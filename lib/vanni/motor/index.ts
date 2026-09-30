// Motor de WhatsApp de Vanni: la puerta de entrada de cada mensaje.
//
// **Tres entradas, un número.** La campaña la empujamos nosotros; el cupón lo
// pide el cliente desde el QR de la sala; y todo lo demás es alguien que le
// escribe a Vanni para comprar. El orden de decisión es:
//
//   0. QR de la sala ("Quiero mi descuento Vanni (sala X)") → captura: permiso,
//      RUT y cupón (ver `captura.ts`), mientras dure esa conversación.
//   1. Cupón ("quiero mi cupón (código VN-…)") → su cupón vigente.
//   2. Respuesta a una campaña con el hilo abierto → `ofertas`. Abierto =
//      recibió la campaña hace menos de 14 días y todavía no dijo OK, no, ni
//      BAJA. Una vez cerrado, lo que escriba ya no es respuesta a la campaña.
//   3. Todo lo demás → tienda. Sin llave: quien escribe "necesito servilletas"
//      quiere comprar.
//
// Llaves internas, para el simulador y los ensayos (no se le muestran a nadie):
// `#Ofertas` simula que al teléfono le llegó la campaña vigente;
// `#tienda-whatsapp` fuerza la tienda; `#salir` cierra la sesión.
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
import { capturaPorCodigo, capturaPorTelefono, marcarWhatsApp } from "../captura";
import { cuponDeCaptura, cuponPorCodigo, estadoEfectivo, urlQrCupon } from "../cupones";
import { envioReciente, responderOfertas } from "./ofertas";
import { CAPTURA_VIGENTE_MS, iniciarCaptura, LLAVE_SALA, responderCaptura } from "./captura";
import { responderTienda } from "./tienda";
import type { Salida } from "./tipos";

export const LLAVE_OFERTAS = /#\s*ofertas?\b/i;
export const LLAVE_TIENDA = /#\s*tienda(?:[-\s_]*whats?app)?\b/i;
export const LLAVE_SALIR = /#\s*salir\b/i;
/**
 * Alguien que ya tiene cupón y lo vuelve a pedir ("quiero mi cupón (código
 * VN-…)"), o `#descuento` escrito a mano: se le reenvía el suyo.
 */
export const LLAVE_DESCUENTO = /#\s*(descuento|cup[oó]n)\b|(aplicar|activar|usar|canjear)\s+(mi\s+)?descuento|(quiero|mandame|m[aá]ndame|env[ií]ame)\s+(mi\s+)?cup[oó]n/i;

/** Órdenes que solo tienen sentido en la tienda. */
const ORDEN_TIENDA = /^(agregar|quitar|carrito|pagar|confirmar|comprar|finalizar|estado|categor[ií]as?)\b/i;

const SESION_VIGENTE_MS = 7 * 86_400_000;


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
  return { campana, envio, texto, imagenUrl: campana.imagenUrl };
}

/**
 * Llegó desde el QR de la sala (fase 1: cupón para canjear en caja).
 *
 * El código del mensaje identifica el cupón; si no viene, se busca el cupón de
 * la última captura de este teléfono. La respuesta es la imagen del QR del
 * cupón, para que quede guardado en el chat y se muestre en caja. No entra a la
 * tienda: la compra por WhatsApp es la fase 2 y depende de la pasarela de pago.
 */
async function entrarPorDescuento(telefono: string, texto: string, nombrePush: string | null): Promise<Salida[]> {
  const codigo = texto.match(/c[oó]digo\s*:?\s*(VN-?[A-Z0-9]{5}|[A-Z0-9]{5,8})/i)?.[1];
  let cupon = codigo && /^VN/i.test(codigo) ? await cuponPorCodigo(codigo) : null;
  const captura = !cupon ? ((codigo ? await capturaPorCodigo(codigo) : null) ?? (await capturaPorTelefono(telefono))) : null;
  if (!cupon && captura) cupon = await cuponDeCaptura(captura.id);
  if (cupon?.capturaId) await marcarWhatsApp(cupon.capturaId);
  else if (captura) await marcarWhatsApp(captura.id);

  const contacto = await contactoDe(telefono);
  const nombre = (cupon?.nombre ?? contacto?.nombre ?? nombrePush ?? "").trim().split(/\s+/)[0] || null;
  await guardarSesion({ telefono, flujo: "ofertas", contactoId: contacto?.id ?? null, estado: { carrito: [] } });

  if (!cupon) {
    return [
      {
        texto:
          `¡Hola${nombre ? `, ${nombre}` : ""}! No encontré un cupón asociado a este número. ` +
          "Escanea el QR de la sala e ingresa tu RUT para obtener el tuyo. 🎁",
      },
    ];
  }
  const estado = estadoEfectivo(cupon);
  if (estado !== "vigente") {
    const motivo = { canjeado: "ya fue usado", anulado: "fue anulado", vencido: "está vencido" }[estado];
    return [{ texto: `Tu cupón *${cupon.codigo}* ${motivo}. Si crees que es un error, respóndenos por aquí.` }];
  }
  const vence = cupon.venceAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
  return [
    {
      imagenUrl: urlQrCupon(cupon.token),
      texto:
        `¡Listo${nombre ? `, ${nombre}` : ""}! 🎁 Este es tu cupón: *${cupon.descuento}*\n` +
        `Código *${cupon.codigo}* · válido hasta el ${vence}.\n\n` +
        "Muestra este QR en caja en cualquier sucursal Vanni y te aplicamos el descuento.",
    },
  ];
}

async function decidir(e: Entrada, telefono: string): Promise<{ flujo: Flujo | "sistema"; salidas: Salida[] }> {
  const texto = e.texto.trim();
  const simulado = Boolean(e.simulado);

  if (LLAVE_SALIR.test(texto)) {
    await cerrarSesion(telefono);
    return { flujo: "sistema", salidas: [{ texto: "Listo, cerré la conversación. Si necesitas algo, escríbenos cuando quieras. 👋" }] };
  }

  const sesion = await leerSesion(telefono);
  const sesionViva = sesion && Date.now() - new Date(sesion.actualizadaAt).getTime() < SESION_VIGENTE_MS;

  // 1. Captura en sala: el mensaje que deja escrito el QR, y sus respuestas.
  if (LLAVE_SALA.test(texto)) {
    return { flujo: "captura", salidas: await iniciarCaptura(telefono, texto) };
  }
  if (
    sesion?.flujo === "captura" &&
    sesion.estado?.captura &&
    Date.now() - new Date(sesion.actualizadaAt).getTime() < CAPTURA_VIGENTE_MS
  ) {
    return {
      flujo: "captura",
      salidas: await responderCaptura({ telefono, texto, estado: sesion.estado.captura, nombrePush: e.nombre ?? null }),
    };
  }

  // Llaves
  if (LLAVE_DESCUENTO.test(texto)) {
    return { flujo: "ofertas", salidas: await entrarPorDescuento(telefono, texto, e.nombre ?? null) };
  }
  if (LLAVE_OFERTAS.test(texto)) {
    const contacto = await asegurarContacto(telefono, e.nombre ?? null);
    if (contacto.estado === "baja") {
      return { flujo: "ofertas", salidas: [{ texto: "Pediste no recibir promociones, así que no te enviaremos ofertas. Si quieres comprar, escríbenos lo que buscas." }] };
    }
    const inicio = await iniciarOfertas(telefono, contacto, simulado);
    if (!inicio) {
      return { flujo: "sistema", salidas: [{ texto: "Por ahora no hay una campaña activa. Escríbenos lo que buscas y te ayudamos a comprar." }] };
    }
    return { flujo: "ofertas", salidas: [{ texto: inicio.texto, imagenUrl: inicio.imagenUrl }] };
  }
  if (LLAVE_TIENDA.test(texto)) {
    const contacto = await contactoDe(telefono);
    return {
      flujo: "tienda",
      salidas: await responderTienda({ telefono, texto, contacto, nombrePush: e.nombre ?? null, estado: { carrito: [] }, simulado }),
    };
  }

  // 2. Respuesta a una campaña, mientras el hilo siga abierto. Una orden de la
  // tienda ("agregar 1 x 10", "pagar") nunca es respuesta a la promoción.
  const hilo = ORDEN_TIENDA.test(texto)
    ? null
    : await hiloDeCampana(telefono, sesionViva && sesion.flujo === "ofertas" ? sesion.campanaId : null);
  if (hilo) {
    return {
      flujo: "ofertas",
      salidas: await responderOfertas({ telefono, texto, contacto: hilo.contacto, campana: hilo.campana, envioId: hilo.envioId, simulado }),
    };
  }

  // 3. Todo lo demás: la tienda. Si ya venía comprando, con su carrito.
  const contacto = await contactoDe(telefono);
  return {
    flujo: "tienda",
    salidas: await responderTienda({
      telefono,
      texto,
      contacto,
      nombrePush: e.nombre ?? null,
      estado: sesionViva && sesion.flujo === "tienda" ? estadoTienda(sesion) : { carrito: [] },
      simulado,
    }),
  };
}

/**
 * La campaña a la que este mensaje responde, si el hilo sigue abierto: la de su
 * sesión, o la que recibió en los últimos 14 días. Cerrado = ya hay un resultado
 * que termina la conversación (dijo OK, no, BAJA o hizo un reclamo). Una duda
 * sobre la promoción ("pregunta") lo deja abierto.
 */
async function hiloDeCampana(telefono: string, campanaSesion: number | null | undefined) {
  const contacto = await contactoDe(telefono);
  if (!contacto) return null;
  const campanaId = campanaSesion ?? (await envioReciente(telefono))?.campana.id;
  if (!campanaId) return null;
  const [fila] = await db
    .select({ envio: vanniEnvios, campana: vanniCampanas })
    .from(vanniEnvios)
    .innerJoin(vanniCampanas, eq(vanniCampanas.id, vanniEnvios.campanaId))
    .where(and(eq(vanniEnvios.campanaId, campanaId), eq(vanniEnvios.contactoId, contacto.id)))
    .limit(1);
  if (!fila) return null;
  if (fila.envio.resultado && fila.envio.resultado !== "pregunta") return null;
  return { contacto, campana: fila.campana, envioId: fila.envio.id };
}

export async function procesarMensaje(e: Entrada): Promise<SalidaEnviada[]> {
  const telefono = normalizarTelefono(e.telefono);
  if (!telefono || !e.texto.trim()) return [];

  // El entrante se guarda antes de decidir: el historial que lee el modelo
  // tiene que incluir lo que se le acaba de decir.
  const flujoPrevio = (await leerSesion(telefono))?.flujo as Flujo | undefined;
  const flujoEntrada: Flujo | "sistema" = LLAVE_SALA.test(e.texto)
    ? "captura"
    : LLAVE_TIENDA.test(e.texto)
    ? "tienda"
    : LLAVE_OFERTAS.test(e.texto) || LLAVE_DESCUENTO.test(e.texto)
      ? "ofertas"
      : (flujoPrevio ?? "tienda");
  const nuevo = await guardarMensaje({
    telefono,
    flujo: flujoEntrada,
    direccion: "in",
    texto: e.texto.trim(),
    simulado: e.simulado,
    waMsgId: e.waMsgId ?? null,
  });
  // Mismo mensaje entregado dos veces por el webhook: ya lo está respondiendo
  // la otra llamada. El índice único de `wa_msg_id` hace que solo una gane.
  if (!nuevo) return [];

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
