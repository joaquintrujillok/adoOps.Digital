// Inspecciona y arregla suscripciones de Cafecito IA desde la línea de comandos.
//
//   node scripts/cafecito-suscriptor.mjs                          lista todas
//   node scripts/cafecito-suscriptor.mjs joaquin@jtk.app          muestra una
//   node scripts/cafecito-suscriptor.mjs joaquin@jtk.app --taza flat_white
//   node scripts/cafecito-suscriptor.mjs joaquin@jtk.app --eliminar
//
// Sin --taza solo muestra el estado. Con --taza confirma la suscripción y fija
// la taza, que es exactamente lo que hace el formulario de perfilamiento.
//
// --eliminar borra la fila entera, de forma irreversible. Es para reponer una
// suscripción de prueba desde cero, no para dar de baja a alguien: la baja real
// se hace con el enlace del pie del correo, que conserva la fila y deja
// constancia de que esa persona pidió no recibir más.
//
// Existe porque el diagnóstico "¿por qué me llegó la variante equivocada?" se
// responde mirando la fila, y hacerlo por la interfaz exige tener a mano el
// enlace del correo de confirmación.

import { readFileSync, existsSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const TAZAS = ["expreso_directivo", "expreso_builder", "flat_white"];

// .env mínimo: primero .env.local, después .env. No pisa lo que ya venga del entorno.
for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const linea of readFileSync(f, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const iTaza = args.indexOf("--taza");
const eliminar = args.includes("--eliminar");
const taza = iTaza !== -1 ? args[iTaza + 1] : null;
const email = args.find((a) => a.includes("@"))?.trim().toLowerCase() ?? null;

if (taza !== null && !TAZAS.includes(taza)) {
  console.error(`--taza debe ser una de: ${TAZAS.join(", ")}`);
  process.exit(1);
}
if (taza && !email) {
  console.error("--taza necesita que indiques a qué correo aplicarla.");
  process.exit(1);
}
if (eliminar && !email) {
  console.error("--eliminar necesita que indiques qué correo borrar.");
  process.exit(1);
}
if (eliminar && taza) {
  console.error("--eliminar y --taza son incompatibles: o la arreglas o la borras.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL (ponla en .env.local o en el entorno).");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const base = process.env.NEXT_PUBLIC_BASE_URL || "https://www.adoops.digital";

// ── Listado completo ────────────────────────────────────────────────────────
if (!email) {
  const filas = await sql`
    SELECT id, email, estado, taza, confirmado_en, baja_en, created_at
    FROM cafecito_suscriptores ORDER BY created_at`;

  if (!filas.length) {
    console.log("No hay ningún suscriptor todavía.");
    process.exit(0);
  }

  console.log(`\n${filas.length} fila(s):\n`);
  for (const f of filas) {
    const efectiva = f.baja_en
      ? "dado de baja"
      : f.estado !== "confirmado"
        ? "no recibe (sin confirmar)"
        : (f.taza ?? "expreso_directivo (por defecto, no eligió)");
    console.log(`  ${f.email.padEnd(34)} ${f.estado.padEnd(12)} → ${efectiva}`);
  }
  console.log("\nPara ver o arreglar una: pásale el correo como argumento.\n");
  process.exit(0);
}

// ── Una sola dirección ──────────────────────────────────────────────────────
const [fila] = await sql`
  SELECT id, email, estado, nombre, empresa, rol, taza, telefono, origen,
         token_confirmacion, confirmacion_expira_en, confirmado_en, baja_en, created_at
  FROM cafecito_suscriptores WHERE email = ${email} LIMIT 1`;

if (!fila) {
  console.log(`No hay ninguna fila para ${email}. Nunca se registró con esa dirección.`);
  process.exit(0);
}

const mostrar = (f) => {
  console.log(`  estado      ${f.estado}`);
  console.log(`  taza        ${f.taza ?? "(sin elegir — recibe expreso directivo por defecto)"}`);
  console.log(`  nombre      ${f.nombre ?? "—"}`);
  console.log(`  empresa     ${f.empresa ?? "—"}`);
  console.log(`  rol         ${f.rol ?? "—"}`);
  console.log(`  registrado  ${f.created_at}`);
  console.log(`  confirmado  ${f.confirmado_en ?? "nunca"}`);
  console.log(`  baja        ${f.baja_en ?? "no"}`);
};

console.log(`\n${email}`);
mostrar(fila);

// Por qué no le llega lo que espera, dicho en una línea.
if (fila.baja_en) {
  console.log("\n→ Está dado de baja: la API no lo devuelve en ninguna lista.");
} else if (fila.estado !== "confirmado") {
  const vencido = fila.confirmacion_expira_en && new Date(fila.confirmacion_expira_en) < new Date();
  console.log(
    `\n→ No completó el doble opt-in, así que no recibe nada.` +
      (vencido
        ? " El enlace venció; hay que registrarse de nuevo en el sitio."
        : `\n  Enlace vigente: ${base}/cafecito-ia/confirmar/${fila.token_confirmacion}`),
  );
} else if (!fila.taza) {
  console.log("\n→ Confirmado pero sin taza elegida: recibe el expreso directivo por defecto.");
} else {
  console.log(`\n→ Todo en orden: recibe ${fila.taza}.`);
}

if (eliminar) {
  await sql`DELETE FROM cafecito_suscriptores WHERE id = ${fila.id}`;
  console.log(`\nBorrada. ${email} ya no existe en la base y puede registrarse de nuevo.`);
  process.exit(0);
}

if (taza) {
  const [nueva] = await sql`
    UPDATE cafecito_suscriptores
    SET estado = 'confirmado',
        confirmado_en = COALESCE(confirmado_en, now()),
        taza = ${taza},
        baja_en = NULL
    WHERE id = ${fila.id}
    RETURNING id, email, estado, nombre, empresa, rol, taza,
              confirmado_en, baja_en, created_at`;
  console.log(`\nActualizado:`);
  mostrar(nueva);
}
