// El interruptor general del motor, en la base y no en una variable de entorno.
//
// Una variable de Vercel exige redesplegar para cambiarla, y el momento en que
// se necesita apagar un motor de envíos es exactamente el momento en que no se
// quiere esperar un despliegue. Va en una tabla de dos columnas.
//
// **Nace apagado y falla cerrado.** Si la tabla no existe, si la consulta
// revienta o si la clave no está, la respuesta es `false`. Es el mismo criterio
// que `whatsapp.envio_habilitado` en el CRM de CDC: el estado por defecto de un
// sistema que le escribe a desconocidos es "no manda nada".

import { sql } from "drizzle-orm";
import { db } from "@/db";

export const CLAVE_MOTOR = "motor.encendido";

export async function leerConfig(clave: string): Promise<string | null> {
  try {
    const r = await db.execute<{ valor: string }>(
      sql`SELECT valor FROM lead_config WHERE clave = ${clave} LIMIT 1`,
    );
    return r.rows[0]?.valor ?? null;
  } catch {
    return null;
  }
}

export async function escribirConfig(clave: string, valor: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO lead_config (clave, valor, actualizado_en)
    VALUES (${clave}, ${valor}, NOW())
    ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()
  `);
}

/** El candado 3. Sin esto en `true` no sale nada, de ninguna campaña. */
export async function motorEncendido(): Promise<boolean> {
  return (await leerConfig(CLAVE_MOTOR)) === "true";
}

export async function encenderMotor(encendido: boolean): Promise<void> {
  await escribirConfig(CLAVE_MOTOR, encendido ? "true" : "false");
}
