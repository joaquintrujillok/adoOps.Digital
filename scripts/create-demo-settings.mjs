// Crea la tabla demo_settings y la inicializa en 'terreno'.
// Idempotente. Uso: node scripts/create-demo-settings.mjs
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
  CREATE TABLE IF NOT EXISTS demo_settings (
    id SERIAL PRIMARY KEY,
    active_demo VARCHAR(20) NOT NULL DEFAULT 'terreno',
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;

const [existing] = await sql`SELECT id FROM demo_settings LIMIT 1`;
if (!existing) {
  await sql`INSERT INTO demo_settings (active_demo) VALUES ('terreno')`;
  console.log("✓ Tabla demo_settings creada e inicializada en 'terreno'.");
} else {
  console.log("✓ Tabla demo_settings ya existe, sin cambios.");
}
