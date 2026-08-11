// Migración de la bandeja de conversaciones a tres columnas.
//
// Idempotente y aditiva: agrega dos columnas a `crm_wa_conversations` y nada
// más. No borra, no renombra, no toca datos existentes.
//
// Por qué estas dos columnas y no una vista derivada:
//
// `leido_en` — "no leído" tiene que ser una decisión de la persona que atiende,
// no un cálculo. Derivarlo de "el último mensaje es entrante" suena parecido y
// se comporta distinto: una conversación que se leyó y se dejó para responder
// mañana volvería a aparecer como pendiente cada vez que se recarga, y la
// pestaña deja de servir para lo único que sirve —saber qué falta mirar.
//
// `destacada` — un destacado que se calcula solo no es un destacado. La pestaña
// existe justamente para que alguien marque a mano las tres conversaciones que
// no puede perder de vista esta semana.
//
// Uso: node scripts/crm-migrar-bandeja.mjs

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
  `ALTER TABLE crm_wa_conversations ADD COLUMN IF NOT EXISTS leido_en TIMESTAMP`,
  `ALTER TABLE crm_wa_conversations ADD COLUMN IF NOT EXISTS destacada BOOLEAN NOT NULL DEFAULT FALSE`,
  `CREATE INDEX IF NOT EXISTS crm_wa_conv_destacada_idx ON crm_wa_conversations (destacada)`,
];

console.log("Migrando la bandeja de conversaciones…\n");

for (const sentencia of SENTENCIAS) {
  const resumen = sentencia.replace(/\s+/g, " ").slice(0, 78);
  try {
    await sql.query(sentencia);
    console.log(`  ✓ ${resumen}`);
  } catch (error) {
    console.error(`  ✗ ${resumen}\n    ${error.message}`);
    process.exitCode = 1;
  }
}

console.log("\nListo. Las conversaciones existentes quedan sin marcar de leídas:");
console.log("aparecen en «No leídos» hasta que alguien las abra.");
