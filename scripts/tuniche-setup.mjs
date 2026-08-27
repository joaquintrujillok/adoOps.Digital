// Crea, de forma idempotente, las tablas del Sistema Tuniche.
//
// Aditivo: no toca ninguna otra tabla. El sitio de adoOps se despliega entero
// sin estas —`lib/tuniche/usuarios.ts` responde `disponible() === false`—, así
// que correr esto es lo que enciende el módulo en un entorno.
//
// **No siembra ningún usuario.** El primer administrador se crea aparte, con
// `scripts/tuniche-usuario.mjs`, y a propósito: una cuenta sembrada con clave
// conocida es una puerta abierta que nadie recuerda haber dejado. Ese error ya
// se paga caro en un sistema con datos de agricultores reales adentro.
//
// Uso: node scripts/tuniche-setup.mjs

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
  CREATE TABLE IF NOT EXISTS tuniche_usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(254),
    telefono VARCHAR(20),
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'zonal',
    area VARCHAR(20),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    debe_cambiar_clave BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_ingreso TIMESTAMP,
    creado_por INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;

await sql`CREATE UNIQUE INDEX IF NOT EXISTS tuniche_usuarios_username_idx ON tuniche_usuarios (username)`;
// Único porque el teléfono es la identidad en WhatsApp: dos personas con el
// mismo número harían que un audio entre a nombre de cualquiera de las dos.
// En Postgres los NULL no chocan entre sí, así que varias cuentas sin teléfono
// conviven sin problema — que es justo lo que hace falta mientras se cargan.
await sql`CREATE UNIQUE INDEX IF NOT EXISTS tuniche_usuarios_telefono_idx ON tuniche_usuarios (telefono)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_usuarios_area_idx ON tuniche_usuarios (area)`;

await sql`
  CREATE TABLE IF NOT EXISTS tuniche_agricultores (
    id SERIAL PRIMARY KEY,
    area VARCHAR(20) NOT NULL,
    razon_social VARCHAR(200) NOT NULL,
    nombre_contacto VARCHAR(160),
    telefono VARCHAR(20),
    email VARCHAR(254),
    localidad VARCHAR(120),
    region VARCHAR(120),
    distribuidor VARCHAR(200),
    zonal_id INTEGER,
    zonal_nombre VARCHAR(120),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_agricultores_area_idx ON tuniche_agricultores (area)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_agricultores_zonal_idx ON tuniche_agricultores (zonal_id)`;

await sql`
  CREATE TABLE IF NOT EXISTS tuniche_lotes (
    id SERIAL PRIMARY KEY,
    agricultor_id INTEGER NOT NULL,
    area VARCHAR(20) NOT NULL,
    codigo VARCHAR(60) NOT NULL,
    temporada VARCHAR(20),
    cultivo VARCHAR(80),
    variedad VARCHAR(80),
    relacion_hm VARCHAR(20),
    hectareas NUMERIC(8,2),
    objetivo VARCHAR(60),
    cliente_final VARCHAR(200),
    idase VARCHAR(40),
    tipo_semilla VARCHAR(60),
    etapa_actual VARCHAR(40),
    hitos JSONB DEFAULT '{}'::jsonb,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_lotes_agricultor_idx ON tuniche_lotes (agricultor_id)`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS tuniche_lotes_codigo_idx ON tuniche_lotes (codigo)`;

await sql`
  CREATE TABLE IF NOT EXISTS tuniche_visitas (
    id SERIAL PRIMARY KEY,
    lote_id INTEGER,
    agricultor_id INTEGER,
    area VARCHAR(20) NOT NULL,
    usuario_id INTEGER NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT now(),
    origen VARCHAR(20) NOT NULL DEFAULT 'audio',
    wa_message_id VARCHAR(120),
    audio_url TEXT,
    transcripcion TEXT,
    etapa VARCHAR(40),
    datos JSONB DEFAULT '{}'::jsonb,
    nota_agronomica INTEGER,
    resumen TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    validada_en TIMESTAMP,
    enviada_al_agricultor_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_visitas_lote_idx ON tuniche_visitas (lote_id)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_visitas_usuario_idx ON tuniche_visitas (usuario_id)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_visitas_fecha_idx ON tuniche_visitas (fecha)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_visitas_estado_idx ON tuniche_visitas (estado)`;

await sql`
  CREATE TABLE IF NOT EXISTS tuniche_fotos (
    id SERIAL PRIMARY KEY,
    visita_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'general',
    wa_message_id VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_fotos_visita_idx ON tuniche_fotos (visita_id)`;

// El visto bueno de jefatura para que una visita salga al agricultor. Es una
// compuerta distinta de la validación del zonal: ver db/tuniche.ts.
await sql`ALTER TABLE tuniche_visitas ADD COLUMN IF NOT EXISTS aprobada_por INTEGER`;
await sql`ALTER TABLE tuniche_visitas ADD COLUMN IF NOT EXISTS aprobada_en TIMESTAMP`;

// El área que un admin simula cuando manda un audio. Un admin no tiene área
// —cruza las dos— y un audio sin área no tiene plantilla. Ver lib/tuniche/session.ts.
await sql`ALTER TABLE tuniche_usuarios ADD COLUMN IF NOT EXISTS area_audio VARCHAR(20)`;

await sql`
  CREATE TABLE IF NOT EXISTS tuniche_informes (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    area VARCHAR(20) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    visita_id INTEGER,
    lote_id INTEGER,
    agricultor_id INTEGER,
    cliente VARCHAR(200),
    periodo_desde TIMESTAMP,
    periodo_hasta TIMESTAMP,
    contenido JSONB NOT NULL,
    generado_por INTEGER NOT NULL,
    generado_en TIMESTAMP NOT NULL DEFAULT now(),
    aprobado_por INTEGER,
    aprobado_en TIMESTAMP,
    enviado_por INTEGER,
    enviado_en TIMESTAMP,
    enviado_a VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_informes_tipo_idx ON tuniche_informes (tipo)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_informes_estado_idx ON tuniche_informes (estado)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_informes_agricultor_idx ON tuniche_informes (agricultor_id)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_informes_lote_idx ON tuniche_informes (lote_id)`;
await sql`CREATE INDEX IF NOT EXISTS tuniche_informes_generado_idx ON tuniche_informes (generado_en)`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS tuniche_informes_visita_idx ON tuniche_informes (visita_id)`;

// El visto bueno se mudó de la visita al informe: se aprueba el documento que
// va a salir, habiéndolo visto, y no una tarjeta en una lista. Estas dos
// columnas duraron una hora y nunca tuvieron una fila; dejarlas ahí sería dejar
// una segunda verdad sobre lo mismo, que es como se pudren estos esquemas.
await sql`ALTER TABLE tuniche_visitas DROP COLUMN IF EXISTS aprobada_por`;
await sql`ALTER TABLE tuniche_visitas DROP COLUMN IF EXISTS aprobada_en`;

const [{ n }] = await sql`SELECT count(*)::int AS n FROM tuniche_usuarios`;

console.log("✓ tuniche_usuarios · tuniche_agricultores · tuniche_lotes · tuniche_visitas · tuniche_fotos");
if (n === 0) {
  console.log("");
  console.log("  No hay ninguna cuenta todavía. Crea el primer administrador:");
  console.log("");
  console.log('    node scripts/tuniche-usuario.mjs <usuario> <contraseña> admin "Nombre Apellido"');
  console.log("");
} else {
  console.log(`  ${n} ${n === 1 ? "cuenta existente" : "cuentas existentes"}, sin tocar.`);
}
