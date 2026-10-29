// Borra las entrevistas en vivo del levantamiento (/gia) después de una demo.
//
// Son personas reales —quien se entrevistó durante la reunión— en un módulo
// `demo`, y por eso no se dejan ahí. Las respuestas caen con la entrevista
// (ON DELETE CASCADE). La empresa demo vive en código y no se toca.
//
// Uso:
//   node scripts/gia-limpiar.mjs            muestra qué borraría
//   node scripts/gia-limpiar.mjs --borrar   las borra

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL no encontrada");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());
const filas = await sql`SELECT id, nombre, cargo, estado, created_at FROM gia_entrevistas ORDER BY id`;

if (!filas.length) {
  console.log("No hay entrevistas en vivo.");
  process.exit(0);
}
for (const f of filas) console.log(`#${f.id} · ${f.nombre} · ${f.cargo} · ${f.estado} · ${new Date(f.created_at).toISOString().slice(0, 16)}`);

if (!process.argv.includes("--borrar")) {
  console.log(`\n${filas.length} entrevistas. Agrega --borrar para eliminarlas.`);
  process.exit(0);
}
await sql`DELETE FROM gia_entrevistas`;
console.log(`\n${filas.length} entrevistas borradas.`);
