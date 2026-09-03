// Transcribe un tramo de audio de una sesión en vivo.
//
// ── Por qué por tramos y no en tiempo real ───────────────────────────────────
//
// La versión anterior usaba `gpt-live-transcribe` sobre una sesión WebRTC:
// texto en menos de un segundo, US$0,017 el minuto, **US$1,02 la hora**. Se pagó
// una reunión real a ese precio y el número dejó claro el error de diseño: se
// estaba pagando una prima por latencia que después se tiraba a la basura,
// porque el copiloto razona cada 20 segundos igual.
//
// `gpt-transcribe` cuesta US$0,0045 el minuto —un 73% menos— y entrega el texto
// de un archivo. Con tramos de 20 segundos la cadencia del texto es la misma a
// la que el copiloto ya trabajaba. No es un modelo nuevo para este repo: es el
// que el Sistema Tuniche usa en producción desde el 27-08-2026.
//
// ── Por qué el tramo anterior viaja como `prompt` ────────────────────────────
//
// Cortar cada 20 segundos parte una frase por la mitad, y el modelo que recibe
// el tramo siguiente no tiene forma de saber de qué se venía hablando. El
// parámetro `prompt` de la API existe justamente para eso: se le manda la cola
// del texto anterior como contexto. No se transcribe de nuevo —no se paga dos
// veces— pero el modelo entra sabiendo el tema, que es donde se juega acertar
// los nombres propios.

import OpenAI from "openai";
import { sumarCostoVivo, USD_POR_MINUTO_ESCUCHA } from "@/lib/reuniones/vivo";
import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";
// Un tramo de 20 segundos se transcribe en pocos segundos. Sesenta es margen
// amplio para un pico de latencia sin dejar colgada la cadencia de la pantalla.
export const maxDuration = 60;

/** El modelo recomendado por OpenAI para audio grabado. Ver la cabecera. */
const MODELO = process.env.REUNIONES_MODELO_ESCUCHA || "gpt-transcribe";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

export async function POST(req: Request) {
  const sesion = await getSession();
  if (!sesion) return Response.json({ error: "No autenticado" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "falta el audio" }, { status: 400 });
  }

  const clave = String(form.get("clave") ?? "").trim();
  const segundos = Number(form.get("segundos") ?? 0);
  const contexto = String(form.get("contexto") ?? "").slice(-400);

  try {
    const salida = await client().audio.transcriptions.create({
      file: audio,
      model: MODELO,
      language: "es",
      // La cola del tramo anterior. No se transcribe de nuevo: solo orienta.
      ...(contexto ? { prompt: contexto } : {}),
    });

    const texto = (salida.text || "").trim();

    // El costo se acumula por tramo y no por duración total de la reunión: los
    // tramos en silencio no llegan hasta acá, así que una reunión con pausas
    // largas cuesta de verdad menos, y la cifra guardada lo refleja.
    const costoUsd = (segundos / 60) * USD_POR_MINUTO_ESCUCHA;
    if (clave && segundos > 0) await sumarCostoVivo(clave, costoUsd);

    return Response.json({ texto, costoUsd });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
