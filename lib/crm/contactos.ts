// Los clientes. **El eje del CRM.**
//
// Reemplaza a lib/crm/cuentas.ts como entidad principal: en una boutique de
// alta gama el cliente es una persona con nombre y teléfono, no una razón
// social. La empresa sigue existiendo (lib/crm/cuentas.ts) para el regalo
// corporativo, que es la excepción.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmAccounts,
  crmActivities,
  crmCampaigns,
  crmContacts,
  crmDeals,
  crmOrderItems,
  crmOrders,
  crmProducts,
  crmQuotes,
  crmTouchpoints,
  crmUsers,
  crmWaConversations,
  type CrmActivity,
  type CrmContact,
  type CrmDeal,
} from "@/db/crm";

export interface ClienteListado extends CrmContact {
  owner: string | null;
  empresa: string | null;
  compras: number;
  facturado: number;
  ultimaCompra: Date | null;
  ultimaActividad: Date | null;
  dealsAbiertos: number;
  montoAbierto: number;
  cotizacionesAbiertas: number;
  conversationId: number | null;
}

/**
 * Listado con los agregados que se miran antes de abrir la ficha.
 *
 * Subconsultas escalares en vez de joins a tablas 1-a-N: con joins, los montos
 * se multiplican entre sí y quedan cifras infladas que nadie logra explicar.
 * La tabla se nombra en texto plano (`crm_contacts.id`) porque Drizzle solo
 * califica la columna cuando la consulta tiene joins.
 */
export async function listarClientes(opciones?: {
  ownerId?: number | null;
  estado?: string;
  busqueda?: string;
  etiqueta?: string;
  limite?: number;
}): Promise<ClienteListado[]> {
  const condiciones = [];
  if (opciones?.ownerId != null) condiciones.push(eq(crmContacts.ownerId, opciones.ownerId));
  if (opciones?.estado) condiciones.push(eq(crmContacts.estado, opciones.estado));
  if (opciones?.busqueda) {
    const q = `%${opciones.busqueda.toLowerCase()}%`;
    condiciones.push(
      sql`(unaccent(lower(${crmContacts.nombre})) like unaccent(${q})
           or ${crmContacts.telefono} like ${q}
           or lower(coalesce(${crmContacts.email}, '')) like ${q})`,
    );
  }
  if (opciones?.etiqueta) {
    condiciones.push(sql`${crmContacts.etiquetas} @> ${JSON.stringify([opciones.etiqueta])}::jsonb`);
  }

  const filas = await db
    .select({
      c: crmContacts,
      owner: crmUsers.nombre,
      empresa: crmAccounts.nombre,
      compras: sql<number>`(select count(*) from crm_orders o where o.contact_id = crm_contacts.id)::int`,
      facturado: sql<number>`coalesce((select sum(o.total) from crm_orders o where o.contact_id = crm_contacts.id),0)::float8`,
      ultimaCompra: sql<string | null>`(select max(o.fecha) from crm_orders o where o.contact_id = crm_contacts.id)`,
      ultimaActividad: sql<string | null>`(select max(a.ocurrido_en) from crm_activities a where a.contact_id = crm_contacts.id)`,
      dealsAbiertos: sql<number>`(select count(*) from crm_deals d where d.contact_id = crm_contacts.id and d.etapa not in ('ganado','perdido'))::int`,
      montoAbierto: sql<number>`coalesce((select sum(d.monto) from crm_deals d where d.contact_id = crm_contacts.id and d.etapa not in ('ganado','perdido')),0)::float8`,
      cotizacionesAbiertas: sql<number>`(select count(*) from crm_quotes q where q.contact_id = crm_contacts.id and q.estado in ('abierta','enviada'))::int`,
      conversationId: sql<number | null>`(select w.id from crm_wa_conversations w where w.contact_id = crm_contacts.id limit 1)`,
    })
    .from(crmContacts)
    .leftJoin(crmUsers, eq(crmUsers.id, crmContacts.ownerId))
    .leftJoin(crmAccounts, eq(crmAccounts.id, crmContacts.accountId))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(sql`coalesce((select sum(o.total) from crm_orders o where o.contact_id = crm_contacts.id),0)`))
    .limit(opciones?.limite ?? 400);

  return filas.map((f) => ({
    ...f.c,
    owner: f.owner,
    empresa: f.empresa,
    compras: f.compras,
    facturado: f.facturado,
    ultimaCompra: f.ultimaCompra ? new Date(f.ultimaCompra) : null,
    ultimaActividad: f.ultimaActividad ? new Date(f.ultimaActividad) : null,
    dealsAbiertos: f.dealsAbiertos,
    montoAbierto: f.montoAbierto,
    cotizacionesAbiertas: f.cotizacionesAbiertas,
    conversationId: f.conversationId,
  }));
}

export interface CompraHistorica {
  orderId: number;
  fecha: Date;
  total: number;
  canal: string | null;
  piezas: { nombre: string; marca: string | null; sku: string; cantidad: number; subtotal: number }[];
}

export interface FichaCliente {
  contacto: CrmContact;
  owner: string | null;
  empresa: string | null;
  deals: CrmDeal[];
  actividades: (CrmActivity & { autor: string | null })[];
  compras: CompraHistorica[];
  cotizaciones: { id: number; estado: string; total: number; createdAt: Date; piezas: number }[];
  conversationId: number | null;
  recorrido: { fecha: Date; tipo: string; campana: string | null; canal: string | null }[];
  totales: {
    facturado: number;
    compras: number;
    ticketPromedio: number;
    montoAbierto: number;
    cicloRecompraDias: number | null;
    diasSinComprar: number | null;
    /** Lo que más compra, para saber por dónde entrar. */
    categoriaHabitual: string | null;
    marcaHabitual: string | null;
  };
}

export async function fichaCliente(contactId: number): Promise<FichaCliente | null> {
  const [base] = await db
    .select({ c: crmContacts, owner: crmUsers.nombre, empresa: crmAccounts.nombre })
    .from(crmContacts)
    .leftJoin(crmUsers, eq(crmUsers.id, crmContacts.ownerId))
    .leftJoin(crmAccounts, eq(crmAccounts.id, crmContacts.accountId))
    .where(eq(crmContacts.id, contactId))
    .limit(1);

  if (!base) return null;

  const [deals, actividades, ordenes, cotizaciones, recorridoCrudo, conversacion] =
    await Promise.all([
      db.select().from(crmDeals).where(eq(crmDeals.contactId, contactId)).orderBy(desc(crmDeals.abiertoEn)),
      db
        .select({ act: crmActivities, autor: crmUsers.nombre })
        .from(crmActivities)
        .leftJoin(crmUsers, eq(crmUsers.id, crmActivities.ownerId))
        .where(eq(crmActivities.contactId, contactId))
        .orderBy(desc(crmActivities.ocurridoEn))
        .limit(40),
      db.select().from(crmOrders).where(eq(crmOrders.contactId, contactId)).orderBy(desc(crmOrders.fecha)),
      db
        .select({
          id: crmQuotes.id,
          estado: crmQuotes.estado,
          total: crmQuotes.total,
          createdAt: crmQuotes.createdAt,
          piezas: sql<number>`(select count(*) from crm_quote_items it where it.quote_id = crm_quotes.id)::int`,
        })
        .from(crmQuotes)
        .where(eq(crmQuotes.contactId, contactId))
        .orderBy(desc(crmQuotes.createdAt)),
      db
        .select({
          fecha: crmTouchpoints.ocurridoEn,
          tipo: crmTouchpoints.tipo,
          campana: crmCampaigns.nombre,
          canal: crmCampaigns.canal,
        })
        .from(crmTouchpoints)
        .leftJoin(crmCampaigns, eq(crmCampaigns.id, crmTouchpoints.campaignId))
        .where(eq(crmTouchpoints.contactId, contactId))
        .orderBy(desc(crmTouchpoints.ocurridoEn))
        .limit(25),
      db
        .select({ id: crmWaConversations.id })
        .from(crmWaConversations)
        .where(eq(crmWaConversations.contactId, contactId))
        .limit(1),
    ]);

  const items =
    ordenes.length > 0
      ? await db
          .select({
            orderId: crmOrderItems.orderId,
            nombre: crmProducts.nombre,
            marca: crmProducts.marca,
            categoria: crmProducts.categoria,
            sku: crmProducts.sku,
            cantidad: crmOrderItems.cantidad,
            precio: crmOrderItems.precioUnitario,
          })
          .from(crmOrderItems)
          .innerJoin(crmProducts, eq(crmProducts.id, crmOrderItems.productId))
          .where(inArray(crmOrderItems.orderId, ordenes.map((o) => o.id)))
      : [];

  const compras: CompraHistorica[] = ordenes.map((o) => ({
    orderId: o.id,
    fecha: o.fecha,
    total: o.total,
    canal: o.canal,
    piezas: items
      .filter((i) => i.orderId === o.id)
      .map((i) => ({
        nombre: i.nombre,
        marca: i.marca,
        sku: i.sku,
        cantidad: i.cantidad,
        subtotal: i.cantidad * i.precio,
      })),
  }));

  const facturado = ordenes.reduce((s, o) => s + o.total, 0);

  return {
    contacto: base.c,
    owner: base.owner,
    empresa: base.empresa,
    deals,
    actividades: actividades.map((a) => ({ ...a.act, autor: a.autor })),
    compras,
    cotizaciones,
    conversationId: conversacion[0]?.id ?? null,
    recorrido: recorridoCrudo.map((r) => ({ ...r, fecha: new Date(r.fecha) })),
    totales: {
      facturado,
      compras: ordenes.length,
      ticketPromedio: ordenes.length ? Math.round(facturado / ordenes.length) : 0,
      montoAbierto: deals
        .filter((d) => d.etapa !== "ganado" && d.etapa !== "perdido")
        .reduce((s, d) => s + d.monto, 0),
      cicloRecompraDias: cicloRecompra(ordenes.map((o) => o.fecha)),
      diasSinComprar: ordenes.length
        ? Math.floor((Date.now() - new Date(ordenes[0].fecha).getTime()) / 86_400_000)
        : null,
      categoriaHabitual: masFrecuente(items.map((i) => i.categoria)),
      marcaHabitual: masFrecuente(items.map((i) => i.marca)),
    },
  };
}

function masFrecuente(valores: (string | null)[]): string | null {
  const conteo = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    conteo.set(v, (conteo.get(v) ?? 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Días promedio entre compras consecutivas.
 *
 * Promedio simple y no mediana: con 3-6 compras, que es lo típico, la mediana
 * salta entre valores enteros y da la impresión de que el ciclo cambió cuando
 * solo se agregó una compra.
 */
export function cicloRecompra(fechas: (Date | string)[]): number | null {
  if (fechas.length < 2) return null;
  const ordenadas = fechas.map((f) => new Date(f).getTime()).sort((a, b) => a - b);
  let suma = 0;
  for (let i = 1; i < ordenadas.length; i++) suma += ordenadas[i] - ordenadas[i - 1];
  return Math.round(suma / (ordenadas.length - 1) / 86_400_000);
}

export async function contarClientes(): Promise<Record<string, number>> {
  const filas = await db
    .select({ estado: crmContacts.estado, n: sql<number>`count(*)::int` })
    .from(crmContacts)
    .groupBy(crmContacts.estado);
  return Object.fromEntries(filas.map((f) => [f.estado, f.n]));
}

/** Todas las etiquetas en uso, para los filtros. */
export async function etiquetasEnUso(): Promise<string[]> {
  const filas = await db
    .select({ etiqueta: sql<string>`jsonb_array_elements_text(${crmContacts.etiquetas})` })
    .from(crmContacts)
    .where(sql`${crmContacts.etiquetas} is not null`);
  return [...new Set(filas.map((f) => f.etiqueta))].sort();
}

export async function contactoPorTelefono(telefono: string) {
  const [c] = await db
    .select()
    .from(crmContacts)
    .where(eq(crmContacts.telefono, telefono))
    .limit(1);
  return c ?? null;
}
