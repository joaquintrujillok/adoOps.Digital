// ÚNICO punto donde Dashboard360 lee las tablas de reuniones.
//
// Mismo patrón y misma razón que `motor.ts` y `contenido.ts`: **el tablero
// tiene que poder existir sin este módulo al lado.** Si las tablas `reunion_*`
// no están creadas en un despliegue, nada revienta — todo devuelve vacío,
// `disponible()` responde `false`, y el menú no pinta la entrada.

import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  reunionCompromisos,
  reunionRegistros,
  type ReunionCompromiso,
  type ReunionRegistro,
} from "@/db/reuniones";

/**
 * ¿Está el módulo de reuniones desplegado en este entorno?
 *
 * Se pregunta por la tabla y no por un flag: lo que importa no es si alguien
 * quiso instalarlo, es si las consultas van a funcionar.
 */
export async function disponible(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM reunion_registros LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

export type FilaReunion = Pick<
  ReunionRegistro,
  | "id"
  | "titulo"
  | "plataforma"
  | "inicioEn"
  | "duracionMin"
  | "participantes"
  | "estado"
  | "resumen"
  | "createdAt"
>;

/**
 * La lista, más reciente primero.
 *
 * Ordena por `inicioEn` y desempata con `createdAt` porque `inicioEn` puede ser
 * null: la extensión en modo `simple` manda la fecha ya formateada para
 * humanos y no se parsea (ver `lib/reuniones/payload.ts`). `NULLS LAST` deja
 * esas reuniones donde corresponde en vez de arriba de todo.
 */
export async function listar(limite = 50): Promise<FilaReunion[]> {
  try {
    return await db
      .select({
        id: reunionRegistros.id,
        titulo: reunionRegistros.titulo,
        plataforma: reunionRegistros.plataforma,
        inicioEn: reunionRegistros.inicioEn,
        duracionMin: reunionRegistros.duracionMin,
        participantes: reunionRegistros.participantes,
        estado: reunionRegistros.estado,
        resumen: reunionRegistros.resumen,
        createdAt: reunionRegistros.createdAt,
      })
      .from(reunionRegistros)
      .orderBy(sql`${reunionRegistros.inicioEn} DESC NULLS LAST`, desc(reunionRegistros.createdAt))
      .limit(limite);
  } catch {
    return [];
  }
}

export type DetalleReunion = {
  reunion: ReunionRegistro;
  compromisos: ReunionCompromiso[];
};

export async function detalle(id: number): Promise<DetalleReunion | null> {
  try {
    const [reunion] = await db
      .select()
      .from(reunionRegistros)
      .where(eq(reunionRegistros.id, id))
      .limit(1);
    if (!reunion) return null;

    const compromisos = await db
      .select()
      .from(reunionCompromisos)
      .where(eq(reunionCompromisos.reunionId, id))
      .orderBy(reunionCompromisos.id);

    return { reunion, compromisos };
  } catch {
    return null;
  }
}

export type Gasto = {
  /** USD gastados en resumir, sumando todas las reuniones. */
  totalUsd: number;
  /** Sobre cuántas reuniones se calculó. Sin esto el total no dice nada. */
  reuniones: number;
};

/**
 * Lo que lleva costado el módulo.
 *
 * Suma la columna congelada de cada fila, no recalcula con la tarifa de hoy —
 * ver `lib/reuniones/costo.ts`. Las filas sin costo (modelo desconocido, o
 * reuniones que nunca se resumieron) no suman y tampoco cuentan: un promedio
 * repartido entre reuniones que no se pagaron sería más bajo que el real.
 */
export async function gasto(): Promise<Gasto> {
  try {
    const filas = await db
      .select({
        total: sql<string>`coalesce(sum(${reunionRegistros.costoUsd}), 0)`,
        n: sql<number>`count(${reunionRegistros.costoUsd})::int`,
      })
      .from(reunionRegistros);
    // `sum()` de un numeric vuelve como string. Number() acá y no en la
    // pantalla: que el tipo mienta una sola vez, lo más cerca posible del SQL.
    return { totalUsd: Number(filas[0]?.total ?? 0), reuniones: filas[0]?.n ?? 0 };
  } catch {
    return { totalUsd: 0, reuniones: 0 };
  }
}

/**
 * Cuántas reuniones llegaron y no tienen resumen. Es el número del badge.
 *
 * Cuenta las dos formas de quedarse sin resumen —la que falló y la que nunca
 * se procesó— porque para quien mira el menú son el mismo problema: hay una
 * reunión guardada que no se puede leer todavía.
 */
export async function sinResumen(): Promise<number> {
  try {
    const filas = await db
      .select({ id: reunionRegistros.id })
      .from(reunionRegistros)
      .where(inArray(reunionRegistros.estado, ["recibida", "error"]));
    return filas.length;
  } catch {
    return 0;
  }
}
