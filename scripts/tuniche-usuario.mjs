// Crea o actualiza un usuario del Sistema Tuniche desde la línea de comandos.
//
// Tiene dos usos y solo dos: **crear el primer administrador** (no hay pantalla
// para eso, porque la pantalla exige ser administrador) y **la salida de
// emergencia** cuando nadie puede entrar. Todo lo demás se hace en
// /tuniche/usuarios, que valida más y deja rastro de quién creó a quién.
//
// Uso:
//   node scripts/tuniche-usuario.mjs <usuario> <contraseña> [rol] ["Nombre"] [area]
//
//   rol:  admin | jefe | zonal      (por defecto zonal)
//   area: mn | altue                (obligatoria salvo para admin)
//
// El hash es scrypt con sal por usuario, el mismo formato que verifica
// lib/tuniche/session.ts: scrypt$<sal base64url>$<hash base64url>.

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

const [usuario, clave, rol = "zonal", nombre, area] = process.argv.slice(2);

if (!usuario || !clave) {
  console.error(
    'Uso: node scripts/tuniche-usuario.mjs <usuario> <contraseña> [rol] ["Nombre"] [area]',
  );
  process.exit(1);
}
if (!["admin", "jefe", "zonal"].includes(rol)) {
  console.error(`Rol inválido: ${rol}. Usa admin, jefe o zonal.`);
  process.exit(1);
}
// La misma regla que aplica la aplicación. Si el script fuera más permisivo,
// la puerta de emergencia sería la más débil de las dos, que es exactamente al
// revés de lo que se quiere.
if (clave.length < 12) {
  console.error("La contraseña necesita al menos 12 caracteres.");
  process.exit(1);
}

// Un admin con área daría a entender que su alcance está limitado, y no lo está.
// Un jefe o un zonal sin área no tendría ninguna fila que ver.
let areaFinal = null;
if (rol === "admin") {
  if (area) {
    console.error("Un administrador no lleva área: ve todas. Quita el último argumento.");
    process.exit(1);
  }
} else {
  if (!["mn", "altue"].includes(area ?? "")) {
    console.error(`Un ${rol} necesita área. Usa mn (Mercado Nacional) o altue (Producción Altué).`);
    process.exit(1);
  }
  areaFinal = area;
}

const sql = neon(loadDatabaseUrl());
const username = usuario.trim().toLowerCase();
const visible = nombre || usuario;
const hash = hashPassword(clave);

// `debe_cambiar_clave` queda en FALSE: esta clave la eligió quien corre el
// script, no se la dictaron. Las que dicta un administrador desde la pantalla sí
// obligan a cambiarla.
const filas = await sql`
  INSERT INTO tuniche_usuarios (username, nombre, password_hash, rol, area, activo, debe_cambiar_clave)
  VALUES (${username}, ${visible}, ${hash}, ${rol}, ${areaFinal}, TRUE, FALSE)
  ON CONFLICT (username) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        rol = EXCLUDED.rol,
        area = EXCLUDED.area,
        nombre = EXCLUDED.nombre,
        activo = TRUE,
        debe_cambiar_clave = FALSE
  RETURNING id, username, nombre, rol, area
`;

const u = filas[0];
console.log(`✓ #${u.id} ${u.username} — ${u.nombre} · ${u.rol} · ${u.area ?? "todas las áreas"}`);
