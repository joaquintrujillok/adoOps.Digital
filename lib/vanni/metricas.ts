// Métricas del tablero. Todo se calcula en la base y todo filtra por la
// columna `ejemplo` del contacto: los números reales y los de demostración
// nunca se suman entre sí.

import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface Filtro {
  ejemplo: boolean;
  campanaId?: number | null;
}

function donde(f: Filtro) {
  return f.campanaId
    ? sql`c.ejemplo = ${f.ejemplo} and e.campana_id = ${f.campanaId}`
    : sql`c.ejemplo = ${f.ejemplo}`;
}

export interface Embudo {
  encolados: number;
  enviados: number;
  errores: number;
  entregados: number;
  leidos: number;
  respondieron: number;
  interesados: number;
  bajas: number;
  contactados: number;
  cotizando: number;
  porLlamar: number;
}

export async function embudo(f: Filtro): Promise<Embudo> {
  const r = await db.execute(sql`
    select
      count(*)::int as encolados,
      count(*) filter (where e.estado = 'enviado')::int as enviados,
      count(*) filter (where e.estado = 'error')::int as errores,
      count(*) filter (where e.entrega in ('entregado','leido'))::int as entregados,
      count(*) filter (where e.entrega = 'leido')::int as leidos,
      count(*) filter (where e.respondio_at is not null)::int as respondieron,
      count(*) filter (where e.resultado = 'interesado')::int as interesados,
      count(*) filter (where e.resultado = 'baja')::int as bajas
    from vanni_envios e join vanni_contactos c on c.id = e.contacto_id
    where ${donde(f)}`);
  const o = await db.execute(sql`
    select
      count(*) filter (where o.estado <> 'por_llamar')::int as contactados,
      count(*) filter (where o.estado in ('cotizando','ganada'))::int as cotizando,
      count(*) filter (where o.estado = 'por_llamar')::int as por_llamar
    from vanni_oportunidades o join vanni_contactos c on c.id = o.contacto_id
    where c.ejemplo = ${f.ejemplo} ${f.campanaId ? sql`and o.campana_id = ${f.campanaId}` : sql``}
      and o.tipo = 'interes'`);
  const a = r.rows[0] as Record<string, number>;
  const b = o.rows[0] as Record<string, number>;
  return {
    encolados: a.encolados ?? 0,
    enviados: a.enviados ?? 0,
    errores: a.errores ?? 0,
    entregados: a.entregados ?? 0,
    leidos: a.leidos ?? 0,
    respondieron: a.respondieron ?? 0,
    interesados: a.interesados ?? 0,
    bajas: a.bajas ?? 0,
    contactados: b.contactados ?? 0,
    cotizando: b.cotizando ?? 0,
    porLlamar: b.por_llamar ?? 0,
  };
}

export interface FilaSegmento {
  segmento: string;
  enviados: number;
  interesados: number;
  cotizando: number;
}

export async function porSegmento(f: Filtro): Promise<FilaSegmento[]> {
  const r = await db.execute(sql`
    select c.segmento,
      count(distinct e.id) filter (where e.estado = 'enviado')::int as enviados,
      count(distinct e.id) filter (where e.resultado = 'interesado')::int as interesados,
      count(distinct o.id) filter (where o.estado in ('cotizando','ganada'))::int as cotizando
    from vanni_envios e
    join vanni_contactos c on c.id = e.contacto_id
    left join vanni_oportunidades o on o.envio_id = e.id and o.tipo = 'interes'
    where ${donde(f)}
    group by c.segmento`);
  return r.rows as unknown as FilaSegmento[];
}

export interface FilaSucursal {
  sucursal: string;
  interesados: number;
  cotizando: number;
}

export async function porSucursal(f: Filtro): Promise<FilaSucursal[]> {
  const r = await db.execute(sql`
    select coalesce(c.sucursal, 'Sin sucursal') as sucursal,
      count(distinct e.id) filter (where e.resultado = 'interesado')::int as interesados,
      count(distinct o.id) filter (where o.estado in ('cotizando','ganada'))::int as cotizando
    from vanni_envios e
    join vanni_contactos c on c.id = e.contacto_id
    left join vanni_oportunidades o on o.envio_id = e.id and o.tipo = 'interes'
    where ${donde(f)}
    group by 1
    order by 2 desc`);
  return r.rows as unknown as FilaSucursal[];
}

export interface FilaVariante {
  campanaId: number;
  codigo: string;
  nombre: string;
  plantilla: string;
  enviados: number;
  interesados: number;
}

export async function porVariante(f: Filtro): Promise<FilaVariante[]> {
  const r = await db.execute(sql`
    select v.campana_id as "campanaId", v.codigo, v.nombre, v.plantilla,
      count(e.id) filter (where e.estado = 'enviado')::int as enviados,
      count(e.id) filter (where e.resultado = 'interesado')::int as interesados
    from vanni_variantes v
    join vanni_envios e on e.variante_id = v.id
    join vanni_contactos c on c.id = e.contacto_id
    where ${donde(f)}
    group by v.id
    order by v.campana_id desc, v.codigo`);
  return r.rows as unknown as FilaVariante[];
}

export async function contactosPorSegmento(ejemplo: boolean): Promise<{ segmento: string; n: number; bajas: number }[]> {
  const r = await db.execute(sql`
    select segmento, count(*)::int as n, count(*) filter (where estado = 'baja')::int as bajas
    from vanni_contactos where ejemplo = ${ejemplo} group by segmento`);
  return r.rows as unknown as { segmento: string; n: number; bajas: number }[];
}

export async function hayDatos(ejemplo: boolean): Promise<boolean> {
  const r = await db.execute(sql`select exists(select 1 from vanni_contactos where ejemplo = ${ejemplo}) as hay`);
  return Boolean((r.rows[0] as { hay?: boolean })?.hay);
}

// ─── La base de contactos ────────────────────────────────────────────────────

export interface ResumenBase {
  total: number;
  activos: number;
  bajas: number;
  conHistorial: number;
  montoTotal: number;
}

export async function resumenBase(ejemplo: boolean): Promise<ResumenBase> {
  const r = await db.execute(sql`
    select count(*)::int as total,
      count(*) filter (where estado = 'activo')::int as activos,
      count(*) filter (where estado = 'baja')::int as bajas,
      count(*) filter (where r_score is not null)::int as "conHistorial",
      coalesce(sum(monto_total), 0)::bigint as "montoTotal"
    from vanni_contactos where ejemplo = ${ejemplo}`);
  const x = r.rows[0] as Record<string, number | string>;
  return {
    total: Number(x.total ?? 0),
    activos: Number(x.activos ?? 0),
    bajas: Number(x.bajas ?? 0),
    conHistorial: Number(x.conHistorial ?? 0),
    montoTotal: Number(x.montoTotal ?? 0),
  };
}

export interface FilaSegmentoBase {
  segmento: string;
  n: number;
  activos: number;
  monto: number;
}

/** Cuántos contactos y cuánto monto histórico hay en cada segmento. */
export async function composicionPorSegmento(ejemplo: boolean): Promise<FilaSegmentoBase[]> {
  const r = await db.execute(sql`
    select segmento, count(*)::int as n,
      count(*) filter (where estado = 'activo')::int as activos,
      coalesce(sum(monto_total), 0)::bigint as monto
    from vanni_contactos where ejemplo = ${ejemplo}
    group by segmento`);
  return (r.rows as Record<string, unknown>[]).map((x) => ({
    segmento: String(x.segmento),
    n: Number(x.n),
    activos: Number(x.activos),
    monto: Number(x.monto),
  }));
}

export interface CeldaRfm {
  r: number;
  f: number;
  n: number;
  monto: number;
}

/** Recencia × Frecuencia: el mapa clásico del RFM. */
export async function mapaRfm(ejemplo: boolean): Promise<CeldaRfm[]> {
  const r = await db.execute(sql`
    select r_score as r, f_score as f, count(*)::int as n, coalesce(sum(monto_total), 0)::bigint as monto
    from vanni_contactos
    where ejemplo = ${ejemplo} and r_score is not null and f_score is not null
    group by 1, 2`);
  return (r.rows as Record<string, unknown>[]).map((x) => ({
    r: Number(x.r),
    f: Number(x.f),
    n: Number(x.n),
    monto: Number(x.monto),
  }));
}

export interface FilaConversion {
  segmento: string;
  enviados: number;
  respondieron: number;
  interesados: number;
  cotizando: number;
}

/** El embudo de campaña por segmento, sobre todas las campañas. */
export async function conversionPorSegmento(ejemplo: boolean): Promise<FilaConversion[]> {
  const r = await db.execute(sql`
    select c.segmento,
      count(distinct e.id) filter (where e.estado = 'enviado')::int as enviados,
      count(distinct e.id) filter (where e.respondio_at is not null)::int as respondieron,
      count(distinct e.id) filter (where e.resultado = 'interesado')::int as interesados,
      count(distinct o.id) filter (where o.estado in ('cotizando','ganada'))::int as cotizando
    from vanni_envios e
    join vanni_contactos c on c.id = e.contacto_id
    left join vanni_oportunidades o on o.envio_id = e.id and o.tipo = 'interes'
    where c.ejemplo = ${ejemplo}
    group by c.segmento`);
  return r.rows as unknown as FilaConversion[];
}

/** Tramos de días desde la última compra. */
export const TRAMOS_RECENCIA = ["≤ 3 meses", "3–6 meses", "6–12 meses", "1–2 años", "> 2 años", "Sin dato"] as const;

export async function recencia(ejemplo: boolean): Promise<{ tramo: string; n: number }[]> {
  const r = await db.execute(sql`
    select case
        when ultima_compra is null then 'Sin dato'
        when current_date - ultima_compra <= 90 then '≤ 3 meses'
        when current_date - ultima_compra <= 180 then '3–6 meses'
        when current_date - ultima_compra <= 365 then '6–12 meses'
        when current_date - ultima_compra <= 730 then '1–2 años'
        else '> 2 años' end as tramo,
      count(*)::int as n
    from vanni_contactos where ejemplo = ${ejemplo}
    group by 1`);
  const m = new Map((r.rows as { tramo: string; n: number }[]).map((x) => [x.tramo, Number(x.n)]));
  return TRAMOS_RECENCIA.map((t) => ({ tramo: t, n: m.get(t) ?? 0 }));
}

export async function contactosPorSucursal(ejemplo: boolean): Promise<{ sucursal: string; n: number; interesados: number }[]> {
  const r = await db.execute(sql`
    select coalesce(c.sucursal, 'Sin sucursal') as sucursal, count(distinct c.id)::int as n,
      count(distinct e.id) filter (where e.resultado = 'interesado')::int as interesados
    from vanni_contactos c
    left join vanni_envios e on e.contacto_id = c.id
    where c.ejemplo = ${ejemplo}
    group by 1 order by 2 desc`);
  return r.rows as unknown as { sucursal: string; n: number; interesados: number }[];
}
