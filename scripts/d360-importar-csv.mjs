// Sube un informe de campaña de Google Ads (CSV de la interfaz) al despliegue.
//
// No procesa nada: es un cliente del endpoint /api/dashboard360/cron/importar-csv,
// que corre dentro del despliegue porque es el único lugar donde la cadena de
// conexión de Neon está disponible.
//
// Uso:
//   D360_SETUP_SECRET=... node scripts/d360-importar-csv.mjs <url-base> <archivo.csv> [customer-id]

import { readFileSync } from "node:fs";

const [base, archivo, cuenta] = process.argv.slice(2);
const secreto = process.env.D360_SETUP_SECRET;

if (!base || !archivo) {
  console.error("Uso: node scripts/d360-importar-csv.mjs <url-base> <archivo.csv> [customer-id]");
  process.exit(1);
}
if (!secreto) {
  console.error("Falta D360_SETUP_SECRET en el entorno.");
  process.exit(1);
}

const csv = readFileSync(archivo, "utf8");
const url = new URL("/api/dashboard360/cron/importar-csv", base);
if (cuenta) url.searchParams.set("cuenta", cuenta);

const res = await fetch(url, {
  method: "POST",
  headers: { authorization: `Bearer ${secreto}`, "content-type": "text/csv; charset=utf-8" },
  body: csv,
});

const cuerpo = await res.json().catch(() => ({ error: "respuesta no JSON" }));
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(cuerpo, null, 2));
process.exit(res.ok ? 0 : 1);
