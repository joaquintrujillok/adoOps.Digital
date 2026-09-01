// Ingesta y recuperación de la base de conocimiento del copiloto.

import { and, eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "@/db";
import { conocimientoTrozos, DIMENSIONES } from "@/db/conocimiento";
import { trocear } from "./trocear";

/**
 * El modelo de embeddings. Cambiarlo obliga a reingerir TODO: los vectores de
 * dos modelos distintos no se comparan entre sí, y mezclarlos da resultados que
 * se ven plausibles y son ruido. Por eso no es una variable de entorno: un
 * cambio silencioso acá rompería la búsqueda sin dar ningún error.
 */
const MODELO = "text-embedding-3-small";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

async function embeber(textos: string[]): Promise<number[][]> {
  const salida: number[][] = [];
  // De a 96: la API acepta lotes, y de a uno serían cientos de viajes de red
  // para algo que tarda lo mismo.
  for (let i = 0; i < textos.length; i += 96) {
    const res = await client().embeddings.create({
      model: MODELO,
      input: textos.slice(i, i + 96),
    });
    salida.push(...res.data.map((d) => d.embedding));
  }
  return salida;
}

export type ResultadoIngesta = {
  trozos: number;
  siempre: number;
  reemplazados: number;
  tokens: number;
};

/**
 * Carga un documento. Es **reemplazo, no acumulación**: borra lo que había de
 * ese archivo en esa cuenta y carga lo nuevo.
 *
 * Acumular dejaría el documento viejo conviviendo con el nuevo, y el copiloto
 * empezaría a citar precios que ya no existen sin que nadie entienda de dónde
 * los saca. Un índice que miente es peor que uno vacío, porque el vacío se nota.
 */
export async function ingerir(
  cuenta: string,
  origen: string,
  markdown: string,
): Promise<ResultadoIngesta> {
  const trozos = trocear(markdown);
  if (trozos.length === 0) return { trozos: 0, siempre: 0, reemplazados: 0, tokens: 0 };

  const vectores = await embeber(trozos.map((t) => t.texto));

  const borrados = await db
    .delete(conocimientoTrozos)
    .where(and(eq(conocimientoTrozos.cuenta, cuenta), eq(conocimientoTrozos.origen, origen)))
    .returning({ id: conocimientoTrozos.id });

  // De a 50 y no de a uno: con neon-http cada sentencia es un viaje HTTP, y 250
  // trozos de a uno son 250 viajes que exceden el tiempo de la función.
  for (let i = 0; i < trozos.length; i += 50) {
    await db.insert(conocimientoTrozos).values(
      trozos.slice(i, i + 50).map((t, j) => ({
        cuenta,
        origen,
        ruta: t.ruta,
        titulo: t.titulo,
        texto: t.texto,
        orden: i + j,
        siempre: t.siempre,
        vector: vectores[i + j],
        tokens: Math.round(t.texto.length / 4),
      })),
    );
  }

  return {
    trozos: trozos.length,
    siempre: trozos.filter((t) => t.siempre).length,
    reemplazados: borrados.length,
    tokens: trozos.reduce((a, t) => a + Math.round(t.texto.length / 4), 0),
  };
}

// ─── Recuperación ────────────────────────────────────────────────────────────

/**
 * Cuántos trozos se traen por pasada.
 *
 * Tres, de ~1.100 tokens cada uno. Con seis el prompt se llena de material
 * tangencial y el modelo empieza a proponer soluciones que nadie mencionó; con
 * uno, cualquier error de la búsqueda deja al copiloto sin nada. Tres es el
 * punto donde todavía se puede leer qué se recuperó y por qué.
 */
const CUANTOS = 3;

export type TrozoRecuperado = { ruta: string; texto: string; distancia: number };

/**
 * Trae el material pertinente a lo que se está hablando.
 *
 * **La consulta es el contexto de la reunión, no la última frase.** Es la
 * diferencia entre buscar bien y buscar ruido: una frase suelta de veinte
 * segundos suele ser "sí, claro, exacto"; el contexto acumulado —el tema, lo que
 * la otra parte quiere, dónde está la fricción— es una descripción densa de la
 * conversación, que es justo lo que un embedding sabe comparar.
 */
export async function recuperar(
  cuenta: string,
  consulta: string,
): Promise<TrozoRecuperado[]> {
  try {
    // Los "siempre" no pasan por la búsqueda: son las instrucciones al agente.
    const fijos = await db
      .select({ ruta: conocimientoTrozos.ruta, texto: conocimientoTrozos.texto })
      .from(conocimientoTrozos)
      .where(and(eq(conocimientoTrozos.cuenta, cuenta), eq(conocimientoTrozos.siempre, 1)))
      .orderBy(conocimientoTrozos.orden);

    const limpia = consulta.trim();
    if (!limpia) return fijos.map((f) => ({ ...f, distancia: 0 }));

    const [vector] = await embeber([limpia]);
    if (!vector || vector.length !== DIMENSIONES) {
      return fijos.map((f) => ({ ...f, distancia: 0 }));
    }

    const literal = JSON.stringify(vector);
    const cercanos = await db
      .select({
        ruta: conocimientoTrozos.ruta,
        texto: conocimientoTrozos.texto,
        distancia: sql<number>`${conocimientoTrozos.vector} <=> ${literal}::vector`,
      })
      .from(conocimientoTrozos)
      .where(and(eq(conocimientoTrozos.cuenta, cuenta), eq(conocimientoTrozos.siempre, 0)))
      .orderBy(sql`${conocimientoTrozos.vector} <=> ${literal}::vector`)
      .limit(CUANTOS);

    return [...fijos.map((f) => ({ ...f, distancia: 0 })), ...cercanos];
  } catch {
    // Sin base de conocimiento el copiloto sigue funcionando, solo que sin
    // material propio. Que falle la búsqueda no puede cortar la reunión.
    return [];
  }
}

/** Cuántos trozos tiene cargados una cuenta. Para que la pantalla lo diga. */
export async function cuantos(cuenta: string): Promise<number> {
  try {
    const filas = await db
      .select({ id: conocimientoTrozos.id })
      .from(conocimientoTrozos)
      .where(eq(conocimientoTrozos.cuenta, cuenta));
    return filas.length;
  } catch {
    return 0;
  }
}
