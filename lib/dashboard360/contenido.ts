// ÚNICO punto donde Dashboard360 lee las tablas de contenido.
//
// Mismo patrón y misma razón que `motor.ts`: **el tablero tiene que poder
// existir sin la máquina de contenido al lado.** Si las tablas `contenido_*` no
// están creadas en un despliegue, nada revienta — todo devuelve vacío,
// `disponible()` responde `false`, y el menú no pinta la entrada.
//
// Es la misma promesa que hace que el plan "Inteligencia" se pueda vender solo.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conProblema,
  estadoEmisores,
  type FilaEmisorContenido,
} from "@/lib/contenido/emisores";

export type { FilaEmisorContenido };

/**
 * ¿Está la máquina de contenido desplegada en este entorno?
 *
 * Se pregunta por una tabla concreta y no por un flag: lo que importa no es si
 * alguien quiso instalarla, es si las consultas van a funcionar.
 */
export async function disponible(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM contenido_emisores LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

export interface PanelEmisores {
  disponible: boolean;
  emisores: FilaEmisorContenido[];
  /** Cuántos exigen que alguien haga algo. Es el número del badge. */
  problemas: number;
}

const VACIO: PanelEmisores = { disponible: false, emisores: [], problemas: 0 };

export async function panelEmisores(ahora = new Date()): Promise<PanelEmisores> {
  try {
    const emisores = await estadoEmisores(ahora);
    return { disponible: true, emisores, problemas: conProblema(emisores) };
  } catch {
    // No está desplegada acá. No es un error del tablero.
    return VACIO;
  }
}

/** Para el badge del menú, sin traer la pantalla entera. */
export async function emisoresConProblema(): Promise<number> {
  try {
    const { problemas } = await panelEmisores();
    return problemas;
  } catch {
    return 0;
  }
}
