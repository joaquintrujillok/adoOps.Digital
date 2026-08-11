// Categoría editable de la oportunidad, para la pantalla de Pipeline.
//
// Idempotente y aditiva: una columna y su índice. No borra ni renombra nada.
//
// Por qué una columna y no derivarla siempre de las piezas: la categoría de una
// oportunidad se deriva bien el 90% de las veces —la pieza más cara manda— pero
// el 10% restante es justo el que importa. Un cronómetro cotizado como regalo
// corporativo pesa en "Alta relojería" cuando el negocio en realidad es de
// empresa, y quien lo está vendiendo lo sabe y el sistema no.
//
// `categoria` en NULL significa "usa la de las piezas". Solo cuando alguien la
// corrige a mano queda escrita, y desde ahí manda. Así la corrección se nota:
// una columna llena de NULL dice que nadie tuvo que intervenir.
//
// Uso: node scripts/crm-migrar-pipeline.mjs

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

const SENTENCIAS = [
  `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS categoria VARCHAR(80)`,
  `CREATE INDEX IF NOT EXISTS crm_deals_categoria_idx ON crm_deals (categoria)`,
];

console.log("Migrando la categoría de las oportunidades…\n");

for (const sentencia of SENTENCIAS) {
  const resumen = sentencia.replace(/\s+/g, " ").slice(0, 78);
  try {
    await sql.query(sentencia);
    console.log(`  ✓ ${resumen}`);
  } catch (error) {
    console.error(`  ✗ ${resumen}\n    ${error.message}`);
    process.exitCode = 1;
  }
}

console.log("\nListo. Las oportunidades existentes quedan en NULL:");
console.log("heredan la categoría de la pieza más cara hasta que alguien la corrija.");
