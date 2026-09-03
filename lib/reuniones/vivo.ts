// Persistencia de una sesión de escucha en vivo.
//
// ── Por qué se guarda cada 20 segundos y no al final ─────────────────────────
//
// Es la misma invariante que el carril del webhook —ver `db/reuniones.ts`—: el
// transcript es lo irrecuperable. Guardar solo al apretar "Detener" significa
// que cerrar la pestaña, quedarse sin batería o irse a otra página borra una
// reunión entera. Y en una reunión en vivo, cerrar la pestaña por accidente es
// mucho más probable que en cualquier otra pantalla del tablero.
//
// El copiloto ya habla con el servidor cada 20 segundos. Guardar en esa misma
// llamada no cuesta un viaje más y deja el peor caso en veinte segundos
// perdidos, no una hora.
//
// ── Por qué termina en `reunion_registros` y no en una tabla propia ──────────
//
// Porque una reunión escuchada en vivo es una reunión. Guardarla en la misma
// tabla le da gratis el buscador, el filtro por fechas, la descarga en .txt y la
// corrección con IA. Una tabla aparte habría obligado a duplicar las cuatro
// cosas y a decidir en cada pantalla cuál de las dos mirar.
//
// Lo que sí es distinto queda declarado en la fila: `plataforma` dice "En vivo",
// y `participantes` va vacío porque un micrófono no separa voces.

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reunionRegistros } from "@/db/reuniones";

/**
 * Precio por minuto de `gpt-live-transcribe`, en USD.
 *
 * Verificado el 01-09-2026 en developers.openai.com/api/docs/pricing. Va con
 * fecha por lo mismo que la tabla de `lib/reuniones/costo.ts`: es un número que
 * envejece y que nadie va a volver a mirar por su cuenta.
 */
export const USD_POR_MINUTO_VIVO = 0.017;

export type EntradaVivo = {
  /** Clave de idempotencia: identifica la sesión entre pasadas. */
  clave: string;
  titulo: string;
  inicioEn: Date;
  transcripcion: string;
  cuenta: string | null;
  capturadaPor: string | null;
};

/**
 * Crea la fila la primera vez y la actualiza después. Devuelve el id.
 *
 * Solo se toca `transcripcion` en las actualizaciones: si la sesión ya fue
 * procesada por la IA —porque alguien apretó "Detener" y volvió a grabar sobre
 * la misma clave— sobrescribir el resumen borraría trabajo hecho.
 */
export async function guardarVivo(entrada: EntradaVivo): Promise<number> {
  const [existente] = await db
    .select({ id: reunionRegistros.id })
    .from(reunionRegistros)
    .where(eq(reunionRegistros.clave, entrada.clave))
    .limit(1);

  if (existente) {
    await db
      .update(reunionRegistros)
      .set({ transcripcion: entrada.transcripcion, titulo: entrada.titulo })
      .where(eq(reunionRegistros.id, existente.id));
    return existente.id;
  }

  const [creada] = await db
    .insert(reunionRegistros)
    .values({
      clave: entrada.clave,
      titulo: entrada.titulo,
      // "En vivo" y no "Google Meet": lo que se escuchó fue la sala, y puede
      // haber sido una llamada, un Zoom o una conversación presencial. Decir
      // Meet sería afirmar algo que este carril no sabe.
      plataforma: "En vivo",
      inicioEn: entrada.inicioEn,
      transcripcion: entrada.transcripcion,
      // Vacío y no null: la lista distingue "no hay hablantes identificados" de
      // "todavía no se procesó", y acá nunca los va a haber. Un micrófono en la
      // sala no separa voces.
      participantes: [],
      ambito: entrada.cuenta,
      capturadaPor: entrada.capturadaPor,
      estado: "recibida",
    })
    .returning({ id: reunionRegistros.id });

  return creada.id;
}

/**
 * Cierra la sesión: fija el fin, calcula la duración y deja la fila lista para
 * que la IA la procese.
 */
export async function cerrarVivo(clave: string, fin: Date): Promise<number | null> {
  const [fila] = await db
    .select({ id: reunionRegistros.id, inicioEn: reunionRegistros.inicioEn })
    .from(reunionRegistros)
    .where(eq(reunionRegistros.clave, clave))
    .limit(1);

  if (!fila) return null;

  const duracionMin = fila.inicioEn
    ? Math.max(0, Math.round((fin.getTime() - fila.inicioEn.getTime()) / 60000))
    : null;

  await db
    .update(reunionRegistros)
    .set({
      finEn: fin,
      duracionMin,
      // La transcripción se cobra por minuto y es, de lejos, el grueso del
      // gasto: una reunión de media hora son ~US$0,50 de escucha contra medio
      // centavo de resumen. Se calcula acá y no en la pantalla porque tiene que
      // quedar guardado: el contador en vivo desaparece al cerrar la pestaña.
      costoVivoUsd: sql`coalesce(${reunionRegistros.costoVivoUsd}, 0) + ${(
        (duracionMin ?? 0) * USD_POR_MINUTO_VIVO
      ).toFixed(6)}::numeric`,
    })
    .where(eq(reunionRegistros.id, fila.id));

  return fila.id;
}


/**
 * Suma un gasto a la reunión en vivo. Se acumula, no se reemplaza.
 *
 * Cada pasada del copiloto llama acá con lo suyo, y el cierre agrega la
 * transcripción. Es una suma en SQL y no una lectura seguida de una escritura:
 * dos pasadas que terminen a la vez se sumarían sobre el mismo valor viejo y una
 * de las dos se perdería.
 */
export async function sumarCostoVivo(clave: string, usd: number): Promise<void> {
  if (!Number.isFinite(usd) || usd <= 0) return;
  await db
    .update(reunionRegistros)
    .set({
      costoVivoUsd: sql`coalesce(${reunionRegistros.costoVivoUsd}, 0) + ${usd.toFixed(6)}::numeric`,
    })
    .where(eq(reunionRegistros.clave, clave));
}
