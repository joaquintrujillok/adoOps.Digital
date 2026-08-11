// Migración al modelo con el CONTACTO como eje + cotizaciones de mostrador.
//
// Idempotente y aditiva: solo agrega columnas y tablas, y afloja restricciones
// NOT NULL que dejaron de tener sentido. No borra ni renombra nada.
//
// Por qué afloja `account_id`: el CRM pasó de un modelo B2B (todo cuelga de la
// empresa) a uno B2C (el cliente es una persona). Una boutique de alta gama le
// vende a alguien con nombre y teléfono; la empresa es la excepción, no la
// regla, y forzar una cuenta por cliente obligaba a inventar razones sociales.
//
// Uso: node scripts/crm-migrar-v2.mjs

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
  // ── El contacto pasa a ser el eje ──
  `ALTER TABLE crm_contacts ALTER COLUMN account_id DROP NOT NULL`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'prospecto'`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS fuente VARCHAR(60)`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS owner_id INTEGER`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS ciudad VARCHAR(80)`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS etiquetas JSONB`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS notas TEXT`,
  `ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS preferencias TEXT`,
  `CREATE INDEX IF NOT EXISTS crm_contacts_estado_idx ON crm_contacts (estado)`,
  `CREATE INDEX IF NOT EXISTS crm_contacts_owner_idx ON crm_contacts (owner_id)`,

  // ── Oportunidades y ventas cuelgan del contacto ──
  `ALTER TABLE crm_deals ALTER COLUMN account_id DROP NOT NULL`,
  `ALTER TABLE crm_orders ALTER COLUMN account_id DROP NOT NULL`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS contact_id INTEGER`,
  `ALTER TABLE crm_orders ADD COLUMN IF NOT EXISTS quote_id INTEGER`,
  `CREATE INDEX IF NOT EXISTS crm_orders_contact_idx ON crm_orders (contact_id)`,
  `ALTER TABLE crm_activities ALTER COLUMN account_id DROP NOT NULL`,
  `ALTER TABLE crm_touchpoints ALTER COLUMN account_id DROP NOT NULL`,

  // ── Catálogo de alta gama ──
  `ALTER TABLE crm_products ADD COLUMN IF NOT EXISTS marca VARCHAR(80)`,
  `ALTER TABLE crm_products ADD COLUMN IF NOT EXISTS permite_descuento BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE crm_products ADD COLUMN IF NOT EXISTS tope_descuento_bp INTEGER`,

  // ── Cotizaciones de mostrador ──
  `CREATE TABLE IF NOT EXISTS crm_quotes (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER,
    cotizante_nombre VARCHAR(120) NOT NULL,
    cotizante_telefono VARCHAR(20) NOT NULL,
    para_si_mismo BOOLEAN NOT NULL DEFAULT TRUE,
    destinatario_nombre VARCHAR(120),
    boutique VARCHAR(80),
    created_by_id INTEGER,
    subtotal INTEGER NOT NULL DEFAULT 0,
    descuento_global INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    conversation_id INTEGER,
    order_id INTEGER,
    deal_id INTEGER,
    enviada_en TIMESTAMP,
    convertida_en TIMESTAMP,
    editada_tras_envio BOOLEAN NOT NULL DEFAULT FALSE,
    editada_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_quotes_estado_idx ON crm_quotes (estado)`,
  `CREATE INDEX IF NOT EXISTS crm_quotes_contact_idx ON crm_quotes (contact_id)`,
  `CREATE INDEX IF NOT EXISTS crm_quotes_telefono_idx ON crm_quotes (cotizante_telefono)`,
  `CREATE INDEX IF NOT EXISTS crm_quotes_fecha_idx ON crm_quotes (created_at)`,

  `CREATE TABLE IF NOT EXISTS crm_quote_items (
    id SERIAL PRIMARY KEY,
    quote_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    producto_nombre VARCHAR(160) NOT NULL,
    sku VARCHAR(40),
    marca VARCHAR(80),
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario INTEGER NOT NULL DEFAULT 0,
    descuento INTEGER NOT NULL DEFAULT 0,
    tope_descuento_bp INTEGER,
    total INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS crm_quote_items_quote_idx ON crm_quote_items (quote_id)`,
];

for (const sentencia of SENTENCIAS) {
  await sql.query(sentencia);
}

const tablas = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'crm_%'
  ORDER BY table_name
`;

console.log(`✓ Migración aplicada · ${tablas.length} tablas del CRM`);
console.log("  nuevas: crm_quotes, crm_quote_items");
console.log("  el contacto es ahora el eje (account_id quedó opcional)");
