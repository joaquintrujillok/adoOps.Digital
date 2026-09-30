// Flujo de campaña: la respuesta de un cliente inactivo a la promoción que le enviamos.
//
// El agente no vende ni cotiza. El mensaje de la campaña pide un OK; con el OK
// (o cualquier señal de interés) se deriva a la ejecutiva y el hilo se cierra:
// no se piden productos ni cantidades, eso lo conversa la ejecutiva al llamar.
// Todo lo que no sea la promoción (precios, stock, medidas) también se deriva:
// el agente nunca inventa condiciones.
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
import { proximaAtencion } from "../horario";
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
  accion: "responder" | "derivar" | "baja" | "cerrar";
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
  simulado: boolean;
}

// ─── Reglas ──────────────────────────────────────────────────────────────────

const R = {
  // "BAJA" sola es lo que pide el mensaje de la campaña.
  baja: /^\W*baja\W*$|\b(de\s*baja|darme de baja|no me (escriban|env[ií]en|manden|contacten|molesten)|dejen de|stop|desuscrib|elimin(a|en)me|borr(a|en)me)/i,
  reclamo: /(reclamo|queja|p[eé]simo|mal servicio|nunca lleg|me cobraron|devoluci|problema con (mi|el) (pedido|despacho|producto))/i,
  noInteresa: /^(no|nop|nope|no gracias|no por ahora|ahora no|no me interesa|no, gracias)\b|no me interesa|no necesito/i,
  precio: /(precio|cu[aá]nto (sale|cuesta|vale|es)|valor|stock|disponib|lista de precios)/i,
  interes:
    /\b(s[ií]+p?o?|me interesa|interesad|quiero|dale|de una|ok[a-z]*|oki|bueno|claro|ya|ya po|listo|ll[aá]m(en|ame|ar|enme)|cont[aá]ct|cotiz|necesito|me sirve|perfecto|genial|bac[aá]n|me tinca)\b|👍|🙌|👌/i,
  pregunta: /(\?|c[oó]mo|hasta cu[aá]ndo|condiciones|aplica|v[aá]lid|qu[eé] (incluye|productos))/i,
};

export function decidirConReglas(texto: string): Decision {
  const t = texto.trim();
  const base = { interes: null, resumen: null, respuesta: null };
  if (R.baja.test(t)) return { ...base, intencion: "baja", accion: "baja" };
  if (R.reclamo.test(t)) return { ...base, intencion: "reclamo", accion: "derivar", interes: t };
  if (R.noInteresa.test(t)) return { ...base, intencion: "no_interesado", accion: "cerrar" };
  if (R.precio.test(t)) return { ...base, intencion: "precio_stock", accion: "derivar", interes: t };
  // Un OK basta: no se pregunta qué necesita, eso lo ve la ejecutiva al llamar.
  if (R.interes.test(t)) return { ...base, intencion: "interesado", accion: "derivar", interes: t.split(/\s+/).length >= 3 ? t : null };
  if (R.pregunta.test(t)) return { ...base, intencion: "pregunta", accion: "responder" };
  return { ...base, intencion: "otro", accion: "responder" };
}

// ─── Modelo ──────────────────────────────────────────────────────────────────

const SISTEMA = `Eres el asistente de WhatsApp de Vanni Chile, distribuidora de envases, desechables y artículos de aseo.
Le escribiste a un cliente que hace tiempo no compra, con una promoción. Ahora respondió.

Tu trabajo es decidir qué hacer con su respuesta y redactar tu mensaje. Reglas firmes:
- Solo puedes ofrecer la promoción de la campaña, con sus condiciones. Nunca inventes precios, descuentos, stock ni plazos.
- El mensaje de la campaña le pidió responder OK para que una ejecutiva lo llame. Cualquier aceptación o señal de interés ("ok", "oka", "ya", "sí", "dale", "me interesa", un 👍, o decir qué producto necesita) es accion "derivar". NUNCA preguntes qué productos, cantidades o medidas necesita: eso lo conversa la ejecutiva.
- Si pregunta precios, stock, medidas, gramajes o algo que no está en las condiciones: accion "derivar" con intencion "precio_stock".
- Si tiene un reclamo: accion "derivar" con intencion "reclamo". No ofrezcas nada.
- Si no le interesa: accion "cerrar", agradece y no insistas.
- Si pide no ser contactado o escribe "baja": accion "baja".
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
      "\n" +
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
            accion: { type: "string", enum: ["responder", "derivar", "baja", "cerrar"] },
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

  // Fuera del horario de atención no se promete una llamada inmediata: al
  // cliente se le dice cuándo, y a la ejecutiva, que llegó fuera de horario.
  const cuando = proximaAtencion();

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
      fueraDeHorario: cuando,
    });
    await db
      .update(vanniOportunidades)
      .set({ notificadaAt: new Date() })
      .where(eq(vanniOportunidades.id, oportunidadId));
  }

  const quien = primerNombre(ejecutiva?.nombre);
  const nombre = primerNombre(ctx.contacto.nombre);
  if (tipo === "reclamo") {
    return `Lamento lo que pasó${nombre ? `, ${nombre}` : ""}. Le paso tu caso a ${quien ? `*${quien}*` : "una ejecutiva"} para que te contacte y lo resuelva.`;
  }
  // Sin género: el nombre de la cuenta puede ser de cualquiera del equipo.
  const ejecutivaDe = quien ? `*${quien}*, del equipo comercial de Vanni,` : null;
  if (cuando) {
    return (
      `¡Perfecto${nombre ? `, ${nombre}` : ""}! 🙌 Recibimos tu OK. Nuestro horario de atención ya terminó, así que ` +
      `${ejecutivaDe ?? "alguien del equipo comercial de Vanni"} te llamará ${cuando} para aplicar tu *${ctx.campana.promocion}*.\n¡Gracias por preferirnos!`
    );
  }
  return (
    `¡Perfecto${nombre ? `, ${nombre}` : ""}! 🙌 ${ejecutivaDe ?? "Alguien del equipo comercial de Vanni"} ` +
    `te llamará dentro de las próximas 24 horas para aplicar tu *${ctx.campana.promocion}*.\n¡Gracias por preferirnos!`
  );
}

/** La oportunidad que ya se abrió con este cliente en esta campaña, si la hay. */
async function oportunidadAbierta(ctx: Contexto) {
  const [o] = await db
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
  return o ?? null;
}

export async function responderOfertas(ctx: Contexto): Promise<Salida[]> {
  const nombre = primerNombre(ctx.contacto.nombre);

  // Ya dio el OK: el hilo está cerrado. Lo que escriba se suma a la ficha para
  // la ejecutiva (sin volver a sonarle el teléfono) y el bot no pregunta nada.
  const abierta = R.baja.test(ctx.texto.trim()) ? null : await oportunidadAbierta(ctx);
  if (abierta) {
    const resumen = [abierta.resumen, ctx.texto.trim()].filter(Boolean).join(" · ").slice(0, 1000);
    await db
      .update(vanniOportunidades)
      .set({ resumen, updatedAt: new Date() })
      .where(eq(vanniOportunidades.id, abierta.id));
    await guardarSesion({
      telefono: ctx.telefono,
      flujo: "ofertas" satisfies Flujo,
      contactoId: ctx.contacto.id,
      campanaId: ctx.campana.id,
      estado: { carrito: [] },
    });
    return [{ texto: `Anotado${nombre ? `, ${nombre}` : ""} 👍 Se lo paso a tu ejecutiva para que lo vean cuando te llame.` }];
  }

  let d: Decision;
  // La baja no pasa por el modelo: tiene que funcionar siempre, igual.
  const usarModelo = !R.baja.test(ctx.texto.trim()) && hayModelo() && (await hayPresupuesto());
  try {
    d = usarModelo ? await decidirConModelo(ctx) : decidirConReglas(ctx.texto);
  } catch (err) {
    console.error("[vanni] decisión con modelo falló, uso reglas", err);
    d = decidirConReglas(ctx.texto);
  }

  let texto: string;

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
    default:
      await marcarEnvio(ctx.envioId, "pregunta");
      texto =
        d.respuesta ||
        `La promoción es: *${ctx.campana.promocion}*.${ctx.campana.condiciones ? `\n${ctx.campana.condiciones}` : ""}\nSi te interesa, responde *OK* y una ejecutiva te llama dentro de 24 horas.`;
  }

  await guardarSesion({
    telefono: ctx.telefono,
    flujo: "ofertas" satisfies Flujo,
    contactoId: ctx.contacto.id,
    campanaId: ctx.campana.id,
    estado: { carrito: [] },
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
