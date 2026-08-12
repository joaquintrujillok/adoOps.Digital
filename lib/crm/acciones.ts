"use server";

// Server Actions del CRM — el único camino por el que la interfaz escribe.
//
// Todas empiezan por `requireSession()`. El proxy ya bloquea a los anónimos,
// pero una Server Action es un endpoint público en la práctica: si la
// autorización viviera solo en el proxy, bastaría con invocarla directamente.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  crmAlerts,
  crmContacts,
  crmDeals,
  crmInventory,
  crmOrderItems,
  crmOrders,
  crmQuoteItems,
  crmQuotes,
  crmSegments,
  crmWaMessages,
} from "@/db/crm";
import { requireGerencia, requireSession } from "./auth.actions";
import { moverEtapa, registrarActividad } from "./pipeline";
import { cambiarEstadoAlerta, recalcularAlertas, type AccionSugerida } from "./insights";
import { despacharMensaje } from "./whatsapp-dispatch";
import {
  alternarDestacada,
  conversacionDe,
  marcarLeida,
  prepararParaClientes,
  redactar,
} from "./whatsapp";
import { normalizarTelefono } from "./telefono";
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

/**
 * Deja el hilo por leído. La llama la pantalla al abrir una conversación.
 *
 * Solo revalida si de verdad marcó algo. Abrir un hilo ya leído no cambia nada
 * en la base, y revalidar igual haría que cada apertura vuelva a montar la
 * bandeja entera por gusto.
 */
export async function accionMarcarLeida(conversationId: number): Promise<void> {
  await requireSession();
  if (!Number.isFinite(conversationId) || conversationId <= 0) return;
  const cambio = await marcarLeida(conversationId);
  if (cambio) revalidatePath("/crm/conversaciones");
}

export async function accionDestacarConversacion(formData: FormData): Promise<void> {
  await requireSession();
  const conversationId = Number(formData.get("conversationId"));
  if (!Number.isFinite(conversationId) || conversationId <= 0) return;
  await alternarDestacada(conversationId);
  revalidatePath("/crm/conversaciones");
}

/**
 * Corrige los datos del contacto desde la ficha del hilo, sin salir de la
 * pantalla.
 *
 * El teléfono se normaliza igual que en el resto del CRM y se guarda en E.164;
 * si lo tecleado no es un número usable se rechaza el guardado entero en vez de
 * dejar la mitad de los cambios aplicados. Y no toca el teléfono de la
 * conversación: el hilo está amarrado al número por el que llegaron los
 * mensajes, y cambiarlo acá movería una conversación de WhatsApp a un número al
 * que nadie le escribió nunca.
 */
export interface ResultadoContacto {
  ok: boolean;
  error?: string;
  /**
   * Lo que se tecleó, devuelto tal cual cuando el guardado se rechaza.
   *
   * React vacía los campos de un formulario no controlado apenas termina la
   * acción, así que sin esto un teléfono rechazado se borra junto con el resto
   * de lo escrito: el vendedor ve el error y ya no tiene qué corregir.
   */
  valores?: { nombre: string; email: string; telefono: string };
}

export async function accionGuardarContacto(
  _estado: ResultadoContacto | null,
  formData: FormData,
): Promise<ResultadoContacto> {
  await requireSession();
  const contactId = Number(formData.get("contactId"));
  if (!Number.isFinite(contactId) || contactId <= 0) {
    return { ok: false, error: "Falta el contacto" };
  }

  const nombre = String(formData.get("nombre") || "").trim();
  const emailCrudo = String(formData.get("email") || "").trim();
  const telefonoCrudo = String(formData.get("telefono") || "").trim();
  const tecleado = { nombre, email: emailCrudo, telefono: telefonoCrudo };

  if (!nombre) {
    return { ok: false, error: "El nombre no puede quedar vacío", valores: tecleado };
  }
  if (emailCrudo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCrudo)) {
    return { ok: false, error: "Ese correo no tiene forma de correo", valores: tecleado };
  }

  let telefono: string | null = null;
  if (telefonoCrudo) {
    telefono = normalizarTelefono(telefonoCrudo);
    if (!telefono) {
      return { ok: false, error: "Ese teléfono no es un número válido", valores: tecleado };
    }
  }

  await db
    .update(crmContacts)
    .set({ nombre, email: emailCrudo || null, telefono })
    .where(eq(crmContacts.id, contactId));

  revalidatePath("/crm/conversaciones");
  revalidatePath(`/crm/contactos/${contactId}`);
  revalidatePath("/crm/contactos");
  return { ok: true };
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

/**
 * Corrige la categoría de una oportunidad desde la tabla de Pipeline.
 *
 * Vacío devuelve la oportunidad a la categoría que sale de sus piezas: `null`
 * significa "sin corrección", no "sin categoría". Sin ese camino de vuelta, un
 * clic equivocado quedaría escrito para siempre.
 */
export async function accionCategoriaOportunidad(formData: FormData): Promise<void> {
  await requireSession();
  const dealId = Number(formData.get("dealId"));
  if (!Number.isFinite(dealId) || dealId <= 0) return;
  const categoria = String(formData.get("categoria") || "").trim();

  await db
    .update(crmDeals)
    .set({ categoria: categoria || null })
    .where(eq(crmDeals.id, dealId));

  revalidatePath("/crm/pipeline");
  revalidatePath("/crm/oportunidades");
}

export async function accionAsignarDueno(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const dealId = Number(formData.get("dealId"));
  await db.update(crmDeals).set({ ownerId: sesion.userId }).where(eq(crmDeals.id, dealId));
  revalidatePath("/crm/oportunidades");
}

// ─── Cotizaciones ────────────────────────────────────────────────────────────

/**
 * Crea una cotización desde el armador.
 *
 * Los ítems llegan como JSON en un campo oculto porque son una lista de largo
 * variable; los precios NO viajan: `crearCotizacion` los relee del catálogo.
 */
export async function accionCrearCotizacion(formData: FormData): Promise<void> {
  const sesion = await requireSession();

  let items: { productId: number; cantidad: number; descuento?: number }[] = [];
  try {
    items = JSON.parse(String(formData.get("items") || "[]"));
  } catch {
    items = [];
  }

  const { crearCotizacion } = await import("./cotizaciones");
  const resultado = await crearCotizacion({
    contactId: formData.get("contactId") ? Number(formData.get("contactId")) : null,
    cotizanteNombre: String(formData.get("nombre") || ""),
    cotizanteTelefono: String(formData.get("telefono") || ""),
    paraSiMismo: !formData.get("esRegalo"),
    destinatarioNombre: String(formData.get("destinatario") || "") || null,
    boutique: String(formData.get("boutique") || "") || null,
    createdById: sesion.userId,
    items,
    descuentoGlobal: Number(formData.get("descuentoGlobal") || 0),
  });

  if (!resultado.ok) {
    // El error viaja en la URL: la alternativa sería useActionState en el
    // armador, que obligaría a subir todo el estado del formulario al cliente.
    redirect(`/crm/cotizaciones/nueva?error=${encodeURIComponent(resultado.error)}`);
  }

  revalidatePath("/crm/cotizaciones");
  redirect(`/crm/cotizaciones/${resultado.id}`);
}

/**
 * Envía la cotización por WhatsApp.
 *
 * El cuerpo llega editado por quien vende —el mensaje se ajusta antes de
 * mandarlo— pero el cierre con la palabra BAJA lo vuelve a pegar
 * `mensajeCompleto()`: es la salida del cliente y no puede perderse porque
 * alguien borró la última línea.
 */
export async function accionEnviarCotizacion(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const quoteId = Number(formData.get("quoteId"));
  const cuerpo = String(formData.get("cuerpo") || "").trim();
  if (!cuerpo) return;

  const [q] = await db.select().from(crmQuotes).where(eq(crmQuotes.id, quoteId)).limit(1);
  if (!q) return;

  const { mensajeCompleto } = await import("./documento-cotizacion");
  const conversationId = await conversacionDe(q.cotizanteTelefono, {
    contactId: q.contactId,
    nombre: q.cotizanteNombre,
  });

  const messageId = await redactar({
    conversationId,
    cuerpo: mensajeCompleto(cuerpo, sesion.nombre),
    autorId: sesion.userId,
    aprobado: true,
  });
  const resultado = await despacharMensaje(messageId);

  // La cotización pasa a "enviada" solo si el mensaje efectivamente salió (o se
  // simuló). Si un candado lo retuvo, sigue abierta: decir "enviada" cuando el
  // cliente no recibió nada es la mentira que después nadie puede explicar.
  if (resultado.estado === "sent" || resultado.estado === "simulado") {
    await db
      .update(crmQuotes)
      .set({ estado: "enviada", enviadaEn: new Date(), conversationId })
      .where(eq(crmQuotes.id, quoteId));
  }

  revalidatePath(`/crm/cotizaciones/${quoteId}`);
  revalidatePath("/crm/cotizaciones");
  revalidatePath("/crm/conversaciones");
}

/** Marca la cotización como vendida y deja la venta registrada. */
export async function accionConvertirCotizacion(formData: FormData): Promise<void> {
  await requireSession();
  const quoteId = Number(formData.get("quoteId"));

  const [q] = await db.select().from(crmQuotes).where(eq(crmQuotes.id, quoteId)).limit(1);
  if (!q || q.estado === "convertida") return;

  const items = await db
    .select()
    .from(crmQuoteItems)
    .where(eq(crmQuoteItems.quoteId, quoteId));

  const [orden] = await db
    .insert(crmOrders)
    .values({
      contactId: q.contactId,
      quoteId,
      fecha: new Date(),
      total: q.total,
      canal: "Cotización",
    })
    .returning({ id: crmOrders.id });

  if (items.length > 0) {
    await db.insert(crmOrderItems).values(
      items.map((i) => ({
        orderId: orden.id,
        productId: i.productId,
        cantidad: i.cantidad,
        // El precio que se guarda es el efectivamente cobrado por unidad, con
        // su descuento aplicado: si se guardara el de lista, el histórico del
        // cliente diría que pagó más de lo que pagó.
        precioUnitario: Math.round(i.total / Math.max(1, i.cantidad)),
      })),
    );
  }

  await db
    .update(crmQuotes)
    .set({ estado: "convertida", convertidaEn: new Date(), orderId: orden.id })
    .where(eq(crmQuotes.id, quoteId));

  // Quien compra deja de ser prospecto.
  if (q.contactId) {
    await db
      .update(crmContacts)
      .set({ estado: "cliente" })
      .where(eq(crmContacts.id, q.contactId));
    revalidatePath(`/crm/contactos/${q.contactId}`);
  }

  revalidatePath(`/crm/cotizaciones/${quoteId}`);
  revalidatePath("/crm/cotizaciones");
}

export async function accionDescartarCotizacion(formData: FormData): Promise<void> {
  await requireSession();
  const quoteId = Number(formData.get("quoteId"));
  await db
    .update(crmQuotes)
    .set({ estado: "descartada" })
    .where(eq(crmQuotes.id, quoteId));
  revalidatePath("/crm/cotizaciones");
  revalidatePath(`/crm/cotizaciones/${quoteId}`);
}

// ─── Señales de conversación ─────────────────────────────────────────────────

export async function accionRecalcularSenales(): Promise<void> {
  await requireSession();
  const { recalcularSenales } = await import("./senales");
  await recalcularSenales();
  revalidatePath("/crm/senales");
}

export async function accionResolverSenal(formData: FormData): Promise<void> {
  await requireSession();
  const { cambiarEstadoSenal } = await import("./senales");
  await cambiarEstadoSenal(
    Number(formData.get("senalId")),
    String(formData.get("estado")) as "accionada" | "descartada",
  );
  revalidatePath("/crm/senales");
}

/**
 * Manda el borrador de la señal por WhatsApp y la marca como accionada.
 *
 * El texto llega editado por quien vende: el sistema propone, la persona
 * decide. Un mensaje automático a un cliente que gasta millones es la forma más
 * rápida de que la relación se sienta industrial.
 */
export async function accionEnviarSenal(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  const senalId = Number(formData.get("senalId"));
  const contactId = Number(formData.get("contactId"));
  const cuerpo = String(formData.get("cuerpo") || "").trim();
  if (!cuerpo) return;

  const [c] = await db
    .select({ telefono: crmContacts.telefono, nombre: crmContacts.nombre })
    .from(crmContacts)
    .where(eq(crmContacts.id, contactId))
    .limit(1);
  if (!c?.telefono) return;

  const conversationId = await conversacionDe(c.telefono, {
    contactId,
    nombre: c.nombre,
  });
  const messageId = await redactar({
    conversationId,
    cuerpo,
    autorId: sesion.userId,
    aprobado: true,
  });
  await despacharMensaje(messageId);

  const { cambiarEstadoSenal } = await import("./senales");
  await cambiarEstadoSenal(senalId, "accionada");

  revalidatePath("/crm/senales");
  revalidatePath("/crm/conversaciones");
}
