// Crea, de forma idempotente, las dos tablas de Pulso IA.
//
// Aditivo: solo CREATE IF NOT EXISTS y ADD COLUMN IF NOT EXISTS. No siembra nada: la primera fila llega
// desde una sala real. Para probar, crea una sesión desde /dashboard360/pulso y bórrala
// después desde ahí mismo.
//
// Uso: node scripts/pulso-setup.mjs

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
  CREATE TABLE IF NOT EXISTS pulso_sesiones (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(12) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    organizacion VARCHAR(200) NOT NULL,
    empresa_id INTEGER,
    relator VARCHAR(120) NOT NULL DEFAULT 'Nelson García',
    fase VARCHAR(12) NOT NULL DEFAULT 'inicio',
    fecha TIMESTAMP NOT NULL DEFAULT now(),
    senal_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS pulso_sesiones_codigo_idx ON pulso_sesiones (codigo)`;

await sql`
  CREATE TABLE IF NOT EXISTS pulso_respuestas (
    id SERIAL PRIMARY KEY,
    sesion_id INTEGER NOT NULL,
    token VARCHAR(40) NOT NULL,
    uso SMALLINT NOT NULL,
    tarea TEXT,
    freno VARCHAR(30) NOT NULL,
    expectativa SMALLINT NOT NULL,
    rol VARCHAR(30) NOT NULL,
    cuadrante VARCHAR(20) NOT NULL,
    expectativa_cierre SMALLINT,
    freno_cierre VARCHAR(30),
    cierre_en TIMESTAMP,
    nombre VARCHAR(160),
    cargo VARCHAR(200),
    email VARCHAR(254),
    telefono VARCHAR(20),
    consiente BOOLEAN NOT NULL DEFAULT false,
    contacto_en TIMESTAMP,
    lead_persona_id INTEGER,
    resultado_enviado_en TIMESTAMP,
    extra JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS pulso_respuestas_token_idx ON pulso_respuestas (sesion_id, token)`;
await sql`CREATE INDEX IF NOT EXISTS pulso_respuestas_sesion_idx ON pulso_respuestas (sesion_id)`;

// La pausa del QR llegó después de las tablas. Para una base que ya las tenía,
// este es el único paso que hace algo.
await sql`ALTER TABLE pulso_sesiones ADD COLUMN IF NOT EXISTS pausada BOOLEAN NOT NULL DEFAULT false`;

console.log("pulso_sesiones y pulso_respuestas listas.");
