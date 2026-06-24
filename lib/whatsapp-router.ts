/**
 * Router de WhatsApp: un solo número/webhook alimenta los 3 verticales de demo
 * (terreno, actas, mantención). Clasifica cada mensaje por palabras clave de su
 * texto/transcripción y lo despacha al vertical correcto. `terreno` es el default.
 *
 * Flujo:
 *  - audio  → desencriptar → transcribir (una sola vez) → clasificar → procesar
 *  - texto  → clasificar → procesar
 *  - "OK"   → validar el reporte pendiente MÁS RECIENTE entre los 3 verticales
 */
import { transcribeFromUrl } from "@/lib/stt";
import {
  decryptAudio,
  extractText,
  sendText,
  type WaIncomingMessage,
} from "@/lib/wasender";
import * as terreno from "@/lib/reports";
import * as actas from "@/lib/actas";
import * as mantencion from "@/lib/mantencion";
import { getActiveDemoSetting } from "@/lib/demo-settings";

type Vertical = "terreno" | "actas" | "mantencion";

type TranscriptInput = {
  senderPhone: string;
  senderName: string | null;
  source: "audio" | "texto";
  waMessageId: string;
  audioUrl: string | null;
  transcript: string;
};

/** Cada vertical expone la misma interfaz para procesar y validar. */
const VERTICALS: Record<
  Vertical,
  {
    processTranscript: (p: TranscriptInput) => Promise<void>;
    findLastPendingAt: (phone: string) => Promise<Date | null>;
    validateLastPending: (phone: string) => Promise<boolean>;
    validatedMsg: string;
  }
> = {
  terreno: {
    processTranscript: terreno.processTranscript,
    findLastPendingAt: terreno.findLastPendingAt,
    validateLastPending: terreno.validateLastPending,
    validatedMsg:
      "✅ Reporte validado. Hoja de trabajo activada y disponible en el dashboard.",
  },
  actas: {
    processTranscript: actas.processTranscript,
    findLastPendingAt: actas.findLastPendingAt,
    validateLastPending: actas.validateLastPending,
    validatedMsg: "✅ Acta validada. Compromisos activados y disponibles en el dashboard.",
  },
  mantencion: {
    processTranscript: mantencion.processTranscript,
    findLastPendingAt: mantencion.findLastPendingAt,
    validateLastPending: mantencion.validateLastPending,
    validatedMsg:
      "✅ Incidencia validada. Órdenes de trabajo activadas y disponibles en el dashboard.",
  },
};

/** Palabras que el usuario manda para validar el último pendiente. */
const VALIDATION_WORDS = ["ok", "validar", "validado", "confirmo", "confirmar", "👍", "si", "sí"];

/** Diccionario de palabras clave por vertical (en minúsculas, sin tildes). */
const KEYWORDS: Record<Vertical, string[]> = {
  terreno: [
    "reporte de terreno",
    "informe de terreno",
    "reporte de campo",
    "terreno",
    "predio",
    "campo",
    "cuartel",
    "hectareas",
    "cuadrilla",
    "supervisor de terreno",
    "tecnico de terreno",
    "avance del dia",
    "trabajo planificado",
    "poda",
    "cosecha",
    "aplicacion",
    "labores",
    "faena",
    "polinizacion",
    "trampa",
    "colmena",
  ],
  mantencion: [
    "falla mecanica",
    "falla electrica",
    "falla hidraulica",
    "falla",
    "fallo",
    "averia",
    "mantencion",
    "mantenimiento",
    "se detuvo",
    "equipo detenido",
    "esta detenido",
    "esta detenida",
    "no parte",
    "no enciende",
    "no arranca",
    "maquina parada",
    "motor quemado",
    "bomba rota",
    "correa cortada",
    "rodamiento",
    "repuesto",
    "fuga de aceite",
    "fuga de agua",
    "sobrecalentamiento",
    "recalentamiento",
    "vibracion excesiva",
    "panne",
    "orden de trabajo",
  ],
  actas: [
    "acta de reunion",
    "acta",
    "reunion",
    "minuta",
    "comite",
    "acordamos",
    "se acordo",
    "quedo de",
    "quedó de",
    "compromiso",
    "participaron",
    "asistieron",
    "proxima reunion",
    "kickoff",
    "directorio",
    "sesion de",
  ],
};

/** Normaliza para matching: minúsculas y sin tildes. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Clasifica el mensaje a un vertical contando coincidencias de palabras clave.
 * Los 3 verticales puntúan; terreno gana los empates (es el caso más común).
 */
export function classify(text: string): Vertical {
  const t = normalize(text);
  const scores: Record<Vertical, number> = { terreno: 0, mantencion: 0, actas: 0 };

  for (const [vertical, words] of Object.entries(KEYWORDS) as [Vertical, string[]][]) {
    for (const w of words) {
      if (t.includes(normalize(w))) scores[vertical] += 1;
    }
  }

  // Terreno gana los empates (es el vertical más frecuente).
  if (scores.terreno >= scores.mantencion && scores.terreno >= scores.actas) return "terreno";
  if (scores.mantencion >= scores.actas) return "mantencion";
  return "actas";
}

/** ¿El texto es una confirmación de validación? */
function isValidation(text: string): boolean {
  const t = text.trim().toLowerCase();
  return VALIDATION_WORDS.includes(t);
}

/**
 * Valida el reporte pendiente MÁS RECIENTE de este teléfono entre los 3
 * verticales. Devuelve el mensaje de confirmación, o null si no había pendientes.
 */
async function validateNewestPending(phone: string): Promise<string | null> {
  const candidates = await Promise.all(
    (Object.keys(VERTICALS) as Vertical[]).map(async (v) => ({
      vertical: v,
      at: await VERTICALS[v].findLastPendingAt(phone),
    }))
  );

  const pending = candidates.filter((c): c is { vertical: Vertical; at: Date } => c.at != null);
  if (pending.length === 0) return null;

  pending.sort((a, b) => b.at.getTime() - a.at.getTime());
  const winner = pending[0].vertical;
  const ok = await VERTICALS[winner].validateLastPending(phone);
  return ok ? VERTICALS[winner].validatedMsg : null;
}

/**
 * Punto de entrada desde el webhook. Decide si es texto/audio/validación,
 * clasifica el vertical y ejecuta el flujo. Maneja sus propios errores para no
 * romper el ack del webhook.
 */
export async function routeMessage(msg: WaIncomingMessage): Promise<void> {
  const phone = msg.key.cleanedSenderPn || msg.key.remoteJid || "";
  const name = msg.pushName ?? null;
  const waMessageId = msg.key.id;
  const text = extractText(msg);

  try {
    // 1) Validación humana del último pendiente (cualquier vertical).
    if (text && isValidation(text)) {
      const confirm = await validateNewestPending(phone);
      await sendText(
        phone,
        confirm ??
          "No encontré un reporte pendiente de validar. Envíame tu reporte, acta o incidencia."
      );
      return;
    }

    // Vertical activo según el selector de /admin (ignora clasificación automática).
    const vertical = await getActiveDemoSetting();

    // 2) Audio → desencriptar → transcribir → procesar en el vertical activo.
    if (msg.message?.audioMessage) {
      await sendText(phone, "🎧 Recibí tu audio, lo estoy procesando…");
      const publicUrl = await decryptAudio(msg);
      if (!publicUrl) {
        await sendText(phone, "⚠️ No pude descargar el audio. ¿Lo reenvías?");
        return;
      }
      const transcript = await transcribeFromUrl(publicUrl, `${waMessageId}.ogg`);
      if (!transcript) {
        await sendText(phone, "⚠️ No pude transcribir el audio. ¿Lo reenvías?");
        return;
      }
      await VERTICALS[vertical].processTranscript({
        senderPhone: phone,
        senderName: name,
        source: "audio",
        waMessageId,
        audioUrl: publicUrl,
        transcript,
      });
      return;
    }

    // 3) Texto libre → procesar en el vertical activo.
    if (text) {
      await VERTICALS[vertical].processTranscript({
        senderPhone: phone,
        senderName: name,
        source: "texto",
        waMessageId,
        audioUrl: null,
        transcript: text,
      });
      return;
    }
  } catch (err) {
    console.error("routeMessage error:", err);
    try {
      await sendText(phone, "⚠️ Tuve un problema procesando tu mensaje. Intentemos de nuevo.");
    } catch {
      /* noop */
    }
  }
}
