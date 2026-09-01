// Crea o actualiza un usuario de Dashboard360. Es la salida cuando nadie puede
// entrar. Hermano de `scripts/crm-usuario.mjs`, mismo formato de hash.
//
// Uso:
//   node scripts/d360-usuario.mjs <usuario> <contraseña> [rol] ["Nombre"] [cuentas]
//
//   rol      admin | gerente | analista   (por defecto analista)
//   cuentas  lista separada por comas, o "todas" (por defecto: todas)
//
// La contraseña también se puede pasar por `D360_PASSWORD` y omitir el
// argumento. No es un detalle: un argumento queda en el historial del shell y en
// la lista de procesos mientras el comando corre, y una contraseña no debería
// estar en ninguno de los dos.
//
//   D360_PASSWORD='…' node scripts/d360-usuario.mjs joaquin@jtk.app - admin "Joaquín"
//
// ── Sobre "super admin" ──────────────────────────────────────────────────────
//
// No existe como rol, y no hace falta: es `admin` con `cuentas` en NULL. NULL
// significa **todas** —ver la nota en `db/dashboard360.ts`— y es distinto de un
// arreglo vacío, que significa ninguna. Inventar un cuarto rol para decir lo
// mismo que ya dicen dos columnas juntas sería un segundo concepto solapado, que
// es el problema que las cuentas vinieron a resolver, no a repetir.

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

const CUENTAS_VALIDAS = ["demo", "adoops", "soho", "personal"];
const ROLES = ["admin", "gerente", "analista"];

const [usuario, claveArg, rol = "analista", nombre, cuentasArg] = process.argv.slice(2);
const clave = claveArg && claveArg !== "-" ? claveArg : process.env.D360_PASSWORD;

if (!usuario || !clave) {
  console.error(
    'Uso: node scripts/d360-usuario.mjs <usuario> <contraseña|-> [rol] ["Nombre"] [cuentas]',
  );
  console.error("Con «-» la contraseña se lee de D360_PASSWORD.");
  process.exit(1);
}
if (!ROLES.includes(rol)) {
  console.error(`Rol inválido: ${rol}. Usa ${ROLES.join(", ")}.`);
  process.exit(1);
}

// "todas" y la ausencia son lo mismo: NULL. Se escribe explícito para que el
// comando diga en voz alta lo que hace, en vez de que dependa de un default.
let cuentas = null;
if (cuentasArg && cuentasArg !== "todas") {
  cuentas = cuentasArg
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const malas = cuentas.filter((c) => !CUENTAS_VALIDAS.includes(c));
  if (malas.length) {
    console.error(`Cuentas inválidas: ${malas.join(", ")}. Válidas: ${CUENTAS_VALIDAS.join(", ")}.`);
    process.exit(1);
  }
}

const sql = neon(loadDatabaseUrl());
const username = usuario.trim().toLowerCase();
const visible = nombre || usuario;
const email = username.includes("@") ? username : null;
const hash = hashPassword(clave);
const cuentasJson = cuentas ? JSON.stringify(cuentas) : null;

// Idempotente por username: volver a correrlo cambia la contraseña en vez de
// reventar con un choque de índice único. Es lo que se quiere de un script que
// existe justamente para cuando alguien no puede entrar.
const [fila] = await sql`
  INSERT INTO d360_users (username, nombre, email, password_hash, rol, cuentas, activo)
  VALUES (${username}, ${visible}, ${email}, ${hash}, ${rol}, ${cuentasJson}::jsonb, true)
  ON CONFLICT (username) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    rol = EXCLUDED.rol,
    cuentas = EXCLUDED.cuentas,
    activo = true
  RETURNING id, username, nombre, rol, cuentas
`;

console.log("Usuario listo:");
console.log(`  id       ${fila.id}`);
console.log(`  usuario  ${fila.username}`);
console.log(`  nombre   ${fila.nombre}`);
console.log(`  rol      ${fila.rol}`);
console.log(`  cuentas  ${fila.cuentas ? fila.cuentas.join(", ") : "todas"}`);
console.log("");
console.log("Entra en /dashboard360/login");
