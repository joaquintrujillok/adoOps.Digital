// Crea (o reactiva) el usuario administrador del backoffice de Vanni.
//
//   node scripts/vanni-crear-admin.mjs <usuario> "<Nombre>" [telefono] [email]
//
// La clave inicial sale de VANNI_ADMIN_PASSWORD en .env.local y no se imprime.
// El usuario queda con `debe_cambiar_clave`: la primera pantalla le pide elegir
// la suya. El teléfono es a donde llegan los avisos de interesados cuando una
// campaña no tiene ejecutiva asignada.

import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

function cargarEnv() {
  const s = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const linea of s.split("\n")) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
cargarEnv();

const [usuario, nombre, telefono, email] = process.argv.slice(2);
if (!usuario || !nombre) {
  console.error('Uso: node scripts/vanni-crear-admin.mjs <usuario> "<Nombre>" [telefono] [email]');
  process.exit(1);
}
const clave = process.env.VANNI_ADMIN_PASSWORD;
if (!clave || clave.length < 12) {
  console.error("VANNI_ADMIN_PASSWORD falta en .env.local o tiene menos de 12 caracteres");
  process.exit(1);
}

const sal = randomBytes(16);
const hash = `scrypt$${sal.toString("base64url")}$${scryptSync(clave, sal, 64).toString("base64url")}`;
const sql = neon(process.env.DATABASE_URL);

const [u] = await sql`
  insert into vanni_usuarios (username, nombre, email, telefono, rol, password_hash, activo, debe_cambiar_clave)
  values (${usuario.toLowerCase()}, ${nombre}, ${email ?? null}, ${telefono ?? null}, 'admin', ${hash}, true, true)
  on conflict (username) do update set
    nombre = excluded.nombre, email = coalesce(excluded.email, vanni_usuarios.email),
    telefono = coalesce(excluded.telefono, vanni_usuarios.telefono),
    rol = 'admin', password_hash = excluded.password_hash, activo = true, debe_cambiar_clave = true
  returning id, username`;
console.log(`Admin listo: ${u.username} (id ${u.id}). Clave inicial: la de VANNI_ADMIN_PASSWORD en .env.local.`);
