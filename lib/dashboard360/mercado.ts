// El mercado direccionable y el estado del motor de prospección.
//
// Dos fuentes distintas y conviene tenerlo claro:
//
//   · `d360_mercado`  — el universo, agregado del SII. Tabla propia del tablero.
//   · `lead_*`        — el motor de nurturing. Tablas de otro módulo.
//
// La lectura de `lead_*` es una dependencia deliberada entre módulos, y es la
// única del tablero. Está aislada acá y **degrada sola**: si el motor no está
// desplegado o no tiene nada, `motor()` devuelve ceros y la pantalla lo dice en
// vez de reventar. Dashboard360 se vende por separado; esta sección tiene que
// poder existir sin el motor al lado.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { d360Mercado } from "@/db/dashboard360";
import { leadEmpresas, leadInscripciones, leadPersonas } from "@/db/leads";

export const NOMBRE_REGION: Record<number, string> = {
  1: "Tarapacá", 2: "Antofagasta", 3: "Atacama", 4: "Coquimbo",
  5: "Valparaíso", 6: "O'Higgins", 7: "Maule", 8: "Biobío",
  9: "La Araucanía", 10: "Los Lagos", 11: "Aysén", 12: "Magallanes",
  13: "Metropolitana", 14: "Los Ríos", 15: "Arica y Parinacota", 16: "Ñuble",
};

/**
 * El ICP vigente, escrito como filtro y no como adjetivo.
 *
 * Vive en código y no en la base a propósito: hoy hay uno solo y moverlo a
 * configuración editable antes de tener dos es inventarse una pantalla de
 * administración que nadie va a abrir. Cuando haya dos, se mueve.
 */
export const ICP = {
  nombre: "Financieras y seguros · RM · medianas y grandes",
  rubro: "ACTIVIDADES FINANCIERAS Y DE SEGUROS",
  region: 13,
  tramoMinimo: 8,
  porQue:
    "Presupuesto para adopción de IA, regulación pesada y volumen alto de datos personales: es donde el argumento de la Ley 21.719 pega más fuerte.",
} as const;

export interface FilaRubro {
  rubro: string;
  empresas: number;
  operativas: number;
  inversion: number;
}

/** El universo por rubro, para el tamaño y la región que se estén mirando. */
export async function porRubro(opciones: {
  region?: number | null;
  tramoMinimo?: number;
}): Promise<FilaRubro[]> {
  const condiciones = [
    opciones.region ? eq(d360Mercado.region, opciones.region) : undefined,
    opciones.tramoMinimo ? gte(d360Mercado.tramo, opciones.tramoMinimo) : undefined,
  ].filter(Boolean);

  const filas = await db
    .select({
      rubro: d360Mercado.rubro,
      empresas: sql<number>`sum(empresas)::int`,
      operativas: sql<number>`sum(operativas)::int`,
      inversion: sql<number>`sum(inversion)::int`,
    })
    .from(d360Mercado)
    .where(condiciones.length ? and(...condiciones) : undefined)
    .groupBy(d360Mercado.rubro)
    .orderBy(desc(sql`sum(operativas)`));

  // "Valor por Defecto" y "SIN RUBRO" son basura del archivo del SII, no rubros.
  return filas.filter((f) => f.operativas > 0 && !/VALOR POR DEFECTO|SIN RUBRO/.test(f.rubro));
}

export interface Universo {
  anoComercial: number;
  paisTodas: number;
  paisOperativas: number;
  icpTodas: number;
  icpOperativas: number;
  icpInversion: number;
}

export async function universo(): Promise<Universo> {
  const [pais, icp, ano] = await Promise.all([
    db
      .select({
        todas: sql<number>`sum(empresas)::int`,
        operativas: sql<number>`sum(operativas)::int`,
      })
      .from(d360Mercado),
    db
      .select({
        todas: sql<number>`sum(empresas)::int`,
        operativas: sql<number>`sum(operativas)::int`,
        inversion: sql<number>`sum(inversion)::int`,
      })
      .from(d360Mercado)
      .where(
        and(
          eq(d360Mercado.rubro, ICP.rubro),
          eq(d360Mercado.region, ICP.region),
          gte(d360Mercado.tramo, ICP.tramoMinimo),
        ),
      ),
    db
      .select({ ano: sql<number>`max(ano_comercial)::int` })
      .from(d360Mercado),
  ]);

  return {
    anoComercial: ano[0]?.ano ?? 0,
    paisTodas: pais[0]?.todas ?? 0,
    paisOperativas: pais[0]?.operativas ?? 0,
    icpTodas: icp[0]?.todas ?? 0,
    icpOperativas: icp[0]?.operativas ?? 0,
    icpInversion: icp[0]?.inversion ?? 0,
  };
}

// ─── El motor, leído desde el otro módulo ────────────────────────────────────

export interface EstadoMotor {
  disponible: boolean;
  enBase: number;
  conDominio: number;
  alcanzables: number;
  inscritos: number;
  respondieron: number;
}

const MOTOR_VACIO: EstadoMotor = {
  disponible: false,
  enBase: 0,
  conDominio: 0,
  alcanzables: 0,
  inscritos: 0,
  respondieron: 0,
};

export async function motor(): Promise<EstadoMotor> {
  try {
    const [empresas, dominio, alcanzables, inscritos, respondieron] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(leadEmpresas),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(leadEmpresas)
        .where(sql`lead_empresas.dominio is not null`),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(leadPersonas)
        .where(
          sql`(lead_personas.email is not null or lead_personas.member_urn is not null)
              and lead_personas.suprimido_en is null`,
        ),
      db.select({ n: sql<number>`count(*)::int` }).from(leadInscripciones),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(leadInscripciones)
        .where(sql`lead_inscripciones.estado in ('respondio','calificado')`),
    ]);

    return {
      disponible: true,
      enBase: empresas[0].n,
      conDominio: dominio[0].n,
      alcanzables: alcanzables[0].n,
      inscritos: inscritos[0].n,
      respondieron: respondieron[0].n,
    };
  } catch {
    // El motor no está desplegado en este entorno. No es un error del tablero.
    return MOTOR_VACIO;
  }
}
