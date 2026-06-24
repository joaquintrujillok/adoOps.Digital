/**
 * Extracción estructurada con OpenAI (function calling).
 * Convierte la transcripción del reporte de terreno en:
 *  - registro estructurado (6 categorías del documento de campo)
 *  - resumen ejecutivo
 *  - hoja(s) de trabajo accionables
 * Usa una "function/tool" para forzar salida JSON con esquema fijo.
 */
import OpenAI from "openai";
import type { FieldExtraction, WorkSheetItem } from "@/db/schema";

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

export type ExtractionResult = {
  extraction: FieldExtraction;
  executiveSummary: string;
  incidencias: string[];
  hectareas: number | null;
  workSheet: WorkSheetItem[];
};

const PARAMETERS = {
  type: "object" as const,
  properties: {
    identificacion: {
      type: "object",
      properties: {
        cliente: { type: ["string", "null"], description: "Campo / predio / cliente" },
        sector: { type: ["string", "null"] },
        cuarteles: { type: "array", items: { type: "string" } },
        fecha: { type: ["string", "null"], description: "Fecha del reporte si se menciona" },
        responsable: { type: ["string", "null"], description: "Supervisor o técnico a cargo" },
        equipo: { type: ["string", "null"], description: "Equipo o cuadrilla involucrada" },
      },
      required: ["cliente", "sector", "cuarteles", "fecha", "responsable", "equipo"],
    },
    actividad: {
      type: "object",
      properties: {
        tipoTrabajo: { type: ["string", "null"] },
        avancePct: { type: ["number", "null"], description: "Avance del día en %" },
        unidadesRevisadas: {
          type: ["string", "null"],
          description: "Hectáreas/hileras/plantas/colmenas/trampas revisadas",
        },
        estadoTarea: {
          type: ["string", "null"],
          enum: ["iniciada", "en_curso", "terminada", "pendiente", null],
        },
      },
      required: ["tipoTrabajo", "avancePct", "unidadesRevisadas", "estadoTarea"],
    },
    hallazgos: {
      type: "array",
      items: { type: "string" },
      description: "Problemas observados, incidencias, plagas, clima, accesos, etc.",
    },
    recursos: {
      type: "object",
      properties: {
        personas: { type: ["number", "null"] },
        horas: { type: ["number", "null"] },
        equiposMateriales: { type: "array", items: { type: "string" } },
        insumos: { type: "array", items: { type: "string" } },
      },
      required: ["personas", "horas", "equiposMateriales", "insumos"],
    },
    evidencias: {
      type: "object",
      properties: {
        fotos: { type: ["number", "null"] },
        pendientes: { type: "array", items: { type: "string" } },
        ubicacion: { type: ["string", "null"] },
      },
      required: ["fotos", "pendientes", "ubicacion"],
    },
    proximasAcciones: { type: "array", items: { type: "string" } },
    hectareas: {
      type: ["number", "null"],
      description: "Hectáreas revisadas como número, si aplica",
    },
    incidencias: {
      type: "array",
      items: { type: "string" },
      description: "Lista corta de incidencias clave para alertar en el dashboard",
    },
    resumenEjecutivo: {
      type: "string",
      description: "Resumen ejecutivo de 2-4 frases del reporte",
    },
    hojaDeTrabajo: {
      type: "array",
      description: "Tareas accionables derivadas del reporte (próximas acciones)",
      items: {
        type: "object",
        properties: {
          tarea: { type: "string" },
          responsableSugerido: { type: ["string", "null"] },
          prioridad: { type: "string", enum: ["alta", "media", "baja"] },
          plazo: { type: ["string", "null"] },
          recursos: { type: ["string", "null"] },
          evidenciaRequerida: { type: ["string", "null"] },
        },
        required: ["tarea", "prioridad"],
      },
    },
  },
  required: [
    "identificacion",
    "actividad",
    "hallazgos",
    "recursos",
    "evidencias",
    "proximasAcciones",
    "incidencias",
    "resumenEjecutivo",
    "hojaDeTrabajo",
  ],
};

const SYSTEM = `Eres un asistente que estructura reportes de terreno agrícola/forestal en Chile.
Recibes la transcripción de un audio o mensaje de WhatsApp enviado por un supervisor desde el campo.
Extrae la información en el esquema de la función, sin inventar datos: si algo no se menciona, usa null o lista vacía.
Normaliza el avance a número entero de porcentaje. Deriva la hoja de trabajo SOLO de lo que el reporte sugiere o pide hacer.
Responde siempre llamando a la función 'registrar_reporte_terreno'.`;

export async function extractReport(transcript: string): Promise<ExtractionResult> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Transcripción del reporte de terreno:\n\n"""${transcript}"""`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "registrar_reporte_terreno",
          description:
            "Registra de forma estructurada un reporte de terreno agrícola a partir de la transcripción de un audio/mensaje de WhatsApp.",
          parameters: PARAMETERS,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "registrar_reporte_terreno" },
    },
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    throw new Error("OpenAI no devolvió la estructura esperada");
  }

  const raw = JSON.parse(call.function.arguments) as Record<string, unknown>;

  const extraction: FieldExtraction = {
    identificacion: (raw.identificacion as FieldExtraction["identificacion"]) ?? {
      cliente: null,
      sector: null,
      cuarteles: [],
      fecha: null,
      responsable: null,
      equipo: null,
    },
    actividad: (raw.actividad as FieldExtraction["actividad"]) ?? {
      tipoTrabajo: null,
      avancePct: null,
      unidadesRevisadas: null,
      estadoTarea: null,
    },
    hallazgos: (raw.hallazgos as string[]) ?? [],
    recursos: (raw.recursos as FieldExtraction["recursos"]) ?? {
      personas: null,
      horas: null,
      equiposMateriales: [],
      insumos: [],
    },
    evidencias: (raw.evidencias as FieldExtraction["evidencias"]) ?? {
      fotos: null,
      pendientes: [],
      ubicacion: null,
    },
    proximasAcciones: (raw.proximasAcciones as string[]) ?? [],
  };

  return {
    extraction,
    executiveSummary: (raw.resumenEjecutivo as string) ?? "",
    incidencias: (raw.incidencias as string[]) ?? [],
    hectareas: (raw.hectareas as number | null) ?? null,
    workSheet: (raw.hojaDeTrabajo as WorkSheetItem[]) ?? [],
  };
}
