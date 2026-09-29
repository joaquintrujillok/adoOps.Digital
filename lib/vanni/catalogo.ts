// Catálogo de la tienda por WhatsApp: búsqueda y lectura de productos.
//
// La búsqueda tiene dos caminos, y el segundo no es un parche: es el que queda
// cuando el primero no puede correr.
//
// 1. **Por significado** (embeddings, como el RAG del bot de Paine): "algo para
//    llevar sushi" encuentra bandejas y envases aunque ninguna palabra coincida.
// 2. **Por palabras**: cada palabra de la consulta suma si aparece en el nombre,
//    la categoría o el SKU. Es lo que corre sin OPENAI_API_KEY, o si un producto
//    todavía no tiene su vector.

import { and, asc, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniCategorias, vanniProductos, type VanniProducto } from "@/db/vanni";
import { embedding, hayModelo } from "./llm";

export interface ProductoBreve {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  categoria: string | null;
  imagenUrl: string | null;
  sku: string | null;
}

const COLUMNAS = {
  id: vanniProductos.id,
  nombre: vanniProductos.nombre,
  precio: vanniProductos.precio,
  stock: vanniProductos.stock,
  categoria: vanniProductos.categoria,
  imagenUrl: vanniProductos.imagenUrl,
  sku: vanniProductos.sku,
};

const VACIAS = new Set([
  "para", "con", "los", "las", "una", "uno", "unos", "unas", "que", "del", "por",
  "quiero", "necesito", "busco", "tienen", "tiene", "hay", "algo", "comprar",
  "me", "de", "el", "la", "en", "y", "o", "un", "mas", "más", "precio",
]);

function palabras(consulta: string): string[] {
  return consulta
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !VACIAS.has(w))
    // "bandejas" → "bandeja": el catálogo mezcla singular y plural.
    .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
    .slice(0, 6);
}

async function buscarPorPalabras(consulta: string, limite: number): Promise<ProductoBreve[]> {
  const ws = palabras(consulta);
  if (ws.length === 0) return [];
  // translate() y no la extensión `unaccent`, que puede no estar instalada.
  const nombre = sql`translate(lower(${vanniProductos.nombre}), 'áéíóúüñ', 'aeiouun')`;
  const resto = sql`translate(lower(coalesce(${vanniProductos.categoria}, '') || ' ' || coalesce(${vanniProductos.sku}, '')), 'áéíóúüñ', 'aeiouun')`;
  // En el nombre pesa más que en la categoría, y más aún al comienzo: quien
  // busca "servilletas" quiere servilletas, no el dispensador de servilletas
  // que vive en la misma categoría.
  const puntaje = sql.join(
    ws.map(
      (w) => sql`(case when ${nombre} like ${w + "%"} then 5 when ${nombre} like ${"%" + w + "%"} then 3 else 0 end
        + case when ${resto} like ${"%" + w + "%"} then 1 else 0 end)`,
    ),
    sql` + `,
  );
  return db
    .select(COLUMNAS)
    .from(vanniProductos)
    .where(and(eq(vanniProductos.activo, true), sql`(${puntaje}) > 0`))
    .orderBy(desc(sql`(${puntaje})`), desc(gt(vanniProductos.stock, 0)), asc(vanniProductos.nombre))
    .limit(limite);
}

async function buscarPorSignificado(consulta: string, limite: number): Promise<ProductoBreve[]> {
  const v = await embedding(consulta);
  const literal = `[${v.join(",")}]`;
  return db
    .select(COLUMNAS)
    .from(vanniProductos)
    .where(and(eq(vanniProductos.activo, true), isNotNull(vanniProductos.embedding)))
    .orderBy(sql`${vanniProductos.embedding} <=> ${literal}::vector`)
    .limit(limite);
}

export async function buscarProductos(consulta: string, limite = 6): Promise<ProductoBreve[]> {
  const q = consulta.trim();
  if (!q) return [];
  // Un SKU exacto gana siempre: quien lo escribe sabe lo que quiere.
  const porSku = await db
    .select(COLUMNAS)
    .from(vanniProductos)
    .where(and(eq(vanniProductos.activo, true), eq(vanniProductos.sku, q)))
    .limit(1);
  if (porSku.length) return porSku;

  if (hayModelo()) {
    try {
      const r = await buscarPorSignificado(q, limite);
      if (r.length) return r;
    } catch (err) {
      console.error("[vanni] búsqueda por significado falló, uso palabras", err);
    }
  }
  return buscarPorPalabras(q, limite);
}

export async function productoPorId(id: number): Promise<VanniProducto | null> {
  const [p] = await db.select().from(vanniProductos).where(eq(vanniProductos.id, id)).limit(1);
  return p ?? null;
}

export async function productosPorIds(ids: number[]): Promise<ProductoBreve[]> {
  if (!ids.length) return [];
  const filas = await db.select(COLUMNAS).from(vanniProductos).where(inArray(vanniProductos.id, ids));
  return ids.map((id) => filas.find((f) => f.id === id)).filter((f): f is ProductoBreve => Boolean(f));
}

/** Categorías de primer nivel con productos, para el menú de la tienda. */
export async function categoriasPrincipales(): Promise<{ nombre: string; productos: number }[]> {
  return db
    .select({ nombre: vanniProductos.categoria, productos: sql<number>`count(*)::int` })
    .from(vanniProductos)
    .where(and(eq(vanniProductos.activo, true), isNotNull(vanniProductos.categoria)))
    .groupBy(vanniProductos.categoria)
    .orderBy(desc(sql`count(*)`))
    .then((r) => r.map((x) => ({ nombre: x.nombre ?? "", productos: x.productos })));
}

export async function productosDeCategoria(nombre: string, limite = 6): Promise<ProductoBreve[]> {
  return db
    .select(COLUMNAS)
    .from(vanniProductos)
    .where(and(eq(vanniProductos.activo, true), sql`lower(${vanniProductos.categoria}) = lower(${nombre})`))
    .orderBy(desc(vanniProductos.destacado), desc(gt(vanniProductos.stock, 0)), asc(vanniProductos.nombre))
    .limit(limite);
}

export async function totalCategorias(): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(vanniCategorias);
  return r?.n ?? 0;
}
