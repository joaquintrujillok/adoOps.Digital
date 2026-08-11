// Crea (de forma idempotente) las tablas del CRM (/crm).
//
// Aditivo: solo CREATE TABLE/INDEX IF NOT EXISTS sobre nombres con prefijo
// `crm_`. No altera ni borra nada de lo que ya vive en la base — que también
// aloja la web corporativa (`leads`), TV Mix (`mix_rooms`) y las demos.
//
// Se usa esto en vez de `drizzle-kit push` porque el push, al ver tablas
// nuevas junto a tablas que no están en el schema, pregunta si se trata de un
// rename. Una respuesta equivocada ahí renombra una tabla con datos.
//
// Uso: node scripts/crm-create-tables.mjs

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
  `CREATE TABLE IF NOT EXISTS crm_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(254),
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'vendedor',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_ingreso TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_users_username_idx ON crm_users (username)`,

  `CREATE TABLE IF NOT EXISTS crm_accounts (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL,
    rut VARCHAR(20),
    industria VARCHAR(80),
    tamano VARCHAR(20),
    ciudad VARCHAR(80),
    sitio_web VARCHAR(200),
    estado VARCHAR(20) NOT NULL DEFAULT 'prospecto',
    fuente VARCHAR(60),
    owner_id INTEGER,
    notas TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_accounts_estado_idx ON crm_accounts (estado)`,
  `CREATE INDEX IF NOT EXISTS crm_accounts_owner_idx ON crm_accounts (owner_id)`,

  `CREATE TABLE IF NOT EXISTS crm_contacts (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    cargo VARCHAR(120),
    email VARCHAR(254),
    telefono VARCHAR(20),
    es_decisor BOOLEAN NOT NULL DEFAULT FALSE,
    opt_in_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_contacts_account_idx ON crm_contacts (account_id)`,
  `CREATE INDEX IF NOT EXISTS crm_contacts_telefono_idx ON crm_contacts (telefono)`,

  `CREATE TABLE IF NOT EXISTS crm_products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(40) NOT NULL,
    nombre VARCHAR(160) NOT NULL,
    categoria VARCHAR(80),
    precio INTEGER NOT NULL DEFAULT 0,
    costo INTEGER NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    descripcion TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_products_sku_idx ON crm_products (sku)`,

  `CREATE TABLE IF NOT EXISTS crm_inventory (
    product_id INTEGER PRIMARY KEY,
    stock INTEGER NOT NULL DEFAULT 0,
    reservado INTEGER NOT NULL DEFAULT 0,
    punto_reposicion INTEGER NOT NULL DEFAULT 0,
    lead_time_dias INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS crm_campaigns (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL,
    canal VARCHAR(30) NOT NULL,
    inicio TIMESTAMP NOT NULL,
    fin TIMESTAMP,
    costo INTEGER NOT NULL DEFAULT 0,
    objetivo TEXT,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS crm_touchpoints (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    campaign_id INTEGER,
    tipo VARCHAR(20) NOT NULL,
    detalle TEXT,
    ocurrido_en TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_touchpoints_account_idx ON crm_touchpoints (account_id)`,
  `CREATE INDEX IF NOT EXISTS crm_touchpoints_campaign_idx ON crm_touchpoints (campaign_id)`,
  `CREATE INDEX IF NOT EXISTS crm_touchpoints_fecha_idx ON crm_touchpoints (ocurrido_en)`,

  `CREATE TABLE IF NOT EXISTS crm_deals (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    contact_id INTEGER,
    titulo VARCHAR(200) NOT NULL,
    etapa VARCHAR(20) NOT NULL DEFAULT 'nuevo',
    monto INTEGER NOT NULL DEFAULT 0,
    probabilidad INTEGER NOT NULL DEFAULT 10,
    owner_id INTEGER,
    fuente VARCHAR(60),
    campaign_first_id INTEGER,
    campaign_last_id INTEGER,
    abierto_en TIMESTAMP NOT NULL DEFAULT NOW(),
    cierre_estimado TIMESTAMP,
    cerrado_en TIMESTAMP,
    motivo_perdida VARCHAR(200),
    ultima_actividad_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_deals_etapa_idx ON crm_deals (etapa)`,
  `CREATE INDEX IF NOT EXISTS crm_deals_account_idx ON crm_deals (account_id)`,
  `CREATE INDEX IF NOT EXISTS crm_deals_owner_idx ON crm_deals (owner_id)`,

  `CREATE TABLE IF NOT EXISTS crm_deal_items (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS crm_deal_items_deal_idx ON crm_deal_items (deal_id)`,

  `CREATE TABLE IF NOT EXISTS crm_activities (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    deal_id INTEGER,
    contact_id INTEGER,
    tipo VARCHAR(20) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    detalle TEXT,
    owner_id INTEGER,
    ocurrido_en TIMESTAMP NOT NULL DEFAULT NOW(),
    vence_en TIMESTAMP,
    completada BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  `CREATE INDEX IF NOT EXISTS crm_activities_account_idx ON crm_activities (account_id)`,
  `CREATE INDEX IF NOT EXISTS crm_activities_deal_idx ON crm_activities (deal_id)`,
  `CREATE INDEX IF NOT EXISTS crm_activities_fecha_idx ON crm_activities (ocurrido_en)`,

  `CREATE TABLE IF NOT EXISTS crm_orders (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    deal_id INTEGER,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    total INTEGER NOT NULL DEFAULT 0,
    canal VARCHAR(40)
  )`,
  `CREATE INDEX IF NOT EXISTS crm_orders_account_idx ON crm_orders (account_id)`,
  `CREATE INDEX IF NOT EXISTS crm_orders_fecha_idx ON crm_orders (fecha)`,

  `CREATE TABLE IF NOT EXISTS crm_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS crm_order_items_order_idx ON crm_order_items (order_id)`,
  `CREATE INDEX IF NOT EXISTS crm_order_items_product_idx ON crm_order_items (product_id)`,

  `CREATE TABLE IF NOT EXISTS crm_wa_conversations (
    id SERIAL PRIMARY KEY,
    account_id INTEGER,
    contact_id INTEGER,
    deal_id INTEGER,
    telefono VARCHAR(20) NOT NULL,
    nombre VARCHAR(120),
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    baja BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_mensaje_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_wa_conv_telefono_idx ON crm_wa_conversations (telefono)`,
  `CREATE INDEX IF NOT EXISTS crm_wa_conv_estado_idx ON crm_wa_conversations (estado)`,

  `CREATE TABLE IF NOT EXISTS crm_wa_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL,
    direccion VARCHAR(4) NOT NULL,
    cuerpo TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'draft',
    motivo TEXT,
    automatico BOOLEAN NOT NULL DEFAULT FALSE,
    autor_id INTEGER,
    wa_message_id VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    enviado_en TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS crm_wa_msg_conv_idx ON crm_wa_messages (conversation_id)`,
  `CREATE INDEX IF NOT EXISTS crm_wa_msg_estado_idx ON crm_wa_messages (estado)`,

  `CREATE TABLE IF NOT EXISTS crm_wa_templates (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    cuerpo TEXT NOT NULL,
    proposito VARCHAR(40),
    activa BOOLEAN NOT NULL DEFAULT TRUE
  )`,

  `CREATE TABLE IF NOT EXISTS crm_segments (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    definicion JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS crm_alerts (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(200) NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    severidad VARCHAR(10) NOT NULL DEFAULT 'media',
    titulo VARCHAR(250) NOT NULL,
    detalle TEXT,
    entidad_tipo VARCHAR(20),
    entidad_id INTEGER,
    accion_sugerida JSONB,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    generada_en TIMESTAMP NOT NULL DEFAULT NOW(),
    resuelta_en TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_alerts_clave_idx ON crm_alerts (clave)`,
  `CREATE INDEX IF NOT EXISTS crm_alerts_estado_idx ON crm_alerts (estado)`,

  `CREATE TABLE IF NOT EXISTS crm_settings (
    clave VARCHAR(80) PRIMARY KEY,
    valor TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

for (const sentencia of SENTENCIAS) {
  await sql.query(sentencia);
}

const tablas = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name LIKE 'crm_%'
  ORDER BY table_name
`;

console.log(`✓ ${tablas.length} tablas del CRM listas:`);
for (const t of tablas) console.log(`  · ${t.table_name}`);
