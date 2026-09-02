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

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * WaSender acepta **un mensaje cada 5 segundos** cuando la cuenta tiene
 * "Account Protection" encendido, y rechaza el resto con un 429 que este
 * cliente traducía a `false` — es decir, a nada. El 02-09-2026 eso se comió el
 * aviso de error de un audio fallido, cinco de las seis respuestas a unas fotos,
 * y la confirmación de una foto que sí se había guardado. El zonal quedó mirando
 * un chat mudo tres veces distintas, con el sistema funcionando por detrás.
 *
 * Dos defensas, y las dos hacen falta:
 *
 * 1. `ultimoEnvio` espacia las salidas **dentro de este proceso**. Barato y
 *    evita la mayoría de los 429 antes de provocarlos.
 * 2. El reintento sobre el 429 es el que de verdad sostiene, porque cada mensaje
 *    de WhatsApp entra por su propia invocación del webhook y dos invocaciones
 *    no comparten memoria: el punto 1 no las puede coordinar. WaSender dice en
 *    `retry_after` cuántos segundos faltan, así que se le hace caso a él en vez
 *    de adivinar.
 *
 * Sigue siendo mejor tener Account Protection apagado, pero el sistema ya no
 * depende de eso.
 */
let ultimoEnvio = 0;
const SEPARACION_MS = 5_200; // los 5s del proveedor, con un margen
const REINTENTOS = 3;

async function postEnvio(cuerpo: unknown, etiqueta: string): Promise<boolean> {
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const espera = ultimoEnvio + SEPARACION_MS - Date.now();
    if (espera > 0) await dormir(espera);
    ultimoEnvio = Date.now();

    try {
      const resp = await fetch(`${BASE}/send-message`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(20_000),
      });
      if (resp.ok) return true;

      const detalle = await resp.text();
      if (resp.status === 429 && intento < REINTENTOS) {
        // `retry_after` viene en segundos y a veces es 0: el proveedor dice
        // "ya casi", no "reintenta al tiro". El mínimo evita el bucle apretado.
        let segundos = 5;
        try {
          const j = JSON.parse(detalle) as { retry_after?: number };
          if (typeof j.retry_after === "number") segundos = Math.max(j.retry_after, 1);
        } catch {
          /* si no viene JSON, el default de 5s es el límite conocido */
        }
        console.warn(`WaSender ${etiqueta}: 429, reintento ${intento + 1}/${REINTENTOS} en ${segundos}s`);
        await dormir(segundos * 1000);
        continue;
      }

      console.error(`WaSender ${etiqueta} error:`, resp.status, detalle);
      return false;
    } catch (err) {
      console.error(`WaSender ${etiqueta} exception:`, err);
      return false;
    }
  }
  console.error(`WaSender ${etiqueta}: se agotaron los reintentos por 429`);
  return false;
}

/**
 * Espera a que la URL que devolvió `decrypt-media` exista de verdad.
 *
 * WaSender entrega la URL **antes** de terminar de dejar el archivo disponible.
 * Bajarla de una sola vez devuelve 404 y, como el audio es lo único que hay, se
 * pierde la visita entera: fue lo que mató el audio de las 12:58 del
 * 02-09-2026. No es un archivo que no exista, es uno que todavía no está.
 */
async function esperarMedia(url: string, etiqueta: string): Promise<string | null> {
  const esperas = [0, 700, 1500, 3000];
  for (const [i, espera] of esperas.entries()) {
    if (espera) await dormir(espera);
    try {
      const resp = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      if (resp.ok) return url;
      // Un 404 acá es "todavía no"; cualquier otro código es un problema real.
      if (resp.status !== 404) {
        console.error(`WaSender ${etiqueta}: media respondió ${resp.status}`);
        return null;
      }
      console.warn(`WaSender ${etiqueta}: media aún no disponible (404), intento ${i + 1}/${esperas.length}`);
    } catch (err) {
      console.warn(`WaSender ${etiqueta}: no se pudo consultar la media`, err);
    }
  }
  console.error(`WaSender ${etiqueta}: la media siguió en 404 tras ${esperas.length} intentos`);
  return null;
}

/**
 * Pide la media desencriptada y no se conforma con el primer intento.
 *
 * Sondear la misma URL sirve cuando el archivo viene en camino, que es el caso
 * documentado —WaSender entrega la dirección antes de terminar—. Pero no cubre
 * que la desencriptación misma haya fallado: ahí la URL nace muerta y volver a
 * consultarla es perder el tiempo. Por eso, si la primera ronda no produce
 * nada, se rehace el `decrypt-media` completo, que genera un archivo nuevo.
 *
 * Cuál de las dos cosas mató el audio del 02-09-2026 no se puede saber: para
 * cuando lo revisamos la URL ya había expirado (duran ~1h) y el sobre del
 * mensaje no se guarda en ninguna parte. Esta función cubre las dos.
 */
async function pedirMedia(sobre: unknown, etiqueta: string): Promise<string | null> {
  for (let ronda = 1; ronda <= 2; ronda++) {
    try {
      const resp = await fetch(`${BASE}/decrypt-media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: { messages: sobre } }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp.ok) {
        console.error(`WaSender ${etiqueta} error:`, resp.status, await resp.text());
        return null;
      }
      const json = (await resp.json()) as { success?: boolean; publicUrl?: string };
      if (!json.publicUrl) {
        console.error(`WaSender ${etiqueta}: la respuesta no trae publicUrl`);
        return null;
      }
      const lista = await esperarMedia(json.publicUrl, etiqueta);
      if (lista) return lista;
      if (ronda === 1) console.warn(`WaSender ${etiqueta}: rehaciendo el desencriptado desde cero`);
    } catch (err) {
      console.error(`WaSender ${etiqueta} exception:`, err);
      return null;
    }
  }
  return null;
}

/** Envía un mensaje de texto. Devuelve true si WaSender lo aceptó. */
export async function sendText(to: string, text: string): Promise<boolean> {
  return postEnvio({ to, text }, "send-message");
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

  return pedirMedia(
    { key: { id: msg.key.id }, message: { audioMessage: audio } },
    "decrypt-media (audio)",
  );
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

  return pedirMedia(
    { key: { id: msg.key.id }, message: { imageMessage: image } },
    "decrypt-media (imagen)",
  );
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

  return pedirMedia(
    { key: { id: msg.key.id }, message: { documentMessage: document } },
    "decrypt-media (documento)",
  );
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
  return postEnvio({ to, text: caption, documentUrl, fileName }, "send-document");
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
