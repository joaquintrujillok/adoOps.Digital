// Crea o actualiza un usuario del CRM. Es la salida cuando nadie puede entrar.
//
// Uso:
//   node scripts/crm-usuario.mjs <usuario> <contraseña> [rol] ["Nombre visible"]
//
// rol: admin | gerente | vendedor (por defecto vendedor)
//
// El hash es scrypt con sal por usuario, el mismo formato que verifica
// lib/crm/session.ts: scrypt$<sal base64url>$<hash base64url>.

import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL no encontrada");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

function hashPassword(plano) {
  const sal = randomBytes(16);
  const hash = scryptSync(plano, sal, 64);
  return `scrypt$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

const [usuario, clave, rol = "vendedor", nombre] = process.argv.slice(2);

if (!usuario || !clave) {
  console.error(
    'Uso: node scripts/crm-usuario.mjs <usuario> <contraseña> [rol] ["Nombre"]',
  );
  process.exit(1);
}
if (!["admin", "gerente", "vendedor"].includes(rol)) {
  console.error(`Rol inválido: ${rol}. Usa admin, gerente o vendedor.`);
  process.exit(1);
}

const sql = neon(loadDatabaseUrl());
const username = usuario.trim().toLowerCase();
const visible = nombre || usuario;
const hash = hashPassword(clave);

const filas = await sql`
  INSERT INTO crm_users (username, nombre, password_hash, rol, activo)
  VALUES (${username}, ${visible}, ${hash}, ${rol}, TRUE)
  ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rol = EXCLUDED.rol,
        nombre = EXCLUDED.nombre,
        activo = TRUE
  RETURNING id, username, nombre, rol
`;

const u = filas[0];
console.log(`✓ Usuario #${u.id} ${u.username} (${u.rol}) — ${u.nombre}`);
