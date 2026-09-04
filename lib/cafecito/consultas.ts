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
        titulo: cafecitoEdiciones.titulo,
        bajada: cafecitoEdiciones.bajada,
        lectura: cafecitoEdiciones.lectura,
      })
      .from(cafecitoEdiciones)
      .where(eq(cafecitoEdiciones.publicada, true))
      .orderBy(desc(cafecitoEdiciones.slug))
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

export async function edicionAnterior(slug: string) {
  try {
    const [e] = await db
      .select({ slug: cafecitoEdiciones.slug, titulo: cafecitoEdiciones.titulo })
      .from(cafecitoEdiciones)
      .where(and(eq(cafecitoEdiciones.publicada, true), lt(cafecitoEdiciones.slug, slug)))
      .orderBy(desc(cafecitoEdiciones.slug))
      .limit(1);
    return e ?? null;
  } catch (err) {
    fallo("edicionAnterior", err);
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
      .orderBy(desc(cafecitoEdiciones.slug))
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
      .orderBy(desc(cafecitoEdiciones.slug))
      .limit(limite);
  } catch (err) {
    // Un sitemap incompleto es un problema menor; uno caído hace que Google
    // deje de pedirlo.
    fallo("edicionesParaSitemap", err);
    return [];
  }
}
