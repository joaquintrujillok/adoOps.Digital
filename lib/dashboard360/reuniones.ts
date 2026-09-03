// ÚNICO punto donde Dashboard360 lee las tablas de reuniones.
//
// Mismo patrón y misma razón que `motor.ts` y `contenido.ts`: **el tablero
// tiene que poder existir sin este módulo al lado.** Si las tablas `reunion_*`
// no están creadas en un despliegue, nada revienta — todo devuelve vacío,
// `disponible()` responde `false`, y el menú no pinta la entrada.

import { and, eq, inArray, sql } from "drizzle-orm";
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
  | "ambito"
  | "capturadaPor"
  | "createdAt"
>;

export type FiltrosReunion = {
  /** Texto libre. Busca en el título y adentro de la transcripción. */
  q?: string;
  /** `YYYY-MM-DD`, inclusive. */
  desde?: string;
  /** `YYYY-MM-DD`, inclusive: se compara contra el final de ese día. */
  hasta?: string;
  /**
   * Id de cuenta. `undefined` es "todas" —solo se usa para el rescate de
   * huérfanas—, y el string vacío es el filtro explícito de "sin cuenta".
   */
  ambito?: string;
  /** Solo las que no tienen cuenta asignada. Ver `huerfanas()`. */
  sinCuenta?: boolean;
};

/**
 * La fecha por la que se ordena y se filtra.
 *
 * Es `inicio_en` cuando existe, y si no la hora en que llegó. `inicio_en` es
 * null cuando la extensión está configurada en modo `simple` —manda la fecha
 * formateada para humanos y no se puede parsear, ver `lib/reuniones/payload.ts`—
 * y una reunión sin fecha no puede desaparecer de un filtro por fechas solo
 * porque su emisor tenía mal una casilla.
 */
const FECHA = sql`coalesce(${reunionRegistros.inicioEn}, ${reunionRegistros.createdAt})`;

/**
 * La lista, más reciente primero, con filtros.
 *
 * **La búsqueda entra al texto de la reunión, no solo al título.** Es lo que la
 * hace servir: el título que manda Meet es el código de la sala —"Meet -
 * ppb-cxec-ujo"— y nadie recuerda una reunión por ahí. Se recuerda por una
 * palabra que se dijo adentro.
 *
 * Se busca con `ILIKE` y no con búsqueda de texto completo de Postgres. Con
 * cientos de reuniones la diferencia no se nota, y `ILIKE '%palabra%'` encuentra
 * fragmentos y palabras a medias, que es como busca alguien que no se acuerda
 * bien. Si algún día son miles, esto se cambia por un índice `tsvector` y la
 * pantalla no se entera.
 */
export async function listar(
  filtros: FiltrosReunion = {},
  limite = 100,
): Promise<FilaReunion[]> {
  try {
    const condiciones = [];

    const q = filtros.q?.trim();
    if (q) {
      const patron = `%${q}%`;
      condiciones.push(
        sql`(
          ${reunionRegistros.titulo} ILIKE ${patron}
          OR ${reunionRegistros.transcripcion} ILIKE ${patron}
          OR coalesce(${reunionRegistros.transcripcionCorregida}, '') ILIKE ${patron}
          OR coalesce(${reunionRegistros.resumen}, '') ILIKE ${patron}
        )`,
      );
    }

    if (filtros.desde) condiciones.push(sql`${FECHA} >= ${filtros.desde}::date`);
    // El "hasta" incluye el día entero: quien escribe una fecha de término
    // quiere ese día adentro, no hasta su medianoche inicial.
    if (filtros.hasta)
      condiciones.push(sql`${FECHA} < (${filtros.hasta}::date + interval '1 day')`);

    if (filtros.sinCuenta) {
      condiciones.push(sql`${reunionRegistros.ambito} IS NULL`);
    } else if (filtros.ambito) {
      condiciones.push(eq(reunionRegistros.ambito, filtros.ambito));
    }

    const base = db
      .select({
        id: reunionRegistros.id,
        titulo: reunionRegistros.titulo,
        plataforma: reunionRegistros.plataforma,
        inicioEn: reunionRegistros.inicioEn,
        duracionMin: reunionRegistros.duracionMin,
        participantes: reunionRegistros.participantes,
        estado: reunionRegistros.estado,
        resumen: reunionRegistros.resumen,
        ambito: reunionRegistros.ambito,
        capturadaPor: reunionRegistros.capturadaPor,
        createdAt: reunionRegistros.createdAt,
      })
      .from(reunionRegistros);

    const conFiltros = condiciones.length > 0 ? base.where(and(...condiciones)) : base;

    return await conFiltros.orderBy(sql`${FECHA} DESC`).limit(limite);
  } catch {
    return [];
  }
}

/**
 * Cuántas reuniones quedaron sin cuenta asignada.
 *
 * **Existe para que no desaparezcan.** La lista filtra por la cuenta activa, así
 * que una fila sin cuenta no aparece en ninguna: sin este contador se perdería
 * en silencio, que es la peor forma de perder algo. Son las que entraron antes
 * de que las cuentas existieran, o por un token que no declara ámbito.
 *
 * No se les asigna una a ciegas. Adivinar de qué mundo era una conversación es
 * justo el error que las cuentas existen para evitar.
 */
export async function huerfanas(): Promise<number> {
  try {
    const filas = await db
      .select({ id: reunionRegistros.id })
      .from(reunionRegistros)
      .where(sql`${reunionRegistros.ambito} IS NULL`);
    return filas.length;
  } catch {
    return 0;
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
  /**
   * `true` si alguna de las reuniones sumadas tiene el costo estimado al tramo
   * de contexto corto. Un total que mezcla cifras exactas con pisos no se puede
   * presentar como exacto: basta una fila aproximada para que el total lo sea.
   */
  aproximado: boolean;
};

/**
 * Lo que lleva costado el módulo.
 *
 * Suma la columna congelada de cada fila, no recalcula con la tarifa de hoy —
 * ver `lib/reuniones/costo.ts`. Las filas sin costo (modelo desconocido, o
 * reuniones que nunca se resumieron) no suman y tampoco cuentan: un promedio
 * repartido entre reuniones que no se pagaron sería más bajo que el real.
 */
export async function gasto(cuenta?: string): Promise<Gasto> {
  try {
    const base = db
      .select({
        // Las dos columnas: `costoUsd` es la corrección y el resumen;
        // `costoVivoUsd` es escuchar en vivo, que en una reunión larga es cien
        // veces más. Sumar solo la primera —como hacía antes— daba un total que
        // parecía decir que el módulo es gratis.
        total: sql<string>`coalesce(sum(coalesce(${reunionRegistros.costoUsd}, 0) + coalesce(${reunionRegistros.costoVivoUsd}, 0)), 0)`,
        n: sql<number>`count(*) filter (where ${reunionRegistros.costoUsd} is not null or ${reunionRegistros.costoVivoUsd} is not null)::int`,
        aprox: sql<number>`count(*) filter (where ${reunionRegistros.costoAproximado} = 1 and ${reunionRegistros.costoUsd} is not null)::int`,
      })
      .from(reunionRegistros);

    // Por cuenta y no global: un total que mezcla lo personal con lo de la
    // empresa no responde ninguna de las dos preguntas que uno se hace.
    const filas = cuenta
      ? await base.where(eq(reunionRegistros.ambito, cuenta))
      : await base;

    // `sum()` de un numeric vuelve como string. Number() acá y no en la
    // pantalla: que el tipo mienta una sola vez, lo más cerca posible del SQL.
    return {
      totalUsd: Number(filas[0]?.total ?? 0),
      reuniones: filas[0]?.n ?? 0,
      aproximado: (filas[0]?.aprox ?? 0) > 0,
    };
  } catch {
    return { totalUsd: 0, reuniones: 0, aproximado: false };
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
