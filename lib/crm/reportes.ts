// Los números del negocio.
//
// Todo lo que sale de acá viene con su comparación: un monto sin "contra qué"
// no es información, es decoración. Por eso cada indicador trae el período
// anterior y la variación ya calculada.

import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { crmAccounts, crmDeals, crmOrders, crmUsers } from "@/db/crm";
import { ETAPAS, ETAPAS_ABIERTAS_IDS } from "./etapas";

export interface Indicador {
  valor: number;
  anterior: number;
  /** Variación porcentual contra el período anterior. null si no hay base. */
  variacion: number | null;
}

function comparar(valor: number, anterior: number): Indicador {
  return {
    valor,
    anterior,
    variacion: anterior > 0 ? ((valor - anterior) / anterior) * 100 : null,
  };
}

export interface ResumenComercial {
  ingresos: Indicador;
  ordenes: Indicador;
  ticketPromedio: Indicador;
  /** Suma de las oportunidades abiertas hoy. */
  pipelineAbierto: number;
  /** El pipeline corregido por probabilidad: lo que de verdad se espera. */
  pipelinePonderado: number;
  oportunidadesAbiertas: number;
  tasaCierre: number;
  cicloVentaDias: number | null;
  cuentasActivas: number;
  periodo: { desde: Date; hasta: Date; etiqueta: string };
}

/**
 * Resumen de los últimos `dias` días contra los `dias` anteriores.
 *
 * Ventanas móviles y no meses calendario: el día 3 del mes, un comparativo
 * mensual muestra una caída del 90% que no significa nada, y alguien siempre
 * termina tomando una decisión con eso.
 */
export async function resumenComercial(dias = 30): Promise<ResumenComercial> {
  const hasta = new Date();
  const desde = new Date(Date.now() - dias * 86_400_000);
  const desdeAnterior = new Date(Date.now() - dias * 2 * 86_400_000);

  const [ventas, abiertas, cerradas, cuentas] = await Promise.all([
    db
      .select({
        ingresos: sql<number>`coalesce(sum(${crmOrders.total}) filter (where ${crmOrders.fecha} >= ${desde}),0)::int`,
        ordenes: sql<number>`count(*) filter (where ${crmOrders.fecha} >= ${desde})::int`,
        ingresosPrevios: sql<number>`coalesce(sum(${crmOrders.total}) filter (where ${crmOrders.fecha} >= ${desdeAnterior} and ${crmOrders.fecha} < ${desde}),0)::int`,
        ordenesPrevias: sql<number>`count(*) filter (where ${crmOrders.fecha} >= ${desdeAnterior} and ${crmOrders.fecha} < ${desde})::int`,
      })
      .from(crmOrders)
      .where(gte(crmOrders.fecha, desdeAnterior)),
    db
      .select({
        total: sql<number>`coalesce(sum(${crmDeals.monto}),0)::int`,
        ponderado: sql<number>`coalesce(sum(${crmDeals.monto} * ${crmDeals.probabilidad} / 100.0),0)::int`,
        n: sql<number>`count(*)::int`,
      })
      .from(crmDeals)
      .where(inArray(crmDeals.etapa, ETAPAS_ABIERTAS_IDS)),
    db
      .select({
        ganadas: sql<number>`count(*) filter (where ${crmDeals.etapa} = 'ganado')::int`,
        perdidas: sql<number>`count(*) filter (where ${crmDeals.etapa} = 'perdido')::int`,
        cicloDias: sql<number | null>`avg(extract(epoch from (${crmDeals.cerradoEn} - ${crmDeals.abiertoEn})) / 86400) filter (where ${crmDeals.etapa} = 'ganado')`,
      })
      .from(crmDeals)
      .where(sql`${crmDeals.cerradoEn} is not null`),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(crmAccounts)
      .where(eq(crmAccounts.estado, "cliente")),
  ]);

  const v = ventas[0];
  const a = abiertas[0];
  const c = cerradas[0];
  const cerradasTotal = (c?.ganadas ?? 0) + (c?.perdidas ?? 0);

  return {
    ingresos: comparar(v?.ingresos ?? 0, v?.ingresosPrevios ?? 0),
    ordenes: comparar(v?.ordenes ?? 0, v?.ordenesPrevias ?? 0),
    ticketPromedio: comparar(
      v?.ordenes ? Math.round(v.ingresos / v.ordenes) : 0,
      v?.ordenesPrevias ? Math.round(v.ingresosPrevios / v.ordenesPrevias) : 0,
    ),
    pipelineAbierto: a?.total ?? 0,
    pipelinePonderado: a?.ponderado ?? 0,
    oportunidadesAbiertas: a?.n ?? 0,
    tasaCierre: cerradasTotal > 0 ? ((c?.ganadas ?? 0) / cerradasTotal) * 100 : 0,
    cicloVentaDias: c?.cicloDias != null ? Math.round(Number(c.cicloDias)) : null,
    cuentasActivas: cuentas[0]?.n ?? 0,
    periodo: { desde, hasta, etiqueta: `últimos ${dias} días` },
  };
}

// ─── Embudo de conversión ────────────────────────────────────────────────────

export interface PasoConversion {
  etapa: string;
  nombre: string;
  oportunidades: number;
  monto: number;
}

/**
 * Embudo acumulado: cada etapa cuenta las oportunidades que llegaron HASTA ahí
 * o más lejos.
 *
 * Contar solo las que están paradas en cada etapa daría un "embudo" que sube y
 * baja sin sentido, porque las que avanzaron desaparecen de las etapas de atrás.
 */
export async function embudoConversion(): Promise<PasoConversion[]> {
  const filas = await db
    .select({
      etapa: crmDeals.etapa,
      n: sql<number>`count(*)::int`,
      monto: sql<number>`coalesce(sum(${crmDeals.monto}),0)::int`,
    })
    .from(crmDeals)
    .groupBy(crmDeals.etapa);

  const porEtapa = new Map(filas.map((f) => [f.etapa, f]));
  const orden = ["nuevo", "calificado", "propuesta", "negociacion", "ganado"];

  return orden.map((etapa, i) => {
    // Acumula esta etapa y todas las posteriores (las que ya pasaron por acá).
    const posteriores = orden.slice(i);
    const alcanzadas = posteriores.reduce(
      (acc, e) => {
        const f = porEtapa.get(e);
        return {
          n: acc.n + (f?.n ?? 0),
          monto: acc.monto + (f?.monto ?? 0),
        };
      },
      { n: 0, monto: 0 },
    );
    return {
      etapa,
      nombre: ETAPAS.find((e) => e.id === etapa)?.nombre ?? etapa,
      oportunidades: alcanzadas.n,
      monto: alcanzadas.monto,
    };
  });
}

// ─── Ranking del equipo ──────────────────────────────────────────────────────

export interface RendimientoVendedor {
  userId: number;
  nombre: string;
  abiertas: number;
  montoAbierto: number;
  ganadas: number;
  montoGanado: number;
  perdidas: number;
  tasaCierre: number;
}

export async function rendimientoEquipo(): Promise<RendimientoVendedor[]> {
  const filas = await db
    .select({
      userId: crmUsers.id,
      nombre: crmUsers.nombre,
      abiertas: sql<number>`count(${crmDeals.id}) filter (where ${crmDeals.etapa} not in ('ganado','perdido'))::int`,
      montoAbierto: sql<number>`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} not in ('ganado','perdido')),0)::int`,
      ganadas: sql<number>`count(${crmDeals.id}) filter (where ${crmDeals.etapa} = 'ganado')::int`,
      montoGanado: sql<number>`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)::int`,
      perdidas: sql<number>`count(${crmDeals.id}) filter (where ${crmDeals.etapa} = 'perdido')::int`,
    })
    .from(crmUsers)
    .leftJoin(crmDeals, eq(crmDeals.ownerId, crmUsers.id))
    .where(eq(crmUsers.activo, true))
    .groupBy(crmUsers.id, crmUsers.nombre)
    .orderBy(desc(sql`coalesce(sum(${crmDeals.monto}) filter (where ${crmDeals.etapa} = 'ganado'),0)`));

  return filas.map((f) => ({
    ...f,
    tasaCierre:
      f.ganadas + f.perdidas > 0 ? (f.ganadas / (f.ganadas + f.perdidas)) * 100 : 0,
  }));
}

// ─── Por qué se pierden ──────────────────────────────────────────────────────

export async function motivosDePerdida() {
  return db
    .select({
      motivo: sql<string>`coalesce(${crmDeals.motivoPerdida}, 'Sin registrar')`,
      n: sql<number>`count(*)::int`,
      monto: sql<number>`coalesce(sum(${crmDeals.monto}),0)::int`,
    })
    .from(crmDeals)
    .where(eq(crmDeals.etapa, "perdido"))
    .groupBy(sql`coalesce(${crmDeals.motivoPerdida}, 'Sin registrar')`)
    .orderBy(desc(sql`count(*)`));
}

/** Las cuentas que más facturaron en la ventana pedida. */
export async function topCuentas(dias = 365, limite = 10) {
  const desde = new Date(Date.now() - dias * 86_400_000);
  return db
    .select({
      accountId: crmAccounts.id,
      nombre: crmAccounts.nombre,
      total: sql<number>`coalesce(sum(${crmOrders.total}),0)::int`,
      ordenes: sql<number>`count(${crmOrders.id})::int`,
    })
    .from(crmAccounts)
    .innerJoin(crmOrders, eq(crmOrders.accountId, crmAccounts.id))
    .where(gte(crmOrders.fecha, desde))
    .groupBy(crmAccounts.id, crmAccounts.nombre)
    .orderBy(desc(sql`coalesce(sum(${crmOrders.total}),0)`))
    .limit(limite);
}

/**
 * Concentración de cartera: qué porcentaje de la facturación depende de las
 * pocas cuentas más grandes.
 *
 * Es un indicador de riesgo, no de éxito: 60% en tres clientes significa que
 * perder uno cambia el año.
 */
export async function concentracion(dias = 365) {
  const top = await topCuentas(dias, 1000);
  const total = top.reduce((s, t) => s + t.total, 0);
  if (total === 0) return { top3: 0, top10: 0, total: 0, cuentas: 0 };
  const suma = (n: number) => top.slice(0, n).reduce((s, t) => s + t.total, 0);
  return {
    top3: (suma(3) / total) * 100,
    top10: (suma(10) / total) * 100,
    total,
    cuentas: top.length,
  };
}
