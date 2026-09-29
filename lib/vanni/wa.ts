// Cliente de WaSender para Vanni.
//
// **Por qué no reutiliza lib/wasender.ts.** Aquel cliente habla con la sesión
// que atiende a Tuniche, que está en producción. Una campaña masiva que haga que
// WhatsApp bloquee el número dejaría a Tuniche sin su canal. Vanni tiene su
// propia sesión de WaSender (`VANNI_WASENDER_API_KEY`) y su propio webhook, así
// que un problema acá no cruza al sistema de otro cliente.
//
// Tres modos de no enviar, cada uno por su motivo:
//
// - **Sin llave** (`VANNI_WASENDER_API_KEY` vacía) → todo se simula. Es el estado
//   antes de conectar la sesión: el motor corre completo y nadie recibe nada.
// - **`VANNI_WHATSAPP_SIMULADO=1`** → lo mismo, a propósito, con la llave puesta.
// - **`VANNI_WHATSAPP_ALLOWLIST`** → solo esos números reciben de verdad; al resto
//   el envío se rechaza con un error visible. Es la red para las pruebas: una
//   campaña de prueba contra una base real no puede escaparse a clientes reales.

const BASE = "https://www.wasenderapi.com/api";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// WaSender acepta un mensaje cada 5 s con "Account Protection". Se espacia
// dentro del proceso y se reintenta el 429 con el `retry_after` que manda él.
let ultimoEnvio = 0;
const SEPARACION_MS = 5_200;
const REINTENTOS = 3;

export interface ResultadoEnvio {
  ok: boolean;
  /** `msgId` de WaSender, o `sim-…` si fue simulado. */
  msgId?: string;
  simulado: boolean;
  error?: string;
}

function llave(): string | null {
  return process.env.VANNI_WASENDER_API_KEY?.trim() || null;
}

export function modoWhatsApp(): "real" | "simulado" {
  if (!llave() || process.env.VANNI_WHATSAPP_SIMULADO === "1") return "simulado";
  return "real";
}

function permitido(telefono: string): boolean {
  const lista = process.env.VANNI_WHATSAPP_ALLOWLIST?.trim();
  if (!lista) return true;
  return lista
    .split(",")
    .map((s) => s.replace(/\D/g, ""))
    .includes(telefono.replace(/\D/g, ""));
}

async function post(cuerpo: Record<string, unknown>, etiqueta: string): Promise<ResultadoEnvio> {
  const to = String(cuerpo.to ?? "");
  if (modoWhatsApp() === "simulado") {
    console.log(`[vanni · simulado → +${to}] ${String(cuerpo.text ?? "").slice(0, 160)}`);
    return { ok: true, simulado: true, msgId: `sim-${Date.now().toString(36)}` };
  }
  if (!permitido(to)) {
    return { ok: false, simulado: false, error: "Número fuera de VANNI_WHATSAPP_ALLOWLIST" };
  }

  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const espera = ultimoEnvio + SEPARACION_MS - Date.now();
    if (espera > 0) await dormir(espera);
    ultimoEnvio = Date.now();

    try {
      const resp = await fetch(`${BASE}/send-message`, {
        method: "POST",
        headers: { Authorization: `Bearer ${llave()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, to: `+${to}` }),
        signal: AbortSignal.timeout(20_000),
      });
      const texto = await resp.text();
      if (resp.ok) {
        let msgId: string | undefined;
        try {
          const j = JSON.parse(texto) as { data?: { msgId?: string | number } };
          if (j.data?.msgId !== undefined) msgId = String(j.data.msgId);
        } catch {
          /* respuesta sin JSON: el envío igual fue aceptado */
        }
        return { ok: true, simulado: false, msgId };
      }
      if (resp.status === 429 && intento < REINTENTOS) {
        let segundos = 5;
        try {
          const j = JSON.parse(texto) as { retry_after?: number };
          if (typeof j.retry_after === "number") segundos = Math.max(j.retry_after, 1);
        } catch {
          /* default de 5 s */
        }
        await dormir(segundos * 1000);
        continue;
      }
      console.error(`Vanni WaSender ${etiqueta}:`, resp.status, texto.slice(0, 300));
      return { ok: false, simulado: false, error: `WaSender respondió ${resp.status}: ${texto.slice(0, 160)}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Vanni WaSender ${etiqueta} exception:`, msg);
      return { ok: false, simulado: false, error: msg };
    }
  }
  return { ok: false, simulado: false, error: "Se agotaron los reintentos por límite de envío (429)" };
}

export function enviarTexto(telefono: string, texto: string): Promise<ResultadoEnvio> {
  return post({ to: telefono, text: texto }, "texto");
}

/** Imagen con epígrafe, en un solo mensaje. `imageUrl` debe ser pública. */
export function enviarImagen(telefono: string, imageUrl: string, epigrafe: string): Promise<ResultadoEnvio> {
  return post({ to: telefono, text: epigrafe, imageUrl }, "imagen");
}

/**
 * Estado de un mensaje enviado, consultado a WaSender por su `msgId`.
 *
 * Es el respaldo del webhook `messages.update`: ese trae el `key.id` de
 * WhatsApp, que la documentación no garantiza que sea el mismo `msgId` que
 * devolvió el envío. Con esta consulta el tablero no depende de esa suposición.
 */
export async function estadoMensaje(msgId: string): Promise<{ status?: number; keyId?: string } | null> {
  const k = llave();
  if (!k || msgId.startsWith("sim-")) return null;
  try {
    const resp = await fetch(`${BASE}/messages/${encodeURIComponent(msgId)}/info`, {
      headers: { Authorization: `Bearer ${k}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return null;
    const j = (await resp.json()) as Record<string, unknown>;
    const data = (j.data ?? j) as Record<string, unknown>;
    const raw = data.status ?? (data.update as Record<string, unknown> | undefined)?.status;
    const key = data.key as Record<string, unknown> | undefined;
    return {
      status: typeof raw === "number" ? raw : raw !== undefined ? Number(raw) : undefined,
      keyId: typeof key?.id === "string" ? key.id : undefined,
    };
  } catch {
    return null;
  }
}

/** Códigos de `messages.update`: 0 error · 1 pendiente · 2 enviado · 3 entregado · 4 leído · 5 reproducido. */
export function entregaDeCodigo(status: number): "error" | "enviado" | "entregado" | "leido" | null {
  if (status === 0) return "error";
  if (status === 2) return "enviado";
  if (status === 3) return "entregado";
  if (status >= 4) return "leido";
  return null;
}

// ─── Entrante ────────────────────────────────────────────────────────────────

export interface WaEntrante {
  key: { id: string; fromMe?: boolean; remoteJid?: string; cleanedSenderPn?: string };
  messageBody?: string;
  pushName?: string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string };
    listResponseMessage?: { title?: string };
  };
}

export function textoEntrante(msg: WaEntrante): string {
  return (
    msg.messageBody ||
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.buttonsResponseMessage?.selectedDisplayText ||
    msg.message?.listResponseMessage?.title ||
    ""
  ).trim();
}

export function telefonoEntrante(msg: WaEntrante): string {
  const crudo = msg.key.cleanedSenderPn || msg.key.remoteJid || "";
  return crudo.split("@")[0].replace(/\D/g, "");
}
