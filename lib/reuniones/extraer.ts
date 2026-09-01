// Resumen y extracción estructurada de una reunión, con OpenAI (function calling).
//
// Es el primo de `lib/extract-actas.ts` y comparte la técnica —una función con
// esquema fijo para forzar JSON válido— pero **no el prompt**, porque la
// entrada es de otra naturaleza y confundirlas produce resúmenes malos:
//
//   `extract-actas.ts` recibe a alguien *relatando* una reunión por WhatsApp:
//   texto corto, ordenado por quien lo cuenta, ya interpretado.
//
//   Este recibe la transcripción *literal*: una hora de habla cruda, con
//   muletillas, frases cortadas, gente que se pisa, y errores del reconocedor
//   de voz de Google. Nadie lo ordenó antes. El trabajo de separar la señal del
//   ruido es de este prompt, no de la persona.
//
// Por eso acá hay dos reglas que allá no hacen falta: no confundir "lo tiramos
// para la próxima semana" dicho al pasar con un compromiso, y no atribuirle a
// alguien algo que no dijo. El transcript trae nombres reales, así que una
// atribución inventada no es un error de formato: es ponerle a una persona una
// tarea que nadie le pidió.

import OpenAI from "openai";
import type { ExtraccionReunion } from "@/db/reuniones";
import { medirUso, type UsoModelo } from "@/lib/reuniones/costo";

// Variable propia y no la de actas, por la misma razón que `lib/stt.ts` acepta
// un modelo por módulo: cambiar el modelo del demo de TorreControl no debería
// cambiar el de las reuniones internas del equipo.
const MODEL = process.env.REUNIONES_MODEL || "gpt-4o-mini";

/**
 * Tope de caracteres que se le manda al modelo.
 *
 * Una reunión de una hora son unos 45.000 caracteres, así que esto solo se
 * activa ante algo anómalo —una sesión de todo el día, o un transcript que se
 * duplicó—. Se corta por el final y se avisa en el prompt: es preferible un
 * resumen de las primeras tres horas, marcado como parcial, que un error 400
 * de contexto excedido que deja la reunión sin resumen.
 */
const MAX_CARACTERES = 240_000;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export type ResultadoExtraccion = {
  extraccion: ExtraccionReunion;
  resumen: string;
  /** Tokens y dólares de esta llamada. Se guardan con la reunión. */
  uso: UsoModelo;
};

const PARAMETERS = {
  type: "object" as const,
  properties: {
    resumenEjecutivo: {
      type: "string",
      description:
        "Resumen de 3 a 6 frases: de qué se trató la reunión y en qué quedó. Escrito para alguien que no estuvo.",
    },
    temas: {
      type: "array",
      items: { type: "string" },
      description: "Los temas que efectivamente se trataron, en el orden en que aparecieron.",
    },
    decisiones: {
      type: "array",
      items: { type: "string" },
      description:
        "Lo que quedó decidido. Solo si hubo acuerdo explícito; una idea que se discutió y no se cerró NO es una decisión.",
    },
    compromisos: {
      type: "array",
      description:
        "Tareas concretas que alguien se llevó. Solo si en el transcript alguien las asumió o se las asignaron.",
      items: {
        type: "object",
        properties: {
          compromiso: { type: "string" },
          responsable: {
            type: ["string", "null"],
            description:
              "El nombre tal como aparece en el transcript. null si no quedó claro quién.",
          },
          prioridad: { type: "string", enum: ["alta", "media", "baja"] },
          plazo: { type: ["string", "null"], description: "Solo si se dijo. null si no." },
        },
        required: ["compromiso", "responsable", "prioridad", "plazo"],
      },
    },
    riesgos: {
      type: "array",
      items: { type: "string" },
      description: "Bloqueos, dudas sin resolver o cosas que alguien marcó como problema.",
    },
    proximaReunion: {
      type: ["string", "null"],
      description: "Cuándo se vuelven a juntar, si se mencionó. null si no.",
    },
  },
  required: [
    "resumenEjecutivo",
    "temas",
    "decisiones",
    "compromisos",
    "riesgos",
    "proximaReunion",
  ],
};

const SYSTEM = `Eres un asistente que resume reuniones de trabajo en español de Chile.

Recibes la TRANSCRIPCIÓN LITERAL de una reunión, generada por el reconocedor de voz automático de Google Meet. Eso implica tres cosas que debes dar por hechas:
- El texto tiene muletillas, frases cortadas y repeticiones. Ignóralas.
- Hay palabras mal transcritas, sobre todo nombres propios y términos técnicos. Si una palabra no calza con el contexto, probablemente está mal reconocida: no construyas una conclusión sobre ella.
- Cada línea empieza con el nombre de quien habló. Úsalo para atribuir, nunca lo inventes.

Reglas que no se negocian:
1. NO inventes. Si algo no se dijo, la lista va vacía o el campo va en null.
2. Una DECISIÓN es un acuerdo explícito ("ya, lo hacemos así"). Un tema que se conversó sin cerrar no es una decisión: va en temas, o en riesgos si quedó trabado.
3. Un COMPROMISO tiene a alguien que lo asumió. "Habría que revisar eso" no es un compromiso de nadie. Si no quedó claro quién, responsable va en null; NO lo asignes al que habló más.
4. El responsable se escribe con el nombre tal como aparece en la transcripción.
5. Escribe en español de Chile, directo, sin relleno. Nada de "en esta reunión se discutieron diversos temas".

Responde siempre llamando a la función 'registrar_reunion'.`;

export async function extraerReunion(
  transcripcion: string,
  contexto?: { titulo?: string | null; participantes?: string[] },
): Promise<ResultadoExtraccion> {
  const recortada = transcripcion.length > MAX_CARACTERES;
  const texto = recortada ? transcripcion.slice(0, MAX_CARACTERES) : transcripcion;

  const encabezado: string[] = [];
  if (contexto?.titulo) encabezado.push(`Título de la reunión: ${contexto.titulo}`);
  if (contexto?.participantes?.length)
    encabezado.push(`Personas que hablaron: ${contexto.participantes.join(", ")}`);
  if (recortada)
    encabezado.push(
      "AVISO: la transcripción venía muy larga y está cortada. Resume solo lo que recibes y no supongas el final.",
    );

  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `${encabezado.join("\n")}\n\nTranscripción:\n\n"""${texto}"""`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "registrar_reunion",
          description:
            "Registra el resumen estructurado de una reunión a partir de su transcripción literal.",
          parameters: PARAMETERS,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "registrar_reunion" } },
  });

  // El uso se mide antes de validar la respuesta: si el modelo contestó
  // cualquier cosa, los tokens igual se pagaron. Un error que no queda
  // registrado como gasto es un gasto que no aparece en ninguna suma.
  const uso = medirUso(completion.model || MODEL, completion.usage);

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    throw new Error("OpenAI no devolvió la estructura esperada");
  }

  const raw = JSON.parse(call.function.arguments) as Record<string, unknown>;

  // Se normaliza campo por campo en vez de confiar en el esquema. El modelo
  // cumple el contrato casi siempre, y "casi siempre" acá significa una
  // pantalla que revienta al mapear undefined.
  const extraccion: ExtraccionReunion = {
    temas: (raw.temas as string[]) ?? [],
    decisiones: (raw.decisiones as string[]) ?? [],
    compromisos: (raw.compromisos as ExtraccionReunion["compromisos"]) ?? [],
    riesgos: (raw.riesgos as string[]) ?? [],
    proximaReunion: (raw.proximaReunion as string | null) ?? null,
  };

  return { extraccion, resumen: (raw.resumenEjecutivo as string) ?? "", uso };
}
