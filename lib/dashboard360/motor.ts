// ÚNICO punto donde Dashboard360 lee las tablas del motor.
//
// `mercado.ts` inventó este patrón para una función; acá se formaliza para las
// seis que necesita la consola. La propiedad que hay que preservar es una sola:
//
//   **Dashboard360 tiene que poder existir sin el motor al lado.**
//
// El tablero se vende por separado —el plan "Inteligencia" es el único que no
// depende de LinkedIn, y es el que sobrevive si LinkedIn cierra la puerta—. Si
// las tablas `lead_*` no existen en un despliegue, nada de esto revienta: todo
// devuelve vacío y `disponible()` responde `false`, con lo cual el grupo
// "Prospección" del menú ni siquiera se pinta.
//
// Si este archivo crece a dos, esa promesa deja de ser verificable de un
// vistazo — que es exactamente el valor del `grep` de un solo punto de salida.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bandaFrenados,
  colaDeHoy,
  estadoEmisores,
  type FilaCola,
  type FilaEmisor,
  type FilaFrenada,
} from "@/lib/leads/cola";
import { bloqueos, embudo, type Bloqueo, type Embudo } from "@/lib/leads/embudo";
import { motorEncendido } from "@/lib/leads/config";

export type { FilaCola, FilaEmisor, FilaFrenada, Bloqueo, Embudo };

/**
 * ¿Está el motor desplegado en este entorno?
 *
 * Se pregunta por una tabla concreta y no por un flag de configuración: lo que
 * importa no es si alguien quiso instalarlo, es si las consultas van a
 * funcionar.
 */
export async function disponible(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM lead_acciones LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

export interface PanelDespacho {
  disponible: boolean;
  encendido: boolean;
  emisores: FilaEmisor[];
  cola: FilaCola[];
  frenados: FilaFrenada[];
  bloqueos: Bloqueo[];
  embudo: Embudo | null;
  /** Cuántas de la cola esperan aprobación. Es el número del botón. */
  porAprobar: number;
}

const VACIO: PanelDespacho = {
  disponible: false,
  encendido: false,
  emisores: [],
  cola: [],
  frenados: [],
  bloqueos: [],
  embudo: null,
  porAprobar: 0,
};

/**
 * Todo lo que el panel necesita, en un viaje.
 *
 * Se traen las cinco consultas en paralelo y no en cascada: son independientes
 * entre sí y encadenarlas multiplicaría la latencia de la pantalla por cinco
 * sin ganar nada.
 */
export async function panelDespacho(ahora = new Date()): Promise<PanelDespacho> {
  try {
    const [encendido, emisores, cola, frenados, lista, e] = await Promise.all([
      motorEncendido(),
      estadoEmisores(ahora),
      colaDeHoy(ahora),
      bandaFrenados(ahora),
      bloqueos(),
      embudo(),
    ]);

    return {
      disponible: true,
      encendido,
      emisores,
      cola,
      frenados,
      bloqueos: lista,
      embudo: e,
      porAprobar: cola.filter((c) => c.estado === "pendiente").length,
    };
  } catch {
    // El motor no está desplegado acá. No es un error del tablero.
    return VACIO;
  }
}

/** Para el badge del menú: conversaciones esperando a una persona. */
export async function sinResponder(): Promise<number> {
  try {
    const r = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM lead_inscripciones
       WHERE estado = 'respondio'
    `);
    return r.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

/** Para el badge del menú: emisores frenados o pausados, que es lo que urge mirar. */
export async function emisoresConProblema(): Promise<number> {
  try {
    const r = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n
        FROM lead_emisores
       WHERE estado IN ('frenado', 'pausado', 'restringido')
          OR (tasa_aceptacion_7d IS NOT NULL AND tasa_aceptacion_7d < 25)
    `);
    return r.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}
