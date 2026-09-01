// Orquestación de una reunión que entra por webhook:
//   recibir()  → guarda el transcript y devuelve el id. No llama a la IA.
//   resumir()  → le pide a la IA el resumen y actualiza la fila.
//
// **Por qué son dos pasos y no uno.** Ver la invariante en la cabecera de
// `db/reuniones.ts`: el transcript existe una sola vez, en el navegador de
// quien estuvo en la reunión, y la extensión lo manda una sola vez. Si el
// endpoint hiciera todo junto y OpenAI tardara más de lo que aguanta el
// webhook, la reunión se perdería entera por un problema que no tiene nada que
// ver con haberla grabado.
//
// Separado, el peor caso es una fila en `error` con el texto completo adentro,
// que se arregla apretando un botón.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reunionCompromisos, reunionRegistros } from "@/db/reuniones";
import { extraerReunion } from "@/lib/reuniones/extraer";
import type { ReunionNormalizada } from "@/lib/reuniones/payload";

export type ResultadoRecepcion = {
  id: number;
  /** `true` si esta reunión ya estaba guardada y no se hizo nada. */
  duplicada: boolean;
};

/**
 * Guarda el transcript. Idempotente por `clave`: el mismo POST repetido
 * devuelve el id de la fila que ya existe, sin tocarla.
 *
 * No se actualiza la fila existente a propósito. Si alguien repostea la misma
 * reunión desde el historial de la extensión, lo que hay guardado es igual o
 * mejor que lo que llega —y sobrescribirlo borraría un resumen ya generado.
 */
export async function recibir(
  reunion: ReunionNormalizada,
  crudo: unknown,
): Promise<ResultadoRecepcion> {
  const insertada = await db
    .insert(reunionRegistros)
    .values({
      clave: reunion.clave,
      plataforma: reunion.plataforma,
      titulo: reunion.titulo,
      inicioEn: reunion.inicioEn,
      finEn: reunion.finEn,
      duracionMin: reunion.duracionMin,
      participantes: reunion.participantes,
      transcripcion: reunion.transcripcion,
      bloques: reunion.bloques,
      chat: reunion.chat,
      crudo,
      estado: "recibida",
    })
    .onConflictDoNothing({ target: reunionRegistros.clave })
    .returning({ id: reunionRegistros.id });

  if (insertada.length > 0) return { id: insertada[0].id, duplicada: false };

  const [existente] = await db
    .select({ id: reunionRegistros.id })
    .from(reunionRegistros)
    .where(eq(reunionRegistros.clave, reunion.clave))
    .limit(1);

  return { id: existente.id, duplicada: true };
}

/**
 * Pide el resumen y actualiza la fila. Nunca lanza: el llamador es un
 * `after()` de un webhook que ya respondió 200, así que una excepción acá no
 * llega a ninguna parte. El error se guarda en la fila, que es donde alguien lo
 * va a ver.
 */
export async function resumir(id: number): Promise<void> {
  const [fila] = await db
    .select()
    .from(reunionRegistros)
    .where(eq(reunionRegistros.id, id))
    .limit(1);

  if (!fila) return;
  if (fila.estado === "resumida") return;

  try {
    const { extraccion, resumen, uso } = await extraerReunion(fila.transcripcion, {
      titulo: fila.titulo,
      participantes: fila.participantes ?? [],
    });

    // Los compromisos se rehacen desde cero en cada resumen. Si esto es un
    // reintento, los de la corrida fallida anterior no deben quedar mezclados
    // con los nuevos.
    await db.delete(reunionCompromisos).where(eq(reunionCompromisos.reunionId, id));

    if (extraccion.compromisos.length) {
      await db.insert(reunionCompromisos).values(
        extraccion.compromisos.map((c) => ({
          reunionId: id,
          compromiso: c.compromiso,
          responsable: c.responsable ?? null,
          prioridad: c.prioridad ?? "media",
          plazo: c.plazo ?? null,
        })),
      );
    }

    await db
      .update(reunionRegistros)
      .set({
        estado: "resumida",
        resumen,
        extraccion,
        error: null,
        modelo: uso.modelo,
        tokensEntrada: uso.tokensEntrada,
        tokensEntradaCache: uso.tokensEntradaCache,
        tokensSalida: uso.tokensSalida,
        // `numeric` viaja como string. `toFixed(6)` fija la escala de la
        // columna en vez de dejar que Postgres redondee un float largo.
        costoUsd: uso.costoUsd === null ? null : uso.costoUsd.toFixed(6),
        costoAproximado: uso.costoAproximado ? 1 : 0,
        intentos: fila.intentos + 1,
        resumidaEn: new Date(),
      })
      .where(eq(reunionRegistros.id, id));
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    await db
      .update(reunionRegistros)
      .set({
        estado: "error",
        // El mensaje se guarda entero salvo que sea absurdo: un stack de 8 KB
        // en la pantalla no ayuda a nadie.
        error: mensaje.slice(0, 2000),
        intentos: fila.intentos + 1,
      })
      .where(eq(reunionRegistros.id, id));
  }
}
