// Crea, de forma idempotente, las tres tablas de la máquina de contenido.
//
// Aditivo: no toca ninguna otra tabla. El tablero se despliega sin estas —
// `lib/dashboard360/contenido.ts` responde `disponible() === false` y el menú
// ni siquiera pinta la entrada—, así que correr esto es lo que enciende el
// módulo en un entorno.
//
// **No siembra emisores.** Un emisor sin token no sirve para nada, y el token
// solo existe después de que una persona autorice la app: sembrar filas vacías
// llenaría la pantalla de avisos rojos que no son problemas reales, sino
// ruido que enseña a ignorar los avisos.
//
// Uso: node scripts/contenido-setup.mjs

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
  CREATE TABLE IF NOT EXISTS contenido_emisores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'persona',
    rol VARCHAR(60),
    autor_urn VARCHAR(120),
    token TEXT,
    scopes VARCHAR(200),
    token_vence_en TIMESTAMP,
    conectado_en TIMESTAMP,
    pausado SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS contenido_emisores_vence_idx ON contenido_emisores (token_vence_en)`;

await sql`
  CREATE TABLE IF NOT EXISTS contenido_piezas (
    id SERIAL PRIMARY KEY,
    emisor_id INTEGER REFERENCES contenido_emisores(id),
    slot SMALLINT,
    fecha_objetivo DATE,
    formato VARCHAR(20) NOT NULL DEFAULT 'texto',
    titulo VARCHAR(200) NOT NULL,
    cuerpo TEXT NOT NULL,
    medio_urn VARCHAR(120),
    medio_nombre VARCHAR(200),
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    segmento VARCHAR(120),
    servicio VARCHAR(120),
    aprobada_por VARCHAR(120),
    aprobada_en TIMESTAMP,
    impresiones INTEGER,
    interacciones INTEGER,
    metricas_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS contenido_piezas_estado_idx ON contenido_piezas (estado)`;
await sql`CREATE INDEX IF NOT EXISTS contenido_piezas_fecha_idx ON contenido_piezas (fecha_objetivo)`;

// Una fila por INTENTO, no por éxito: si una pieza no salió, la pregunta que se
// hace después es "¿por qué?", y la respuesta tiene que estar en una tabla y no
// en un log que ya rotó.
await sql`
  CREATE TABLE IF NOT EXISTS contenido_publicaciones (
    id SERIAL PRIMARY KEY,
    pieza_id INTEGER NOT NULL REFERENCES contenido_piezas(id),
    emisor_id INTEGER REFERENCES contenido_emisores(id),
    urn VARCHAR(120),
    http SMALLINT,
    error TEXT,
    visibilidad VARCHAR(20),
    simulado SMALLINT NOT NULL DEFAULT 0,
    publicada_en TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS contenido_publicaciones_pieza_idx ON contenido_publicaciones (pieza_id)`;

console.log("✓ contenido_emisores, contenido_piezas, contenido_publicaciones listas.");
