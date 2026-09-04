// Marca las migraciones existentes como YA APLICADAS, sin ejecutarlas.
//
//   node scripts/baseline-migraciones.mjs [--aplicar]
//
// ── Para qué ─────────────────────────────────────────────────────────────────
//
// Este proyecto llevaba su base con `drizzle-kit push`, que sincroniza contra el
// esquema sin dejar historial. Al pasar a migraciones versionadas, la primera
// que genera drizzle contiene un CREATE TABLE por cada tabla del esquema —
// incluidas las 70 que ya existen. Ejecutarla fallaría.
//
// La línea base resuelve eso: registra esa primera migración como aplicada para
// que `migrate` la salte, y desde ahí en adelante el historial es real.
//
// ── Cómo calcula el hash ─────────────────────────────────────────────────────
//
// El migrador de drizzle guarda, por migración, el sha256 del CONTENIDO COMPLETO
// del archivo .sql y el `when` de meta/_journal.json. Esto replica ese cálculo.
// Si drizzle cambiara la fórmula en una versión futura, `migrate` intentaría
// reaplicar la migración y fallaría con "ya existe" — ruidoso, no destructivo.
//
// Sin --aplicar solo muestra qué haría.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

function cargarEnv() {
  for (const f of [".env.local", ".env"]) {
    let s;
    try { s = readFileSync(f, "utf8"); } catch { continue; }
    for (const linea of s.split("\n")) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
cargarEnv();

const aplicar = process.argv.includes("--aplicar");
const OUT = "drizzle";

let journal;
try {
  journal = JSON.parse(readFileSync(join(OUT, "meta", "_journal.json"), "utf8"));
} catch {
  console.error(`No hay ${OUT}/meta/_journal.json. Corre primero: npm run db:generate`);
  process.exit(1);
}

if (!journal.entries?.length) {
  console.error("El journal está vacío: no hay migraciones que registrar.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`
  CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`;

const yaRegistradas = new Set(
  (await sql`SELECT hash FROM drizzle."__drizzle_migrations"`).map((r) => r.hash),
);

console.log(`${journal.entries.length} migraciones en el journal · ${yaRegistradas.size} ya registradas\n`);

let nuevas = 0;
for (const e of journal.entries) {
  const archivo = join(OUT, `${e.tag}.sql`);
  const contenido = readFileSync(archivo, "utf8");
  const hash = createHash("sha256").update(contenido).digest("hex");
  const tablas = (contenido.match(/CREATE TABLE/g) || []).length;

  if (yaRegistradas.has(hash)) {
    console.log(`  = ${e.tag} — ya registrada`);
    continue;
  }

  nuevas++;
  console.log(`  + ${e.tag} — ${tablas} CREATE TABLE · hash ${hash.slice(0, 12)}…`);
  if (aplicar) {
    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${e.when})
    `;
  }
}

console.log();
if (!nuevas) {
  console.log("Nada que registrar: la línea base ya está puesta.");
} else if (aplicar) {
  console.log(`✓ ${nuevas} migraciones registradas como aplicadas. Ninguna se ejecutó.`);
  console.log("  Desde ahora: npm run db:generate && npm run db:migrate");
} else {
  console.log(`Esto registraría ${nuevas} migraciones SIN ejecutarlas.`);
  console.log("Si el esquema ya refleja la base (npm run db:verificar en verde), corre:");
  console.log("  node scripts/baseline-migraciones.mjs --aplicar");
}
