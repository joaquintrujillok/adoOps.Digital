/**
 * Speech-to-text con OpenAI Whisper.
 * Recibe la URL pública del audio (la que devuelve WaSender al desencriptar),
 * lo descarga y lo transcribe.
 */
import OpenAI from "openai";

const STT_MODEL = process.env.STT_MODEL || "gpt-4o-transcribe";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Descarga un audio desde una URL y lo transcribe a texto (español). */
export async function transcribeFromUrl(
  audioUrl: string,
  fileName = "voice.ogg"
): Promise<string> {
  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(`No se pudo descargar el audio: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  // El SDK acepta un File del runtime (Node 20+/Next).
  const file = new File([buf], fileName, {
    type: res.headers.get("content-type") || "audio/ogg",
  });

  const out = await client().audio.transcriptions.create({
    file,
    model: STT_MODEL,
    language: "es",
  });

  return (out.text || "").trim();
}
