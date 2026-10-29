// La IA del levantamiento: transcribir, repreguntar y analizar.
//
// Las tres funciones son independientes de cómo llegó la voz. Hoy la entrevista
// graba una respuesta por tema (el patrón del levantamiento del JPL en
// funcionariosmunipaine, probado en producción); si mañana la entrevista pasa a
// ser una conversación continua con la API Realtime, lo que cambia es la
// pantalla, no esto: el análisis lee transcripciones, no audio.
//
// El audio nunca se guarda. Se transcribe al llegar y se descarta.

import OpenAI from "openai";
import {
  ARQUETIPOS,
  NIVELES,
  SOLUCIONES,
  TEMAS,
  cerrarPerfil,
  temaPorId,
  type AnalisisGia,
  type ArquetipoId,
  type Solucion,
  type TemaId,
} from "./modelo";

// Los mismos modelos que el resto del repo ya usa en producción, para no
// estrenar uno en una demo: `gpt-transcribe` es el de `lib/stt.ts` (Tuniche lo
// usa desde el 27-08-2026) y `gpt-5.6-sol` es el de la extracción de Tuniche.
const STT = process.env.GIA_STT_MODEL || process.env.STT_MODEL || "gpt-transcribe";
const MODELO = process.env.GIA_MODEL || "gpt-5.6-sol";
// La repregunta va en el camino crítico —la persona espera en silencio— así
// que usa un modelo rápido. No decide nada: solo nota qué faltó.
const MODELO_RAPIDO = process.env.GIA_MODEL_RAPIDO || "gpt-4o-mini";

let _c: OpenAI | null = null;
function cliente(): OpenAI {
  if (!_c) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _c = new OpenAI({ apiKey });
  }
  return _c;
}

export function modeloAnalisis(): string {
  return MODELO;
}

/** Transcribe una respuesta. La pregunta va como contexto: mejora nombres y siglas. */
export async function transcribir(audio: File, pregunta: string): Promise<string> {
  // Safari graba en mp4 y Chrome en webm; algunos navegadores mandan el tipo
  // con parámetros (`audio/webm;codecs=opus`). La API decide por la extensión.
  const tipo = audio.type.split(";")[0];
  const ext = tipo.includes("mp4") || tipo.includes("m4a") ? "m4a" : tipo.includes("ogg") ? "ogg" : tipo.includes("wav") ? "wav" : "webm";
  const archivo = new File([await audio.arrayBuffer()], `respuesta.${ext}`, { type: tipo || "audio/webm" });
  const out = await cliente().audio.transcriptions.create({
    file: archivo,
    model: STT,
    language: "es",
    prompt: `Entrevista de trabajo a un colaborador de una empresa chilena sobre sus tareas y el uso de inteligencia artificial. Pregunta: ${pregunta}`,
  });
  return (out.text || "").trim();
}

/**
 * Decide si hace falta una repregunta y la escribe. `null` si la respuesta ya
 * cubre lo que el tema busca: una entrevista que repregunta siempre se siente
 * como un formulario.
 */
export async function repreguntar(tema: TemaId, respuesta: string): Promise<string | null> {
  const t = temaPorId(tema);
  if (!t || respuesta.trim().length < 3) return null;
  try {
    const r = await cliente().chat.completions.create({
      model: MODELO_RAPIDO,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un entrevistador amable de una consultora chilena. Haces UNA repregunta breve (máximo 25 palabras), " +
            "tuteando, en español de Chile neutro, sobre lo que la persona acaba de decir. " +
            "Solo repreguntas si falta algo de lo que el tema busca; si la respuesta ya lo cubre, devuelves null. " +
            "Nunca preguntes por datos personales, sueldos, salud ni opiniones sobre personas. " +
            "Pide cifras aproximadas (tiempo, frecuencia) cuando falten. " +
            'Responde JSON: {"repregunta": string | null}.',
        },
        {
          role: "user",
          content: `Tema: ${t.titulo}\nPregunta hecha: ${t.pregunta}\nLo que el tema busca: ${t.busca}\n\nRespuesta de la persona:\n"""${respuesta}"""`,
        },
      ],
    });
    const crudo = JSON.parse(r.choices[0]?.message?.content || "{}") as { repregunta?: unknown };
    const q = typeof crudo.repregunta === "string" ? crudo.repregunta.trim() : "";
    return q.length > 5 ? q : null;
  } catch (e) {
    // Una repregunta que falla no puede trabar la entrevista: se sigue al
    // próximo tema y el análisis trabaja con lo que hay.
    console.error("[gia] repregunta falló", e);
    return null;
  }
}

// ─── Análisis ────────────────────────────────────────────────────────────────

const SISTEMA = `Analizas la entrevista de levantamiento de un colaborador para el Centro de Excelencia de IA de su empresa.

Reglas:
- Extrae SOLO lo que la persona dijo. Si algo no se dijo, déjalo vacío o null. No inventes.
- Las citas son TEXTUALES de la transcripción, cortas (una frase).
- Las cifras de tiempo nunca se omiten. horasMes se calcula de lo dicho (1,5 h diarias ≈ 30 h/mes con 20 días hábiles; 6 h semanales ≈ 24 h/mes). Si no hay cómo estimarlo, null.
- Clasificas por el CONTENIDO de lo que dice y hace, nunca por su forma de hablar.
- La desconfianza o la preocupación por los datos NO es resistencia: suma al arquetipo Guardián.
- La madurez se decide por frecuencia y método de uso observables, no por lo que la persona cree saber.
- Alerta de gobierno: datos de clientes, productores, trabajadores o internos en herramientas personales o no autorizadas; documentos sin orden ni lugar compartido.
- Escribe en español de Chile, claro y respetuoso. La persona va a leer su ficha.

Arquetipos (reparte ${60} puntos entre los seis según la evidencia; el que más tenga es el principal):
${ARQUETIPOS.map((a) => `- ${a.id} (${a.nombre}): ${a.descripcion}. Señales: ${a.senales}`).join("\n")}

Madurez (1 a 5):
${NIVELES.map((n) => `- ${n.n} ${n.nombre}: ${n.criterio}`).join("\n")}

Soluciones posibles para cada tarea:
${Object.entries(SOLUCIONES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}
(gemini: tareas personales de correo, documentos, minutas. gem: tarea de equipo sobre documentos de Drive. agente_proceso: cruza sistemas o actúa. agente_datos: consolida y analiza datos de varias fuentes.)`;

const ARQ_IDS = ARQUETIPOS.map((a) => a.id);
const TEMA_IDS = TEMAS.map((t) => t.id);

const ESQUEMA = {
  type: "object",
  properties: {
    resumen: { type: "string", description: "2 o 3 frases sobre su rol y su relación con la IA." },
    tareas: {
      type: "array",
      description: "Tareas repetitivas mencionadas, de más a menos horas.",
      items: {
        type: "object",
        properties: {
          tarea: { type: "string" },
          frecuencia: { type: "string", description: "diaria, semanal, mensual, varias veces por semana…" },
          horasMes: { type: ["number", "null"] },
          sistemas: { type: "array", items: { type: "string" } },
          solucion: { type: "string", enum: Object.keys(SOLUCIONES) },
          cita: { type: "string" },
        },
        required: ["tarea", "frecuencia", "horasMes", "sistemas", "solucion", "cita"],
      },
    },
    usoIa: {
      type: "object",
      properties: {
        herramientas: { type: "array", items: { type: "string" } },
        frecuencia: { type: "string" },
        cuentaCorporativa: { type: ["boolean", "null"] },
        verificacion: { type: "string", description: "Cómo revisa lo que la IA le entrega. Vacío si no lo dijo." },
      },
      required: ["herramientas", "frecuencia", "cuentaCorporativa", "verificacion"],
    },
    alertas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["datos", "herramienta", "documentos", "otro"] },
          texto: { type: "string" },
          cita: { type: "string" },
        },
        required: ["tipo", "texto", "cita"],
      },
    },
    cambio: {
      type: "object",
      properties: {
        postura: { type: "string", enum: ["entusiasta", "abierta", "cauta", "preocupada"] },
        preocupaciones: { type: "array", items: { type: "string" } },
        ideas: { type: "array", items: { type: "string" } },
        cita: { type: "string" },
      },
      required: ["postura", "preocupaciones", "ideas", "cita"],
    },
    puntos: {
      type: "object",
      description: "Reparto de 60 puntos entre los seis arquetipos.",
      properties: Object.fromEntries(ARQ_IDS.map((id) => [id, { type: "number" }])),
      required: ARQ_IDS,
    },
    madurez: { type: "integer", minimum: 1, maximum: 5 },
    porQueMadurez: { type: "string", description: "Una frase con la evidencia de frecuencia y método." },
    evidencias: {
      type: "array",
      description: "Entre 2 y 4 citas que justifican los arquetipos con más puntos.",
      items: {
        type: "object",
        properties: {
          arquetipo: { type: "string", enum: ARQ_IDS },
          tema: { type: "string", enum: TEMA_IDS },
          cita: { type: "string" },
          lectura: { type: "string", description: "Por qué esa cita apunta a ese arquetipo. Una línea." },
        },
        required: ["arquetipo", "tema", "cita", "lectura"],
      },
    },
    ruta: { type: "string", description: "La ruta sugerida para esta persona: herramienta, formación y un primer caso. Una frase." },
  },
  required: ["resumen", "tareas", "usoIa", "alertas", "cambio", "puntos", "madurez", "porQueMadurez", "evidencias", "ruta"],
};

export interface Turno {
  tema: string;
  ronda: number;
  pregunta: string;
  transcripcion: string;
}

export async function analizar(persona: { nombre: string; cargo: string; gerencia: string }, turnos: Turno[]): Promise<AnalisisGia> {
  const texto = turnos
    .map((t) => `[tema: ${t.tema}${t.ronda ? " · repregunta" : ""}]\nAgente: ${t.pregunta}\n${persona.nombre}: ${t.transcripcion}`)
    .join("\n\n");

  // Responses API con una función obligatoria, igual que la extracción de
  // Tuniche: con modelos de razonamiento, chat.completions rechaza las tools.
  // `strict` apagado porque el esquema usa tipos nulables y enums que el modo
  // estricto no acepta tal cual; lo que vuelve se normaliza abajo.
  const r = await cliente().responses.create({
    model: MODELO,
    instructions: SISTEMA,
    input: `Persona: ${persona.nombre} · ${persona.cargo} · ${persona.gerencia}\n\nTranscripción:\n${texto}`,
    tools: [{ type: "function", name: "registrar_ficha", description: "Registra la ficha de levantamiento de la persona.", parameters: ESQUEMA, strict: false }],
    tool_choice: { type: "function", name: "registrar_ficha" },
  });
  const llamada = r.output.find((i) => i.type === "function_call");
  if (!llamada || llamada.type !== "function_call") throw new Error("El modelo no devolvió la ficha");
  return normalizar(JSON.parse(llamada.arguments) as Record<string, unknown>);
}

// ─── Normalización ───────────────────────────────────────────────────────────
//
// Lo que vuelve del modelo se trata como entrada no confiable: se recorta, se
// valida contra los catálogos y lo que no calza se descarta. Una ficha a la que
// le falta un dato es preferible a una que muestra un enum inventado.

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const strs = (v: unknown, n = 8) => arr(v).map((x) => str(x, 160)).filter(Boolean).slice(0, n);
const uno = <T extends string>(v: unknown, ok: readonly T[], def: T): T => (ok.includes(v as T) ? (v as T) : def);

function normalizar(c: Record<string, unknown>): AnalisisGia {
  const uso = (c.usoIa ?? {}) as Record<string, unknown>;
  const cam = (c.cambio ?? {}) as Record<string, unknown>;
  const perfil = cerrarPerfil((c.puntos ?? {}) as Record<string, unknown>);
  const m = Math.round(Number(c.madurez));
  const madurez = (m >= 1 && m <= 5 ? m : 1) as 1 | 2 | 3 | 4 | 5;
  const solucionesOk = Object.keys(SOLUCIONES) as Solucion[];

  return {
    resumen: str(c.resumen),
    tareas: arr(c.tareas)
      .map((x) => {
        const t = x as Record<string, unknown>;
        const h = Number(t.horasMes);
        return {
          tarea: str(t.tarea, 160),
          frecuencia: str(t.frecuencia, 60),
          horasMes: t.horasMes === null || !Number.isFinite(h) || h <= 0 ? null : Math.round(h),
          sistemas: strs(t.sistemas, 6),
          solucion: uno(t.solucion, solucionesOk, "ninguna"),
          cita: str(t.cita, 300),
        };
      })
      .filter((t) => t.tarea)
      .slice(0, 8),
    usoIa: {
      herramientas: strs(uso.herramientas, 8),
      frecuencia: str(uso.frecuencia, 60),
      cuentaCorporativa: typeof uso.cuentaCorporativa === "boolean" ? uso.cuentaCorporativa : null,
      verificacion: str(uso.verificacion, 300),
    },
    alertas: arr(c.alertas)
      .map((x) => {
        const a = x as Record<string, unknown>;
        return { tipo: uno(a.tipo, ["datos", "herramienta", "documentos", "otro"] as const, "otro"), texto: str(a.texto, 300), cita: str(a.cita, 300) };
      })
      .filter((a) => a.texto)
      .slice(0, 5),
    cambio: {
      postura: uno(cam.postura, ["entusiasta", "abierta", "cauta", "preocupada"] as const, "abierta"),
      preocupaciones: strs(cam.preocupaciones, 5),
      ideas: strs(cam.ideas, 5),
      cita: str(cam.cita, 300),
    },
    perfil: {
      ...perfil,
      madurez,
      porQueMadurez: str(c.porQueMadurez, 300),
      evidencias: arr(c.evidencias)
        .map((x) => {
          const e = x as Record<string, unknown>;
          return {
            arquetipo: uno(e.arquetipo, ARQ_IDS, perfil.principal) as ArquetipoId,
            tema: uno(e.tema, TEMA_IDS, "ia") as TemaId,
            cita: str(e.cita, 300),
            lectura: str(e.lectura, 200),
          };
        })
        .filter((e) => e.cita)
        .slice(0, 4),
    },
    ruta: str(c.ruta, 400),
  };
}
