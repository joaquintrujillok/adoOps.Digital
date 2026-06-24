/**
 * Orquestación del vertical "Actas de Reunión":
 *  transcripción → extracción → persistencia → respuesta de validación por WhatsApp.
 * El router (lib/whatsapp-router.ts) decide cuándo despachar aquí.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actaReports, compromisos } from "@/db/schema";
import type { ActaExtractionResult } from "@/lib/extract-actas";
import { extractActa } from "@/lib/extract-actas";
import { sendText } from "@/lib/wasender";

export type TranscriptInput = {
  senderPhone: string;
  senderName: string | null;
  source: "audio" | "texto";
  waMessageId: string;
  audioUrl: string | null;
  transcript: string;
};

/** Persiste un acta extraída + sus compromisos. Devuelve el id. */
async function persist(params: TranscriptInput & { result: ActaExtractionResult }): Promise<number> {
  const { result } = params;
  const ext = result.extraction;

  const [acta] = await db
    .insert(actaReports)
    .values({
      senderPhone: params.senderPhone,
      senderName: params.senderName,
      source: params.source,
      waMessageId: params.waMessageId,
      audioUrl: params.audioUrl,
      transcript: params.transcript,
      titulo: ext.reunion.titulo,
      fecha: ext.reunion.fecha,
      lugar: ext.reunion.lugar,
      participantes: ext.reunion.participantes,
      extraction: ext,
      executiveSummary: result.executiveSummary,
      decisiones: result.decisiones,
      status: "pendiente",
    })
    .returning({ id: actaReports.id });

  if (result.compromisos.length) {
    await db.insert(compromisos).values(
      result.compromisos.map((c) => ({
        actaId: acta.id,
        compromiso: c.compromiso,
        responsable: c.responsable ?? null,
        prioridad: c.prioridad ?? "media",
        plazo: c.plazo ?? null,
      }))
    );
  }

  return acta.id;
}

/** Arma el mensaje de validación que se devuelve por WhatsApp. */
function buildReply(result: ActaExtractionResult): string {
  const e = result.extraction;
  const L: string[] = [];
  L.push("📋 *Acta estructurada*");
  if (e.reunion.titulo) L.push(`• Reunión: ${e.reunion.titulo}`);
  if (e.reunion.fecha) L.push(`• Fecha: ${e.reunion.fecha}`);
  if (e.reunion.lugar) L.push(`• Lugar: ${e.reunion.lugar}`);
  if (e.reunion.participantes.length)
    L.push(`• Participantes: ${e.reunion.participantes.join(", ")}`);

  if (result.decisiones.length) {
    L.push("");
    L.push("✅ *Decisiones*");
    for (const d of result.decisiones) L.push(`• ${d}`);
  }

  if (result.compromisos.length) {
    L.push("");
    L.push("📝 *Compromisos*");
    for (const c of result.compromisos) {
      const meta = [c.responsable, c.prioridad ? `prioridad ${c.prioridad}` : null, c.plazo]
        .filter(Boolean)
        .join(", ");
      L.push(`• ${c.compromiso}${meta ? ` (${meta})` : ""}`);
    }
  }

  if (e.riesgos.length) {
    L.push("");
    L.push(`⚠️ Riesgos: ${e.riesgos.join("; ")}`);
  }

  if (result.executiveSummary) {
    L.push("");
    L.push(`🧾 ${result.executiveSummary}`);
  }

  L.push("");
  L.push("¿Está correcto? Responde *OK* para validar o escribe las correcciones.");
  return L.join("\n");
}

/** Procesa una transcripción ya obtenida: extrae, persiste y responde. */
export async function processTranscript(params: TranscriptInput): Promise<void> {
  const result = await extractActa(params.transcript);
  await persist({ ...params, result });
  await sendText(params.senderPhone, buildReply(result));
}

/** Fecha del último acta pendiente de ese teléfono (para el router de validación). */
export async function findLastPendingAt(phone: string): Promise<Date | null> {
  const [last] = await db
    .select({ createdAt: actaReports.createdAt })
    .from(actaReports)
    .where(and(eq(actaReports.senderPhone, phone), eq(actaReports.status, "pendiente")))
    .orderBy(desc(actaReports.createdAt))
    .limit(1);
  return last?.createdAt ?? null;
}

/** Marca como validada el última acta pendiente de ese teléfono. */
export async function validateLastPending(phone: string): Promise<boolean> {
  const [last] = await db
    .select({ id: actaReports.id })
    .from(actaReports)
    .where(and(eq(actaReports.senderPhone, phone), eq(actaReports.status, "pendiente")))
    .orderBy(desc(actaReports.createdAt))
    .limit(1);

  if (!last) return false;

  await db
    .update(actaReports)
    .set({ status: "validado", validatedAt: new Date() })
    .where(eq(actaReports.id, last.id));

  await db
    .update(compromisos)
    .set({ estado: "activa" })
    .where(eq(compromisos.actaId, last.id));

  return true;
}
