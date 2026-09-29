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
