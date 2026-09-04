// Inventario de la base, de solo lectura.
//
//   node scripts/inventario-db.mjs
//
// Escribe docs/db-inventario.md con todas las tablas que existen de verdad en
// Neon, sus columnas, índices y cuántas filas tienen. Sirve para comparar la
// realidad contra lo que declara db/schema.ts.
//
// No modifica nada: solo SELECT sobre los catálogos de Postgres.

import { neon } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

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
const sql = neon(process.env.DATABASE_URL);

const tablas = await sql`
  SELECT c.relname AS tabla,
         COALESCE(s.n_live_tup, 0) AS filas_aprox
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname
`;

const columnas = await sql`
  SELECT table_name AS tabla, column_name AS columna, data_type AS tipo,
         is_nullable AS nulo, column_default AS por_defecto,
         character_maximum_length AS largo
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`;

const indices = await sql`
  SELECT tablename AS tabla, indexname AS indice, indexdef AS definicion
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`;

const porTabla = (filas) =>
  filas.reduce((acc, f) => ((acc[f.tabla] ??= []).push(f), acc), {});
const cols = porTabla(columnas);
const idx = porTabla(indices);

// Conteo real (n_live_tup es una estimación del recolector de estadísticas).
const conteos = {};
for (const t of tablas) {
  try {
    const [{ n }] = await sql(`SELECT count(*)::int AS n FROM "${t.tabla}"`);
    conteos[t.tabla] = n;
  } catch {
    conteos[t.tabla] = "?";
  }
}

let md = `# Inventario de la base\n\nGenerado por \`scripts/inventario-db.mjs\` el ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC.\n\n`;
md += `${tablas.length} tablas en el esquema \`public\`.\n\n## Resumen\n\n| Tabla | Filas | Columnas |\n|---|---:|---:|\n`;
for (const t of tablas) {
  md += `| \`${t.tabla}\` | ${conteos[t.tabla]} | ${(cols[t.tabla] || []).length} |\n`;
}

md += `\n## Detalle\n`;
for (const t of tablas) {
  md += `\n### \`${t.tabla}\` — ${conteos[t.tabla]} filas\n\n| Columna | Tipo | Nulo | Default |\n|---|---|---|---|\n`;
  for (const c of cols[t.tabla] || []) {
    const tipo = c.largo ? `${c.tipo}(${c.largo})` : c.tipo;
    md += `| \`${c.columna}\` | ${tipo} | ${c.nulo === "YES" ? "sí" : "no"} | ${c.por_defecto ? `\`${String(c.por_defecto).slice(0, 40)}\`` : "—"} |\n`;
  }
  const is = (idx[t.tabla] || []).filter((i) => !i.indice.endsWith("_pkey"));
  if (is.length) {
    md += `\nÍndices:\n`;
    for (const i of is) md += `- \`${i.indice}\`: ${i.definicion.replace(/^CREATE /, "")}\n`;
  }
}

mkdirSync("docs", { recursive: true });
writeFileSync("docs/db-inventario.md", md);
console.log(`Escrito docs/db-inventario.md — ${tablas.length} tablas`);
