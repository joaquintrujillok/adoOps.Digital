// Pone slug de titular a las ediciones que todavía lo tienen con forma de fecha.
//
//   npx tsx scripts/cafecito-reslug.mts            muestra qué haría
//   npx tsx scripts/cafecito-reslug.mts --aplicar  lo hace
//
// ── Por qué un script y no SQL dentro de la migración ───────────────────────
//
// La migración `0002` agrega la columna `fecha` y ensancha `slug`, pero no puede
// calcular los slugs nuevos: la lógica vive en `lib/cafecito/slug.ts`, en
// TypeScript, y reescribirla en SQL sería tener dos implementaciones que se van
// a separar el día que una cambie. Se importa la de verdad.
//
// Es idempotente y de una sola pasada: solo toca las filas cuyo slug sigue
// siendo `YYYY-MM-DD`. Una vez convertida, una edición no se vuelve a tocar
// nunca —su URL ya salió por correo—, que es la misma regla que aplica la ruta
// de publicación.

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { ES_FECHA, slugificar } from "../lib/cafecito/slug";

const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) {
  console.error("Falta DATABASE_URL en .env.local");
  process.exit(1);
}

const sql = neon(url);
const aplicar = process.argv.includes("--aplicar");

const filas = (await sql`
  SELECT id, slug, fecha::text AS fecha, titulo FROM cafecito_ediciones ORDER BY fecha
`) as { id: number; slug: string; fecha: string; titulo: string }[];

const pendientes = filas.filter((f) => ES_FECHA.test(f.slug));

console.log(`${filas.length} ediciones · ${pendientes.length} con slug de fecha\n`);

if (!pendientes.length) {
  console.log("Nada que convertir: todas tienen slug de titular.");
  process.exit(0);
}

const tomados = new Set(filas.map((f) => f.slug));
const cambios: { id: number; de: string; a: string }[] = [];

for (const f of pendientes) {
  let nuevo = slugificar(f.titulo) || f.fecha;
  if (tomados.has(nuevo)) nuevo = `${nuevo}-${f.fecha}`;
  let n = 2;
  while (tomados.has(nuevo)) nuevo = `${slugificar(f.titulo)}-${f.fecha}-${n++}`;
  tomados.add(nuevo);
  cambios.push({ id: f.id, de: f.slug, a: nuevo });
  console.log(`  ${f.slug}\n    → ${nuevo}`);
}

console.log();

if (!aplicar) {
  console.log("Simulación. Para aplicarlo:");
  console.log("  npx tsx scripts/cafecito-reslug.mts --aplicar");
  process.exit(0);
}

for (const c of cambios) {
  await sql`UPDATE cafecito_ediciones SET slug = ${c.a} WHERE id = ${c.id}`;
}
console.log(`✓ ${cambios.length} slugs actualizados.`);
console.log("Las URLs viejas siguen respondiendo: /cafecito-ia/<fecha> redirige con 301.");
