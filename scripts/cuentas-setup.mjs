// Agrega la columna `cuentas` a `d360_users` y unifica el `ambito` de las
// reuniones con los ids de cuenta.
//
// Aditivo e idempotente. No toca ninguna otra tabla y no deja a nadie afuera:
// `cuentas` queda en NULL para los usuarios que ya existen, y NULL significa
// "todas" —ver la nota en `db/dashboard360.ts`—. Un despliegue que dejara a la
// única persona del equipo sin acceso a su propio tablero sería peor que no
// tener cuentas.
//
// Uso: node scripts/cuentas-setup.mjs

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

await sql`ALTER TABLE d360_users ADD COLUMN IF NOT EXISTS cuentas JSONB`;
console.log("d360_users.cuentas listo");

// El `ambito` de las reuniones ya era este mismo concepto: los tokens del
// webhook declaran `soho` y `personal`, que son ids de cuenta. Lo único que
// falta es que las reuniones que entraron antes de que existieran las cuentas
// no queden invisibles en todas.
const [{ n }] = await sql`
  SELECT count(*)::int AS n FROM reunion_registros WHERE ambito IS NULL
`;

if (n > 0) {
  console.log("");
  console.log(`Hay ${n} reunión(es) sin ámbito, de antes de que existieran las cuentas.`);
  console.log("No se les asigna una a ciegas: adivinar de qué mundo era una");
  console.log("conversación es justo el error que las cuentas existen para evitar.");
  console.log("Se asignan a mano, por ejemplo:");
  console.log("");
  console.log("  UPDATE reunion_registros SET ambito = 'soho' WHERE id = 3;");
}
