// Crea, de forma idempotente, las dos tablas del módulo de reuniones.
//
// Aditivo: no toca ninguna otra tabla. El tablero se despliega sin estas —
// `lib/dashboard360/reuniones.ts` responde `disponible() === false` y el menú
// ni siquiera pinta la entrada—, así que correr esto es lo que enciende el
// módulo en un entorno.
//
// No siembra nada. Una reunión sembrada sería una conversación inventada
// atribuida a personas con nombre y apellido, mezclada con las de verdad en la
// única base que existe. La primera fila de esta tabla tiene que llegar por el
// webhook.
//
// Uso: node scripts/reuniones-setup.mjs

import { randomBytes } from "node:crypto";
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
  CREATE TABLE IF NOT EXISTS reunion_registros (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(200) NOT NULL UNIQUE,
    plataforma VARCHAR(40),
    titulo VARCHAR(300),
    ambito VARCHAR(40),
    capturada_por VARCHAR(160),
    inicio_en TIMESTAMPTZ,
    fin_en TIMESTAMPTZ,
    duracion_min INTEGER,
    participantes JSONB,
    transcripcion TEXT NOT NULL,
    bloques JSONB,
    transcripcion_corregida TEXT,
    tramos_sin_corregir SMALLINT,
    chat JSONB,
    crudo JSONB,
    estado VARCHAR(20) NOT NULL DEFAULT 'recibida',
    error TEXT,
    resumen TEXT,
    extraccion JSONB,
    intentos SMALLINT NOT NULL DEFAULT 0,
    modelo VARCHAR(80),
    tokens_entrada INTEGER,
    tokens_entrada_cache INTEGER,
    tokens_salida INTEGER,
    costo_usd NUMERIC(12,6),
    costo_aproximado SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resumida_en TIMESTAMPTZ
  )
`;
await sql`CREATE INDEX IF NOT EXISTS reunion_registros_inicio_idx ON reunion_registros (inicio_en)`;
await sql`CREATE INDEX IF NOT EXISTS reunion_registros_estado_idx ON reunion_registros (estado)`;

// Columnas que se agregaron después de la primera versión. Van como ALTER y no
// solo dentro del CREATE de arriba porque en el entorno donde esto ya corrió la
// tabla existe y tiene reuniones adentro: recrearla las borraría. `IF NOT
// EXISTS` las hace inofensivas en una instalación nueva, donde el CREATE ya las
// puso.
//
// Y van ANTES del índice sobre `ambito`, no después: en una base que ya tenía la
// tabla vieja, indexar una columna que todavía no existe falla y deja el setup a
// medias. Se descubrió corriéndolo.
await sql`ALTER TABLE reunion_registros ADD COLUMN IF NOT EXISTS ambito VARCHAR(40)`;
await sql`ALTER TABLE reunion_registros ADD COLUMN IF NOT EXISTS capturada_por VARCHAR(160)`;
await sql`ALTER TABLE reunion_registros ADD COLUMN IF NOT EXISTS transcripcion_corregida TEXT`;
await sql`ALTER TABLE reunion_registros ADD COLUMN IF NOT EXISTS tramos_sin_corregir SMALLINT`;

await sql`CREATE INDEX IF NOT EXISTS reunion_registros_ambito_idx ON reunion_registros (ambito)`;

await sql`
  CREATE TABLE IF NOT EXISTS reunion_compromisos (
    id SERIAL PRIMARY KEY,
    reunion_id INTEGER NOT NULL REFERENCES reunion_registros(id) ON DELETE CASCADE,
    compromiso TEXT NOT NULL,
    responsable VARCHAR(160),
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    plazo VARCHAR(120),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS reunion_compromisos_reunion_idx ON reunion_compromisos (reunion_id)`;

const [{ n }] = await sql`SELECT count(*)::int AS n FROM reunion_registros`;

console.log("Tablas reunion_* listas.");
console.log(`Reuniones guardadas: ${n}`);

if (n === 0) {
  // Se ofrece un token porque el módulo no arranca sin uno y porque un token
  // elegido a mano termina siendo la palabra que se le ocurrió a alguien un
  // martes. Solo se imprime: escribirlo en un archivo sería dejarlo en el disco
  // de una máquina y en el historial de una terminal.
  console.log("");
  console.log("Falta configurar el token del webhook. Uno servible:");
  console.log("");
  console.log(`  REUNIONES_WEBHOOK_TOKEN=${randomBytes(32).toString("base64url")}`);
  console.log("");
  console.log("Va en .env.local y en las variables de Vercel. Después, docs/reuniones.md.");
}
