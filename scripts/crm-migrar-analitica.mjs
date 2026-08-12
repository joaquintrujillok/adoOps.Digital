// Migración para la analítica de clientes: origen omnicanal, identidad,
// captura de showroom y señales de conversación.
//
// Idempotente y aditiva: solo agrega columnas y tablas. No borra ni renombra.
//
// Uso: node scripts/crm-migrar-analitica.mjs

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

const SENTENCIAS = [
  // ── Ventas con origen ──
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS origen VARCHAR(20) NOT NULL DEFAULT 'pos'`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS external_id VARCHAR(80)`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS documento VARCHAR(30)`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS numero_documento VARCHAR(40)`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS sucursal VARCHAR(80)`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS identificado BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS metodo_identificacion VARCHAR(20)`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS vendedor VARCHAR(120)`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS medio_pago VARCHAR(40)`,
  `CREATE INDEX IF NOT EXISTS crm_orders_origen_idx ON crm_orders (origen)`,
  // La clave única es (origen, external_id): el POS y el e-commerce numeran por
  // su cuenta y el documento 1041 existe en los dos. Es lo que hace que
  // reprocesar una sincronización no duplique ventas.
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_orders_external_idx ON crm_orders (origen, external_id)`,

  // ── Identidad del contacto ──
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS rut VARCHAR(20)`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS primera_compra_en TIMESTAMP`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS consentimiento BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS consentimiento_en TIMESTAMP`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS cumpleanos TIMESTAMP`,
  `CREATE INDEX IF NOT EXISTS crm_contacts_rut_idx ON crm_contacts (rut)`,
  `CREATE INDEX IF NOT EXISTS crm_contacts_email_idx ON crm_contacts (email)`,

  // ── Captura en showroom ──
  `CREATE TABLE IF NOT EXISTS crm_showroom_visitas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(254),
    interes VARCHAR(120),
    detalle TEXT,
    boutique VARCHAR(80),
    medio VARCHAR(30) NOT NULL DEFAULT 'qr',
    evento VARCHAR(120),
    consentimiento BOOLEAN NOT NULL DEFAULT FALSE,
    consentimiento_en TIMESTAMP,
    atendido_por INTEGER,
    contact_id INTEGER,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_showroom_estado_idx ON crm_showroom_visitas (estado)`,
  `CREATE INDEX IF NOT EXISTS crm_showroom_fecha_idx ON crm_showroom_visitas (created_at)`,
  `CREATE INDEX IF NOT EXISTS crm_showroom_telefono_idx ON crm_showroom_visitas (telefono)`,

  // ── Señales de conversación ──
  `CREATE TABLE IF NOT EXISTS crm_senales (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(200) NOT NULL,
    contact_id INTEGER NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    titulo VARCHAR(250) NOT NULL,
    evidencia TEXT,
    borrador TEXT,
    product_id INTEGER,
    owner_id INTEGER,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    vence_en TIMESTAMP,
    generada_en TIMESTAMP NOT NULL DEFAULT NOW(),
    resuelta_en TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_senales_clave_idx ON crm_senales (clave)`,
  `CREATE INDEX IF NOT EXISTS crm_senales_estado_idx ON crm_senales (estado)`,
  `CREATE INDEX IF NOT EXISTS crm_senales_contact_idx ON crm_senales (contact_id)`,
  `CREATE INDEX IF NOT EXISTS crm_senales_owner_idx ON crm_senales (owner_id)`,
];

for (const sentencia of SENTENCIAS) {
  await sql.query(sentencia);
}

console.log("✓ Migración de analítica aplicada");
console.log("  crm_orders: origen, external_id, identificado, sucursal, vendedor…");
console.log("  crm_contacts: rut, primera_compra_en, consentimiento, cumpleanos");
console.log("  nuevas: crm_showroom_visitas, crm_senales");
