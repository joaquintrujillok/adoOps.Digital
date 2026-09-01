/**
 * Speech-to-text con OpenAI.
 * Recibe la URL pública del audio (la que devuelve WaSender al desencriptar),
 * lo descarga y lo transcribe.
 *
 * Decía "con OpenAI Whisper" y hacía años que no era cierto: Whisper quedó
 * atrás y el modelo se elige abajo. Un encabezado que nombra la tecnología
 * equivocada manda a buscar el problema al lugar equivocado.
 */
import OpenAI from "openai";

// `gpt-transcribe` y no `gpt-4o-transcribe`: es el modelo que OpenAI recomienda
// hoy para audio grabado y cuesta US$0,0045 el minuto contra US$0,006, un 25%
// menos. Verificado el 01-09-2026 en developers.openai.com/api/docs/pricing.
//
// El argumento que decide no es el precio —son décimas de centavo por nota de
// voz—: es que el Sistema Tuniche ya se movió a este modelo el 27-08-2026 y
// lleva desde entonces transcribiendo audio real en producción. El default de
// acá era lo único que seguía en la generación anterior, así que esto no
// estrena un modelo, alinea el demo con lo que ya está probado.
const STT_MODEL = process.env.STT_MODEL || "gpt-transcribe";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/**
 * Descarga un audio desde una URL y lo transcribe a texto (español).
 *
 * `modelo` permite que un módulo use uno distinto del default sin arrastrar a
 * los demás. Existe porque esta función la comparten las demos de TorreControl y
 * el Sistema Tuniche, que tienen exigencias distintas: en una demo una palabra
 * mal transcrita es una anécdota, y en Tuniche es el nombre de un agricultor que
 * después no calza con ningún lote.
 */
export async function transcribeFromUrl(
  audioUrl: string,
  fileName = "voice.ogg",
  modelo?: string
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
    model: modelo || STT_MODEL,
    language: "es",
  });

  return (out.text || "").trim();
}
