/**
 * Orquestación del vertical "Incidencias / Mantención":
 *  transcripción → extracción → persistencia → respuesta de validación por WhatsApp.
 * El router (lib/whatsapp-router.ts) decide cuándo despachar aquí.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { incidencias, ordenesTrabajo } from "@/db/schema";
import type { IncidenciaExtractionResult } from "@/lib/extract-mantencion";
import { extractIncidencia } from "@/lib/extract-mantencion";
import { sendText } from "@/lib/wasender";

export type TranscriptInput = {
  senderPhone: string;
  senderName: string | null;
  source: "audio" | "texto";
  waMessageId: string;
  audioUrl: string | null;
  transcript: string;
};

/** Persiste una incidencia extraída + sus órdenes de trabajo. Devuelve el id. */
async function persist(
  params: TranscriptInput & { result: IncidenciaExtractionResult }
): Promise<number> {
  const { result } = params;
  const ext = result.extraction;

  const [inc] = await db
    .insert(incidencias)
    .values({
      senderPhone: params.senderPhone,
      senderName: params.senderName,
      source: params.source,
      waMessageId: params.waMessageId,
      audioUrl: params.audioUrl,
      transcript: params.transcript,
      equipo: ext.identificacion.equipo,
      codigoActivo: ext.identificacion.codigoActivo,
      ubicacion: ext.identificacion.ubicacion,
      reportadoPor: ext.identificacion.reportadoPor,
      tipoFalla: ext.falla.tipo,
      severidad: ext.falla.severidad,
      estadoEquipo: ext.falla.estadoEquipo,
      extraction: ext,
      executiveSummary: result.executiveSummary,
      alertas: result.alertas,
      status: "pendiente",
    })
    .returning({ id: incidencias.id });

  if (result.ordenesTrabajo.length) {
    await db.insert(ordenesTrabajo).values(
      result.ordenesTrabajo.map((o) => ({
        incidenciaId: inc.id,
        tarea: o.tarea,
        responsableSugerido: o.responsableSugerido ?? null,
        prioridad: o.prioridad ?? "media",
        plazo: o.plazo ?? null,
        repuestos: o.repuestos ?? null,
      }))
    );
  }

  return inc.id;
}

const SEVERIDAD_ICON: Record<string, string> = {
  critica: "🔴",
  alta: "🟠",
  media: "🟡",
  baja: "🟢",
};

const ESTADO_LABEL: Record<string, string> = {
  detenido: "Detenido",
  operativo_con_riesgo: "Operativo con riesgo",
  operativo: "Operativo",
};

/** Arma el mensaje de validación que se devuelve por WhatsApp. */
function buildReply(result: IncidenciaExtractionResult): string {
  const e = result.extraction;
  const L: string[] = [];
  L.push("🔧 *Incidencia estructurada*");
  if (e.identificacion.equipo) L.push(`• Equipo: ${e.identificacion.equipo}`);
  if (e.identificacion.codigoActivo) L.push(`• Activo: ${e.identificacion.codigoActivo}`);
  if (e.identificacion.ubicacion) L.push(`• Ubicación: ${e.identificacion.ubicacion}`);
  if (e.falla.tipo) L.push(`• Falla: ${e.falla.tipo}`);
  if (e.falla.severidad)
    L.push(`• Severidad: ${SEVERIDAD_ICON[e.falla.severidad] ?? ""} ${e.falla.severidad}`);
  if (e.falla.estadoEquipo)
    L.push(`• Estado: ${ESTADO_LABEL[e.falla.estadoEquipo] ?? e.falla.estadoEquipo}`);
  if (e.repuestos.length) L.push(`• Repuestos: ${e.repuestos.join(", ")}`);

  if (result.alertas.length) {
    L.push("");
    L.push(`⚠️ Alertas: ${result.alertas.join("; ")}`);
  }

  if (result.ordenesTrabajo.length) {
    L.push("");
    L.push("📝 *Órdenes de trabajo*");
    for (const o of result.ordenesTrabajo) {
      const meta = [o.responsableSugerido, o.prioridad ? `prioridad ${o.prioridad}` : null, o.plazo]
        .filter(Boolean)
        .join(", ");
      L.push(`• ${o.tarea}${meta ? ` (${meta})` : ""}`);
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
export async function processTranscript(params: TranscriptInput): Promise<void> {
  const result = await extractIncidencia(params.transcript);
  await persist({ ...params, result });
  await sendText(params.senderPhone, buildReply(result));
}

/** Fecha de la última incidencia pendiente de ese teléfono (para el router de validación). */
export async function findLastPendingAt(phone: string): Promise<Date | null> {
  const [last] = await db
    .select({ createdAt: incidencias.createdAt })
    .from(incidencias)
    .where(and(eq(incidencias.senderPhone, phone), eq(incidencias.status, "pendiente")))
    .orderBy(desc(incidencias.createdAt))
    .limit(1);
  return last?.createdAt ?? null;
}

/** Marca como validada la última incidencia pendiente de ese teléfono. */
export async function validateLastPending(phone: string): Promise<boolean> {
  const [last] = await db
    .select({ id: incidencias.id })
    .from(incidencias)
    .where(and(eq(incidencias.senderPhone, phone), eq(incidencias.status, "pendiente")))
    .orderBy(desc(incidencias.createdAt))
    .limit(1);

  if (!last) return false;

  await db
    .update(incidencias)
    .set({ status: "validado", validatedAt: new Date() })
    .where(eq(incidencias.id, last.id));

  await db
    .update(ordenesTrabajo)
    .set({ estado: "activa" })
    .where(eq(ordenesTrabajo.incidenciaId, last.id));

  return true;
}
