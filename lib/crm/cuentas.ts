// Cuentas y contactos — y la ficha 360 que junta todo lo que se sabe de una
// cuenta en una sola consulta.
//
// La ficha es el corazón del CRM: si para contestar "¿cómo vamos con este
// cliente?" hay que abrir cinco pantallas, el CRM no está conectado con ventas,
// solo guarda datos.

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
  crmTouchpoints,
  crmUsers,
  type CrmAccount,
  type CrmActivity,
  type CrmContact,
  type CrmDeal,
} from "@/db/crm";

export interface CuentaListada extends CrmAccount {
  contactos: number;
  dealsAbiertos: number;
  montoAbierto: number;
  facturado: number;
  ultimaCompra: Date | null;
  ultimaActividad: Date | null;
  owner: string | null;
}

/**
 * Listado con los agregados que la gente mira antes de abrir la ficha.
 *
 * Se resuelve con subconsultas escalares en vez de cinco joins: con joins a
 * tablas 1-a-N los montos se multiplican entre sí y quedan cifras infladas que
 * nadie logra explicar después.
 *
 * Las subconsultas nombran `crm_accounts.id` en texto plano y no `${crmAccounts.id}`.
 * Drizzle califica la columna con su tabla solo cuando la consulta tiene joins;
 * sin joins escribe `"id"` a secas, y adentro de la subconsulta ese `"id"` se
 * resuelve contra la tabla de la subconsulta. La consulta corre sin error y
 * devuelve cifras equivocadas. Escribirlo calificado no depende de eso.
 */
export async function listarCuentas(opciones?: {
  ownerId?: number | null;
  estado?: string;
  busqueda?: string;
}): Promise<CuentaListada[]> {
  const condiciones = [];
  if (opciones?.ownerId != null) condiciones.push(eq(crmAccounts.ownerId, opciones.ownerId));
  if (opciones?.estado) condiciones.push(eq(crmAccounts.estado, opciones.estado));
  if (opciones?.busqueda) {
    const q = `%${opciones.busqueda.toLowerCase()}%`;
    condiciones.push(sql`lower(${crmAccounts.nombre}) like ${q}`);
  }

  const filas = await db
    .select({
      cuenta: crmAccounts,
      owner: crmUsers.nombre,
      contactos: sql<number>`(select count(*) from crm_contacts c where c.account_id = crm_accounts.id)::int`,
      dealsAbiertos: sql<number>`(select count(*) from crm_deals d where d.account_id = crm_accounts.id and d.etapa not in ('ganado','perdido'))::int`,
      montoAbierto: sql<number>`coalesce((select sum(d.monto) from crm_deals d where d.account_id = crm_accounts.id and d.etapa not in ('ganado','perdido')),0)::float8`,
      facturado: sql<number>`coalesce((select sum(o.total) from crm_orders o where o.account_id = crm_accounts.id),0)::float8`,
      ultimaCompra: sql<Date | null>`(select max(o.fecha) from crm_orders o where o.account_id = crm_accounts.id)`,
      ultimaActividad: sql<Date | null>`(select max(a.ocurrido_en) from crm_activities a where a.account_id = crm_accounts.id)`,
    })
    .from(crmAccounts)
    .leftJoin(crmUsers, eq(crmUsers.id, crmAccounts.ownerId))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(sql`coalesce((select sum(o.total) from crm_orders o where o.account_id = crm_accounts.id),0)`));

  return filas.map((f) => ({
    ...f.cuenta,
    owner: f.owner,
    contactos: f.contactos,
    dealsAbiertos: f.dealsAbiertos,
    montoAbierto: f.montoAbierto,
    facturado: f.facturado,
    ultimaCompra: f.ultimaCompra ? new Date(f.ultimaCompra) : null,
    ultimaActividad: f.ultimaActividad ? new Date(f.ultimaActividad) : null,
  }));
}

export interface CompraHistorica {
  orderId: number;
  fecha: Date;
  total: number;
  canal: string | null;
  productos: { nombre: string; sku: string; cantidad: number; subtotal: number }[];
}

export interface Ficha360 {
  cuenta: CrmAccount;
  owner: string | null;
  contactos: CrmContact[];
  deals: CrmDeal[];
  actividades: (CrmActivity & { autor: string | null })[];
  compras: CompraHistorica[];
  /** Campañas que tocaron a esta cuenta, en orden cronológico. */
  recorrido: {
    fecha: Date;
    tipo: string;
    campana: string | null;
    canal: string | null;
    detalle: string | null;
  }[];
  totales: {
    facturado: number;
    compras: number;
    ticketPromedio: number;
    montoAbierto: number;
    /** Días promedio entre compras. null si compró una vez o ninguna. */
    cicloRecompraDias: number | null;
    /** Días desde la última compra. */
    diasSinComprar: number | null;
  };
}

export async function ficha360(accountId: number): Promise<Ficha360 | null> {
  const [cuentaFila] = await db
    .select({ cuenta: crmAccounts, owner: crmUsers.nombre })
    .from(crmAccounts)
    .leftJoin(crmUsers, eq(crmUsers.id, crmAccounts.ownerId))
    .where(eq(crmAccounts.id, accountId))
    .limit(1);

  if (!cuentaFila) return null;

  const [contactos, deals, actividades, ordenes, recorridoCrudo] = await Promise.all([
    db.select().from(crmContacts).where(eq(crmContacts.accountId, accountId)).orderBy(desc(crmContacts.esDecisor)),
    db.select().from(crmDeals).where(eq(crmDeals.accountId, accountId)).orderBy(desc(crmDeals.abiertoEn)),
    db
      .select({ act: crmActivities, autor: crmUsers.nombre })
      .from(crmActivities)
      .leftJoin(crmUsers, eq(crmUsers.id, crmActivities.ownerId))
      .where(eq(crmActivities.accountId, accountId))
      .orderBy(desc(crmActivities.ocurridoEn))
      .limit(40),
    db.select().from(crmOrders).where(eq(crmOrders.accountId, accountId)).orderBy(desc(crmOrders.fecha)),
    db
      .select({
        fecha: crmTouchpoints.ocurridoEn,
        tipo: crmTouchpoints.tipo,
        detalle: crmTouchpoints.detalle,
        campana: crmCampaigns.nombre,
        canal: crmCampaigns.canal,
      })
      .from(crmTouchpoints)
      .leftJoin(crmCampaigns, eq(crmCampaigns.id, crmTouchpoints.campaignId))
      .where(eq(crmTouchpoints.accountId, accountId))
      .orderBy(desc(crmTouchpoints.ocurridoEn))
      .limit(30),
  ]);

  const items =
    ordenes.length > 0
      ? await db
          .select({
            orderId: crmOrderItems.orderId,
            nombre: crmProducts.nombre,
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
    productos: items
      .filter((i) => i.orderId === o.id)
      .map((i) => ({
        nombre: i.nombre,
        sku: i.sku,
        cantidad: i.cantidad,
        subtotal: i.cantidad * i.precio,
      })),
  }));

  const facturado = ordenes.reduce((s, o) => s + o.total, 0);
  const montoAbierto = deals
    .filter((d) => d.etapa !== "ganado" && d.etapa !== "perdido")
    .reduce((s, d) => s + d.monto, 0);

  return {
    cuenta: cuentaFila.cuenta,
    owner: cuentaFila.owner,
    contactos,
    deals,
    actividades: actividades.map((a) => ({ ...a.act, autor: a.autor })),
    compras,
    recorrido: recorridoCrudo.map((r) => ({ ...r, fecha: new Date(r.fecha) })),
    totales: {
      facturado,
      compras: ordenes.length,
      ticketPromedio: ordenes.length ? Math.round(facturado / ordenes.length) : 0,
      montoAbierto,
      cicloRecompraDias: cicloRecompra(ordenes.map((o) => o.fecha)),
      diasSinComprar: ordenes.length
        ? Math.floor((Date.now() - new Date(ordenes[0].fecha).getTime()) / 86_400_000)
        : null,
    },
  };
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
  const ordenadas = fechas
    .map((f) => new Date(f).getTime())
    .sort((a, b) => a - b);
  let suma = 0;
  for (let i = 1; i < ordenadas.length; i++) {
    suma += ordenadas[i] - ordenadas[i - 1];
  }
  return Math.round(suma / (ordenadas.length - 1) / 86_400_000);
}

export async function contarCuentas(): Promise<Record<string, number>> {
  const filas = await db
    .select({ estado: crmAccounts.estado, n: sql<number>`count(*)::int` })
    .from(crmAccounts)
    .groupBy(crmAccounts.estado);
  return Object.fromEntries(filas.map((f) => [f.estado, f.n]));
}

export async function buscarContactoPorTelefono(telefono: string) {
  const [fila] = await db
    .select({ contacto: crmContacts, cuenta: crmAccounts })
    .from(crmContacts)
    .innerJoin(crmAccounts, eq(crmAccounts.id, crmContacts.accountId))
    .where(eq(crmContacts.telefono, telefono))
    .limit(1);
  return fila ?? null;
}
