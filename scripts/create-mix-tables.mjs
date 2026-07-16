// Crea (de forma idempotente) la tabla del demo "TV Mix".
// Aditivo: no toca otras tablas. Uso: node scripts/create-mix-tables.mjs
// Nota: el API (/api/mix) también crea la tabla solo en el primer uso, así que
// este script es opcional; existe por consistencia con los demás demos.
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

await sql`
  CREATE TABLE IF NOT EXISTS mix_rooms (
    code VARCHAR(12) PRIMARY KEY,
    state JSONB NOT NULL,
    progress JSONB,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;

console.log("✔ Tabla mix_rooms lista");
