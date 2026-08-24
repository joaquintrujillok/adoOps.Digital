// Dispara la puesta en marcha del demo de Dashboard360 contra un despliegue.
//
// No crea ni siembra nada por sí mismo: es un cliente del endpoint
// /api/dashboard360/cron/setup, que corre dentro del despliegue porque es el
// único lugar donde la cadena de conexión de Neon está disponible (Vercel
// entrega las variables cifradas en un solo sentido: se escriben, no se leen).
//
// Tener la lógica en un solo lado —lib/dashboard360/demo.ts— evita que la
// versión del script y la del servidor se separen con el tiempo.
//
// Uso:
//   D360_SETUP_SECRET=... node scripts/d360-setup.mjs <url-base> [--limpiar]
//
// Ejemplo:
//   D360_SETUP_SECRET=abc node scripts/d360-setup.mjs https://www.adoops.digital

const base = process.argv[2];
const limpiar = process.argv.includes("--limpiar");
const secreto = process.env.D360_SETUP_SECRET;

if (!base) {
  console.error("Falta la URL base. Uso: node scripts/d360-setup.mjs <url-base> [--limpiar]");
  process.exit(1);
}
if (!secreto) {
  console.error("Falta D360_SETUP_SECRET en el entorno.");
  process.exit(1);
}

const url = `${base.replace(/\/$/, "")}/api/dashboard360/cron/setup${limpiar ? "?limpiar=1" : ""}`;
const res = await fetch(url, {
  method: "POST",
  headers: { authorization: `Bearer ${secreto}` },
});

const cuerpo = await res.json().catch(() => ({ error: "respuesta no JSON" }));
console.log(`HTTP ${res.status}`);
console.log(JSON.stringify(cuerpo, null, 2));
process.exit(res.ok ? 0 : 1);
