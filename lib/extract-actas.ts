/**
 * Extracción estructurada con OpenAI (function calling) para actas de reunión.
 * Convierte la transcripción de un audio/mensaje de WhatsApp en:
 *  - acta estructurada (reunión, temas, decisiones, compromisos, riesgos)
 *  - resumen ejecutivo
 *  - compromisos accionables (tareas con responsable y plazo)
 * Usa una "function/tool" para forzar salida JSON con esquema fijo.
 */
import OpenAI from "openai";
import type { ActaExtraction, CompromisoItem } from "@/db/schema";

const MODEL = process.env.EXTRACT_MODEL || "gpt-4o-mini";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export type ActaExtractionResult = {
  extraction: ActaExtraction;
  executiveSummary: string;
  decisiones: string[];
  compromisos: CompromisoItem[];
};

const PARAMETERS = {
  type: "object" as const,
  properties: {
    reunion: {
      type: "object",
      properties: {
        titulo: { type: ["string", "null"], description: "Título o motivo de la reunión" },
        fecha: { type: ["string", "null"], description: "Fecha de la reunión si se menciona" },
        lugar: { type: ["string", "null"], description: "Lugar o canal (sala, Meet, Teams, etc.)" },
        participantes: { type: "array", items: { type: "string" } },
        duracion: { type: ["string", "null"] },
      },
      required: ["titulo", "fecha", "lugar", "participantes", "duracion"],
    },
    temas: {
      type: "array",
      items: { type: "string" },
      description: "Temas o puntos tratados en la reunión",
    },
    decisiones: {
      type: "array",
      items: { type: "string" },
      description: "Decisiones o acuerdos tomados",
    },
    compromisos: {
      type: "array",
      description: "Compromisos accionables: quién hace qué y para cuándo",
      items: {
        type: "object",
        properties: {
          compromiso: { type: "string" },
          responsable: { type: ["string", "null"] },
          prioridad: { type: "string", enum: ["alta", "media", "baja"] },
          plazo: { type: ["string", "null"] },
        },
        required: ["compromiso", "prioridad"],
      },
    },
    riesgos: {
      type: "array",
      items: { type: "string" },
      description: "Riesgos, bloqueos o temas pendientes de resolver",
    },
    proximaReunion: {
      type: ["string", "null"],
      description: "Fecha o referencia de la próxima reunión, si se menciona",
    },
    resumenEjecutivo: {
      type: "string",
      description: "Resumen ejecutivo de 2-4 frases de la reunión",
    },
  },
  required: [
    "reunion",
    "temas",
    "decisiones",
    "compromisos",
    "riesgos",
    "proximaReunion",
    "resumenEjecutivo",
  ],
};

const SYSTEM = `Eres un asistente que estructura actas de reunión en español (Chile).
Recibes la transcripción de un audio o mensaje de WhatsApp donde alguien relata, de forma desordenada, lo que se conversó en una reunión.
Extrae la información en el esquema de la función, sin inventar datos: si algo no se menciona, usa null o lista vacía.
Distingue claramente entre decisiones (lo que se acordó) y compromisos (tareas con responsable y plazo).
Deriva los compromisos SOLO de lo que la reunión asignó o pidió hacer.
Responde siempre llamando a la función 'registrar_acta'.`;

export async function extractActa(transcript: string): Promise<ActaExtractionResult> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Transcripción de la reunión:\n\n"""${transcript}"""`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "registrar_acta",
          description:
            "Registra de forma estructurada un acta de reunión a partir de la transcripción de un audio/mensaje de WhatsApp.",
          parameters: PARAMETERS,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "registrar_acta" },
    },
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    throw new Error("OpenAI no devolvió la estructura esperada");
  }

  const raw = JSON.parse(call.function.arguments) as Record<string, unknown>;

  const extraction: ActaExtraction = {
    reunion: (raw.reunion as ActaExtraction["reunion"]) ?? {
      titulo: null,
      fecha: null,
      lugar: null,
      participantes: [],
      duracion: null,
    },
    temas: (raw.temas as string[]) ?? [],
    decisiones: (raw.decisiones as string[]) ?? [],
    compromisos: (raw.compromisos as CompromisoItem[]) ?? [],
    riesgos: (raw.riesgos as string[]) ?? [],
    proximaReunion: (raw.proximaReunion as string | null) ?? null,
  };

  return {
    extraction,
    executiveSummary: (raw.resumenEjecutivo as string) ?? "",
    decisiones: extraction.decisiones,
    compromisos: extraction.compromisos,
  };
}
