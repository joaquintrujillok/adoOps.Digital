// Flujo `#Ofertas`: la respuesta de un cliente inactivo a la campaña.
//
// El agente no vende ni cotiza. Hace tres cosas, que son las del deck:
// detectar interés, responder lo que la promoción permite y derivar a la
// ejecutiva con el contexto. Todo lo que no sea la promoción (precios, stock,
// descuentos distintos) se deriva: el agente nunca inventa condiciones.
//
// La decisión tiene dos fuentes que devuelven la misma forma (`Decision`): el
// modelo, cuando hay llave y presupuesto, y reglas por palabras cuando no. El
// resto del flujo no sabe cuál de las dos decidió.

import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniCampanas,
  vanniContactos,
  vanniEnvios,
  vanniOportunidades,
  type VanniCampana,
  type VanniContacto,
} from "@/db/vanni";
import { cliente, hayModelo, hayPresupuesto, MODELO, registrarUso } from "../llm";
import { avisarEjecutiva, ejecutivaPara } from "../notificar";
import { guardarSesion, historial, type Flujo } from "./conversacion";
import type { Salida } from "./tipos";

export type Intencion =
  | "interesado"
  | "pregunta"
  | "precio_stock"
  | "no_interesado"
  | "baja"
  | "reclamo"
  | "otro";

export interface Decision {
  intencion: Intencion;
  /** `derivar` crea la oportunidad y avisa a la ejecutiva. */
  accion: "responder" | "preguntar_detalle" | "derivar" | "baja" | "cerrar";
  interes: string | null;
  resumen: string | null;
  /** Texto para el cliente. En `derivar` se reemplaza por una confirmación fija. */
  respuesta: string | null;
}

interface Contexto {
  telefono: string;
  texto: string;
  contacto: VanniContacto;
  campana: VanniCampana;
  envioId: number | null;
  esperandoDetalle: boolean;
  simulado: boolean;
}

// ─── Reglas ──────────────────────────────────────────────────────────────────

const R = {
  baja: /\b(de\s*baja|darme de baja|no me (escriban|env[ií]en|manden|contacten|molesten)|dejen de|stop|desuscrib|elimin(a|en)me|borr(a|en)me)/i,
  reclamo: /(reclamo|queja|p[eé]simo|mal servicio|nunca lleg|me cobraron|devoluci|problema con (mi|el) (pedido|despacho|producto))/i,
  noInteresa: /^(no|nop|nope|no gracias|no por ahora|ahora no|no me interesa|no, gracias)\b|no me interesa|no necesito/i,
  precio: /(precio|cu[aá]nto (sale|cuesta|vale|es)|valor|stock|disponib|lista de precios)/i,
  interes: /\b(s[ií]|si+|me interesa|interesad|quiero|dale|ok|okay|bueno|claro|ll[aá]m(en|ame|ar)|cont[aá]ct|cotiz|necesito|me sirve|perfecto|genial)\b/i,
  pregunta: /(\?|c[oó]mo|hasta cu[aá]ndo|condiciones|aplica|v[aá]lid|qu[eé] (incluye|productos))/i,
};

export function decidirConReglas(texto: string, esperandoDetalle: boolean): Decision {
  const t = texto.trim();
  const base = { interes: null, resumen: null, respuesta: null };
  if (R.baja.test(t)) return { ...base, intencion: "baja", accion: "baja" };
  if (R.reclamo.test(t)) return { ...base, intencion: "reclamo", accion: "derivar", interes: t };
  if (R.noInteresa.test(t)) return { ...base, intencion: "no_interesado", accion: "cerrar" };
  if (R.precio.test(t)) return { ...base, intencion: "precio_stock", accion: "derivar", interes: t };
  // Ya se le preguntó qué necesita: lo que conteste ahora es el detalle.
  if (esperandoDetalle) return { ...base, intencion: "interesado", accion: "derivar", interes: t };
  if (R.interes.test(t)) {
    // "Sí" a secas no dice qué necesita; una frase larga probablemente sí.
    const conDetalle = t.split(/\s+/).length >= 5;
    return conDetalle
      ? { ...base, intencion: "interesado", accion: "derivar", interes: t }
      : { ...base, intencion: "interesado", accion: "preguntar_detalle" };
  }
  if (R.pregunta.test(t)) return { ...base, intencion: "pregunta", accion: "responder" };
  return { ...base, intencion: "otro", accion: "responder" };
}

// ─── Modelo ──────────────────────────────────────────────────────────────────

const SISTEMA = `Eres el asistente de WhatsApp de Vanni Chile, distribuidora de envases, desechables y artículos de aseo.
Le escribiste a un cliente que hace tiempo no compra, con una promoción. Ahora respondió.

Tu trabajo es decidir qué hacer con su respuesta y redactar tu mensaje. Reglas firmes:
- Solo puedes ofrecer la promoción de la campaña, con sus condiciones. Nunca inventes precios, descuentos, stock ni plazos.
- Si pregunta precios, stock o algo que no está en las condiciones: deriva a la ejecutiva ("precio_stock", accion "derivar").
- Si muestra interés pero no dijo qué necesita y todavía no se lo preguntaste: accion "preguntar_detalle" y pregunta qué productos o cantidades le interesan.
- Si muestra interés y ya dijo qué necesita (o ya se le preguntó): accion "derivar".
- Si tiene un reclamo: accion "derivar" con intencion "reclamo". No ofrezcas nada.
- Si no le interesa: accion "cerrar", agradece y no insistas.
- Si pide no ser contactado: accion "baja".
- Si pregunta por la promoción y las condiciones lo responden: accion "responder".
Estilo: español de Chile, cordial y breve (máximo 3 líneas), tuteo. Formato WhatsApp: *negrita* con un asterisco, nunca ## ni **.`;

async function decidirConModelo(ctx: Contexto): Promise<Decision> {
  const previo = await historial(ctx.telefono, 10);
  const conversacion = previo.map((m) => `${m.rol === "cliente" ? "Cliente" : "Vanni"}: ${m.texto}`).join("\n");

  const r = await cliente().responses.create({
    model: MODELO,
    instructions: SISTEMA,
    input:
      `Cliente: ${ctx.contacto.nombre ?? "sin nombre"}${ctx.contacto.categoriaHabitual ? ` (compraba ${ctx.contacto.categoriaHabitual})` : ""}\n` +
      `Promoción: ${ctx.campana.promocion}\n` +
      `Condiciones: ${ctx.campana.condiciones ?? "no hay condiciones adicionales escritas"}\n` +
      `¿Ya se le preguntó qué necesita?: ${ctx.esperandoDetalle ? "sí" : "no"}\n\n` +
      `Conversación hasta ahora:\n${conversacion}\n\nÚltimo mensaje del cliente: """${ctx.texto}"""`,
    tools: [
      {
        type: "function",
        name: "decidir",
        description: "Registra qué hacer con la respuesta del cliente.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            intencion: {
              type: "string",
              enum: ["interesado", "pregunta", "precio_stock", "no_interesado", "baja", "reclamo", "otro"],
            },
            accion: { type: "string", enum: ["responder", "preguntar_detalle", "derivar", "baja", "cerrar"] },
            interes: { type: ["string", "null"], description: "Qué le interesa, en sus palabras. null si no aplica." },
            resumen: { type: ["string", "null"], description: "La conversación en una o dos líneas, para la ejecutiva." },
            respuesta: { type: "string", description: "Tu mensaje para el cliente." },
          },
          required: ["intencion", "accion", "interes", "resumen", "respuesta"],
        },
      },
    ],
    tool_choice: { type: "function", name: "decidir" },
  });

  await registrarUso(r.usage?.input_tokens ?? 0, r.usage?.output_tokens ?? 0);
  const llamada = r.output.find((i) => i.type === "function_call");
  if (!llamada || llamada.type !== "function_call") throw new Error("El modelo no devolvió la decisión");
  return JSON.parse(llamada.arguments) as Decision;
}

// ─── Efectos ─────────────────────────────────────────────────────────────────

function primerNombre(nombre: string | null | undefined): string {
  return (nombre ?? "").trim().split(/\s+/)[0] || "";
}

async function marcarEnvio(envioId: number | null, resultado: string): Promise<void> {
  if (!envioId) return;
  const [e] = await db.select().from(vanniEnvios).where(eq(vanniEnvios.id, envioId));
  if (!e) return;
  // El resultado más fuerte gana: una baja o un interés no se pisan con una pregunta posterior.
  const peso: Record<string, number> = { pregunta: 1, no_interesado: 2, reclamo: 3, interesado: 3, baja: 4 };
  const nuevo = (peso[resultado] ?? 0) >= (peso[e.resultado ?? ""] ?? 0) ? resultado : e.resultado;
  await db
    .update(vanniEnvios)
    .set({ resultado: nuevo, respondioAt: e.respondioAt ?? new Date() })
    .where(eq(vanniEnvios.id, envioId));
}

async function derivar(ctx: Contexto, d: Decision): Promise<string> {
  const tipo = d.intencion === "reclamo" ? "reclamo" : "interes";
  const ejecutiva = await ejecutivaPara(ctx.campana.ejecutivaId ?? ctx.contacto.ejecutivaId);

  const [abierta] = await db
    .select()
    .from(vanniOportunidades)
    .where(
      and(
        eq(vanniOportunidades.contactoId, ctx.contacto.id),
        eq(vanniOportunidades.campanaId, ctx.campana.id),
        eq(vanniOportunidades.estado, "por_llamar"),
      ),
    )
    .limit(1);

  const interes = d.interes ?? ctx.texto;
  const previo = await historial(ctx.telefono, 6);
  const resumen =
    d.resumen ??
    previo
      .filter((m) => m.rol === "cliente")
      .map((m) => m.texto)
      .join(" · ")
      .slice(0, 400);

  let oportunidadId: number;
  if (abierta) {
    await db
      .update(vanniOportunidades)
      .set({ interes, resumen, tipo, updatedAt: new Date() })
      .where(eq(vanniOportunidades.id, abierta.id));
    oportunidadId = abierta.id;
  } else {
    const [nueva] = await db
      .insert(vanniOportunidades)
      .values({
        contactoId: ctx.contacto.id,
        campanaId: ctx.campana.id,
        envioId: ctx.envioId,
        ejecutivaId: ejecutiva?.id ?? null,
        tipo,
        interes,
        resumen,
        ejemplo: ctx.contacto.ejemplo,
      })
      .returning({ id: vanniOportunidades.id });
    oportunidadId = nueva.id;
  }

  // Un aviso por oportunidad: si el cliente agrega detalle, se actualiza la
  // ficha pero no se le vuelve a sonar el teléfono a la ejecutiva.
  if (!abierta?.notificadaAt && !ctx.simulado) {
    await avisarEjecutiva(ejecutiva, {
      tipo,
      oportunidadId,
      nombreCliente: ctx.contacto.razonSocial || ctx.contacto.nombre || "Cliente sin nombre",
      telefonoCliente: ctx.telefono,
      interes,
      resumen,
      campana: ctx.campana.nombre,
      sucursal: ctx.contacto.sucursal,
    });
    await db
      .update(vanniOportunidades)
      .set({ notificadaAt: new Date() })
      .where(eq(vanniOportunidades.id, oportunidadId));
  }

  const quien = primerNombre(ejecutiva?.nombre) || "una ejecutiva";
  const nombre = primerNombre(ctx.contacto.nombre);
  if (tipo === "reclamo") {
    return `Lamento lo que pasó${nombre ? `, ${nombre}` : ""}. Le paso tu caso a *${quien}* para que te contacte y lo resuelva hoy.`;
  }
  return `¡Buenísimo${nombre ? `, ${nombre}` : ""}! Le paso tus datos a *${quien}*, del equipo de Vanni, y te va a llamar para ayudarte con eso. 🙌`;
}

export async function responderOfertas(ctx: Contexto): Promise<Salida[]> {
  let d: Decision;
  const usarModelo = hayModelo() && (await hayPresupuesto());
  try {
    d = usarModelo ? await decidirConModelo(ctx) : decidirConReglas(ctx.texto, ctx.esperandoDetalle);
  } catch (err) {
    console.error("[vanni] decisión con modelo falló, uso reglas", err);
    d = decidirConReglas(ctx.texto, ctx.esperandoDetalle);
  }

  const nombre = primerNombre(ctx.contacto.nombre);
  let texto: string;
  let esperandoDetalle = false;

  switch (d.accion) {
    case "baja":
      await db
        .update(vanniContactos)
        .set({ estado: "baja", bajaAt: new Date(), updatedAt: new Date() })
        .where(eq(vanniContactos.id, ctx.contacto.id));
      await marcarEnvio(ctx.envioId, "baja");
      texto = "Listo, no te volveremos a escribir. Si algún día nos necesitas, escríbenos por aquí. 👋";
      break;
    case "cerrar":
      await marcarEnvio(ctx.envioId, "no_interesado");
      texto =
        d.respuesta ||
        `Gracias por contarnos${nombre ? `, ${nombre}` : ""}. No te molestamos más con esta promoción; si necesitas algo, escríbenos por aquí.`;
      break;
    case "derivar":
      await marcarEnvio(ctx.envioId, d.intencion === "reclamo" ? "reclamo" : "interesado");
      texto = await derivar(ctx, d);
      break;
    case "preguntar_detalle":
      await marcarEnvio(ctx.envioId, "interesado");
      esperandoDetalle = true;
      texto =
        d.respuesta ||
        `¡Qué bueno${nombre ? `, ${nombre}` : ""}! ¿Qué productos o cantidades te interesan? Así la ejecutiva te llama con todo listo.`;
      break;
    default:
      await marcarEnvio(ctx.envioId, "pregunta");
      texto =
        d.respuesta ||
        `La promoción es: *${ctx.campana.promocion}*.${ctx.campana.condiciones ? `\n${ctx.campana.condiciones}` : ""}\n¿Te interesa que una ejecutiva te contacte?`;
  }

  await guardarSesion({
    telefono: ctx.telefono,
    flujo: "ofertas" satisfies Flujo,
    contactoId: ctx.contacto.id,
    campanaId: ctx.campana.id,
    estado: { carrito: [], esperandoDetalle },
  });
  return [{ texto }];
}

// ─── Contexto ────────────────────────────────────────────────────────────────

/** La campaña de la que viene este teléfono: la de su envío más reciente (14 días). */
export async function envioReciente(telefono: string) {
  const desde = new Date(Date.now() - 14 * 86_400_000);
  const [e] = await db
    .select({ envio: vanniEnvios, campana: vanniCampanas })
    .from(vanniEnvios)
    .innerJoin(vanniCampanas, eq(vanniCampanas.id, vanniEnvios.campanaId))
    .where(and(eq(vanniEnvios.telefono, telefono), eq(vanniEnvios.estado, "enviado"), gte(vanniEnvios.createdAt, desde)))
    .orderBy(desc(vanniEnvios.createdAt))
    .limit(1);
  return e ?? null;
}

export type { Contexto as ContextoOfertas };
