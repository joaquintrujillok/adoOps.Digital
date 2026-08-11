// Bandeja de WhatsApp: conversaciones, hilos, plantillas y redacción.
//
// Este módulo NO importa el cliente de WaSender. Todo lo que sale pasa por
// lib/crm/whatsapp-dispatch.ts, y esa separación es lo que hace verificable la
// promesa de que ningún mensaje se escapa por un atajo.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmAccounts,
  crmContacts,
  crmDeals,
  crmProducts,
  crmWaConversations,
  crmWaMessages,
  crmWaTemplates,
  type CrmWaMessage,
} from "@/db/crm";
import { normalizarTelefono } from "./telefono";

// ─── Plantillas ──────────────────────────────────────────────────────────────

/**
 * Plantillas de fábrica. Se siembran en BD para que el cliente las edite; estas
 * son el punto de partida, no la única fuente.
 *
 * Variables disponibles: {{contacto}} {{cuenta}} {{producto}} {{monto}}
 * {{vendedor}} {{empresa}} {{dias}}
 */
export const PLANTILLAS_BASE = [
  {
    nombre: "Recompra",
    proposito: "recompra",
    cuerpo:
      "Hola {{contacto}}, te escribo de {{empresa}}. Vi que ya pasó un tiempo desde tu último pedido de {{producto}}. ¿Te preparo una cotización con los precios de este mes? Si prefieres, te llamo cuando estés desocupado.",
  },
  {
    nombre: "Cross-selling",
    proposito: "cross_sell",
    cuerpo:
      "Hola {{contacto}}, soy {{vendedor}} de {{empresa}}. Varios clientes que trabajan con {{producto}} están sumando complementos que les rinde bien. ¿Te muestro las opciones en dos minutos?",
  },
  {
    nombre: "Seguimiento de propuesta",
    proposito: "seguimiento",
    cuerpo:
      "Hola {{contacto}}, ¿alcanzaste a revisar la propuesta que te envié? Quedo atento a cualquier duda para ajustarla a lo que necesitas.",
  },
  {
    nombre: "Reactivación",
    proposito: "reactivacion",
    cuerpo:
      "Hola {{contacto}}, hace {{dias}} días que no conversamos. ¿Sigue en pie lo que estaban evaluando en {{cuenta}}? Si cambió la prioridad, me sirve saberlo igual.",
  },
] as const;

export function renderPlantilla(
  cuerpo: string,
  datos: Record<string, string | number | null | undefined>,
): string {
  return cuerpo.replace(/\{\{(\w+)\}\}/g, (_, clave: string) => {
    const valor = datos[clave];
    // Una variable sin dato deja un hueco visible en vez de "undefined": quien
    // revisa el borrador ve de inmediato qué falta completar.
    return valor === null || valor === undefined || valor === ""
      ? `[${clave}]`
      : String(valor);
  });
}

export async function listarPlantillas() {
  return db
    .select()
    .from(crmWaTemplates)
    .where(eq(crmWaTemplates.activa, true))
    .orderBy(crmWaTemplates.id);
}

export async function sembrarPlantillas(): Promise<void> {
  const existentes = await db.select({ n: sql<number>`count(*)::int` }).from(crmWaTemplates);
  if ((existentes[0]?.n ?? 0) > 0) return;
  await db.insert(crmWaTemplates).values(
    PLANTILLAS_BASE.map((p) => ({
      nombre: p.nombre,
      cuerpo: p.cuerpo,
      proposito: p.proposito,
      activa: true,
    })),
  );
}

// ─── Bandeja ─────────────────────────────────────────────────────────────────

export interface ConversacionListada {
  id: number;
  telefono: string;
  nombre: string | null;
  estado: string;
  baja: boolean;
  accountId: number | null;
  cuenta: string | null;
  ultimoMensajeEn: Date | null;
  ultimoTexto: string | null;
  ultimaDireccion: string | null;
  sinLeer: number;
  porRevisar: number;
}

export async function bandeja(): Promise<ConversacionListada[]> {
  const filas = await db
    .select({
      c: crmWaConversations,
      cuenta: crmAccounts.nombre,
      ultimoTexto: sql<string | null>`(
        select m.cuerpo from crm_wa_messages m
        where m.conversation_id = crm_wa_conversations.id
        order by m.created_at desc limit 1
      )`,
      ultimaDireccion: sql<string | null>`(
        select m.direccion from crm_wa_messages m
        where m.conversation_id = crm_wa_conversations.id
        order by m.created_at desc limit 1
      )`,
      entrantes: sql<number>`(
        select count(*) from crm_wa_messages m
        where m.conversation_id = crm_wa_conversations.id and m.direccion = 'in'
      )::int`,
      porRevisar: sql<number>`(
        select count(*) from crm_wa_messages m
        where m.conversation_id = crm_wa_conversations.id
          and m.direccion = 'out' and m.estado in ('draft','retenido','failed')
      )::int`,
    })
    .from(crmWaConversations)
    .leftJoin(crmAccounts, eq(crmAccounts.id, crmWaConversations.accountId))
    .orderBy(desc(sql`coalesce(${crmWaConversations.ultimoMensajeEn}, ${crmWaConversations.createdAt})`))
    .limit(200);

  return filas.map((f) => ({
    id: f.c.id,
    telefono: f.c.telefono,
    nombre: f.c.nombre,
    estado: f.c.estado,
    baja: f.c.baja,
    accountId: f.c.accountId,
    cuenta: f.cuenta,
    ultimoMensajeEn: f.c.ultimoMensajeEn,
    ultimoTexto: f.ultimoTexto,
    ultimaDireccion: f.ultimaDireccion,
    sinLeer: f.entrantes,
    porRevisar: f.porRevisar,
  }));
}

export interface Hilo {
  conversacion: typeof crmWaConversations.$inferSelect;
  cuenta: { id: number; nombre: string } | null;
  contacto: { id: number; nombre: string } | null;
  mensajes: CrmWaMessage[];
}

export async function hilo(conversationId: number): Promise<Hilo | null> {
  const [fila] = await db
    .select({
      c: crmWaConversations,
      cuentaId: crmAccounts.id,
      cuenta: crmAccounts.nombre,
      contactoId: crmContacts.id,
      contacto: crmContacts.nombre,
    })
    .from(crmWaConversations)
    .leftJoin(crmAccounts, eq(crmAccounts.id, crmWaConversations.accountId))
    .leftJoin(crmContacts, eq(crmContacts.id, crmWaConversations.contactId))
    .where(eq(crmWaConversations.id, conversationId))
    .limit(1);

  if (!fila) return null;

  const mensajes = await db
    .select()
    .from(crmWaMessages)
    .where(eq(crmWaMessages.conversationId, conversationId))
    .orderBy(crmWaMessages.createdAt);

  return {
    conversacion: fila.c,
    cuenta: fila.cuentaId ? { id: fila.cuentaId, nombre: fila.cuenta! } : null,
    contacto: fila.contactoId ? { id: fila.contactoId, nombre: fila.contacto! } : null,
    mensajes,
  };
}

/**
 * Encuentra o crea la conversación de un teléfono.
 *
 * Una conversación por número, no por contacto: es como funciona WhatsApp de
 * verdad, y evita el caso feo de dos hilos paralelos con la misma persona.
 */
export async function conversacionDe(
  telefono: string,
  datos?: { accountId?: number | null; contactId?: number | null; nombre?: string | null },
): Promise<number> {
  const normalizado = normalizarTelefono(telefono);
  if (!normalizado) throw new Error(`Teléfono inválido: ${telefono}`);

  const [existente] = await db
    .select({ id: crmWaConversations.id })
    .from(crmWaConversations)
    .where(eq(crmWaConversations.telefono, normalizado))
    .limit(1);

  if (existente) return existente.id;

  const [creada] = await db
    .insert(crmWaConversations)
    .values({
      telefono: normalizado,
      accountId: datos?.accountId ?? null,
      contactId: datos?.contactId ?? null,
      nombre: datos?.nombre ?? null,
    })
    .returning({ id: crmWaConversations.id });

  return creada.id;
}

/**
 * Deja un mensaje saliente escrito.
 *
 * `aprobado` decide si nace en 'draft' (alguien tiene que revisarlo) o en
 * 'pending' (listo para salir). Nada nace 'sent': el estado de entrega lo pone
 * el despacho, nunca quien redacta.
 */
export async function redactar(datos: {
  conversationId: number;
  cuerpo: string;
  autorId: number | null;
  automatico?: boolean;
  aprobado?: boolean;
}): Promise<number> {
  const [creado] = await db
    .insert(crmWaMessages)
    .values({
      conversationId: datos.conversationId,
      direccion: "out",
      cuerpo: datos.cuerpo,
      estado: datos.aprobado ? "pending" : "draft",
      automatico: datos.automatico ?? false,
      autorId: datos.autorId,
    })
    .returning({ id: crmWaMessages.id });
  return creado.id;
}

/** Registra un mensaje entrante y aplica la palabra BAJA. */
export async function registrarEntrante(
  conversationId: number,
  cuerpo: string,
): Promise<void> {
  const ahora = new Date();
  await db.insert(crmWaMessages).values({
    conversationId,
    direccion: "in",
    cuerpo,
    estado: "sent",
    enviadoEn: ahora,
  });

  const esBaja = /\b(baja|stop|no molestar|elimin[ae]me)\b/i.test(cuerpo);
  await db
    .update(crmWaConversations)
    .set({ ultimoMensajeEn: ahora, ...(esBaja ? { baja: true, estado: "cerrada" } : {}) })
    .where(eq(crmWaConversations.id, conversationId));
}

// ─── Preparación masiva desde una alerta ─────────────────────────────────────

export interface Preparado {
  accountId: number;
  cuenta: string;
  contacto: string;
  telefono: string;
  mensaje: string;
  conversationId: number;
  messageId: number;
}

/**
 * Convierte una recomendación en borradores concretos, uno por cuenta.
 *
 * Nacen como borrador —nunca aprobados— aunque el usuario haya hecho clic en
 * "preparar mensajes". Un clic en una alerta no puede equivaler a autorizar 40
 * envíos; alguien tiene que leerlos y apretar enviar.
 */
export async function prepararParaCuentas(
  accountIds: number[],
  plantillaProposito: string,
  autorId: number,
  empresa: string,
  vendedor: string,
): Promise<Preparado[]> {
  if (accountIds.length === 0) return [];

  const plantillas = await listarPlantillas();
  const plantilla =
    plantillas.find((p) => p.proposito === plantillaProposito) ?? plantillas[0];
  if (!plantilla) return [];

  const contactos = await db
    .select({
      accountId: crmContacts.accountId,
      cuenta: crmAccounts.nombre,
      contactId: crmContacts.id,
      contacto: crmContacts.nombre,
      telefono: crmContacts.telefono,
    })
    .from(crmContacts)
    .innerJoin(crmAccounts, eq(crmAccounts.id, crmContacts.accountId))
    .where(
      and(
        inArray(crmContacts.accountId, accountIds),
        eq(crmContacts.optInWhatsapp, true),
        sql`${crmContacts.telefono} is not null`,
      ),
    );

  // Un mensaje por cuenta, al primer contacto autorizado: escribirle a tres
  // personas de la misma empresa por la misma razón es exactamente lo que hace
  // que una marca se sienta invasiva.
  const porCuenta = new Map<number, (typeof contactos)[number]>();
  for (const c of contactos) {
    if (!porCuenta.has(c.accountId)) porCuenta.set(c.accountId, c);
  }

  const resultado: Preparado[] = [];

  for (const c of porCuenta.values()) {
    const producto = await productoHabitual(c.accountId);
    const mensaje = renderPlantilla(plantilla.cuerpo, {
      contacto: c.contacto.split(" ")[0],
      cuenta: c.cuenta,
      producto: producto ?? "lo que trabajan con nosotros",
      empresa,
      vendedor,
      dias: await diasSinContacto(c.accountId),
    });

    const conversationId = await conversacionDe(c.telefono!, {
      accountId: c.accountId,
      contactId: c.contactId,
      nombre: c.contacto,
    });
    const messageId = await redactar({
      conversationId,
      cuerpo: mensaje,
      autorId,
      automatico: true,
      aprobado: false,
    });

    resultado.push({
      accountId: c.accountId,
      cuenta: c.cuenta,
      contacto: c.contacto,
      telefono: c.telefono!,
      mensaje,
      conversationId,
      messageId,
    });
  }

  return resultado;
}

async function productoHabitual(accountId: number): Promise<string | null> {
  const [fila] = await db
    .select({
      nombre: crmProducts.nombre,
      unidades: sql<number>`sum(oi.cantidad)::int`,
    })
    .from(sql`crm_order_items oi`)
    .innerJoin(sql`crm_orders o`, sql`o.id = oi.order_id`)
    .innerJoin(crmProducts, sql`${crmProducts.id} = oi.product_id`)
    .where(sql`o.account_id = ${accountId}`)
    .groupBy(crmProducts.nombre)
    .orderBy(sql`sum(oi.cantidad) desc`)
    .limit(1);
  return fila?.nombre ?? null;
}

async function diasSinContacto(accountId: number): Promise<number> {
  const [fila] = await db
    .select({
      ultima: sql<string | null>`max(a.ocurrido_en)`,
    })
    .from(sql`crm_activities a`)
    .where(sql`a.account_id = ${accountId}`);
  if (!fila?.ultima) return 0;
  return Math.floor((Date.now() - new Date(fila.ultima).getTime()) / 86_400_000);
}

/** Mensajes salientes que esperan revisión o fallaron. */
export async function porRevisar() {
  return db
    .select({
      m: crmWaMessages,
      telefono: crmWaConversations.telefono,
      nombre: crmWaConversations.nombre,
      cuenta: crmAccounts.nombre,
    })
    .from(crmWaMessages)
    .innerJoin(crmWaConversations, eq(crmWaConversations.id, crmWaMessages.conversationId))
    .leftJoin(crmAccounts, eq(crmAccounts.id, crmWaConversations.accountId))
    .where(
      and(
        eq(crmWaMessages.direccion, "out"),
        inArray(crmWaMessages.estado, ["draft", "retenido", "failed"]),
      ),
    )
    .orderBy(desc(crmWaMessages.createdAt))
    .limit(100);
}
