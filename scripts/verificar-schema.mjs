// Compara lo que declara db/ contra lo que existe de verdad en la base.
//
//   node scripts/verificar-schema.mjs
//
// Sale con código 1 si hay diferencias. Es la red de seguridad que faltaba:
// `drizzle-kit push` sincroniza la base al esquema, así que TODA tabla o columna
// que exista y no esté declarada es una que push propondría borrar. Correr esto
// antes de migrar convierte una sorpresa en producción en una alerta en la
// terminal.
//
// Lee los archivos .ts como texto en vez de importarlos: así corre en cualquier
// Node sin runtime de TypeScript, que es justo lo que falla en un Mac con Node 20.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

/** Lee .env.local sin dependencias: @next/env es CommonJS y no importa limpio. */
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

// ─── Lo declarado ────────────────────────────────────────────────────────────

const DB_DIR = "db";

/** Solo cuentan los archivos que schema.ts reexporta: es lo que drizzle-kit ve. */
function archivosVisibles() {
  const schema = readFileSync(join(DB_DIR, "schema.ts"), "utf8");
  const reexportados = [...schema.matchAll(/export \* from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1]);
  const todos = readdirSync(DB_DIR).filter((f) => f.endsWith(".ts") && f !== "index.ts");
  const sinReexportar = todos
    .map((f) => f.replace(/\.ts$/, ""))
    .filter((b) => b !== "schema" && !reexportados.includes(b));
  return { archivos: ["schema", ...reexportados].map((b) => join(DB_DIR, `${b}.ts`)), sinReexportar };
}

/** Extrae tabla → columnas de cada bloque pgTable("x", { ... }). */
function declaradas(archivos) {
  const out = new Map();
  for (const f of archivos) {
    const s = readFileSync(f, "utf8");
    const re = /pgTable\(\s*"([a-z_0-9]+)"\s*,\s*\{/g;
    let m;
    while ((m = re.exec(s))) {
      const tabla = m[1];
      // Recorre desde la llave de apertura hasta su cierre, contando niveles.
      let i = re.lastIndex - 1, nivel = 0, fin = i;
      for (; i < s.length; i++) {
        if (s[i] === "{") nivel++;
        else if (s[i] === "}") { nivel--; if (nivel === 0) { fin = i; break; } }
      }
      const cuerpo = s.slice(re.lastIndex, fin);
      // varchar("nombre", …), integer("nombre"), timestamp("nombre") …
      const cols = [...cuerpo.matchAll(/\b[a-zA-Z]+\(\s*"([a-z_0-9]+)"/g)].map((c) => c[1]);
      out.set(tabla, new Set(cols));
    }
  }
  return out;
}

// ─── Lo que existe ───────────────────────────────────────────────────────────

const sql = neon(process.env.DATABASE_URL);
const filas = await sql`
  SELECT table_name AS tabla, column_name AS columna
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`;

const base = new Map();
for (const { tabla, columna } of filas) {
  if (!base.has(tabla)) base.set(tabla, new Set());
  base.get(tabla).add(columna);
}

// ─── Comparación ─────────────────────────────────────────────────────────────

const { archivos, sinReexportar } = archivosVisibles();
const decl = declaradas(archivos);

console.log(`Declaradas: ${decl.size} tablas · en la base: ${base.size} tablas\n`);

let problema = false;

if (sinReexportar.length) {
  problema = true;
  console.log(`⚠️  ${sinReexportar.length} archivos de db/ NO se reexportan desde schema.ts.`);
  console.log(`   drizzle-kit no los ve, así que sus tablas quedan expuestas a borrado:`);
  for (const b of sinReexportar) console.log(`     - db/${b}.ts`);
  console.log();
}

const tablasSinDeclarar = [...base.keys()].filter((t) => !decl.has(t) && t !== "__drizzle_migrations");
if (tablasSinDeclarar.length) {
  problema = true;
  console.log(`⚠️  ${tablasSinDeclarar.length} tablas EXISTEN pero no están declaradas — push las BORRARÍA:`);
  for (const t of tablasSinDeclarar) console.log(`     - ${t}  (${base.get(t).size} columnas)`);
  console.log();
}

const columnasSinDeclarar = [];
for (const [t, cols] of base) {
  const d = decl.get(t);
  if (!d) continue;
  for (const c of cols) if (!d.has(c)) columnasSinDeclarar.push(`${t}.${c}`);
}
if (columnasSinDeclarar.length) {
  problema = true;
  console.log(`⚠️  ${columnasSinDeclarar.length} columnas EXISTEN pero no están declaradas — push las BORRARÍA:`);
  for (const c of columnasSinDeclarar) console.log(`     - ${c}`);
  console.log();
}

const fantasma = [...decl.keys()].filter((t) => !base.has(t));
if (fantasma.length) {
  console.log(`ℹ️  ${fantasma.length} tablas declaradas que aún no existen en la base`);
  console.log(`   (normal si son nuevas y falta migrar):`);
  for (const t of fantasma) console.log(`     - ${t}`);
  console.log();
}

if (!problema) console.log("✓ El esquema declara todo lo que existe. Es seguro migrar.");
process.exit(problema ? 1 : 0);
