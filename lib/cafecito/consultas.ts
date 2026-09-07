// Lecturas de Cafecito IA, tolerantes a que la base no responda.
//
// ── Por qué existe este archivo ──────────────────────────────────────────────
//
// El 03-09-2026 un build de producción se cayó entero con `42P01: relation
// "cafecito_ediciones" does not exist`. Next prerenderiza /cafecito-ia en el
// build, la consulta falló, y con eso se perdió el despliegue completo del
// sitio — no solo el boletín.
//
// Esa es la lección: una sección nueva no puede tumbar el build de todo lo
// demás. Si la base no responde o la tabla todavía no existe, el boletín se
// muestra vacío y el resto del sitio se despliega igual. El error se registra,
// no se esconde.
//
// Ojo con lo que esto NO arregla: si la tabla falta de verdad en producción, la
// página quedará vacía. Es un síntoma visible, que es justo lo que se quiere;
// lo que no se quiere es que se lleve puesto el despliegue.

import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoEdiciones } from "@/db/schema";

/** Log con una marca reconocible: estos fallos son de configuración, no de código. */
function fallo(donde: string, err: unknown) {
  console.error(`[cafecito] ${donde} — la base no respondió:`, err);
}

export async function listarEdiciones(limite = 50) {
  try {
    return await db
      .select({
        slug: cafecitoEdiciones.slug,
        fecha: cafecitoEdiciones.fecha,
        titulo: cafecitoEdiciones.titulo,
        bajada: cafecitoEdiciones.bajada,
        lectura: cafecitoEdiciones.lectura,
        // Para el JSON-LD: schema.org quiere ISO 8601 con zona horaria, y
        // `fecha` es un date pelado (`2026-09-03`). Sirve para mostrar, no para
        // declarar.
        publicadaEn: cafecitoEdiciones.publicadaEn,
      })
      .from(cafecitoEdiciones)
      .where(eq(cafecitoEdiciones.publicada, true))
      // Por fecha, no por slug: desde que el slug es el titular, ordenarlo
      // alfabéticamente pondría el archivo en un orden sin sentido.
      .orderBy(desc(cafecitoEdiciones.fecha))
      .limit(limite);
  } catch (err) {
    fallo("listarEdiciones", err);
    return [];
  }
}

export async function traerEdicion(slug: string) {
  try {
    const [e] = await db
      .select()
      .from(cafecitoEdiciones)
      .where(and(eq(cafecitoEdiciones.slug, slug), eq(cafecitoEdiciones.publicada, true)))
      .limit(1);
    return e ?? null;
  } catch (err) {
    fallo(`traerEdicion(${slug})`, err);
    return null;
  }
}

/** La edición inmediatamente anterior. Se compara por fecha, que es lo que ordena. */
export async function edicionAnterior(fecha: string) {
  try {
    const [e] = await db
      .select({ slug: cafecitoEdiciones.slug, titulo: cafecitoEdiciones.titulo })
      .from(cafecitoEdiciones)
      .where(and(eq(cafecitoEdiciones.publicada, true), lt(cafecitoEdiciones.fecha, fecha)))
      .orderBy(desc(cafecitoEdiciones.fecha))
      .limit(1);
    return e ?? null;
  } catch (err) {
    fallo("edicionAnterior", err);
    return null;
  }
}

/**
 * El slug de la edición de una fecha dada, para redirigir las URLs viejas.
 *
 * Las tres primeras ediciones se publicaron con la fecha como URL y salieron
 * así por correo. Esos enlaces están en bandejas de entrada y tienen que seguir
 * funcionando; esto es lo que permite responderles con un 301.
 */
export async function slugPorFecha(fecha: string) {
  try {
    const [e] = await db
      .select({ slug: cafecitoEdiciones.slug })
      .from(cafecitoEdiciones)
      .where(and(eq(cafecitoEdiciones.fecha, fecha), eq(cafecitoEdiciones.publicada, true)))
      .limit(1);
    return e?.slug ?? null;
  } catch (err) {
    fallo(`slugPorFecha(${fecha})`, err);
    return null;
  }
}

export async function edicionesParaFeed(limite = 50) {
  try {
    return await db
      .select({
        slug: cafecitoEdiciones.slug,
        titulo: cafecitoEdiciones.titulo,
        bajada: cafecitoEdiciones.bajada,
        publicadaEn: cafecitoEdiciones.publicadaEn,
      })
      .from(cafecitoEdiciones)
      .where(eq(cafecitoEdiciones.publicada, true))
      .orderBy(desc(cafecitoEdiciones.fecha))
      .limit(limite);
  } catch (err) {
    // Un feed vacío es mejor que un 500: los lectores lo reintentan solos.
    fallo("edicionesParaFeed", err);
    return [];
  }
}

export async function edicionesParaSitemap(limite = 1000) {
  try {
    return await db
      .select({
        slug: cafecitoEdiciones.slug,
        actualizadaEn: cafecitoEdiciones.actualizadaEn,
      })
      .from(cafecitoEdiciones)
      .where(eq(cafecitoEdiciones.publicada, true))
      .orderBy(desc(cafecitoEdiciones.fecha))
      .limit(limite);
  } catch (err) {
    // Un sitemap incompleto es un problema menor; uno caído hace que Google
    // deje de pedirlo.
    fallo("edicionesParaSitemap", err);
    return [];
  }
}
