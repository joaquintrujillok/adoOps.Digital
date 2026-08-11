// Oportunidades — el tablero, la ficha y las reglas de movimiento.

import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmActivities,
  crmCampaigns,
  crmContacts,
  crmDealItems,
  crmDeals,
  crmProducts,
  crmUsers,
  type CrmDeal,
} from "@/db/crm";
import { ETAPAS_ABIERTAS_IDS, esCerrada, probabilidadDe } from "./etapas";

export interface DealListado {
  id: number;
  titulo: string;
  etapa: string;
  monto: number;
  probabilidad: number;
  contactId: number | null;
  cliente: string;
  contacto: string | null;
  owner: string | null;
  ownerId: number | null;
  fuente: string | null;
  abiertoEn: Date;
  cierreEstimado: Date | null;
  ultimaActividadEn: Date | null;
  /** Días sin ninguna actividad registrada. null si nunca hubo. */
  diasSinTocar: number | null;
}

function conDiasSinTocar<T extends { ultimaActividadEn: Date | null; abiertoEn: Date }>(
  d: T,
): T & { diasSinTocar: number | null } {
  const ref = d.ultimaActividadEn ?? d.abiertoEn;
  return {
    ...d,
    diasSinTocar: ref
      ? Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000)
      : null,
  };
}

export async function listarDeals(opciones?: {
  ownerId?: number | null;
  etapas?: string[];
  contactId?: number;
  limite?: number;
}): Promise<DealListado[]> {
  const condiciones = [];
  if (opciones?.ownerId != null) condiciones.push(eq(crmDeals.ownerId, opciones.ownerId));
  if (opciones?.etapas?.length) condiciones.push(inArray(crmDeals.etapa, opciones.etapas));
  if (opciones?.contactId) condiciones.push(eq(crmDeals.contactId, opciones.contactId));

  const filas = await db
    .select({
      d: crmDeals,
      cliente: crmContacts.nombre,
      contacto: crmContacts.nombre,
      owner: crmUsers.nombre,
    })
    .from(crmDeals)
    .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .leftJoin(crmUsers, eq(crmUsers.id, crmDeals.ownerId))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(crmDeals.monto))
    .limit(opciones?.limite ?? 500);

  return filas.map((f) =>
    conDiasSinTocar({
      id: f.d.id,
      titulo: f.d.titulo,
      etapa: f.d.etapa,
      monto: f.d.monto,
      probabilidad: f.d.probabilidad,
      contactId: f.d.contactId,
      cliente: f.cliente ?? "Sin cliente",
      contacto: f.contacto,
      owner: f.owner,
      ownerId: f.d.ownerId,
      fuente: f.d.fuente,
      abiertoEn: f.d.abiertoEn,
      cierreEstimado: f.d.cierreEstimado,
      ultimaActividadEn: f.d.ultimaActividadEn,
    }),
  );
}

/** Cuántas actividades de cada tipo lleva la oportunidad. */
export type ConteoActividades = Record<string, number>;

export interface DealEnTablero extends DealListado {
  actividades: ConteoActividades;
}

export interface Columna {
  etapa: string;
  nombre: string;
  /** La de la etapa, no el promedio de las oportunidades: es la del encabezado. */
  probabilidad: number;
  deals: DealEnTablero[];
  total: number;
  ponderado: number;
}

/**
 * Cuántas actividades de cada tipo tiene cada oportunidad.
 *
 * Una sola consulta agrupada para todo el tablero. La alternativa —una
 * subconsulta por tipo dentro de `listarDeals`— multiplicaría por cinco el
 * trabajo de una consulta que además usan otras cuatro pantallas que no
 * necesitan estos conteos.
 */
async function actividadesPorDeal(dealIds: number[]): Promise<Map<number, ConteoActividades>> {
  const mapa = new Map<number, ConteoActividades>();
  if (dealIds.length === 0) return mapa;

  const filas = await db
    .select({
      dealId: crmActivities.dealId,
      tipo: crmActivities.tipo,
      n: sql<number>`count(*)::int`,
    })
    .from(crmActivities)
    .where(inArray(crmActivities.dealId, dealIds))
    .groupBy(crmActivities.dealId, crmActivities.tipo);

  for (const f of filas) {
    if (f.dealId == null) continue;
    const actual = mapa.get(f.dealId) ?? {};
    actual[f.tipo] = f.n;
    mapa.set(f.dealId, actual);
  }
  return mapa;
}

/** El tablero: una columna por etapa abierta, con su total y su ponderado. */
export async function tablero(ownerId?: number | null): Promise<Columna[]> {
  const deals = await listarDeals({ ownerId, etapas: ETAPAS_ABIERTAS_IDS });
  const { ETAPAS_ABIERTAS } = await import("./etapas");
  const conteos = await actividadesPorDeal(deals.map((d) => d.id));

  return ETAPAS_ABIERTAS.map((e) => {
    const propios = deals
      .filter((d) => d.etapa === e.id)
      .map((d) => ({ ...d, actividades: conteos.get(d.id) ?? {} }));
    return {
      etapa: e.id,
      nombre: e.nombre,
      probabilidad: e.probabilidad,
      deals: propios,
      total: propios.reduce((s, d) => s + d.monto, 0),
      // Ponderado por probabilidad: es la cifra honesta para proyectar. El total
      // bruto del pipeline siempre se ve espectacular y nunca se cumple.
      ponderado: Math.round(
        propios.reduce((s, d) => s + (d.monto * d.probabilidad) / 100, 0),
      ),
    };
  });
}

export interface FichaDeal {
  deal: CrmDeal;
  cliente: { id: number; nombre: string; estado: string; telefono: string | null; email: string | null } | null;
  owner: string | null;
  items: {
    id: number;
    productId: number;
    nombre: string;
    sku: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
    /** null = producto sin inventario (un servicio), no "cero disponibles". */
    disponible: number | null;
    leadTimeDias: number;
  }[];
  actividades: { id: number; tipo: string; titulo: string; detalle: string | null; ocurridoEn: Date; autor: string | null }[];
  campanaOrigen: string | null;
  campanaUltima: string | null;
}

export async function fichaDeal(dealId: number): Promise<FichaDeal | null> {
  const [fila] = await db
    .select({
      d: crmDeals,
      contactoId: crmContacts.id,
      contacto: crmContacts.nombre,
      contactoEstado: crmContacts.estado,
      telefono: crmContacts.telefono,
      email: crmContacts.email,
      owner: crmUsers.nombre,
    })
    .from(crmDeals)
    .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .leftJoin(crmUsers, eq(crmUsers.id, crmDeals.ownerId))
    .where(eq(crmDeals.id, dealId))
    .limit(1);

  if (!fila) return null;

  const [items, actividades, campanas] = await Promise.all([
    db
      .select({
        id: crmDealItems.id,
        productId: crmDealItems.productId,
        nombre: crmProducts.nombre,
        sku: crmProducts.sku,
        cantidad: crmDealItems.cantidad,
        precioUnitario: crmDealItems.precioUnitario,
        // Sin coalesce: `null` significa "este producto no lleva inventario"
        // (los servicios), que es distinto de "hay cero disponibles".
        stock: sql<number | null>`(select (i.stock - i.reservado)::int from crm_inventory i where i.product_id = crm_deal_items.product_id)`,
        leadTimeDias: sql<number>`coalesce((select i.lead_time_dias from crm_inventory i where i.product_id = crm_deal_items.product_id), 0)::int`,
      })
      .from(crmDealItems)
      .innerJoin(crmProducts, eq(crmProducts.id, crmDealItems.productId))
      .where(eq(crmDealItems.dealId, dealId)),
    db
      .select({
        id: crmActivities.id,
        tipo: crmActivities.tipo,
        titulo: crmActivities.titulo,
        detalle: crmActivities.detalle,
        ocurridoEn: crmActivities.ocurridoEn,
        autor: crmUsers.nombre,
      })
      .from(crmActivities)
      .leftJoin(crmUsers, eq(crmUsers.id, crmActivities.ownerId))
      .where(eq(crmActivities.dealId, dealId))
      .orderBy(desc(crmActivities.ocurridoEn))
      .limit(30),
    db
      .select({ id: crmCampaigns.id, nombre: crmCampaigns.nombre })
      .from(crmCampaigns)
      .where(
        or(
          fila.d.campaignFirstId ? eq(crmCampaigns.id, fila.d.campaignFirstId) : undefined,
          fila.d.campaignLastId ? eq(crmCampaigns.id, fila.d.campaignLastId) : undefined,
        ),
      ),
  ]);

  return {
    deal: fila.d,
    cliente: fila.contactoId
      ? {
          id: fila.contactoId,
          nombre: fila.contacto!,
          estado: fila.contactoEstado!,
          telefono: fila.telefono,
          email: fila.email,
        }
      : null,
    owner: fila.owner,
    items: items.map((i) => ({
      ...i,
      subtotal: i.cantidad * i.precioUnitario,
      disponible: i.stock,
    })),
    actividades,
    campanaOrigen:
      campanas.find((c) => c.id === fila.d.campaignFirstId)?.nombre ?? null,
    campanaUltima:
      campanas.find((c) => c.id === fila.d.campaignLastId)?.nombre ?? null,
  };
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

/**
 * Mueve una oportunidad de etapa y deja el rastro.
 *
 * Escribe una actividad siempre: sin bitácora, dos semanas después nadie
 * recuerda por qué un negocio pasó a "negociación" ni quién lo movió. Y esa
 * actividad es la que alimenta las alertas de estancamiento.
 */
export async function moverEtapa(
  dealId: number,
  etapa: string,
  usuarioId: number,
  motivoPerdida?: string,
): Promise<void> {
  const ahora = new Date();
  const [previo] = await db
    .select({ etapa: crmDeals.etapa, titulo: crmDeals.titulo, contactId: crmDeals.contactId })
    .from(crmDeals)
    .where(eq(crmDeals.id, dealId))
    .limit(1);
  if (!previo) throw new Error("La oportunidad no existe");

  await db
    .update(crmDeals)
    .set({
      etapa,
      probabilidad: probabilidadDe(etapa),
      cerradoEn: esCerrada(etapa) ? ahora : null,
      motivoPerdida: etapa === "perdido" ? (motivoPerdida ?? null) : null,
      ultimaActividadEn: ahora,
    })
    .where(eq(crmDeals.id, dealId));

  const { nombreEtapa } = await import("./etapas");
  await db.insert(crmActivities).values({
    contactId: previo.contactId,
    dealId,
    tipo: "nota",
    titulo: `Etapa: ${nombreEtapa(previo.etapa)} → ${nombreEtapa(etapa)}`,
    detalle: motivoPerdida ? `Motivo: ${motivoPerdida}` : null,
    ownerId: usuarioId,
    ocurridoEn: ahora,
  });
}

export async function registrarActividad(datos: {
  contactId: number;
  dealId?: number | null;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  ownerId: number;
  venceEn?: Date | null;
  completada?: boolean;
}): Promise<void> {
  const ahora = new Date();
  await db.insert(crmActivities).values({
    contactId: datos.contactId,
    dealId: datos.dealId ?? null,
    tipo: datos.tipo,
    titulo: datos.titulo,
    detalle: datos.detalle ?? null,
    ownerId: datos.ownerId,
    ocurridoEn: ahora,
    venceEn: datos.venceEn ?? null,
    completada: datos.completada ?? true,
  });

  if (datos.dealId) {
    await db
      .update(crmDeals)
      .set({ ultimaActividadEn: ahora })
      .where(eq(crmDeals.id, datos.dealId));
  }
}

/** Tareas pendientes: lo que hay que hacer hoy, y lo que ya se pasó. */
export async function tareasPendientes(ownerId?: number | null) {
  const condiciones = [
    eq(crmActivities.tipo, "tarea"),
    eq(crmActivities.completada, false),
  ];
  if (ownerId != null) condiciones.push(eq(crmActivities.ownerId, ownerId));

  const filas = await db
    .select({
      id: crmActivities.id,
      titulo: crmActivities.titulo,
      venceEn: crmActivities.venceEn,
      contactId: crmActivities.contactId,
      cliente: crmContacts.nombre,
      dealId: crmActivities.dealId,
      owner: crmUsers.nombre,
    })
    .from(crmActivities)
    .leftJoin(crmContacts, eq(crmContacts.id, crmActivities.contactId))
    .leftJoin(crmUsers, eq(crmUsers.id, crmActivities.ownerId))
    .where(and(...condiciones))
    .orderBy(crmActivities.venceEn)
    .limit(50);

  const hoy = new Date();
  return filas.map((f) => ({
    ...f,
    vencida: f.venceEn ? new Date(f.venceEn) < hoy : false,
  }));
}

/** Oportunidades sin dueño: se pierden solas si nadie las mira. */
export async function sinDueno(): Promise<number> {
  const [fila] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(crmDeals)
    .where(and(isNull(crmDeals.ownerId), inArray(crmDeals.etapa, ETAPAS_ABIERTAS_IDS)));
  return fila?.n ?? 0;
}
