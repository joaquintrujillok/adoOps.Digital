// Crea (de forma idempotente) las tablas de la demo "Reportes de Terreno".
// Aditivo: no toca la tabla `leads`. Uso: node scripts/create-terreno-tables.mjs
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
  CREATE TABLE IF NOT EXISTS field_reports (
    id SERIAL PRIMARY KEY,
    sender_phone VARCHAR(40) NOT NULL,
    sender_name VARCHAR(160),
    source VARCHAR(10) NOT NULL DEFAULT 'audio',
    wa_message_id VARCHAR(128),
    audio_url TEXT,
    transcript TEXT,
    cliente VARCHAR(160),
    sector VARCHAR(120),
    cuarteles TEXT,
    responsable VARCHAR(160),
    equipo_personas INTEGER,
    avance_pct INTEGER,
    hectareas INTEGER,
    estado_tarea VARCHAR(20),
    extraction JSONB,
    executive_summary TEXT,
    incidencias JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    validated_at TIMESTAMP
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS work_sheets (
    id SERIAL PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES field_reports(id) ON DELETE CASCADE,
    tarea TEXT NOT NULL,
    responsable_sugerido VARCHAR(160),
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    plazo VARCHAR(120),
    recursos TEXT,
    evidencia_requerida TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;

const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('field_reports','work_sheets')
  ORDER BY table_name
`;
console.log("✓ Tablas listas:", tables.map((t) => t.table_name).join(", "));
