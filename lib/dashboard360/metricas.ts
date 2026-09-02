// Consultas y agregaciones de Dashboard360.
//
// Todo lo que pintan las pantallas sale de acá. Dos decisiones que conviene
// tener presentes al leer:
//
// 1. **Las fechas son texto ISO y se comparan como texto.** `'2026-08-01' <=
//    fecha <= '2026-08-31'` ordena igual que una fecha porque el formato ISO es
//    lexicográficamente ordenable. Se evita así que el driver convierta zonas
//    horarias y corra las cifras un día.
//
// 2. **Hay dos conteos de leads y ninguno sobra.** `leadsPlataforma` es la suma
//    de lo que cada plataforma se atribuye; `leadsReales` cuenta personas
//    distintas. El primero siempre es mayor, porque tres canales se cuelgan del
//    mismo contacto. Mostrar solo el primero es lo que hace que un tablero se
//    caiga en la sala del directorio cuando alguien lo compara con el CRM.

import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Leads, d360Metricas } from "@/db/dashboard360";

// ─── Formato ─────────────────────────────────────────────────────────────────

export function clp(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

/** Montos grandes en la cabecera: $12,4M lee mejor que $12.437.900. */
export function clpCorto(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function num(n: number): string {
  return Math.round(n).toLocaleString("es-CL");
}

export function pct(n: number, decimales = 1): string {
  return `${n.toFixed(decimales)}%`;
}

/** Variación porcentual. `null` cuando la base es cero: no existe «infinito %». */
export function variacion(actual: number, previo: number): number | null {
  if (!previo) return null;
  return ((actual - previo) / previo) * 100;
}

export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ─── Rangos ──────────────────────────────────────────────────────────────────

export interface Rango {
  desde: string;
  hasta: string;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Últimos `dias` días terminando en la fecha más reciente con datos.
 *
 * Se ancla al último dato y no a hoy a propósito: las plataformas reportan con
 * retraso, y un tablero anclado a hoy muestra los últimos dos días vacíos y
 * hace parecer que la inversión se derrumbó.
 */
export async function rangoReciente(dias = 30): Promise<Rango> {
  const [fila] = await db
    .select({ max: sql<string | null>`max(${d360Metricas.fecha})` })
    .from(d360Metricas);

  const hasta = fila?.max ?? iso(new Date());
  const d = new Date(`${hasta}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (dias - 1));
  return { desde: iso(d), hasta };
}

/**
 * El primer y último día con datos, para acotar el selector de fechas.
 *
 * El selector se limita a esto a propósito: si alguien pide noventa días y la
 * ingesta solo trajo treinta, el panel muestra sesenta días en cero y parece que
 * la inversión se derrumbó. Es preferible no ofrecer el rango que explicar
 * después por qué el gráfico miente.
 */
export async function rangoDisponible(): Promise<Rango | null> {
  const [f] = await db
    .select({
      min: sql<string | null>`min(${d360Metricas.fecha})`,
      max: sql<string | null>`max(${d360Metricas.fecha})`,
    })
    .from(d360Metricas);
  if (!f?.min || !f?.max) return null;
  return { desde: f.min, hasta: f.max };
}

/**
 * Rango pedido por la URL, acotado a lo que existe.
 *
 * Fechas fuera del rango disponible se recortan en vez de rechazarse: un enlace
 * compartido con un rango viejo debe mostrar lo que haya, no un error.
 */
export async function rangoPedido(
  desde?: string,
  hasta?: string,
  diasPorDefecto = 30,
): Promise<Rango> {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!desde || !hasta || !ISO.test(desde) || !ISO.test(hasta) || desde > hasta) {
    return rangoReciente(diasPorDefecto);
  }
  const disp = await rangoDisponible();
  if (!disp) return { desde, hasta };
  return {
    desde: desde < disp.desde ? disp.desde : desde,
    hasta: hasta > disp.hasta ? disp.hasta : hasta,
  };
}

/** El rango inmediatamente anterior, del mismo largo. Para comparar contra él. */
export function rangoPrevio({ desde, hasta }: Rango): Rango {
  const a = new Date(`${desde}T00:00:00Z`);
  const b = new Date(`${hasta}T00:00:00Z`);
  const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  const finPrevio = new Date(a);
  finPrevio.setUTCDate(finPrevio.getUTCDate() - 1);
  const iniPrevio = new Date(finPrevio);
  iniPrevio.setUTCDate(iniPrevio.getUTCDate() - (dias - 1));
  return { desde: iso(iniPrevio), hasta: iso(finPrevio) };
}

// ─── Resumen del período ─────────────────────────────────────────────────────

export interface Resumen {
  inversionClp: number;
  impresiones: number;
  clics: number;
  /** Leads que las plataformas se atribuyen. Suma con duplicados. */
  leadsPlataforma: number;
  /** Personas distintas. El número honesto. */
  leadsReales: number;
  /** Personas que además existen en el CRM del cliente. */
  leadsEnCrm: number;
  envios: number;
  aperturas: number;
  interacciones: number;
  seguidoresNuevos: number;
  /**
   * Cuota de impresiones perdida por presupuesto, en porcentaje.
   *
   * Se promedia ponderando por impresiones, no aritméticamente: un día con diez
   * impresiones y otro con diez mil no pesan igual, y el promedio simple deja
   * que un día muerto mueva la cifra del mes.
   */
  cuotaPerdidaPresupuesto: number | null;
}

export async function resumen({ desde, hasta }: Rango): Promise<Resumen> {
  const enRango = and(gte(d360Metricas.fecha, desde), lte(d360Metricas.fecha, hasta));

  const [m] = await db
    .select({
      inversionClp: sql<number>`coalesce(sum(${d360Metricas.costoClp}), 0)::int`,
      impresiones: sql<number>`coalesce(sum(${d360Metricas.impresiones}), 0)::int`,
      clics: sql<number>`coalesce(sum(${d360Metricas.clics}), 0)::int`,
      leadsPlataforma: sql<number>`coalesce(sum(${d360Metricas.leads}), 0)::int`,
      envios: sql<number>`coalesce(sum(${d360Metricas.envios}), 0)::int`,
      aperturas: sql<number>`coalesce(sum(${d360Metricas.aperturas}), 0)::int`,
      interacciones: sql<number>`coalesce(sum(${d360Metricas.interacciones}), 0)::int`,
      seguidoresNuevos: sql<number>`coalesce(sum(${d360Metricas.seguidoresNuevos}), 0)::int`,
      cuotaPerdidaPresupuesto: sql<number | null>`
        case when sum(case when ${d360Metricas.cuotaPerdidaPresupuesto} is not null
                           then ${d360Metricas.impresiones} else 0 end) > 0
        then round(
          sum(${d360Metricas.cuotaPerdidaPresupuesto} * ${d360Metricas.impresiones}) filter
            (where ${d360Metricas.cuotaPerdidaPresupuesto} is not null)::numeric
          / nullif(sum(case when ${d360Metricas.cuotaPerdidaPresupuesto} is not null
                            then ${d360Metricas.impresiones} else 0 end), 0)
        )::int end`,
    })
    .from(d360Metricas)
    .where(enRango);

  const [l] = await db
    .select({
      leadsReales: sql<number>`count(*)::int`,
      leadsEnCrm: sql<number>`coalesce(sum(case when ${d360Leads.enCrm} then 1 else 0 end), 0)::int`,
    })
    .from(d360Leads)
    .where(and(gte(d360Leads.fecha, desde), lte(d360Leads.fecha, hasta)));

  return {
    inversionClp: m?.inversionClp ?? 0,
    impresiones: m?.impresiones ?? 0,
    clics: m?.clics ?? 0,
    leadsPlataforma: m?.leadsPlataforma ?? 0,
    envios: m?.envios ?? 0,
    aperturas: m?.aperturas ?? 0,
    interacciones: m?.interacciones ?? 0,
    seguidoresNuevos: m?.seguidoresNuevos ?? 0,
    leadsReales: l?.leadsReales ?? 0,
    leadsEnCrm: l?.leadsEnCrm ?? 0,
    // De puntos base a porcentaje.
    cuotaPerdidaPresupuesto:
      m?.cuotaPerdidaPresupuesto != null ? m.cuotaPerdidaPresupuesto / 100 : null,
  };
}

/** Costo por lead sobre el conteo honesto, no sobre el inflado. */
export function costoPorLead(r: Resumen): number | null {
  return r.leadsReales ? r.inversionClp / r.leadsReales : null;
}

export function ctr(r: Resumen): number {
  return r.impresiones ? (r.clics / r.impresiones) * 100 : 0;
}

// ─── Desglose por fuente ─────────────────────────────────────────────────────

export interface FilaFuente {
  slug: string;
  nombre: string;
  tipo: string;
  inversionClp: number;
  impresiones: number;
  clics: number;
  leadsPlataforma: number;
}

export async function porFuente({ desde, hasta }: Rango): Promise<FilaFuente[]> {
  const filas = await db
    .select({
      slug: d360Metricas.fuenteSlug,
      tipo: d360Metricas.tipo,
      nombre: sql<string>`coalesce(max(${d360Fuentes.nombre}), ${d360Metricas.fuenteSlug})`,
      inversionClp: sql<number>`coalesce(sum(${d360Metricas.costoClp}), 0)::int`,
      impresiones: sql<number>`coalesce(sum(${d360Metricas.impresiones}), 0)::int`,
      clics: sql<number>`coalesce(sum(${d360Metricas.clics}), 0)::int`,
      leadsPlataforma: sql<number>`coalesce(sum(${d360Metricas.leads}), 0)::int`,
    })
    .from(d360Metricas)
    .leftJoin(d360Fuentes, eq(d360Fuentes.slug, d360Metricas.fuenteSlug))
    .where(and(gte(d360Metricas.fecha, desde), lte(d360Metricas.fecha, hasta)))
    .groupBy(d360Metricas.fuenteSlug, d360Metricas.tipo)
    .orderBy(sql`coalesce(sum(${d360Metricas.costoClp}), 0) desc`);

  return filas;
}

// ─── Serie diaria ────────────────────────────────────────────────────────────

export interface PuntoDiario {
  fecha: string;
  inversionClp: number;
  leads: number;
  clics: number;
}

export async function serieDiaria({ desde, hasta }: Rango): Promise<PuntoDiario[]> {
  return db
    .select({
      fecha: d360Metricas.fecha,
      inversionClp: sql<number>`coalesce(sum(${d360Metricas.costoClp}), 0)::int`,
      leads: sql<number>`coalesce(sum(${d360Metricas.leads}), 0)::int`,
      clics: sql<number>`coalesce(sum(${d360Metricas.clics}), 0)::int`,
    })
    .from(d360Metricas)
    .where(and(gte(d360Metricas.fecha, desde), lte(d360Metricas.fecha, hasta)))
    .groupBy(d360Metricas.fecha)
    .orderBy(asc(d360Metricas.fecha));
}

// ─── Campañas ────────────────────────────────────────────────────────────────

export interface FilaCampania {
  campania: string;
  slug: string;
  inversionClp: number;
  clics: number;
  leads: number;
}

export async function porCampania({ desde, hasta }: Rango, limite = 12): Promise<FilaCampania[]> {
  return db
    .select({
      campania: d360Metricas.campania,
      slug: d360Metricas.fuenteSlug,
      inversionClp: sql<number>`coalesce(sum(${d360Metricas.costoClp}), 0)::int`,
      clics: sql<number>`coalesce(sum(${d360Metricas.clics}), 0)::int`,
      leads: sql<number>`coalesce(sum(${d360Metricas.leads}), 0)::int`,
    })
    .from(d360Metricas)
    .where(and(gte(d360Metricas.fecha, desde), lte(d360Metricas.fecha, hasta)))
    .groupBy(d360Metricas.campania, d360Metricas.fuenteSlug)
    .orderBy(sql`coalesce(sum(${d360Metricas.costoClp}), 0) desc`)
    .limit(limite);
}

// ─── Reconciliación ──────────────────────────────────────────────────────────

export interface Reconciliacion {
  /** Suma de lo que se atribuye cada plataforma. */
  segunPlataformas: number;
  /** Personas distintas tras deduplicar. */
  personasUnicas: number;
  /** De esas personas, las que existen en el CRM. */
  enCrm: number;
  /** Diferencia entre lo que dicen las plataformas y la realidad. */
  sobreconteo: number;
  /** Personas que el tablero ve y el CRM no. Suelen ser leads sin cargar. */
  faltanEnCrm: number;
}

/**
 * La pantalla que evita la discusión incómoda.
 *
 * Cuando el gerente compara el tablero con el CRM y los números no coinciden,
 * la reunión se va treinta minutos en averiguar quién miente. Esto lo responde
 * de antemano: las plataformas sobrecuentan porque se atribuyen el mismo
 * contacto, y el CRM va por detrás porque no todos los leads se cargan.
 */
export async function reconciliacion(rango: Rango): Promise<Reconciliacion> {
  const r = await resumen(rango);
  return {
    segunPlataformas: r.leadsPlataforma,
    personasUnicas: r.leadsReales,
    enCrm: r.leadsEnCrm,
    sobreconteo: r.leadsPlataforma - r.leadsReales,
    faltanEnCrm: r.leadsReales - r.leadsEnCrm,
  };
}

// ─── Fuentes ─────────────────────────────────────────────────────────────────

export async function fuentes() {
  return db.select().from(d360Fuentes).orderBy(asc(d360Fuentes.tipo), asc(d360Fuentes.nombre));
}
