/**
 * Cliente mínimo de WaSenderAPI (https://wasenderapi.com).
 * Sólo lo que necesita la demo: enviar texto y desencriptar audios entrantes.
 */

const BASE = "https://www.wasenderapi.com/api";

function apiKey(): string {
  const k = process.env.WASENDER_API_KEY;
  if (!k) throw new Error("WASENDER_API_KEY no configurada");
  return k;
}

/** Envía un mensaje de texto. Devuelve true si WaSender lo aceptó. */
export async function sendText(to: string, text: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE}/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, text }),
    });
    if (!resp.ok) {
      console.error("WaSender send-message error:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("WaSender send-message exception:", err);
    return false;
  }
}

/** Forma del objeto `data.messages` que llega en el webhook. */
export type WaIncomingMessage = {
  key: {
    id: string;
    fromMe?: boolean;
    remoteJid?: string;
    cleanedSenderPn?: string;
  };
  messageBody?: string;
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    audioMessage?: {
      url: string;
      mediaKey: string;
      mimetype: string;
      fileSha256?: string;
      fileLength?: string | number;
      fileName?: string;
    };
    // Las fotos las agregó el Sistema Tuniche (/tuniche): en una visita a campo
    // la foto no es un adjunto opcional, es parte del reporte —Altué pide una
    // general, una de hembra y una de macho en cada visita—. Es aditivo: la
    // demo de TorreControl no las mira y sigue funcionando igual.
    imageMessage?: {
      url: string;
      mediaKey: string;
      mimetype: string;
      caption?: string;
      fileSha256?: string;
      fileLength?: string | number;
    };
  };
};

/**
 * Pide a WaSender la versión desencriptada de un audio entrante.
 * Devuelve una URL pública temporal (válida ~1h) lista para descargar.
 */
export async function decryptAudio(msg: WaIncomingMessage): Promise<string | null> {
  const audio = msg.message?.audioMessage;
  if (!audio) return null;

  try {
    const resp = await fetch(`${BASE}/decrypt-media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          messages: {
            key: { id: msg.key.id },
            message: { audioMessage: audio },
          },
        },
      }),
    });
    if (!resp.ok) {
      console.error("WaSender decrypt-media error:", resp.status, await resp.text());
      return null;
    }
    const json = (await resp.json()) as { success?: boolean; publicUrl?: string };
    return json.publicUrl ?? null;
  } catch (err) {
    console.error("WaSender decrypt-media exception:", err);
    return null;
  }
}

/**
 * La versión desencriptada de una imagen entrante. Misma mecánica que
 * `decryptAudio` contra el mismo endpoint, cambiando el sobre del mensaje.
 *
 * La URL que devuelve WaSender es **temporal** (~1h). Quien la guarde tiene que
 * copiarse el archivo: guardar la URL sola produce un historial que se ve bien
 * hoy y muestra fotos rotas el mes que viene.
 */
export async function decryptImage(msg: WaIncomingMessage): Promise<string | null> {
  const image = msg.message?.imageMessage;
  if (!image) return null;

  try {
    const resp = await fetch(`${BASE}/decrypt-media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { messages: { key: { id: msg.key.id }, message: { imageMessage: image } } },
      }),
    });
    if (!resp.ok) {
      console.error("WaSender decrypt-media (imagen) error:", resp.status, await resp.text());
      return null;
    }
    const json = (await resp.json()) as { success?: boolean; publicUrl?: string };
    return json.publicUrl ?? null;
  } catch (err) {
    console.error("WaSender decrypt-media (imagen) exception:", err);
    return null;
  }
}

/** Extrae el texto plano de un mensaje entrante (si es de texto). */
export function extractText(msg: WaIncomingMessage): string {
  return (
    msg.messageBody ||
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ""
  ).trim();
}
