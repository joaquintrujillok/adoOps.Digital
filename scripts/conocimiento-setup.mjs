// Crea la tabla de la base de conocimiento del copiloto.
//
// Aditivo e idempotente. Habilita `pgvector`, que Neon trae disponible pero no
// instalado: la búsqueda por similitud la hace Postgres, así que no hace falta
// ningún servicio nuevo ni cargar los vectores a memoria en cada consulta.
//
// Uso: node scripts/conocimiento-setup.mjs

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

await sql`CREATE EXTENSION IF NOT EXISTS vector`;

// 1536 dimensiones son las de `text-embedding-3-small`. El número está fijo en
// el DDL a propósito: cambiar de modelo de embeddings obliga a recrear la
// columna, porque los vectores de dos modelos distintos no se comparan entre sí
// y mezclarlos daría resultados que se ven plausibles y son ruido.
await sql`
  CREATE TABLE IF NOT EXISTS conocimiento_trozos (
    id SERIAL PRIMARY KEY,
    cuenta VARCHAR(40) NOT NULL,
    origen VARCHAR(200) NOT NULL,
    ruta TEXT NOT NULL,
    titulo TEXT NOT NULL,
    texto TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    siempre SMALLINT NOT NULL DEFAULT 0,
    vector vector(1536),
    tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS conocimiento_trozos_cuenta_idx ON conocimiento_trozos (cuenta)`;
await sql`CREATE INDEX IF NOT EXISTS conocimiento_trozos_siempre_idx ON conocimiento_trozos (siempre)`;

// Sin índice vectorial y es deliberado: con ~250 trozos por cuenta el recorrido
// completo tarda milisegundos, y un índice HNSW sobre tan pocas filas devuelve
// resultados aproximados sin ganar nada. Cuando sean decenas de miles, entra:
//   CREATE INDEX ON conocimiento_trozos USING hnsw (vector vector_cosine_ops);

const [{ n }] = await sql`SELECT count(*)::int AS n FROM conocimiento_trozos`;
const [{ v }] = await sql`SELECT extversion AS v FROM pg_extension WHERE extname = 'vector'`;
console.log(`Tabla conocimiento_trozos lista. pgvector ${v}.`);
console.log(`Trozos cargados: ${n}`);
console.log("");
console.log("La carga se hace desde Dashboard360 → Reuniones → Base de conocimiento.");
