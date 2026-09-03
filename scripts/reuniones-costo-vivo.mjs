// Agrega `costo_vivo_usd` y rellena lo que faltaba en las reuniones en vivo ya
// grabadas.
//
// Existe porque el costo de escuchar en vivo nunca se guardó: el contador de la
// pantalla lo mostraba mientras la sesión estaba abierta y desaparecía al
// cerrarla. Las reuniones viejas quedaron registrando solo el resumen —medio
// centavo— sobre sesiones que costaron medio dólar.
//
// El relleno es una ESTIMACIÓN y se marca como tal: se reconstruye la parte
// grande, la transcripción por minuto, que es aritmética exacta sobre la
// duración. Las pasadas del copiloto de esas sesiones no se pueden recuperar —no
// quedaron en ningún lado— así que no se inventan.
//
// Uso: node scripts/reuniones-costo-vivo.mjs

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const USD_POR_MINUTO = 0.017;

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL no encontrada");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());

await sql`ALTER TABLE reunion_registros ADD COLUMN IF NOT EXISTS costo_vivo_usd NUMERIC(12,6)`;
console.log("columna costo_vivo_usd lista");

const pendientes = await sql`
  SELECT id, titulo, duracion_min
  FROM reunion_registros
  WHERE plataforma = 'En vivo' AND costo_vivo_usd IS NULL AND duracion_min IS NOT NULL
  ORDER BY id
`;

if (pendientes.length === 0) {
  console.log("No hay reuniones en vivo sin costo.");
} else {
  console.log(`\n${pendientes.length} reunión(es) en vivo sin costo registrado:`);
  for (const r of pendientes) {
    const usd = r.duracion_min * USD_POR_MINUTO;
    await sql`UPDATE reunion_registros SET costo_vivo_usd = ${usd.toFixed(6)} WHERE id = ${r.id}`;
    console.log(`  #${r.id} ${r.titulo} · ${r.duracion_min} min → US$${usd.toFixed(3)}`);
  }
  console.log("\nSolo la transcripción. Las pasadas del copiloto de esas");
  console.log("sesiones no quedaron registradas en ninguna parte y no se inventan:");
  console.log("el número real fue algo más alto.");
}
