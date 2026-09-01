// ÚNICO punto donde el tablero lee las tablas del CRM de adoOps.
//
// Mismo patrón y misma razón que `motor.ts`, `contenido.ts` y `reuniones.ts`:
// **el tablero tiene que poder existir sin este módulo al lado.** Si las tablas
// `venta_*` no están creadas, nada revienta: todo devuelve vacío,
// `disponible()` responde `false`, y la pantalla lo dice en vez de mostrar un
// error de base de datos.

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  ventaActividades,
  ventaContactos,
  ventaEmpresas,
  ventaOportunidades,
  type VentaActividad,
  type VentaContacto,
  type VentaEmpresa,
} from "@/db/venta";
import { esCerrada, ETAPAS_ABIERTAS } from "./etapas";

export async function disponible(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM venta_oportunidades LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/** Una tarjeta del tablero. Trae lo justo para pintarla sin abrir el detalle. */
export type Tarjeta = {
  id: number;
  titulo: string;
  etapa: string;
  monto: number;
  probabilidad: number;
  contacto: string;
  empresa: string | null;
  ultimaActividad: Date | null;
  cierreEstimado: string | null;
};

export type Columna = {
  etapa: string;
  nombre: string;
  tarjetas: Tarjeta[];
  /** Suma de montos de la columna. Es el número que se mira primero. */
  total: number;
};

/**
 * El tablero: una columna por etapa abierta.
 *
 * Se traen todas las abiertas de una sola consulta y se agrupan en memoria. Con
 * un pipeline de cientos de oportunidades eso es más barato que una consulta por
 * columna, y sobre todo es una sola foto: seis consultas separadas pueden
 * devolver estados distintos si alguien mueve una tarjeta mientras cargan.
 */
export async function tablero(): Promise<Columna[]> {
  let filas: Tarjeta[] = [];
  try {
    filas = await db
      .select({
        id: ventaOportunidades.id,
        titulo: ventaOportunidades.titulo,
        etapa: ventaOportunidades.etapa,
        monto: ventaOportunidades.monto,
        probabilidad: ventaOportunidades.probabilidad,
        contacto: ventaContactos.nombre,
        empresa: ventaEmpresas.nombre,
        ultimaActividad: ventaOportunidades.ultimaActividad,
        cierreEstimado: ventaOportunidades.cierreEstimado,
      })
      .from(ventaOportunidades)
      .innerJoin(ventaContactos, eq(ventaOportunidades.contactoId, ventaContactos.id))
      .leftJoin(ventaEmpresas, eq(ventaOportunidades.empresaId, ventaEmpresas.id))
      .where(isNull(ventaOportunidades.cerradoEn))
      .orderBy(desc(ventaOportunidades.monto));
  } catch {
    filas = [];
  }

  return ETAPAS_ABIERTAS.map((e) => {
    const tarjetas = filas.filter((f) => f.etapa === e.id);
    return {
      etapa: e.id,
      nombre: e.nombre,
      tarjetas,
      total: tarjetas.reduce((a, t) => a + t.monto, 0),
    };
  });
}

export type Cerrada = Tarjeta & { cerradoEn: Date | null; motivoPerdida: string | null };

/** Lo que ya se cerró. Va aparte del tablero: no se mueve, se lee. */
export async function cerradas(limite = 30): Promise<Cerrada[]> {
  try {
    return await db
      .select({
        id: ventaOportunidades.id,
        titulo: ventaOportunidades.titulo,
        etapa: ventaOportunidades.etapa,
        monto: ventaOportunidades.monto,
        probabilidad: ventaOportunidades.probabilidad,
        contacto: ventaContactos.nombre,
        empresa: ventaEmpresas.nombre,
        ultimaActividad: ventaOportunidades.ultimaActividad,
        cierreEstimado: ventaOportunidades.cierreEstimado,
        cerradoEn: ventaOportunidades.cerradoEn,
        motivoPerdida: ventaOportunidades.motivoPerdida,
      })
      .from(ventaOportunidades)
      .innerJoin(ventaContactos, eq(ventaOportunidades.contactoId, ventaContactos.id))
      .leftJoin(ventaEmpresas, eq(ventaOportunidades.empresaId, ventaEmpresas.id))
      .where(sql`${ventaOportunidades.cerradoEn} IS NOT NULL`)
      .orderBy(desc(ventaOportunidades.cerradoEn))
      .limit(limite);
  } catch {
    return [];
  }
}

export type DetalleOportunidad = {
  oportunidad: typeof ventaOportunidades.$inferSelect;
  contacto: VentaContacto;
  empresa: VentaEmpresa | null;
  actividades: VentaActividad[];
};

export async function detalle(id: number): Promise<DetalleOportunidad | null> {
  try {
    const [fila] = await db
      .select({
        oportunidad: ventaOportunidades,
        contacto: ventaContactos,
        empresa: ventaEmpresas,
      })
      .from(ventaOportunidades)
      .innerJoin(ventaContactos, eq(ventaOportunidades.contactoId, ventaContactos.id))
      .leftJoin(ventaEmpresas, eq(ventaOportunidades.empresaId, ventaEmpresas.id))
      .where(eq(ventaOportunidades.id, id))
      .limit(1);

    if (!fila) return null;

    const actividades = await db
      .select()
      .from(ventaActividades)
      .where(eq(ventaActividades.oportunidadId, id))
      .orderBy(desc(ventaActividades.ocurrioEn));

    return { ...fila, actividades };
  } catch {
    return null;
  }
}

export type FilaContacto = VentaContacto & {
  empresa: string | null;
  abiertas: number;
};

/** Los contactos con cuántas oportunidades abiertas tiene cada uno. */
export async function contactos(): Promise<FilaContacto[]> {
  try {
    const base = await db
      .select({ contacto: ventaContactos, empresa: ventaEmpresas.nombre })
      .from(ventaContactos)
      .leftJoin(ventaEmpresas, eq(ventaContactos.empresaId, ventaEmpresas.id))
      .orderBy(ventaContactos.nombre);

    const abiertas = await db
      .select({
        contactoId: ventaOportunidades.contactoId,
        n: sql<number>`count(*)::int`,
      })
      .from(ventaOportunidades)
      .where(isNull(ventaOportunidades.cerradoEn))
      .groupBy(ventaOportunidades.contactoId);

    const porContacto = new Map(abiertas.map((a) => [a.contactoId, a.n]));
    return base.map((b) => ({
      ...b.contacto,
      empresa: b.empresa,
      abiertas: porContacto.get(b.contacto.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function empresas(): Promise<VentaEmpresa[]> {
  try {
    return await db.select().from(ventaEmpresas).orderBy(ventaEmpresas.nombre);
  } catch {
    return [];
  }
}

/**
 * Cuántas oportunidades abiertas llevan más de dos semanas sin que nadie las
 * toque. Es el número del badge.
 *
 * **Es la única cifra del CRM que representa algo que se está perdiendo.** Un
 * pipeline lleno no es un problema; uno donde nadie llamó a nadie en quince
 * días, sí. Dos semanas porque en servicios B2B una semana de silencio es
 * normal y un mes ya es un negocio muerto.
 */
export async function frias(): Promise<number> {
  try {
    const filas = await db
      .select({ id: ventaOportunidades.id })
      .from(ventaOportunidades)
      .where(
        and(
          isNull(ventaOportunidades.cerradoEn),
          sql`coalesce(${ventaOportunidades.ultimaActividad}, ${ventaOportunidades.abiertoEn}) < now() - interval '14 days'`,
        ),
      );
    return filas.length;
  } catch {
    return 0;
  }
}

export { esCerrada };
