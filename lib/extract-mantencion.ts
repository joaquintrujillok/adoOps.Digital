/**
 * Extracción estructurada con OpenAI (function calling) para incidencias / mantención.
 * Convierte la transcripción de un audio/mensaje de WhatsApp en:
 *  - incidencia estructurada (equipo, falla, severidad, estado, síntomas, repuestos)
 *  - resumen ejecutivo + alertas
 *  - órdenes de trabajo accionables (tareas con responsable, plazo y repuestos)
 * Usa una "function/tool" para forzar salida JSON con esquema fijo.
 */
import OpenAI from "openai";
import type { IncidenciaExtraction, OrdenItem } from "@/db/schema";

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

export type IncidenciaExtractionResult = {
  extraction: IncidenciaExtraction;
  executiveSummary: string;
  alertas: string[];
  ordenesTrabajo: OrdenItem[];
};

const PARAMETERS = {
  type: "object" as const,
  properties: {
    identificacion: {
      type: "object",
      properties: {
        equipo: { type: ["string", "null"], description: "Equipo, máquina o activo afectado" },
        codigoActivo: { type: ["string", "null"], description: "Código/patente/n° de activo si se menciona" },
        ubicacion: { type: ["string", "null"], description: "Planta, línea, sector o ubicación" },
        reportadoPor: { type: ["string", "null"], description: "Quién reporta la falla" },
        fecha: { type: ["string", "null"] },
      },
      required: ["equipo", "codigoActivo", "ubicacion", "reportadoPor", "fecha"],
    },
    falla: {
      type: "object",
      properties: {
        tipo: { type: ["string", "null"], description: "Tipo de falla (mecánica, eléctrica, hidráulica, etc.)" },
        descripcion: { type: ["string", "null"] },
        severidad: {
          type: ["string", "null"],
          enum: ["critica", "alta", "media", "baja", null],
        },
        estadoEquipo: {
          type: ["string", "null"],
          enum: ["detenido", "operativo_con_riesgo", "operativo", null],
        },
      },
      required: ["tipo", "descripcion", "severidad", "estadoEquipo"],
    },
    sintomas: {
      type: "array",
      items: { type: "string" },
      description: "Síntomas observados: ruidos, fugas, temperatura, vibración, alarmas, etc.",
    },
    impacto: {
      type: ["string", "null"],
      description: "Impacto operativo (producción detenida, horas perdidas, riesgo de seguridad)",
    },
    repuestos: {
      type: "array",
      items: { type: "string" },
      description: "Repuestos o insumos requeridos para reparar",
    },
    alertas: {
      type: "array",
      items: { type: "string" },
      description: "Alertas clave para destacar en el dashboard (seguridad, paro de línea, etc.)",
    },
    resumenEjecutivo: {
      type: "string",
      description: "Resumen ejecutivo de 2-4 frases de la incidencia",
    },
    ordenesTrabajo: {
      type: "array",
      description: "Órdenes de trabajo accionables derivadas de la incidencia",
      items: {
        type: "object",
        properties: {
          tarea: { type: "string" },
          responsableSugerido: { type: ["string", "null"] },
          prioridad: { type: "string", enum: ["alta", "media", "baja"] },
          plazo: { type: ["string", "null"] },
          repuestos: { type: ["string", "null"] },
        },
        required: ["tarea", "prioridad"],
      },
    },
  },
  required: [
    "identificacion",
    "falla",
    "sintomas",
    "impacto",
    "repuestos",
    "alertas",
    "resumenEjecutivo",
    "ordenesTrabajo",
  ],
};

const SYSTEM = `Eres un asistente que estructura reportes de incidencias y mantención de equipos en español (Chile).
Recibes la transcripción de un audio o mensaje de WhatsApp enviado por un operario o técnico que reporta una falla.
Extrae la información en el esquema de la función, sin inventar datos: si algo no se menciona, usa null o lista vacía.
Clasifica la severidad con criterio: 'critica' si hay riesgo de seguridad o línea/planta detenida; 'alta' si el equipo está detenido sin riesgo de personas; 'media' si opera con riesgo; 'baja' si es menor.
Deriva las órdenes de trabajo SOLO de lo que la incidencia sugiere o requiere reparar.
Responde siempre llamando a la función 'registrar_incidencia'.`;

export async function extractIncidencia(transcript: string): Promise<IncidenciaExtractionResult> {
  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Transcripción del reporte de incidencia:\n\n"""${transcript}"""`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "registrar_incidencia",
          description:
            "Registra de forma estructurada una incidencia/falla de equipo a partir de la transcripción de un audio/mensaje de WhatsApp.",
          parameters: PARAMETERS,
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "registrar_incidencia" },
    },
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    throw new Error("OpenAI no devolvió la estructura esperada");
  }

  const raw = JSON.parse(call.function.arguments) as Record<string, unknown>;

  const extraction: IncidenciaExtraction = {
    identificacion: (raw.identificacion as IncidenciaExtraction["identificacion"]) ?? {
      equipo: null,
      codigoActivo: null,
      ubicacion: null,
      reportadoPor: null,
      fecha: null,
    },
    falla: (raw.falla as IncidenciaExtraction["falla"]) ?? {
      tipo: null,
      descripcion: null,
      severidad: null,
      estadoEquipo: null,
    },
    sintomas: (raw.sintomas as string[]) ?? [],
    impacto: (raw.impacto as string | null) ?? null,
    repuestos: (raw.repuestos as string[]) ?? [],
    ordenesTrabajo: (raw.ordenesTrabajo as OrdenItem[]) ?? [],
  };

  return {
    extraction,
    executiveSummary: (raw.resumenEjecutivo as string) ?? "",
    alertas: (raw.alertas as string[]) ?? [],
    ordenesTrabajo: extraction.ordenesTrabajo,
  };
}
