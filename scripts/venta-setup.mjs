// Crea, de forma idempotente, las cuatro tablas del CRM de adoOps.
//
// Aditivo: no toca ninguna otra tabla, y en particular **no toca `crm_*`**, que
// es el sistema de Highend montado como demo y no tiene nada que ver con esto.
// El tablero se despliega sin estas —`lib/venta/consultas.ts` responde
// `disponible() === false` y el menú ni pinta la entrada—, así que correr esto es
// lo que enciende el módulo.
//
// No siembra nada. Un pipeline sembrado es un pronóstico falso, y un pronóstico
// falso en la pantalla donde se mira el pipeline es peor que una pantalla vacía.
//
// Uso: node scripts/venta-setup.mjs

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
  CREATE TABLE IF NOT EXISTS venta_empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    rubro VARCHAR(120),
    sitio VARCHAR(200),
    tamano VARCHAR(40),
    ciudad VARCHAR(120),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS venta_empresas_nombre_idx ON venta_empresas (nombre)`;

await sql`
  CREATE TABLE IF NOT EXISTS venta_contactos (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER REFERENCES venta_empresas(id),
    nombre VARCHAR(200) NOT NULL,
    cargo VARCHAR(160),
    email VARCHAR(254),
    telefono VARCHAR(40),
    linkedin VARCHAR(300),
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS venta_contactos_empresa_idx ON venta_contactos (empresa_id)`;
await sql`CREATE INDEX IF NOT EXISTS venta_contactos_nombre_idx ON venta_contactos (nombre)`;

// `contacto_id` va NOT NULL: es la invariante del módulo. Una oportunidad sin
// nadie con quien hablar no es una oportunidad, es una idea, y las ideas inflan
// el pronóstico sin que nadie pueda hacer nada con ellas. Ver db/venta.ts.
await sql`
  CREATE TABLE IF NOT EXISTS venta_oportunidades (
    id SERIAL PRIMARY KEY,
    contacto_id INTEGER NOT NULL REFERENCES venta_contactos(id),
    empresa_id INTEGER REFERENCES venta_empresas(id),
    titulo VARCHAR(200) NOT NULL,
    etapa VARCHAR(20) NOT NULL DEFAULT 'nuevo',
    monto INTEGER NOT NULL DEFAULT 0,
    probabilidad SMALLINT NOT NULL DEFAULT 5,
    fuente VARCHAR(40),
    cierre_estimado DATE,
    abierto_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    cerrado_en TIMESTAMPTZ,
    motivo_perdida VARCHAR(300),
    ultima_actividad TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS venta_oportunidades_etapa_idx ON venta_oportunidades (etapa)`;
await sql`CREATE INDEX IF NOT EXISTS venta_oportunidades_contacto_idx ON venta_oportunidades (contacto_id)`;
await sql`CREATE INDEX IF NOT EXISTS venta_oportunidades_empresa_idx ON venta_oportunidades (empresa_id)`;

await sql`
  CREATE TABLE IF NOT EXISTS venta_actividades (
    id SERIAL PRIMARY KEY,
    oportunidad_id INTEGER REFERENCES venta_oportunidades(id) ON DELETE CASCADE,
    contacto_id INTEGER REFERENCES venta_contactos(id),
    tipo VARCHAR(20) NOT NULL DEFAULT 'nota',
    detalle TEXT NOT NULL,
    autor VARCHAR(160),
    ocurrio_en TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS venta_actividades_oportunidad_idx ON venta_actividades (oportunidad_id)`;
await sql`CREATE INDEX IF NOT EXISTS venta_actividades_fecha_idx ON venta_actividades (ocurrio_en)`;

const [{ n }] = await sql`SELECT count(*)::int AS n FROM venta_oportunidades`;
console.log("Tablas venta_* listas.");
console.log(`Oportunidades: ${n}`);
console.log("");
console.log("El módulo aparece en el menú de las cuentas adoOps y Demo.");
