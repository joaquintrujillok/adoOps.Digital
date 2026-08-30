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
    // Una foto mandada como **documento**. No es un caso raro: es lo que hace
    // la gente cuando no quiere que WhatsApp le recomprima la imagen, que es
    // justo lo que pasa con las fotos de dron. Sin esto, esas llegaban y el
    // sistema las ignoraba en silencio.
    documentMessage?: {
      url: string;
      mediaKey: string;
      mimetype: string;
      caption?: string;
      fileName?: string;
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

/**
 * La versión desencriptada de un archivo entrante mandado como documento.
 *
 * Misma mecánica que `decryptImage` contra el mismo endpoint, cambiando el
 * sobre. Sirve para las fotos que llegan sin comprimir, que es como se mandan
 * las de dron.
 */
export async function decryptDocument(msg: WaIncomingMessage): Promise<string | null> {
  const doc = msg.message?.documentMessage;
  if (!doc) return null;

  try {
    const resp = await fetch(`${BASE}/decrypt-media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { messages: { key: { id: msg.key.id }, message: { documentMessage: doc } } },
      }),
    });
    if (!resp.ok) {
      console.error("WaSender decrypt-media (documento) error:", resp.status, await resp.text());
      return null;
    }
    const json = (await resp.json()) as { success?: boolean; publicUrl?: string };
    return json.publicUrl ?? null;
  } catch (err) {
    console.error("WaSender decrypt-media (documento) exception:", err);
    return null;
  }
}

/**
 * Sube un archivo y devuelve la URL que WaSender le asigna.
 *
 * **Se sube en vez de exponer una URL propia**, y la razón es la misma que en el
 * CRM de CDC de donde viene esta pieza: nuestro documento lleva el nombre de un
 * agricultor, su lote y lo que se observó en su campo. Publicarlo en una ruta
 * sin sesión para que el proveedor la alcance sería filtrar el informe de un
 * cliente por conveniencia. Acá el archivo viaja por el mismo canal autenticado
 * que el mensaje.
 *
 * La clave real de la respuesta es `publicUrl` en la raíz; las demás quedan de
 * respaldo porque el contrato no está documentado y ya cambió una vez.
 */
export async function uploadFile(
  bytes: Buffer,
  mimetype: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const key = process.env.WASENDER_API_KEY;
  if (!key) return { ok: false, message: "WASENDER_API_KEY no configurada" };

  let res: Response;
  try {
    res = await fetch(`${BASE}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": mimetype },
      body: new Uint8Array(bytes),
      // Más holgado que un envío de texto: subir un PDF con fotos tarda más que
      // mandar una línea, y cortar a los 12 s lo dejaría a medio camino.
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    const aborto = err instanceof Error && err.name === "TimeoutError";
    return {
      ok: false,
      message: aborto ? "La subida del archivo superó los 25 s" : "No se pudo subir el archivo",
    };
  }

  const cuerpo = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    return { ok: false, message: `Subida rechazada (${res.status})` };
  }

  const data = (cuerpo?.data ?? {}) as Record<string, unknown>;
  const url =
    (cuerpo?.publicUrl as string) ??
    (data.publicUrl as string) ??
    (data.url as string) ??
    (cuerpo?.url as string) ??
    (data.file_url as string) ??
    null;

  if (typeof url !== "string" || !url) {
    return { ok: false, message: `La subida respondió sin URL: ${JSON.stringify(cuerpo).slice(0, 200)}` };
  }
  return { ok: true, url };
}

/**
 * Manda un documento con el texto como epígrafe.
 *
 * Va en **un solo mensaje** y no en dos: así el agricultor ve el resumen sin
 * abrir nada y tiene el PDF si lo quiere, en vez de recibir dos notificaciones
 * por la misma visita.
 */
export async function sendDocument(
  to: string,
  documentUrl: string,
  fileName: string,
  caption: string,
): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE}/send-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, text: caption, documentUrl, fileName }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) {
      console.error("WaSender send-document error:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("WaSender send-document exception:", err);
    return false;
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
