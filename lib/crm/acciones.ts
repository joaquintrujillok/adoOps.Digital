"use server";

// Server Actions del CRM — el único camino por el que la interfaz escribe.
//
// Todas empiezan por `requireSession()`. El proxy ya bloquea a los anónimos,
// pero una Server Action es un endpoint público en la práctica: si la
// autorización viviera solo en el proxy, bastaría con invocarla directamente.

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  crmAlerts,
  crmContacts,
  crmDeals,
  crmInventory,
  crmSegments,
  crmWaMessages,
} from "@/db/crm";
import { requireGerencia, requireSession } from "./auth.actions";
import { moverEtapa, registrarActividad } from "./pipeline";
import { cambiarEstadoAlerta, recalcularAlertas, type AccionSugerida } from "./insights";
import { despacharMensaje } from "./whatsapp-dispatch";
import { conversacionDe, prepararParaClientes, redactar } from "./whatsapp";
import { CLAVES, escribir, leer } from "./settings";
import type { DefinicionSegmento } from "./segmentos";

// ─── Pipeline ────────────────────────────────────────────────────────────────

export async function accionMoverEtapa(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const dealId = Number(formData.get("dealId"));
  const etapa = String(formData.get("etapa"));
  const motivo = formData.get("motivo") ? String(formData.get("motivo")) : undefined;

  await moverEtapa(dealId, etapa, sesion.userId, motivo);
  revalidatePath("/crm/oportunidades");
  revalidatePath(`/crm/oportunidades/${dealId}`);
  revalidatePath("/crm");
}

export async function accionRegistrarActividad(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const contactId = Number(formData.get("contactId"));
  const dealId = formData.get("dealId") ? Number(formData.get("dealId")) : null;
  const tipo = String(formData.get("tipo") || "nota");
  const titulo = String(formData.get("titulo") || "").trim();
  const detalle = String(formData.get("detalle") || "").trim() || null;
  const venceEn = formData.get("venceEn") ? new Date(String(formData.get("venceEn"))) : null;

  if (!titulo) return;

  await registrarActividad({
    contactId,
    dealId,
    tipo,
    titulo,
    detalle,
    ownerId: sesion.userId,
    venceEn,
    // Una tarea nace pendiente; cualquier otro registro es algo que ya ocurrió.
    completada: tipo !== "tarea",
  });

  revalidatePath(`/crm/contactos/${contactId}`);
  if (dealId) revalidatePath(`/crm/oportunidades/${dealId}`);
}

export async function accionCompletarTarea(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("actividadId"));
  const { crmActivities } = await import("@/db/crm");
  await db.update(crmActivities).set({ completada: true }).where(eq(crmActivities.id, id));
  revalidatePath("/crm");
  revalidatePath("/crm/inteligencia");
}

// ─── Inteligencia ────────────────────────────────────────────────────────────

export async function accionRecalcularAlertas(): Promise<void> {
  await requireSession();
  await recalcularAlertas();
  revalidatePath("/crm/inteligencia");
  revalidatePath("/crm");
}

export async function accionResolverAlerta(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("alertaId"));
  const estado = String(formData.get("estado")) as "atendida" | "descartada";
  await cambiarEstadoAlerta(id, estado);
  revalidatePath("/crm/inteligencia");
  revalidatePath("/crm");
}

/**
 * Ejecuta la acción sugerida de una alerta de WhatsApp: prepara los borradores
 * y deja la alerta como atendida.
 *
 * Los mensajes quedan en borrador. Un clic acá NO es autorización de envío.
 */
export async function accionPrepararWhatsapp(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const alertaId = Number(formData.get("alertaId"));

  const [alerta] = await db
    .select()
    .from(crmAlerts)
    .where(eq(crmAlerts.id, alertaId))
    .limit(1);
  if (!alerta) return;

  const accion = alerta.accionSugerida as AccionSugerida | null;
  if (!accion || accion.accion !== "whatsapp") return;

  const empresa = (await leer(CLAVES.empresa)) ?? "adoOps";
  await prepararParaClientes(
    accion.contactIds,
    accion.plantilla,
    sesion.userId,
    empresa,
    sesion.nombre,
  );

  await cambiarEstadoAlerta(alertaId, "atendida");
  revalidatePath("/crm/conversaciones");
  revalidatePath("/crm/inteligencia");
}

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export async function accionRedactarMensaje(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const conversationId = Number(formData.get("conversationId"));
  const cuerpo = String(formData.get("cuerpo") || "").trim();
  if (!cuerpo) return;

  const id = await redactar({
    conversationId,
    cuerpo,
    autorId: sesion.userId,
    aprobado: true,
  });
  await despacharMensaje(id);

  revalidatePath(`/crm/conversaciones`);
  revalidatePath("/crm/conversaciones");
}

export async function accionAprobarMensaje(formData: FormData): Promise<void> {
  await requireSession();
  const messageId = Number(formData.get("messageId"));

  await db
    .update(crmWaMessages)
    .set({ estado: "pending", motivo: null })
    .where(eq(crmWaMessages.id, messageId));
  await despacharMensaje(messageId);

  revalidatePath("/crm/conversaciones");
}

export async function accionAprobarTodos(formData: FormData): Promise<void> {
  await requireSession();
  const ids = String(formData.get("messageIds") || "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return;

  await db
    .update(crmWaMessages)
    .set({ estado: "pending", motivo: null })
    .where(inArray(crmWaMessages.id, ids));

  // En serie y no en paralelo: el despacho real respeta un ritmo entre envíos, y
  // dispararlos todos a la vez rompería justamente ese control.
  for (const id of ids) {
    await despacharMensaje(id);
  }

  revalidatePath("/crm/conversaciones");
}

export async function accionDescartarMensaje(formData: FormData): Promise<void> {
  await requireSession();
  const messageId = Number(formData.get("messageId"));
  await db.delete(crmWaMessages).where(eq(crmWaMessages.id, messageId));
  revalidatePath("/crm/conversaciones");
}

export async function accionAbrirConversacion(formData: FormData): Promise<number | null> {
  await requireSession();
  const contactId = Number(formData.get("contactId"));
  const [c] = await db
    .select()
    .from(crmContacts)
    .where(eq(crmContacts.id, contactId))
    .limit(1);
  if (!c?.telefono) return null;

  const id = await conversacionDe(c.telefono, {
    contactId: c.id,
    nombre: c.nombre,
  });
  revalidatePath("/crm/conversaciones");
  return id;
}

// ─── Segmentos ───────────────────────────────────────────────────────────────

export async function accionGuardarSegmento(formData: FormData): Promise<void> {
  await requireSession();
  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) return;

  const definicion: DefinicionSegmento = {};
  const num = (k: string) => {
    const v = formData.get(k);
    return v && String(v).trim() !== "" ? Number(v) : undefined;
  };
  const lista = (k: string) => {
    const v = formData.getAll(k).map(String).filter(Boolean);
    return v.length ? v : undefined;
  };

  definicion.estado = lista("estado");
  definicion.ciudad = lista("ciudad");
  definicion.etiquetas = lista("etiquetas");
  definicion.scoreMin = num("scoreMin");
  definicion.facturadoMin = num("facturadoMin");
  definicion.sinComprarMin = num("sinComprarMin");
  definicion.comprasMin = num("comprasMin");
  if (formData.get("conWhatsapp")) definicion.conWhatsapp = true;

  await db.insert(crmSegments).values({
    nombre,
    descripcion: String(formData.get("descripcion") || "") || null,
    definicion,
  });

  revalidatePath("/crm/segmentos");
}

export async function accionBorrarSegmento(formData: FormData): Promise<void> {
  await requireGerencia();
  const id = Number(formData.get("segmentoId"));
  await db.delete(crmSegments).where(eq(crmSegments.id, id));
  revalidatePath("/crm/segmentos");
}

// ─── Configuración ───────────────────────────────────────────────────────────

export async function accionGuardarConfiguracion(formData: FormData): Promise<void> {
  await requireGerencia();

  // Los interruptores llegan solo cuando están marcados: un checkbox sin marcar
  // no viaja en el formulario, así que la ausencia se traduce a "false".
  await escribir(CLAVES.waSimulado, formData.get("waSimulado") ? "true" : "false");
  await escribir(CLAVES.waHabilitado, formData.get("waHabilitado") ? "true" : "false");
  await escribir(CLAVES.narradorIa, formData.get("narradorIa") ? "true" : "false");

  const empresa = String(formData.get("empresa") || "").trim();
  if (empresa) await escribir(CLAVES.empresa, empresa);

  const pesos = {
    recencia: Number(formData.get("peso_recencia") ?? 25),
    frecuencia: Number(formData.get("peso_frecuencia") ?? 20),
    monto: Number(formData.get("peso_monto") ?? 25),
    engagement: Number(formData.get("peso_engagement") ?? 15),
    potencial: Number(formData.get("peso_potencial") ?? 15),
  };
  await escribir(CLAVES.scoringPesos, JSON.stringify(pesos));

  const umbrales = {
    diasEstancado: Number(formData.get("umbral_diasEstancado") ?? 14),
    montoAlto: Number(formData.get("umbral_montoAlto") ?? 3_000_000),
    caidaPorcentaje: Number(formData.get("umbral_caidaPorcentaje") ?? 40),
    confianzaCrossSell: Number(formData.get("umbral_confianzaCrossSell") ?? 50),
    scoreDesatendido: Number(formData.get("umbral_scoreDesatendido") ?? 70),
  };
  await escribir(CLAVES.alertasUmbrales, JSON.stringify(umbrales));

  revalidatePath("/crm/configuracion");
  revalidatePath("/crm/inteligencia");
  revalidatePath("/crm");
}

// ─── Inventario ──────────────────────────────────────────────────────────────

export async function accionAjustarStock(formData: FormData): Promise<void> {
  await requireGerencia();
  const productId = Number(formData.get("productId"));
  const stock = Number(formData.get("stock"));
  if (!Number.isFinite(stock) || stock < 0) return;

  await db
    .insert(crmInventory)
    .values({ productId, stock })
    .onConflictDoUpdate({
      target: crmInventory.productId,
      set: { stock, updatedAt: new Date() },
    });

  revalidatePath("/crm/productos");
  revalidatePath("/crm/inteligencia");
}

// ─── Oportunidades ───────────────────────────────────────────────────────────

export async function accionAsignarDueno(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const dealId = Number(formData.get("dealId"));
  await db.update(crmDeals).set({ ownerId: sesion.userId }).where(eq(crmDeals.id, dealId));
  revalidatePath("/crm/oportunidades");
}
