// Consultas de la lista de prospectos.
//
// Ojo con la trampa de Drizzle que ya mordió en el CRM: en una subconsulta
// correlacionada hay que nombrar la tabla en texto plano (`lead_empresas.id`),
// porque sin joins Drizzle escribe `"id"` a secas y la resuelve contra la tabla
// equivocada. La consulta corre sin error y devuelve cifras falsas. Acá no hay
// subconsultas por eso mismo: son dos tablas y cientos de filas.

import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { leadEmpresas, leadPersonas } from "@/db/leads";

export interface FiltroEmpresas {
  busqueda?: string;
  region?: number;
  /** `true` solo las que tienen dominio, `false` solo las que no. */
  conDominio?: boolean;
  conContacto?: boolean;
  limite?: number;
}

export interface EmpresaEnLista {
  id: number;
  rut: string | null;
  razonSocial: string;
  acteco: string | null;
  region: number | null;
  comuna: string | null;
  tramoVentas: number | null;
  dominio: string | null;
  origen: string;
  obtenidoEn: Date;
  personas: number;
  conEmail: number;
}

export async function listarEmpresas(f: FiltroEmpresas = {}): Promise<EmpresaEnLista[]> {
  const condiciones = [
    f.busqueda
      ? or(
          ilike(leadEmpresas.razonSocial, `%${f.busqueda}%`),
          ilike(leadEmpresas.rut, `%${f.busqueda}%`),
          ilike(leadEmpresas.dominio, `%${f.busqueda}%`),
        )
      : undefined,
    f.region !== undefined ? eq(leadEmpresas.region, f.region) : undefined,
    f.conDominio === true ? isNotNull(leadEmpresas.dominio) : undefined,
    f.conDominio === false ? isNull(leadEmpresas.dominio) : undefined,
  ].filter(Boolean);

  const empresas = await db
    .select()
    .from(leadEmpresas)
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(leadEmpresas.obtenidoEn), leadEmpresas.razonSocial)
    .limit(f.limite ?? 500);

  if (empresas.length === 0) return [];

  // Una sola consulta para los contactos de todas las empresas de la página, en
  // vez de una por fila. Con 500 filas la diferencia son 500 viajes a Neon.
  const ids = empresas.map((e) => e.id);
  const contactos = await db
    .select({
      empresaId: leadPersonas.empresaId,
      total: sql<number>`count(*)::int`,
      conEmail: sql<number>`count(lead_personas.email)::int`,
    })
    .from(leadPersonas)
    .where(inArray(leadPersonas.empresaId, ids))
    .groupBy(leadPersonas.empresaId);

  const porEmpresa = new Map(contactos.map((c) => [c.empresaId, c]));

  const filas = empresas.map((e) => ({
    id: e.id,
    rut: e.rut,
    razonSocial: e.razonSocial,
    acteco: e.acteco,
    region: e.region,
    comuna: e.comuna,
    tramoVentas: e.tramoVentas,
    dominio: e.dominio,
    origen: e.origen,
    obtenidoEn: e.obtenidoEn,
    personas: porEmpresa.get(e.id)?.total ?? 0,
    conEmail: porEmpresa.get(e.id)?.conEmail ?? 0,
  }));

  return f.conContacto === true ? filas.filter((x) => x.personas > 0) : filas;
}

/**
 * Las regiones que realmente hay en la base, para armar el filtro. Ofrecer las
 * 16 cuando solo hay dos cargadas es hacer que el usuario descubra por prueba
 * y error cuáles no devuelven nada.
 */
export async function regionesEnUso(): Promise<number[]> {
  const filas = await db
    .selectDistinct({ region: leadEmpresas.region })
    .from(leadEmpresas)
    .where(isNotNull(leadEmpresas.region));
  return filas.map((f) => f.region!).sort((a, b) => a - b);
}

export const NOMBRE_REGION: Record<number, string> = {
  1: "Tarapacá", 2: "Antofagasta", 3: "Atacama", 4: "Coquimbo",
  5: "Valparaíso", 6: "O'Higgins", 7: "Maule", 8: "Biobío",
  9: "La Araucanía", 10: "Los Lagos", 11: "Aysén", 12: "Magallanes",
  13: "Metropolitana", 14: "Los Ríos", 15: "Arica y Parinacota", 16: "Ñuble",
};
