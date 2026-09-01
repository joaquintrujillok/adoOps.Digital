// Corrección de la transcripción con IA.
//
// Es la pasada que más valor agrega y la más peligrosa, y conviene decir las dos
// cosas juntas.
//
// **Lo que arregla.** El reconocedor de voz de Google se equivoca de forma
// predecible: nombres propios, términos técnicos, palabras que suenan parecido y
// no calzan con la frase. Un modelo que ve el contexto completo arregla casi
// todo eso, porque sabe que en una reunión sobre agricultura "el lote de la
// martilla" es "La Martina".
//
// **Lo que puede romper.** El mismo modelo puede "arreglar" algo que estaba
// bien y cambiarle el sentido a una frase. Por eso este archivo no reemplaza
// nada: escribe en una columna al lado, y la transcripción original queda
// entera. La corrección es una lectura, no la fuente.
//
// ── Las dos defensas del diseño ──────────────────────────────────────────────
//
// 1. SE CORRIGE LÍNEA POR LÍNEA, Y SE CUENTAN LAS LÍNEAS.
//    El modelo devuelve un arreglo de líneas, no un bloque de texto, y si
//    devuelve una cantidad distinta de la que recibió, **se descarta su salida
//    y se conserva el tramo original**. Un modelo que fusiona dos turnos de
//    habla o se come una línea no está corrigiendo: está resumiendo, y ahí ya
//    perdió el que hablaba. Cuántos tramos se descartaron queda guardado.
//
// 2. LOS TRAMOS NO SE ENCADENAN.
//    Cada tramo recibe como contexto el final del tramo anterior **en su
//    versión original**, no en la corregida. Así un error de corrección no se
//    propaga hacia adelante, y de paso los tramos son independientes y se
//    pueden pedir en paralelo.

import OpenAI from "openai";
import { medirUso, type UsoModelo } from "@/lib/reuniones/costo";

const MODEL = process.env.REUNIONES_MODEL || "gpt-4o-mini";

/**
 * Tamaño de tramo, en caracteres.
 *
 * No es una cifra de rendimiento sino de calidad: un tramo tiene que ser lo
 * bastante grande para que el modelo vea de qué se está hablando —esa es toda
 * la ventaja que tiene sobre el reconocedor de voz— y lo bastante chico para
 * que devolver el texto entero corregido quepa holgado en su límite de salida.
 * Seis mil caracteres son unos 1.700 tokens de ida y otros tantos de vuelta.
 */
const TRAMO_CHARS = 6_000;

/** Cuánto del tramo anterior se manda como contexto, sin pedir que se devuelva. */
const CONTEXTO_CHARS = 800;

/**
 * Tramos que se piden a la vez. Cuatro es un equilibrio: una reunión de una hora
 * son unos ocho tramos, así que sale en dos vueltas, y no se le tiran veinte
 * peticiones simultáneas a la API por una sola reunión.
 */
const EN_PARALELO = 4;

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export type ResultadoCorreccion = {
  texto: string;
  /** Tramos cuya corrección se descartó por no calzar en cantidad de líneas. */
  tramosSinCorregir: number;
  usos: UsoModelo[];
};

const SYSTEM = `Corriges transcripciones automáticas de reuniones en español de Chile.

El texto que recibes lo generó el reconocedor de voz de Google Meet. Tiene tres tipos de error, y son los únicos que debes tocar:
1. PALABRAS MAL RECONOCIDAS. Sobre todo nombres de personas, empresas, lugares y términos técnicos. Si una palabra no calza con el contexto de la frase, casi seguro está mal reconocida.
2. PUNTUACIÓN Y MAYÚSCULAS. El reconocedor puntúa mal y corta frases donde no va. Arréglalo para que se pueda leer.
3. TARTAMUDEOS DEL RECONOCEDOR. Palabras repetidas de corrido que son artefacto del reconocimiento, no de la persona.

Reglas absolutas:
- NO resumas. NO acortes. NO reformules ideas. El resultado tiene que decir lo mismo, con las mismas palabras salvo las que estaban mal.
- NO inventes contenido que no esté. Si una frase quedó incompleta porque la persona se cortó, déjala incompleta.
- NO cambies el nombre del hablante ni la marca de tiempo que aparecen al principio de una línea. Corrige solo lo que se dijo.
- Si una línea ya está bien, devuélvela EXACTAMENTE igual.

Sobre las palabras que no reconoces, que es donde más te vas a equivocar:
- Si no estás seguro de una palabra, DÉJALA COMO ESTÁ, tal cual, sin tocar. Una palabra mal reconocida que queda mal reconocida es un error del reconocedor; una que "corriges" mal es un error tuyo, y ese es peor porque suena convincente y nadie lo va a revisar.
- NO partas una palabra rara en dos palabras que conoces. Si aparece una palabra que no reconoces, es una palabra que no conoces: no la conviertas en dos palabras comunes solo porque juntas suenan parecido.
- NO conviertas una palabra en sigla poniéndola en mayúsculas. Si dice "itos" y no sabes qué es, déjalo "itos"; no lo escribas "ITOS".
- Si te dan una lista de vocabulario conocido, esa lista manda: cuando una palabra mal reconocida se parece a un término de la lista, usa el de la lista. Fuera de la lista, abstente.
- Cuando uses un término del vocabulario, escríbelo EXACTAMENTE como aparece en la lista, respetando sus mayúsculas y su acentuación.

Devuelves SIEMPRE la misma cantidad de líneas que recibes, en el mismo orden, llamando a la función 'devolver_lineas'. Una línea de entrada, una línea de salida. Si recibes 23 líneas, devuelves 23.`;

/**
 * Vocabulario propio, desde `REUNIONES_GLOSARIO` (términos separados por comas).
 *
 * **Es lo que hace que la corrección sirva de verdad**, y se descubrió
 * probándola en producción: con el glosario vacío, un nombre propio que el
 * reconocedor había partido en dos palabras comunes salió "corregido" como esas
 * dos palabras comunes, y una palabra a la que le faltaba una letra salió
 * convertida en sigla, en mayúsculas. El modelo no se abstuvo: armó algo
 * plausible con las palabras que sí conocía, que es la forma más dañina de
 * equivocarse porque el resultado se lee bien y nadie lo va a revisar.
 *
 * Los nombres propios de un negocio no están en el mundo del modelo. Dárselos es
 * barato —viajan en cada tramo, son unas decenas de tokens— y convierte una
 * adivinanza en un calce.
 *
 * **Qué va acá lo decide quien usa el módulo**, no este archivo: son los nombres
 * de SU gente, SUS clientes y SU jerga. Sembrarlo con vocabulario de otro
 * proyecto del repositorio sería meterle a sus reuniones palabras que no tienen
 * nada que ver, y hacer que el corrector empuje hacia ellas.
 */
function glosario(): string[] {
  return (process.env.REUNIONES_GLOSARIO ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

const PARAMETERS = {
  type: "object" as const,
  properties: {
    lineas: {
      type: "array",
      items: { type: "string" },
      description:
        "Las líneas corregidas, en el mismo orden y en la misma cantidad que las recibidas.",
    },
  },
  required: ["lineas"],
};

/** Parte las líneas en tramos de a lo más TRAMO_CHARS caracteres. */
function tramosDe(lineas: string[]): string[][] {
  const tramos: string[][] = [];
  let actual: string[] = [];
  let largo = 0;

  for (const linea of lineas) {
    // Una línea sola más larga que el tramo entero se manda igual: partirla por
    // la mitad rompería una frase, que es justo lo que hay que evitar.
    if (actual.length > 0 && largo + linea.length > TRAMO_CHARS) {
      tramos.push(actual);
      actual = [];
      largo = 0;
    }
    actual.push(linea);
    largo += linea.length + 1;
  }
  if (actual.length > 0) tramos.push(actual);
  return tramos;
}

async function corregirTramo(
  tramo: string[],
  contexto: string,
  cabecera: string,
): Promise<{ lineas: string[] | null; uso: UsoModelo }> {
  const numeradas = tramo.map((l, i) => `${i + 1}\t${l}`).join("\n");

  const partes = [cabecera];
  if (contexto) {
    partes.push(
      `Contexto: así terminaba el tramo anterior. NO lo devuelvas, es solo para que entiendas de qué se venía hablando.\n"""${contexto}"""`,
    );
  }
  partes.push(
    `Corrige estas ${tramo.length} líneas. Vienen numeradas para que puedas contarlas; el número NO forma parte de la línea y no debe aparecer en tu respuesta.\n\n${numeradas}`,
  );

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
          name: "devolver_lineas",
          description: "Devuelve las líneas corregidas, una por cada línea recibida.",
          parameters: PARAMETERS,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "devolver_lineas" } },
  });

  const uso = medirUso(completion.model || MODEL, completion.usage);
  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") return { lineas: null, uso };

  try {
    const raw = JSON.parse(call.function.arguments) as { lineas?: unknown };
    const lineas = raw.lineas;
    // La defensa 1: si no calza la cantidad, no sirve. Ver la cabecera.
    if (!Array.isArray(lineas) || lineas.length !== tramo.length) {
      return { lineas: null, uso };
    }
    return { lineas: lineas.map((l) => String(l)), uso };
  } catch {
    return { lineas: null, uso };
  }
}

export async function corregirTranscripcion(
  transcripcion: string,
  contexto?: { titulo?: string | null; participantes?: string[] },
): Promise<ResultadoCorreccion> {
  const lineas = transcripcion.split("\n");
  const tramos = tramosDe(lineas);

  const cabeceraPartes: string[] = [];
  if (contexto?.titulo) cabeceraPartes.push(`Título de la reunión: ${contexto.titulo}`);
  if (contexto?.participantes?.length)
    cabeceraPartes.push(`Personas que hablaron: ${contexto.participantes.join(", ")}`);

  // Los nombres de quienes hablaron entran al vocabulario junto con el glosario:
  // si en la reunión habló Camila Rojas, "camila roja" en el texto es ella.
  const vocabulario = [...new Set([...(contexto?.participantes ?? []), ...glosario()])];
  if (vocabulario.length) {
    cabeceraPartes.push(
      `Vocabulario conocido de este equipo. Si una palabra mal reconocida se parece a alguno de estos términos, es ese término. Fuera de esta lista, abstente:\n${vocabulario.join(", ")}`,
    );
  }

  const cabecera = cabeceraPartes.join("\n\n");

  // El contexto de cada tramo sale del tramo anterior ORIGINAL. Ver la
  // defensa 2 en la cabecera de este archivo.
  const contextos = tramos.map((_, i) =>
    i === 0 ? "" : tramos[i - 1].join("\n").slice(-CONTEXTO_CHARS),
  );

  const salida: (string[] | null)[] = new Array(tramos.length).fill(null);
  const usos: UsoModelo[] = [];

  for (let i = 0; i < tramos.length; i += EN_PARALELO) {
    const lote = tramos.slice(i, i + EN_PARALELO);
    const resultados = await Promise.all(
      lote.map((tramo, j) => corregirTramo(tramo, contextos[i + j], cabecera)),
    );
    resultados.forEach((r, j) => {
      salida[i + j] = r.lineas;
      usos.push(r.uso);
    });
  }

  let tramosSinCorregir = 0;
  const finales = tramos.map((tramo, i) => {
    if (salida[i]) return salida[i]!;
    tramosSinCorregir++;
    return tramo;
  });

  return {
    texto: finales.flat().join("\n"),
    tramosSinCorregir,
    usos,
  };
}
