"use server";

// Las dos acciones de la pantalla de reuniones.
//
// Ninguna de las dos toca la transcripción. Es deliberado: el transcript es el
// registro de lo que se dijo y no se edita desde una pantalla. Lo que sí se
// puede rehacer es la lectura que la IA hizo de él.

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { reunionRegistros } from "@/db/reuniones";
import { getSession } from "@/lib/dashboard360/session";
import { procesar } from "@/lib/reuniones/registro";

async function exigirSesion() {
  const s = await getSession();
  // Cualquier rol del tablero. No se pide `puedePublicar` como en contenido:
  // acá no sale nada hacia afuera, se releen notas internas.
  if (!s) throw new Error("No autorizado");
  return s;
}

/**
 * Vuelve a correr las dos pasadas de IA: corregir y resumir.
 *
 * Ignora `MAX_INTENTOS` a propósito: ese tope frena los reintentos automáticos,
 * y esto es una persona apretando un botón porque sabe algo que el contador no
 * —que la cuota de OpenAI ya se recargó, por ejemplo—.
 *
 * Corre en línea y no en un `after()`: acá sí hay alguien mirando la pantalla, y
 * que la página vuelva ya con el resultado es la única forma de que el botón se
 * sienta como un botón. Una reunión de una hora tarda algunas decenas de
 * segundos, porque la corrección reescribe el texto entero.
 */
export async function reintentarResumenAction(formData: FormData) {
  await exigirSesion();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  // `procesar()` no reprocesa lo que ya está resumido. Para un reintento a mano
  // eso sería un botón que no hace nada, así que se devuelve a `recibida`.
  await db
    .update(reunionRegistros)
    .set({ estado: "recibida" })
    .where(eq(reunionRegistros.id, id));

  await procesar(id);

  revalidatePath(`/dashboard360/reuniones/${id}`);
  revalidatePath("/dashboard360/reuniones");
}

/**
 * Marca un compromiso como hecho, o lo devuelve a pendiente.
 *
 * Escribe en `reunion_compromisos` y nunca en el jsonb `extraccion`: ese es el
 * acta de lo que la IA leyó en su momento y no se reescribe porque alguien haya
 * terminado una tarea. Ver la nota en `db/reuniones.ts`.
 */
export async function alternarCompromisoAction(formData: FormData) {
  await exigirSesion();
  const id = Number(formData.get("id"));
  const reunionId = Number(formData.get("reunionId"));
  if (!Number.isInteger(id)) return;

  await db.execute(sql`
    UPDATE reunion_compromisos
    SET estado = CASE WHEN estado = 'hecho' THEN 'pendiente' ELSE 'hecho' END
    WHERE id = ${id}
  `);

  if (Number.isInteger(reunionId)) {
    revalidatePath(`/dashboard360/reuniones/${reunionId}`);
  }
}
