// Importa el catálogo de vannichile.cl a `vanni_productos` y `vanni_categorias`.
//
// Lee la Store API pública de WooCommerce (la misma que usa el sitio para
// mostrar la tienda): no hay scraping de HTML, así que un cambio de diseño del
// sitio no rompe esto.
//
// **Precios y stock son ficticios.** En el sitio todos los productos cuestan $1
// y el stock es solo "hay / no hay". Para que la tienda por WhatsApp se pueda
// mostrar, cada producto recibe un precio y un stock inventados, estables
// (derivados de su id, así que re-importar da los mismos números) y marcados con
// `precio_ficticio = true`. Un producto sin stock en el sitio queda con 0.
//
// **Es idempotente.** Se identifica por el id de WooCommerce. Re-importar
// actualiza nombre, descripción, categorías e imagen, pero NO pisa precio ni
// stock: esos pueden haberse editado en el backoffice.
//
// **El certificado de vannichile.cl viene incompleto.** El servidor manda su
// certificado pero no el intermedio de GlobalSign (AlphaSSL CA 2025); los
// navegadores lo completan solos y Node no. En vez de apagar la verificación,
// `scripts/certs/globalsign-alphassl-2025.crt` es ese intermedio, bajado de la
// URL que declara el propio certificado, y se le entrega a Node con
// NODE_EXTRA_CA_CERTS. Por eso se corre con `npm run vanni:catalogo`.
//
// Uso:
//   npm run vanni:catalogo                               catálogo + imágenes
//   npm run vanni:catalogo -- --sin-imagenes
//   npm run vanni:catalogo -- --embeddings   solo vectores faltantes (requiere OPENAI_API_KEY)

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";

function cargarEnv() {
  let s = "";
  try {
    s = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const linea of s.split("\n")) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
cargarEnv();

const sql = neon(process.env.DATABASE_URL);
const API = "https://www.vannichile.cl/wp-json/wc/store/v1";
const UA = { "User-Agent": "adoOps-Vanni-Importador/1.0 (+https://www.adoops.digital)" };
const conImagenes = !process.argv.includes("--sin-imagenes");
const soloEmbeddings = process.argv.includes("--embeddings");

// Raíces que son rubros (a quién se le vende) y no familias de producto.
const RUBROS = new Set([3072, 3073, 3074, 3075]);

const ENTIDADES = { "&amp;": "&", "&#215;": "×", "&#8211;": "–", "&#8212;": "—", "&quot;": '"', "&#039;": "'", "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&#8243;": "″", "&#8242;": "′" };
function decodificar(s) {
  return String(s ?? "")
    .replace(/&[#a-z0-9]+;/gi, (e) => ENTIDADES[e] ?? (e.startsWith("&#") ? String.fromCharCode(Number(e.slice(2, -1))) : e))
    .trim();
}

/**
 * Las fichas del sitio son una tabla de dos filas: encabezados y valores. Se
 * convierten a "Largo (cm): 18,8 · Ancho (cm): 12,0", que es como se leen en
 * un WhatsApp y lo que el modelo necesita para responder "¿cuánto mide?".
 */
function fichaDeTabla(html) {
  const filas = [...String(html ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => decodificar(c[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()),
  );
  if (filas.length < 2) return null;
  const [cab, ...resto] = filas;
  const pares = [];
  for (const valores of resto) {
    cab.forEach((h, i) => {
      const v = valores[i];
      if (h && v) pares.push(`${h.charAt(0).toUpperCase()}${h.slice(1).toLowerCase()}: ${v}`);
    });
  }
  return pares.length ? pares.join(" · ") : null;
}

function textoPlano(html) {
  const ficha = fichaDeTabla(html);
  if (ficha) return ficha.slice(0, 1500);
  return decodificar(
    String(html ?? "")
      .replace(/<\/(td|th)>/gi, " | ")
      .replace(/<\/(tr|p|li|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/(\s*\|\s*)+\n/g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
    .slice(0, 1500);
}

async function traerTodo(ruta) {
  const todo = [];
  for (let pagina = 1; ; pagina++) {
    const r = await fetch(`${API}/${ruta}${ruta.includes("?") ? "&" : "?"}per_page=100&page=${pagina}`, { headers: UA });
    if (!r.ok) throw new Error(`${ruta} página ${pagina}: HTTP ${r.status}`);
    const lote = await r.json();
    todo.push(...lote);
    const total = Number(r.headers.get("x-wp-totalpages") || 1);
    if (pagina >= total || lote.length === 0) break;
  }
  return todo;
}

/** Pseudoaleatorio estable a partir de un entero: el mismo producto, el mismo precio. */
function azar(semilla) {
  let x = (semilla * 2654435761) % 4294967296;
  x ^= x >>> 13;
  x = (x * 1274126177) % 4294967296;
  return (x >>> 0) / 4294967296;
}

// Rangos de precio por familia (CLP, por unidad de venta). Inventados, pero con
// órdenes de magnitud plausibles para que la demo no muestre una resma a $90.
const RANGOS = {
  "ARTICULOS DE ASEO Y MANIPULACION": [1990, 18990],
  "SERVILLETAS HIGIENICOS Y TOALLAS": [3990, 29990],
  "BOLSAS PLASTICAS": [2490, 16990],
  "SACOS Y BOLSAS DE PAPEL": [3490, 24990],
  "RESMAS, ROLLOS Y CORTES PAPEL": [4990, 34990],
  "FILM ALIMENTOS": [5990, 32990],
  EMBALAJE: [1990, 12990],
  ALUMINIOS: [4990, 39990],
};
function precioFicticio(wooId, familia) {
  const [min, max] = RANGOS[familia] ?? [2990, 29990];
  const bruto = min + azar(wooId) * (max - min);
  return Math.max(990, Math.round(bruto / 1000) * 1000 - 10); // termina en 990
}
function stockFicticio(wooId, enStock) {
  if (!enStock) return 0;
  const r = azar(wooId + 7);
  if (r < 0.06) return 0; // algunos agotados, como en cualquier bodega
  return Math.round(8 + azar(wooId + 13) * 480);
}

async function subirImagen(wooId, src) {
  const r = await fetch(src, { headers: UA });
  if (!r.ok) throw new Error(`imagen HTTP ${r.status}`);
  const tipo = r.headers.get("content-type") || "image/jpeg";
  const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
  const bytes = Buffer.from(await r.arrayBuffer());
  const blob = await put(`vanni/productos/${wooId}.${ext}`, bytes, {
    access: "public",
    contentType: tipo,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

async function embeddings() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY vacía en .env.local");
  const filas = await sql`select id, nombre, categoria, descripcion from vanni_productos where embedding is null order by id`;
  console.log(`${filas.length} productos sin vector`);
  for (let i = 0; i < filas.length; i += 100) {
    const lote = filas.slice(i, i + 100);
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: lote.map((p) => `${p.nombre}. Categoría: ${p.categoria ?? ""}. ${(p.descripcion ?? "").slice(0, 600)}`),
      }),
    });
    if (!r.ok) throw new Error(`embeddings HTTP ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const [k, d] of j.data.entries()) {
      await sql`update vanni_productos set embedding = ${`[${d.embedding.join(",")}]`}::vector where id = ${lote[k].id}`;
    }
    console.log(`  vectores ${Math.min(i + 100, filas.length)}/${filas.length}`);
  }
}

async function main() {
  if (soloEmbeddings) return embeddings();

  console.log("Categorías…");
  const cats = await traerTodo("products/categories");
  const porId = new Map(cats.map((c) => [c.id, c]));
  for (const c of cats) {
    await sql`
      insert into vanni_categorias (id, nombre, slug, parent_id, conteo)
      values (${c.id}, ${decodificar(c.name)}, ${c.slug}, ${c.parent || null}, ${c.count})
      on conflict (id) do update set nombre = excluded.nombre, slug = excluded.slug,
        parent_id = excluded.parent_id, conteo = excluded.conteo`;
  }
  console.log(`  ${cats.length} categorías`);

  const raiz = (id) => {
    let c = porId.get(id);
    for (let i = 0; c && c.parent && i < 6; i++) c = porId.get(c.parent) ?? c;
    return c;
  };
  const familiaDe = (p) => {
    // La familia es la raíz que no es rubro. Si el producto solo cuelga de
    // rubros, se usa su subcategoría más específica.
    for (const c of p.categories) {
      const r = raiz(c.id);
      if (r && !RUBROS.has(r.id)) return decodificar(r.name);
    }
    return p.categories[0] ? decodificar(p.categories[0].name) : null;
  };

  console.log("Productos…");
  const productos = await traerTodo("products");
  console.log(`  ${productos.length} productos`);

  let hechos = 0;
  let sinImagen = 0;
  const cola = [...productos];
  async function trabajador() {
    for (let p = cola.shift(); p; p = cola.shift()) {
      const familia = familiaDe(p);
      const origen = p.images?.[0]?.src ?? null;
      let imagen = null;
      if (origen && conImagenes) {
        try {
          imagen = await subirImagen(p.id, origen);
        } catch (err) {
          sinImagen++;
          console.warn(`  imagen de ${p.id} falló: ${err.message}`);
        }
      }
      const ids = p.categories.map((c) => c.id);
      await sql`
        insert into vanni_productos
          (woo_id, sku, nombre, slug, descripcion, categoria, categoria_ids, imagen_url, imagen_origen,
           permalink, precio, precio_ficticio, stock, activo)
        values
          (${p.id}, ${p.sku || null}, ${decodificar(p.name)}, ${p.slug}, ${textoPlano(p.description)},
           ${familia}, ${JSON.stringify(ids)}::jsonb, ${imagen ?? origen}, ${origen}, ${p.permalink},
           ${precioFicticio(p.id, familia)}, true, ${stockFicticio(p.id, p.is_in_stock)}, true)
        on conflict (woo_id) do update set
          sku = excluded.sku, nombre = excluded.nombre, slug = excluded.slug,
          descripcion = excluded.descripcion, categoria = excluded.categoria,
          categoria_ids = excluded.categoria_ids,
          imagen_url = coalesce(${imagen}, vanni_productos.imagen_url, excluded.imagen_url),
          imagen_origen = excluded.imagen_origen, permalink = excluded.permalink,
          updated_at = now()`;
      hechos++;
      if (hechos % 50 === 0) console.log(`  ${hechos}/${productos.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, trabajador));

  const [t] = await sql`select count(*)::int n, count(*) filter (where imagen_url like '%blob.vercel-storage%')::int en_blob from vanni_productos`;
  console.log(`Listo: ${t.n} productos en la base, ${t.en_blob} con imagen en Blob, ${sinImagen} imágenes fallidas.`);
  if (process.env.OPENAI_API_KEY) {
    await embeddings();
  } else {
    console.log("OPENAI_API_KEY vacía: los vectores quedan pendientes (correr con --embeddings después).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
