// El motor del copiloto: contexto y preguntas, mientras la reunión ocurre.
//
// ── Por qué es incremental, y por qué eso lo cambia todo ─────────────────────
//
// La forma ingenua es mandarle al modelo toda la transcripción acumulada cada
// vez. Anda bien los primeros cinco minutos y se degrada sola: a la hora, cada
// pasada arrastra trece mil tokens, cuesta cada vez más, tarda cada vez más, y
// el modelo tiene que releer la reunión entera para decir algo que ya había
// dicho.
//
// Acá cada pasada recibe **el contexto ya construido más lo último que se dijo**,
// y devuelve el contexto actualizado. Costo y latencia constantes, sin importar
// si la reunión lleva diez minutos o dos horas. El contexto es la memoria; el
// transcript completo se guarda, pero no se re-razona.
//
// ── Por qué las preguntas no traen id ────────────────────────────────────────
//
// Si el modelo inventara identificadores, habría que confiar en que los repite
// igual entre pasadas, y no lo hace. Las pendientes van numeradas 1..n en el
// prompt, el modelo responde con números, y **los identificadores los asigna
// este código**. El modelo opina; el estado lo lleva el servidor.
//
// ── Sobre marcar una pregunta como hecha ─────────────────────────────────────
//
// No se busca la pregunta literal en el texto: nadie pregunta con las palabras
// que le sugirió una pantalla. Se le pide al modelo que juzgue si el TEMA de la
// pregunta ya se tocó. Se equivoca a veces, y por eso la pantalla deja marcarla
// y desmarcarla a mano: acá la persona sabe más que el modelo.

import OpenAI from "openai";
import { medirUso, type UsoModelo } from "@/lib/reuniones/costo";

/**
 * El modelo del copiloto, aparte del de corrección.
 *
 * Es el trabajo más difícil de los tres que hace este módulo —leer intención en
 * una conversación a medio terminar— y el único donde un modelo mejor
 * probablemente se nota. Se deja en `gpt-4o-mini` porque es el que está probado
 * en este repo con llamada de función forzada, y se cambia por variable de
 * entorno sin tocar código.
 */
const MODEL = process.env.REUNIONES_MODELO_COPILOTO || "gpt-4o-mini";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Lo que el copiloto entiende de la reunión hasta este segundo. */
export type ContextoReunion = {
  /** De qué se está hablando ahora. Una frase. */
  tema: string;
  /** Qué parece querer la otra parte. Null mientras no se pueda afirmar. */
  objetivo: string | null;
  /** Lo que quedó establecido. Hechos, no interpretaciones. */
  puntosClave: string[];
  /** Dudas, objeciones, riesgos: dónde está la fricción. */
  tensiones: string[];
};

export type PreguntaSugerida = {
  id: string;
  pregunta: string;
  /** Por qué conviene hacerla ahora. Es lo que permite descartarla rápido. */
  porQue: string;
  estado: "pendiente" | "hecha";
};

export type EstadoCopiloto = {
  contexto: ContextoReunion;
  preguntas: PreguntaSugerida[];
};

export const CONTEXTO_VACIO: ContextoReunion = {
  tema: "",
  objetivo: null,
  puntosClave: [],
  tensiones: [],
};

/**
 * Cuántas preguntas pendientes se muestran a la vez.
 *
 * Seis, y el límite es del diseño y no del modelo: esto se lee de reojo mientras
 * se habla. Una lista de quince preguntas en una reunión en vivo no se lee, y
 * una que no se lee es peor que ninguna, porque ocupa pantalla y da la sensación
 * de que hay algo pendiente que no se está atendiendo.
 */
const MAX_PENDIENTES = 6;

const PARAMETERS = {
  type: "object" as const,
  properties: {
    contexto: {
      type: "object",
      properties: {
        tema: {
          type: "string",
          description: "De qué se está hablando ahora mismo. Una frase, en presente.",
        },
        objetivo: {
          type: ["string", "null"],
          description:
            "Qué parece querer la otra parte de esta reunión. null si todavía no se puede afirmar sin inventar.",
        },
        puntosClave: {
          type: "array",
          items: { type: "string" },
          description:
            "Lo que quedó establecido: hechos, cifras, restricciones que alguien dijo. No interpretaciones.",
        },
        tensiones: {
          type: "array",
          items: { type: "string" },
          description:
            "Dudas sin resolver, objeciones, desacuerdos, riesgos que alguien levantó.",
        },
      },
      required: ["tema", "objetivo", "puntosClave", "tensiones"],
    },
    preguntasHechas: {
      type: "array",
      items: { type: "integer" },
      description:
        "Números de las preguntas pendientes cuyo tema ya se tocó en el fragmento nuevo. Vacío si ninguna.",
    },
    preguntasNuevas: {
      type: "array",
      description: "Preguntas que convendría hacer ahora. Vacío si no hay ninguna que valga.",
      items: {
        type: "object",
        properties: {
          pregunta: { type: "string", description: "La pregunta, tal como se diría en voz alta." },
          porQue: { type: "string", description: "En media línea, qué se gana preguntándola ahora." },
        },
        required: ["pregunta", "porQue"],
      },
    },
  },
  required: ["contexto", "preguntasHechas", "preguntasNuevas"],
};

const SYSTEM = `Acompañas una reunión de trabajo EN VIVO, en español de Chile. Quien te lee está hablando en este momento y te mira de reojo.

Recibes el contexto que ya construiste, las preguntas que dejaste pendientes, y SOLO lo último que se dijo. Devuelves el contexto actualizado.

Sobre el texto que recibes:
- Viene de un micrófono que capta la sala entera, así que NO sabes quién dijo cada cosa. No lo inventes: escribe "alguien planteó", no "el cliente dijo".
- Es transcripción automática: hay palabras mal reconocidas. Si algo no calza, probablemente esté mal transcrito; no construyas una conclusión sobre eso.
- Está cortado a mitad de la conversación. Una frase incompleta al final es normal.

Sobre el contexto:
- ACTUALÍZALO, no lo reescribas de cero. Lo que ya estaba y sigue siendo cierto se mantiene tal cual.
- puntosClave son HECHOS que alguien dijo. Si nadie dijo un número, no hay número.
- tensiones es donde está la fricción: lo que quedó sin responder, lo que alguien objetó.
- Si el fragmento nuevo no aporta nada —charla, saludos, ruido— devuelve el contexto igual que lo recibiste y ninguna pregunta nueva.

Sobre las preguntas:
- Solo las que sirvan AHORA, en este punto de la conversación. Una pregunta buena en el momento equivocado es una mala pregunta.
- Que se puedan decir en voz alta tal como están escritas. Nada de "indagar sobre el presupuesto": escribe "¿qué presupuesto tienen asignado para esto este año?".
- Prefiere ninguna a una obvia. Quien lee esto ya sabe hacer su trabajo; le sirve lo que se le pasó, no lo que ya iba a preguntar.
- Máximo dos preguntas nuevas por vez.
- Si te dan un vocabulario de productos y soluciones, las preguntas deberían abrir camino hacia eso, sin sonar a venta.

Sobre marcar preguntas como hechas:
- Devuelve el número de una pendiente si su TEMA ya se tocó en el fragmento nuevo, aunque se haya preguntado con otras palabras. Nadie pregunta con las palabras exactas que le sugirieron.
- Ante la duda, NO la marques. Una pregunta que sigue en pantalla molesta; una que desaparece sin haberse hecho se pierde.

Respondes siempre llamando a la función 'actualizar'.`;

export type ResultadoCopiloto = {
  estado: EstadoCopiloto;
  uso: UsoModelo;
};

export async function actualizarCopiloto(params: {
  estado: EstadoCopiloto;
  /** Solo lo dicho desde la pasada anterior. */
  fragmento: string;
  /** Base de conocimiento: qué vende quien está en la reunión. */
  conocimiento?: string;
}): Promise<ResultadoCopiloto> {
  const { estado, fragmento, conocimiento } = params;
  const pendientes = estado.preguntas.filter((p) => p.estado === "pendiente");

  const partes: string[] = [];
  partes.push(`Contexto hasta ahora:\n${JSON.stringify(estado.contexto, null, 1)}`);

  if (pendientes.length) {
    partes.push(
      `Preguntas pendientes:\n${pendientes
        .map((p, i) => `${i + 1}. ${p.pregunta}`)
        .join("\n")}`,
    );
  } else {
    partes.push("Preguntas pendientes: ninguna.");
  }

  if (conocimiento?.trim()) {
    partes.push(`Lo que ofrece quien conduce la reunión:\n${conocimiento.trim()}`);
  }

  partes.push(`Lo último que se dijo:\n"""${fragmento}"""`);

  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: partes.join("\n\n") },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "actualizar",
          description: "Actualiza el contexto de la reunión y las preguntas sugeridas.",
          parameters: PARAMETERS,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "actualizar" } },
  });

  const uso = medirUso(completion.model || MODEL, completion.usage);
  const call = completion.choices[0]?.message?.tool_calls?.[0];

  // Si el modelo no devolvió lo esperado, se conserva el estado anterior en vez
  // de vaciar la pantalla. En vivo, un panel que se borra solo es peor que uno
  // que se quedó quieto veinte segundos.
  if (!call || call.type !== "function") return { estado, uso };

  let raw: {
    contexto?: ContextoReunion;
    preguntasHechas?: number[];
    preguntasNuevas?: { pregunta: string; porQue: string }[];
  };
  try {
    raw = JSON.parse(call.function.arguments);
  } catch {
    return { estado, uso };
  }

  const hechas = new Set((raw.preguntasHechas ?? []).map((n) => Number(n)));
  const preguntas = estado.preguntas.map((p) => {
    if (p.estado !== "pendiente") return p;
    const numero = pendientes.indexOf(p) + 1;
    return hechas.has(numero) ? { ...p, estado: "hecha" as const } : p;
  });

  for (const nueva of (raw.preguntasNuevas ?? []).slice(0, 2)) {
    if (!nueva?.pregunta?.trim()) continue;
    // Sin duplicados literales: el modelo repite la misma pregunta cuando el
    // tema sigue abierto, y verla dos veces en pantalla parece un error.
    const yaEsta = preguntas.some(
      (p) => p.pregunta.trim().toLowerCase() === nueva.pregunta.trim().toLowerCase(),
    );
    if (yaEsta) continue;
    preguntas.push({
      // Id del servidor, no del modelo. Ver la nota de la cabecera.
      id: `p${preguntas.length + 1}-${Date.now().toString(36)}`,
      pregunta: nueva.pregunta.trim(),
      porQue: (nueva.porQue ?? "").trim(),
      estado: "pendiente",
    });
  }

  // Se recortan las pendientes más viejas, no las nuevas: si el copiloto sugirió
  // algo hace veinte minutos y nadie lo preguntó, dejó de ser oportuno.
  const vivas = preguntas.filter((p) => p.estado === "pendiente");
  const sobran = Math.max(0, vivas.length - MAX_PENDIENTES);
  const aDescartar = new Set(vivas.slice(0, sobran).map((p) => p.id));

  return {
    estado: {
      contexto: raw.contexto ?? estado.contexto,
      preguntas: preguntas.filter((p) => !aDescartar.has(p.id)),
    },
    uso,
  };
}
