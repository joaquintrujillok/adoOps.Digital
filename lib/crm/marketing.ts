// Trazabilidad marketing → oportunidades → ventas.
//
// La pregunta que este módulo contesta es la más cara de todas: de la plata que
// pusiste en marketing, ¿cuál volvió? Para responderla hace falta una cadena
// completa —campaña, contacto tocado, oportunidad abierta, venta cerrada— y por
// eso cada oportunidad guarda `campaign_first_id` y `campaign_last_id`.
//
// Se muestran las dos atribuciones, nunca una sola:
//   · primer toque  — quién trajo al cliente (mide adquisición)
//   · último toque  — qué gatilló el cierre (mide conversión)
// Elegir una y esconder la otra es como se fabrican los reportes que hacen
// invertir donde no corresponde.

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmCampaigns,
  crmDeals,
  crmOrders,
  crmTouchpoints,
  type CrmCampaign,
} from "@/db/crm";

export interface RendimientoCampana {
  campana: CrmCampaign;
  toques: number;
  contactosAlcanzados: number;
  cuentasAlcanzadas: number;
  /** Oportunidades cuyo PRIMER toque fue esta campaña. */
  dealsPrimerToque: number;
  /** Oportunidades cuyo ÚLTIMO toque antes de abrirse fue esta campaña. */
  dealsUltimoToque: number;
  ganadosPrimerToque: number;
  ingresosPrimerToque: number;
  ingresosUltimoToque: number;
  costo: number;
  /** Costo por oportunidad generada (primer toque). null si no generó ninguna. */
  costoPorOportunidad: number | null;
  /** Costo de adquisición por cliente ganado. null si no ganó ninguno. */
  cac: number | null;
  /** Retorno sobre la inversión, en veces. null si no hubo costo. */
  roi: number | null;
  tasaCierre: number;
}

export async function rendimientoCampanas(): Promise<RendimientoCampana[]> {
  const campanas = await db.select().from(crmCampaigns).orderBy(desc(crmCampaigns.inicio));
  if (campanas.length === 0) return [];

  const ids = campanas.map((c) => c.id);

  const [toques, primerToque, ultimoToque] = await Promise.all([
    db
      .select({
        campaignId: crmTouchpoints.campaignId,
        toques: sql<number>`count(*)::int`,
        contactos: sql<number>`count(distinct ${crmTouchpoints.contactId})::int`,
        cuentas: sql<number>`count(distinct ${crmTouchpoints.accountId})::int`,
      })
      .from(crmTouchpoints)
      .where(inArray(crmTouchpoints.campaignId, ids))
      .groupBy(crmTouchpoints.campaignId),
    db
      .select({
        campaignId: crmDeals.campaignFirstId,
        deals: sql<number>`count(*)::int`,
        ganados: sql<number>`count(*) filter (where ${crmDeals.etapa} = 'ganado')::int`,
        ingresos: sql<number>`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)::int`,
      })
      .from(crmDeals)
      .where(inArray(crmDeals.campaignFirstId, ids))
      .groupBy(crmDeals.campaignFirstId),
    db
      .select({
        campaignId: crmDeals.campaignLastId,
        deals: sql<number>`count(*)::int`,
        ingresos: sql<number>`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)::int`,
      })
      .from(crmDeals)
      .where(inArray(crmDeals.campaignLastId, ids))
      .groupBy(crmDeals.campaignLastId),
  ]);

  const porToques = new Map(toques.map((t) => [t.campaignId, t]));
  const porPrimero = new Map(primerToque.map((t) => [t.campaignId, t]));
  const porUltimo = new Map(ultimoToque.map((t) => [t.campaignId, t]));

  return campanas.map((c) => {
    const t = porToques.get(c.id);
    const p = porPrimero.get(c.id);
    const u = porUltimo.get(c.id);
    const dealsPrimerToque = p?.deals ?? 0;
    const ganados = p?.ganados ?? 0;
    const ingresos = p?.ingresos ?? 0;

    return {
      campana: c,
      toques: t?.toques ?? 0,
      contactosAlcanzados: t?.contactos ?? 0,
      cuentasAlcanzadas: t?.cuentas ?? 0,
      dealsPrimerToque,
      dealsUltimoToque: u?.deals ?? 0,
      ganadosPrimerToque: ganados,
      ingresosPrimerToque: ingresos,
      ingresosUltimoToque: u?.ingresos ?? 0,
      costo: c.costo,
      costoPorOportunidad: dealsPrimerToque > 0 ? Math.round(c.costo / dealsPrimerToque) : null,
      cac: ganados > 0 ? Math.round(c.costo / ganados) : null,
      roi: c.costo > 0 ? (ingresos - c.costo) / c.costo : null,
      tasaCierre: dealsPrimerToque > 0 ? (ganados / dealsPrimerToque) * 100 : 0,
    };
  });
}

// ─── Embudo global ───────────────────────────────────────────────────────────

export interface EmbudoMarketing {
  toques: number;
  contactosTocados: number;
  cuentasTocadas: number;
  oportunidades: number;
  montoOportunidades: number;
  ganadas: number;
  montoGanado: number;
  inversion: number;
}

export async function embudoMarketing(desde?: Date): Promise<EmbudoMarketing> {
  const filtroFecha = desde ? gte(crmTouchpoints.ocurridoEn, desde) : undefined;

  const [toques, deals, inversion] = await Promise.all([
    db
      .select({
        toques: sql<number>`count(*)::int`,
        contactos: sql<number>`count(distinct ${crmTouchpoints.contactId})::int`,
        cuentas: sql<number>`count(distinct ${crmTouchpoints.accountId})::int`,
      })
      .from(crmTouchpoints)
      .where(filtroFecha),
    db
      .select({
        total: sql<number>`count(*)::int`,
        monto: sql<number>`coalesce(sum(${crmDeals.monto}),0)::int`,
        ganadas: sql<number>`count(*) filter (where ${crmDeals.etapa} = 'ganado')::int`,
        montoGanado: sql<number>`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)::int`,
      })
      .from(crmDeals)
      .where(
        desde
          ? and(sql`${crmDeals.campaignFirstId} is not null`, gte(crmDeals.abiertoEn, desde))
          : sql`${crmDeals.campaignFirstId} is not null`,
      ),
    db.select({ total: sql<number>`coalesce(sum(${crmCampaigns.costo}),0)::int` }).from(crmCampaigns),
  ]);

  return {
    toques: toques[0]?.toques ?? 0,
    contactosTocados: toques[0]?.contactos ?? 0,
    cuentasTocadas: toques[0]?.cuentas ?? 0,
    oportunidades: deals[0]?.total ?? 0,
    montoOportunidades: deals[0]?.monto ?? 0,
    ganadas: deals[0]?.ganadas ?? 0,
    montoGanado: deals[0]?.montoGanado ?? 0,
    inversion: inversion[0]?.total ?? 0,
  };
}

// ─── Origen de los negocios ──────────────────────────────────────────────────

export interface OrigenNegocio {
  fuente: string;
  oportunidades: number;
  ganadas: number;
  ingresos: number;
  tasaCierre: number;
}

export async function origenDeNegocios(): Promise<OrigenNegocio[]> {
  const filas = await db
    .select({
      fuente: sql<string>`coalesce(${crmDeals.fuente}, 'Sin origen')`,
      oportunidades: sql<number>`count(*)::int`,
      ganadas: sql<number>`count(*) filter (where ${crmDeals.etapa} = 'ganado')::int`,
      ingresos: sql<number>`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)::int`,
    })
    .from(crmDeals)
    .groupBy(sql`coalesce(${crmDeals.fuente}, 'Sin origen')`)
    .orderBy(desc(sql`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)`));

  return filas.map((f) => ({
    ...f,
    tasaCierre: f.oportunidades > 0 ? (f.ganadas / f.oportunidades) * 100 : 0,
  }));
}

// ─── Atribución de una venta ─────────────────────────────────────────────────

/**
 * El recorrido completo de una oportunidad: todos los toques de marketing de su
 * cuenta antes de que se abriera, en orden.
 *
 * Es lo que se muestra cuando alguien pregunta "¿y esta venta de dónde salió?".
 */
export async function recorridoDeDeal(dealId: number) {
  const [deal] = await db
    .select({
      accountId: crmDeals.accountId,
      abiertoEn: crmDeals.abiertoEn,
      cerradoEn: crmDeals.cerradoEn,
      etapa: crmDeals.etapa,
      monto: crmDeals.monto,
    })
    .from(crmDeals)
    .where(eq(crmDeals.id, dealId))
    .limit(1);

  if (!deal) return [];

  return db
    .select({
      fecha: crmTouchpoints.ocurridoEn,
      tipo: crmTouchpoints.tipo,
      detalle: crmTouchpoints.detalle,
      campana: crmCampaigns.nombre,
      canal: crmCampaigns.canal,
      costo: crmCampaigns.costo,
    })
    .from(crmTouchpoints)
    .leftJoin(crmCampaigns, eq(crmCampaigns.id, crmTouchpoints.campaignId))
    .where(eq(crmTouchpoints.accountId, deal.accountId))
    .orderBy(crmTouchpoints.ocurridoEn);
}

/** Ingresos por mes de los últimos N meses. Alimenta la curva de la portada. */
export async function ingresosPorMes(meses = 12) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - (meses - 1));
  desde.setDate(1);
  desde.setHours(0, 0, 0, 0);

  const filas = await db
    .select({
      mes: sql<string>`to_char(date_trunc('month', ${crmOrders.fecha}), 'YYYY-MM')`,
      total: sql<number>`sum(${crmOrders.total})::int`,
      ordenes: sql<number>`count(*)::int`,
    })
    .from(crmOrders)
    .where(gte(crmOrders.fecha, desde))
    .groupBy(sql`date_trunc('month', ${crmOrders.fecha})`)
    .orderBy(sql`date_trunc('month', ${crmOrders.fecha})`);

  // Se rellenan los meses sin ventas: un hueco en el eje temporal miente sobre
  // la forma de la curva.
  const mapa = new Map(filas.map((f) => [f.mes, f]));
  const resultado: { mes: string; etiqueta: string; total: number; ordenes: number }[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde);
    d.setMonth(desde.getMonth() + i);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const f = mapa.get(clave);
    resultado.push({
      mes: clave,
      etiqueta: new Intl.DateTimeFormat("es-CL", { month: "short" }).format(d),
      total: f?.total ?? 0,
      ordenes: f?.ordenes ?? 0,
    });
  }
  return resultado;
}
