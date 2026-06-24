/**
 * Orquestación del flujo de la demo de terreno:
 *  mensaje WhatsApp (audio|texto) → transcripción → extracción → persistencia
 *  → respuesta de validación por WhatsApp.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldReports, workSheets } from "@/db/schema";
import type { ExtractionResult } from "@/lib/extract";
import { extractReport } from "@/lib/extract";
import { sendText } from "@/lib/wasender";

/** Persiste un reporte extraído + su hoja de trabajo. Devuelve el id. */
async function persist(params: {
  senderPhone: string;
  senderName: string | null;
  source: "audio" | "texto";
  waMessageId: string;
  audioUrl: string | null;
  transcript: string;
  result: ExtractionResult;
}): Promise<number> {
  const { result } = params;
  const ext = result.extraction;

  const [report] = await db
    .insert(fieldReports)
    .values({
      senderPhone: params.senderPhone,
      senderName: params.senderName,
      source: params.source,
      waMessageId: params.waMessageId,
      audioUrl: params.audioUrl,
      transcript: params.transcript,
      cliente: ext.identificacion.cliente,
      sector: ext.identificacion.sector,
      cuarteles: ext.identificacion.cuarteles.join(", ") || null,
      responsable: ext.identificacion.responsable,
      equipoPersonas: ext.recursos.personas,
      avancePct: ext.actividad.avancePct,
      hectareas: result.hectareas,
      estadoTarea: ext.actividad.estadoTarea,
      extraction: ext,
      executiveSummary: result.executiveSummary,
      incidencias: result.incidencias,
      status: "pendiente",
    })
    .returning({ id: fieldReports.id });

  if (result.workSheet.length) {
    await db.insert(workSheets).values(
      result.workSheet.map((w) => ({
        reportId: report.id,
        tarea: w.tarea,
        responsableSugerido: w.responsableSugerido ?? null,
        prioridad: w.prioridad ?? "media",
        plazo: w.plazo ?? null,
        recursos: w.recursos ?? null,
        evidenciaRequerida: w.evidenciaRequerida ?? null,
      }))
    );
  }

  return report.id;
}

/** Arma el mensaje de validación que se devuelve por WhatsApp. */
function buildReply(result: ExtractionResult): string {
  const e = result.extraction;
  const L: string[] = [];
  L.push("📋 *Reporte estructurado*");
  if (e.identificacion.cliente) L.push(`• Campo: ${e.identificacion.cliente}`);
  if (e.identificacion.sector) L.push(`• Sector: ${e.identificacion.sector}`);
  if (e.identificacion.cuarteles.length)
    L.push(`• Cuarteles: ${e.identificacion.cuarteles.join(", ")}`);
  if (e.identificacion.responsable) L.push(`• Responsable: ${e.identificacion.responsable}`);
  if (e.recursos.personas != null) L.push(`• Equipo: ${e.recursos.personas} personas`);
  if (e.actividad.avancePct != null) L.push(`• Avance: ${e.actividad.avancePct}%`);
  if (result.incidencias.length) L.push(`• Incidencias: ${result.incidencias.join("; ")}`);
  if (e.evidencias.fotos != null) L.push(`• Evidencia: ${e.evidencias.fotos} fotos`);

  if (result.workSheet.length) {
    L.push("");
    L.push("📝 *Hoja de trabajo*");
    for (const w of result.workSheet) {
      const meta = [w.prioridad ? `prioridad ${w.prioridad}` : null, w.plazo]
        .filter(Boolean)
        .join(", ");
      L.push(`• ${w.tarea}${meta ? ` (${meta})` : ""}`);
    }
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
export async function processTranscript(params: {
  senderPhone: string;
  senderName: string | null;
  source: "audio" | "texto";
  waMessageId: string;
  audioUrl: string | null;
  transcript: string;
}): Promise<void> {
  const result = await extractReport(params.transcript);
  await persist({ ...params, result });
  await sendText(params.senderPhone, buildReply(result));
}

/** Fecha del último reporte pendiente de ese teléfono (para el router de validación). */
export async function findLastPendingAt(phone: string): Promise<Date | null> {
  const [last] = await db
    .select({ createdAt: fieldReports.createdAt })
    .from(fieldReports)
    .where(and(eq(fieldReports.senderPhone, phone), eq(fieldReports.status, "pendiente")))
    .orderBy(desc(fieldReports.createdAt))
    .limit(1);
  return last?.createdAt ?? null;
}

/** Marca como validado el último reporte pendiente de ese teléfono. */
export async function validateLastPending(phone: string): Promise<boolean> {
  const [last] = await db
    .select({ id: fieldReports.id })
    .from(fieldReports)
    .where(and(eq(fieldReports.senderPhone, phone), eq(fieldReports.status, "pendiente")))
    .orderBy(desc(fieldReports.createdAt))
    .limit(1);

  if (!last) return false;

  await db
    .update(fieldReports)
    .set({ status: "validado", validatedAt: new Date() })
    .where(eq(fieldReports.id, last.id));

  await db
    .update(workSheets)
    .set({ estado: "activa" })
    .where(eq(workSheets.reportId, last.id));

  return true;
}
