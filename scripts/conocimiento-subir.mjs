// Sube un documento de conocimiento a la base del copiloto.
//
// Uso:
//   node scripts/conocimiento-subir.mjs <cuenta> <archivo.md> [url]
//   node scripts/conocimiento-subir.mjs soho docs/conocimiento/kb-rag-soho/kb-soho.md
//
// Por defecto sube a producción. Para probar contra el servidor local:
//   node scripts/conocimiento-subir.mjs soho <archivo> http://localhost:3001
//
// ── Por qué sube en vez de ingerir ───────────────────────────────────────────
//
// La ingesta necesita la clave de OpenAI, y esa clave vive en producción. Este
// script solo lee el archivo y lo manda; el troceo, los embeddings y el guardado
// pasan del otro lado. Así la clave no se copia a ninguna máquina.
//
// Se autentica firmando una sesión del tablero con `D360_SESSION_SECRET`, que sí
// está en `.env.local`. No inventa un secreto nuevo para esto: un secreto más es
// un secreto más que rotar.

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

function env(clave) {
  if (process.env[clave]) return process.env[clave];
  const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const linea = txt.split("\n").find((l) => l.startsWith(clave + "="));
  if (!linea) throw new Error(`${clave} no encontrada en .env.local`);
  return linea.slice(clave.length + 1).trim().replace(/^["']|["']$/g, "");
}

const [cuenta, ruta, base = "https://www.adoops.digital"] = process.argv.slice(2);
if (!cuenta || !ruta) {
  console.error("Uso: node scripts/conocimiento-subir.mjs <cuenta> <archivo.md> [url]");
  process.exit(1);
}

const markdown = readFileSync(ruta, "utf8");
const origen = ruta.split("/").pop();

const payload = {
  userId: 0,
  username: "ingesta",
  nombre: "Ingesta de conocimiento",
  rol: "admin",
  cuenta,
  // Corta a propósito: esta sesión existe para una petición y no debería quedar
  // dando vueltas en el historial de nadie.
  exp: Date.now() + 5 * 60 * 1000,
};
const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
const token = `${body}.${createHmac("sha256", env("D360_SESSION_SECRET")).update(body).digest("base64url")}`;

console.log(`Subiendo ${origen} (${Math.round(markdown.length / 1024)} KB) a la cuenta "${cuenta}"…`);

const res = await fetch(`${base}/api/dashboard360/conocimiento/ingesta`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: `adoops_d360_session=${token}`,
  },
  body: JSON.stringify({ cuenta, origen, markdown }),
});

const datos = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Falló (${res.status}):`, datos.error ?? datos);
  process.exit(1);
}

console.log(`Listo.`);
console.log(`  ${datos.trozos} trozos · ${datos.siempre} marcados "siempre" · ~${datos.tokens} tokens`);
if (datos.reemplazados) console.log(`  ${datos.reemplazados} trozos anteriores reemplazados`);
