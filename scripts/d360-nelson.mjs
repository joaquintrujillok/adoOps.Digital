// Crea el usuario de Nelson García en el tablero (/dashboard360).
//
// Es `scripts/d360-usuario.mjs` con los datos ya puestos, para correrlo sin
// argumentos:
//
//   usuario  nelson@adoops.digital
//   nombre   Nelson García
//   rol      gerente
//   cuentas  adoops, demo   — no ve Soho ni Personal
//
// ── La contraseña ────────────────────────────────────────────────────────────
//
// No está escrita acá, a propósito: un archivo del repositorio no es lugar para
// una contraseña. Hay dos formas de darla:
//
//   node scripts/d360-nelson.mjs
//       Genera una al azar y la muestra UNA vez en la terminal. Hay que
//       copiarla ahí mismo y pasársela a Nelson: no queda guardada en ninguna
//       parte, solo su hash.
//
//   D360_PASSWORD='la-que-quieras' node scripts/d360-nelson.mjs
//       Usa esa. Va por variable de entorno y no como argumento para que no
//       quede en la lista de procesos.
//
// ── Si el usuario ya existe ──────────────────────────────────────────────────
//
// Se actualizan nombre, rol y cuentas, y **la contraseña no se toca** salvo que
// se pida: con `D360_PASSWORD` o con `--nueva-clave`. Así el script se puede
// volver a correr para corregir las cuentas sin dejar a Nelson afuera.
//
// Hay una sola base: esto escribe en producción.

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

/** scrypt$<sal base64url>$<hash base64url> — lo que verifica lib/dashboard360/session.ts */
function hashPassword(plano) {
  const sal = randomBytes(16);
  const hash = scryptSync(plano, sal, 64);
  return `scrypt$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

const USUARIO = "nelson@adoops.digital";
const NOMBRE = "Nelson García";
const ROL = "gerente";
const CUENTAS = ["adoops", "demo"];

const sql = neon(loadDatabaseUrl());
const [existe] = await sql`SELECT id FROM d360_users WHERE username = ${USUARIO} LIMIT 1`;

const pedida = process.env.D360_PASSWORD || null;
const cambiarClave = !existe || !!pedida || process.argv.includes("--nueva-clave");
// 18 bytes en base64url son 24 caracteres: se puede dictar y no se adivina.
const generada = cambiarClave && !pedida ? randomBytes(18).toString("base64url") : null;
const clave = pedida ?? generada;

let fila;
if (existe && !cambiarClave) {
  [fila] = await sql`
    UPDATE d360_users
    SET nombre = ${NOMBRE}, email = ${USUARIO}, rol = ${ROL}, cuentas = ${JSON.stringify(CUENTAS)}::jsonb, activo = true
    WHERE id = ${existe.id}
    RETURNING id, username, nombre, rol, cuentas`;
} else {
  [fila] = await sql`
    INSERT INTO d360_users (username, nombre, email, password_hash, rol, cuentas, activo)
    VALUES (${USUARIO}, ${NOMBRE}, ${USUARIO}, ${hashPassword(clave)}, ${ROL}, ${JSON.stringify(CUENTAS)}::jsonb, true)
    ON CONFLICT (username) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      rol = EXCLUDED.rol,
      cuentas = EXCLUDED.cuentas,
      activo = true
    RETURNING id, username, nombre, rol, cuentas`;
}

console.log(existe ? "Usuario actualizado:" : "Usuario creado:");
console.log(`  id       ${fila.id}`);
console.log(`  usuario  ${fila.username}`);
console.log(`  nombre   ${fila.nombre}`);
console.log(`  rol      ${fila.rol}`);
console.log(`  cuentas  ${fila.cuentas.join(", ")}`);
console.log("");
if (generada) {
  console.log(`  contraseña  ${generada}`);
  console.log("  Cópiala ahora: no se vuelve a mostrar ni queda guardada.");
} else if (cambiarClave) {
  console.log("  contraseña  la de D360_PASSWORD");
} else {
  console.log("  contraseña  sin cambios");
}
console.log("");
console.log("Entra en https://www.adoops.digital/dashboard360/login");
