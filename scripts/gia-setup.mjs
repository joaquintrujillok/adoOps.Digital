// Crea, de forma idempotente, las dos tablas del levantamiento de IA (/gia).
//
// Aditivo: solo CREATE IF NOT EXISTS. No siembra nada: la empresa demo vive en
// código (lib/gia/semilla.ts) y la primera fila llega de una entrevista en vivo.
//
// Por qué un script y no una migración de drizzle: el 29-10-2026 `db:generate`
// produjo una migración que, además de estas tablas, recreaba `pulso_*` (creadas
// también por script) y agregaba columnas `cuenta` a `venta_*` que ya existen.
// El snapshot de `drizzle/meta` está desfasado de la base, y esa migración
// habría fallado a la primera instrucción. Arreglar el snapshot es otro trabajo.
//
// Uso: node scripts/gia-setup.mjs

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
  CREATE TABLE IF NOT EXISTS gia_entrevistas (
    id SERIAL PRIMARY KEY,
    token VARCHAR(40) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    cargo VARCHAR(160) NOT NULL,
    gerencia VARCHAR(80) NOT NULL,
    estado VARCHAR(12) NOT NULL DEFAULT 'en_curso',
    analisis JSONB,
    error TEXT,
    modelo VARCHAR(60),
    confirmada_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS gia_entrevistas_token_idx ON gia_entrevistas (token)`;

await sql`
  CREATE TABLE IF NOT EXISTS gia_respuestas (
    id SERIAL PRIMARY KEY,
    entrevista_id INTEGER NOT NULL REFERENCES gia_entrevistas(id) ON DELETE CASCADE,
    tema VARCHAR(20) NOT NULL,
    ronda SMALLINT NOT NULL DEFAULT 0,
    pregunta TEXT NOT NULL,
    transcripcion TEXT NOT NULL,
    canal VARCHAR(6) NOT NULL DEFAULT 'voz',
    segundos INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS gia_respuestas_turno_idx ON gia_respuestas (entrevista_id, tema, ronda)`;
await sql`CREATE INDEX IF NOT EXISTS gia_respuestas_entrevista_idx ON gia_respuestas (entrevista_id)`;

console.log("gia_entrevistas y gia_respuestas listas.");
