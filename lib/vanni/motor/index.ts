// Motor de WhatsApp de Vanni: la puerta de entrada de cada mensaje.
//
// **Por qué hay llaves.** Un mismo número atiende dos demos. Sin una regla
// explícita, "sí" podría ser la respuesta a una oferta o a "¿lo agrego al
// carrito?", y el cliente terminaría en el flujo equivocado. El orden de
// decisión es:
//
//   1. Llave en el mensaje → cambia de flujo, siempre.
//        #Ofertas          → campaña de inactivos
//        #tienda-whatsapp  → tienda (también #tienda)
//        #salir            → cierra la sesión
//   2. Sesión vigente (7 días) → sigue en su flujo.
//   3. Recibió una campaña hace menos de 14 días → `ofertas`. Es el caso real:
//      un cliente inactivo que contesta la promoción no escribe ninguna llave.
//   4. Nada de lo anterior → se le explica cómo entrar.
//
// El motor recibe y devuelve texto: no sabe si el mensaje vino de WhatsApp o del
// simulador del backoffice. Enviar es responsabilidad de quien lo llama, salvo
// que se le pida con `enviar: true`.

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniCampanas, vanniContactos, vanniEnvios, vanniVariantes, type VanniContacto } from "@/db/vanni";
import { renderPlantilla } from "../formato";
import { normalizarTelefono } from "../telefono";
import { enviarImagen, enviarTexto } from "../wa";
import { cerrarSesion, estadoTienda, guardarMensaje, guardarSesion, leerSesion, type Flujo } from "./conversacion";
import { envioReciente, responderOfertas } from "./ofertas";
import { responderTienda } from "./tienda";
import type { Salida } from "./tipos";

export const LLAVE_OFERTAS = /#\s*ofertas?\b/i;
export const LLAVE_TIENDA = /#\s*tienda(?:[-\s_]*whats?app)?\b/i;
export const LLAVE_SALIR = /#\s*salir\b/i;

const SESION_VIGENTE_MS = 7 * 86_400_000;

export const MENSAJE_LLAVES =
  "¡Hola! Soy el asistente de *Vanni Chile* por WhatsApp.\n" +
  "Escribe *#tienda-whatsapp* para ver el catálogo y comprar por aquí,\n" +
  "o *#Ofertas* para conocer la promoción vigente.";

export interface Entrada {
  telefono: string;
  texto: string;
  nombre?: string | null;
  waMsgId?: string | null;
  /** Viene del simulador: se guarda y se responde, pero nada sale por WhatsApp. */
  simulado?: boolean;
  /** Enviar las respuestas por WhatsApp (el webhook sí; el simulador no). */
  enviar?: boolean;
}

export interface SalidaEnviada extends Salida {
  ok: boolean;
  error?: string;
}

async function contactoDe(telefono: string): Promise<VanniContacto | null> {
  const [c] = await db.select().from(vanniContactos).where(eq(vanniContactos.telefono, telefono)).limit(1);
  return c ?? null;
}

async function asegurarContacto(telefono: string, nombre: string | null): Promise<VanniContacto> {
  const existente = await contactoDe(telefono);
  if (existente) return existente;
  const [nuevo] = await db
    .insert(vanniContactos)
    // El prefijo 569000 es el de los teléfonos inventados (simulador y datos de
    // ejemplo): quedan marcados y nunca reciben un WhatsApp de campaña.
    .values({ telefono, nombre, origen: "whatsapp", ejemplo: telefono.startsWith("569000") })
    .onConflictDoNothing()
    .returning();
  return nuevo ?? (await contactoDe(telefono))!;
}

/**
 * `#Ofertas` desde un teléfono que no recibió la campaña: se le manda la
 * campaña vigente como si hubiera estado en la base. Es la forma de mostrar el
 * flujo en una reunión sin cargar el teléfono de nadie en una planilla.
 */
async function iniciarOfertas(telefono: string, contacto: VanniContacto, simulado: boolean) {
  const [campana] = await db
    .select()
    .from(vanniCampanas)
    .where(ne(vanniCampanas.estado, "borrador"))
    // Un contacto de ejemplo prefiere la campaña de ejemplo, y uno real la real.
    .orderBy(
      desc(sql`${vanniCampanas.ejemplo} = ${contacto.ejemplo}`),
      desc(vanniCampanas.iniciadaAt),
      desc(vanniCampanas.id),
    )
    .limit(1);
  if (!campana) return null;

  const [variante] = await db
    .select()
    .from(vanniVariantes)
    .where(eq(vanniVariantes.campanaId, campana.id))
    .orderBy(vanniVariantes.codigo)
    .limit(1);
  const texto = renderPlantilla(
    variante?.plantilla ?? "Hola {nombre}, este mes tienes {promocion}. ¿Te interesa que una ejecutiva te contacte?",
    {
      nombre: (contacto.nombre ?? "").split(" ")[0],
      promocion: campana.promocion,
      categoria: contacto.categoriaHabitual ?? "tus productos habituales",
      sucursal: contacto.sucursal,
    },
  );

  // Queda como un envío más de la campaña: el tablero cuenta la demo como un
  // contacto que recibió la promoción, que es lo que efectivamente pasó.
  const [envio] = await db
    .insert(vanniEnvios)
    .values({
      campanaId: campana.id,
      contactoId: contacto.id,
      varianteId: variante?.id ?? null,
      telefono,
      texto,
      estado: "enviado",
      entrega: simulado ? null : "enviado",
      enviadoAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [vanniEnvios.campanaId, vanniEnvios.contactoId],
      set: { texto, estado: "enviado", enviadoAt: new Date(), resultado: null, respondioAt: null },
    })
    .returning();

  await guardarSesion({ telefono, flujo: "ofertas", contactoId: contacto.id, campanaId: campana.id, estado: { carrito: [] } });
  return { campana, envio, texto };
}

async function decidir(e: Entrada, telefono: string): Promise<{ flujo: Flujo | "sistema"; salidas: Salida[] }> {
  const texto = e.texto.trim();
  const simulado = Boolean(e.simulado);

  if (LLAVE_SALIR.test(texto)) {
    await cerrarSesion(telefono);
    return { flujo: "sistema", salidas: [{ texto: "Listo, cerré la conversación. " + MENSAJE_LLAVES }] };
  }

  const sesion = await leerSesion(telefono);
  const sesionViva = sesion && Date.now() - new Date(sesion.actualizadaAt).getTime() < SESION_VIGENTE_MS;

  // 1. Llaves
  if (LLAVE_OFERTAS.test(texto)) {
    const contacto = await asegurarContacto(telefono, e.nombre ?? null);
    if (contacto.estado === "baja") {
      return { flujo: "ofertas", salidas: [{ texto: "Pediste no recibir promociones, así que no te enviaremos ofertas. Si quieres comprar, escribe *#tienda-whatsapp*." }] };
    }
    const inicio = await iniciarOfertas(telefono, contacto, simulado);
    if (!inicio) {
      return { flujo: "sistema", salidas: [{ texto: "Por ahora no hay una campaña activa. Escribe *#tienda-whatsapp* para ver el catálogo." }] };
    }
    return { flujo: "ofertas", salidas: [{ texto: inicio.texto }] };
  }
  if (LLAVE_TIENDA.test(texto)) {
    const contacto = await contactoDe(telefono);
    return {
      flujo: "tienda",
      salidas: await responderTienda({ telefono, texto, contacto, nombrePush: e.nombre ?? null, estado: { carrito: [] }, simulado }),
    };
  }

  // 2. Sesión vigente
  if (sesionViva && sesion.flujo === "tienda") {
    const contacto = await contactoDe(telefono);
    return {
      flujo: "tienda",
      salidas: await responderTienda({ telefono, texto, contacto, nombrePush: e.nombre ?? null, estado: estadoTienda(sesion), simulado }),
    };
  }

  // 2 y 3. Ofertas: por sesión o por haber recibido la campaña.
  const reciente = await envioReciente(telefono);
  if ((sesionViva && sesion.flujo === "ofertas" && sesion.campanaId) || reciente) {
    const contacto = await asegurarContacto(telefono, e.nombre ?? null);
    const campanaId = sesionViva && sesion?.campanaId ? sesion.campanaId : reciente!.campana.id;
    const [campana] = await db.select().from(vanniCampanas).where(eq(vanniCampanas.id, campanaId));
    const [envio] = await db
      .select({ id: vanniEnvios.id })
      .from(vanniEnvios)
      .where(and(eq(vanniEnvios.campanaId, campanaId), eq(vanniEnvios.contactoId, contacto.id)))
      .limit(1);
    if (campana) {
      return {
        flujo: "ofertas",
        salidas: await responderOfertas({
          telefono,
          texto,
          contacto,
          campana,
          envioId: envio?.id ?? null,
          esperandoDetalle: Boolean(sesion?.flujo === "ofertas" && sesion.estado?.esperandoDetalle),
          simulado,
        }),
      };
    }
  }

  // 4. Nadie sabe quién es: se le explica cómo entrar.
  return { flujo: "sistema", salidas: [{ texto: MENSAJE_LLAVES }] };
}

export async function procesarMensaje(e: Entrada): Promise<SalidaEnviada[]> {
  const telefono = normalizarTelefono(e.telefono);
  if (!telefono || !e.texto.trim()) return [];

  // El entrante se guarda antes de decidir: el historial que lee el modelo
  // tiene que incluir lo que se le acaba de decir.
  const flujoPrevio = (await leerSesion(telefono))?.flujo as Flujo | undefined;
  const flujoEntrada: Flujo | "sistema" = LLAVE_TIENDA.test(e.texto)
    ? "tienda"
    : LLAVE_OFERTAS.test(e.texto)
      ? "ofertas"
      : (flujoPrevio ?? "sistema");
  await guardarMensaje({
    telefono,
    flujo: flujoEntrada,
    direccion: "in",
    texto: e.texto.trim(),
    simulado: e.simulado,
    waMsgId: e.waMsgId ?? null,
  });

  const { flujo, salidas } = await decidir(e, telefono);

  const resultado: SalidaEnviada[] = [];
  for (const s of salidas) {
    let ok = true;
    let error: string | undefined;
    let waMsgId: string | null = null;
    let simulado = Boolean(e.simulado) || !e.enviar;
    if (e.enviar && !e.simulado) {
      const r = s.imagenUrl
        ? await enviarImagen(telefono, s.imagenUrl, s.texto)
        : await enviarTexto(telefono, s.texto);
      ok = r.ok;
      error = r.error;
      waMsgId = r.msgId ?? null;
      simulado = r.simulado;
    }
    await guardarMensaje({ telefono, flujo, direccion: "out", texto: s.texto, imagenUrl: s.imagenUrl, simulado, waMsgId });
    resultado.push({ ...s, ok, error });
  }
  return resultado;
}

/** Teléfonos con sesión o envío en curso: lo que usa el simulador para listar conversaciones. */
export async function contactosPorTelefono(telefonos: string[]) {
  if (!telefonos.length) return [];
  return db.select().from(vanniContactos).where(inArray(vanniContactos.telefono, telefonos));
}
