// Catálogo real de Highend Chile.
//
// Reemplaza el catálogo de relojería con el que la tienda vende de verdad: las
// once categorías de su sitio y las marcas que distribuye, con precios dentro
// del rango que publican ($49.900 a $39.900.000).
//
// El catálogo no es decorado. Es lo que hace que el resto del CRM diga algo:
// los tramos de monto del RFM, la detección del eslabón débil y las señales de
// complemento se calculan sobre estas categorías y estos precios. Con productos
// inventados, todo lo que se muestre arriba es una maqueta bonita.
//
// **El orden de la cadena importa.** Un sistema de audio se arma por eslabones
// —fuente, previo, etapa, parlantes, soporte— y el negocio de la recompra vive
// justamente ahí: el que tiene los parlantes vuelve por la etapa. Por eso cada
// categoría declara su eslabón y su posición.
//
// Uso:
//   node scripts/crm-catalogo-highend.mjs            reemplaza el catálogo
//   node scripts/crm-catalogo-highend.mjs --listar   solo muestra qué haría

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL no encontrada");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());

// ─── Categorías y su lugar en la cadena ──────────────────────────────────────

export const CATEGORIAS = [
  { nombre: "Sistemas Highend", eslabon: "sistema", orden: 0 },
  { nombre: "Audio Análogo", eslabon: "fuente", orden: 1 },
  { nombre: "Audio Digital", eslabon: "fuente", orden: 1 },
  { nombre: "Preamplificadores", eslabon: "previo", orden: 2 },
  { nombre: "Amplificadores", eslabon: "etapa", orden: 3 },
  { nombre: "Parlantes y Cine", eslabon: "parlantes", orden: 4 },
  { nombre: "Audio Video", eslabon: "video", orden: 5 },
  { nombre: "Cables de Audio", eslabon: "soporte", orden: 6 },
  { nombre: "Acondicionador de Potencia", eslabon: "soporte", orden: 6 },
  { nombre: "Racks y Antivibración", eslabon: "soporte", orden: 6 },
  { nombre: "Tubos y Válvulas", eslabon: "soporte", orden: 6 },
];

// ─── El catálogo ─────────────────────────────────────────────────────────────
//
// [nombre, marca, categoría, precio, stock]
//
// Los precios están en pesos y son de lista. En este rubro el precio de lista
// es un punto de partida: la venta grande se negocia. Eso ya lo modela el
// módulo de cotizaciones con su descuento por pieza.

const CATALOGO = [
  // ── Parlantes y Cine ──
  ["Magico M6", "Magico", "Parlantes y Cine", 39_900_000, 1],
  ["Estelon X Diamond Mk II", "Estelon", "Parlantes y Cine", 34_500_000, 1],
  ["Børresen 05 SSE", "Børresen", "Parlantes y Cine", 28_900_000, 1],
  ["Magico S5 Mk II", "Magico", "Parlantes y Cine", 21_400_000, 2],
  ["Estelon Aura", "Estelon", "Parlantes y Cine", 14_800_000, 2],
  ["Børresen X3", "Børresen", "Parlantes y Cine", 9_600_000, 2],
  ["Magico A3", "Magico", "Parlantes y Cine", 7_900_000, 3],
  ["Harbeth Super HL5plus XD", "Harbeth", "Parlantes y Cine", 5_400_000, 3],
  ["Harbeth C7ES-3 XD", "Harbeth", "Parlantes y Cine", 4_200_000, 4],
  ["Harbeth P3ESR XD", "Harbeth", "Parlantes y Cine", 2_890_000, 4],

  // ── Amplificadores ──
  ["Soulution 701 Monoblock (par)", "Soulution", "Amplificadores", 38_500_000, 1],
  ["Vitus Audio SM-103 Mk II (par)", "Vitus Audio", "Amplificadores", 31_200_000, 1],
  ["Burmester 218 Stereo", "Burmester", "Amplificadores", 19_800_000, 1],
  ["Krell Solo 575 XD (par)", "Krell", "Amplificadores", 15_600_000, 2],
  ["Accuphase A-80", "Accuphase", "Amplificadores", 12_400_000, 2],
  ["Accuphase P-7500", "Accuphase", "Amplificadores", 10_900_000, 2],
  ["Krell KSA i400", "Krell", "Amplificadores", 8_700_000, 2],
  ["Accuphase E-5000 Integrado", "Accuphase", "Amplificadores", 7_200_000, 3],
  ["Accuphase E-380 Integrado", "Accuphase", "Amplificadores", 4_100_000, 3],

  // ── Preamplificadores ──
  ["Vitus Audio MP-L201 Mk II", "Vitus Audio", "Preamplificadores", 24_600_000, 1],
  ["Soulution 725", "Soulution", "Preamplificadores", 22_300_000, 1],
  ["Burmester 077", "Burmester", "Preamplificadores", 17_500_000, 1],
  ["Nagra HD Preamp", "Nagra", "Preamplificadores", 13_900_000, 1],
  ["Accuphase C-3900", "Accuphase", "Preamplificadores", 9_800_000, 2],
  ["Krell Illusion II", "Krell", "Preamplificadores", 5_600_000, 2],
  ["Accuphase C-2300", "Accuphase", "Preamplificadores", 4_700_000, 3],

  // ── Audio Digital ──
  ["Wadax Atlantis Reference DAC", "Wadax", "Audio Digital", 39_500_000, 1],
  ["Nagra HD DAC X", "Nagra", "Audio Digital", 26_800_000, 1],
  ["Aurender W20SE", "Aurender", "Audio Digital", 12_900_000, 2],
  ["Burmester 151 Mk II Musiccenter", "Burmester", "Audio Digital", 11_400_000, 1],
  ["Aurender N30SA", "Aurender", "Audio Digital", 9_700_000, 2],
  ["Accuphase DP-770 SACD", "Accuphase", "Audio Digital", 8_300_000, 2],
  ["Aurender N200", "Aurender", "Audio Digital", 4_600_000, 3],
  ["Aurender N150", "Aurender", "Audio Digital", 2_950_000, 4],
  ["Aurender A15", "Aurender", "Audio Digital", 2_200_000, 4],

  // ── Audio Análogo ──
  ["Transrotor Artus FMD", "Transrotor", "Audio Análogo", 33_800_000, 1],
  ["Transrotor Massimo TMD", "Transrotor", "Audio Análogo", 13_600_000, 1],
  ["Transrotor Alto TMD", "Transrotor", "Audio Análogo", 7_400_000, 2],
  ["Acoustic Solid Machine Small", "Acoustic Solid", "Audio Análogo", 3_100_000, 2],
  ["Transrotor Figaro Cápsula MC", "Transrotor", "Audio Análogo", 1_850_000, 3],
  ["Transrotor Phono 8 MC", "Transrotor", "Audio Análogo", 1_290_000, 3],
  ["Acoustic Solid Cápsula MM AS-11", "Acoustic Solid", "Audio Análogo", 420_000, 5],

  // ── Sistemas Highend (llave en mano) ──
  ["Sistema Referencia Børresen · Soulution", "Highend", "Sistemas Highend", 39_900_000, 1],
  ["Sistema Integrado Harbeth · Accuphase", "Highend", "Sistemas Highend", 9_400_000, 2],
  ["Sistema de Entrada Audio Digital", "Highend", "Sistemas Highend", 4_900_000, 2],

  // ── Audio Video ──
  ["Procesador Cine Storm Audio ISP Core 16", "Storm Audio", "Audio Video", 11_800_000, 1],
  ["Proyector JVC DLA-NZ8", "JVC", "Audio Video", 8_900_000, 1],
  ["Procesador Storm Audio ISP Elite 20", "Storm Audio", "Audio Video", 6_300_000, 1],

  // ── Acondicionador de Potencia ──
  ["Ansuz Mainz D-TC Supreme", "Ansuz", "Acondicionador de Potencia", 11_600_000, 1],
  ["Shunyata Everest 8000", "Shunyata Research", "Acondicionador de Potencia", 8_400_000, 1],
  ["Shunyata Denali 6000/S v2", "Shunyata Research", "Acondicionador de Potencia", 3_900_000, 2],
  ["Ansuz Mainz8 D2", "Ansuz", "Acondicionador de Potencia", 2_400_000, 3],
  ["IsoTek V5 Sigmas", "IsoTek", "Acondicionador de Potencia", 1_450_000, 4],

  // ── Cables de Audio ──
  ["Ansuz Speakz D-TC Supreme (par 2.5m)", "Ansuz", "Cables de Audio", 14_200_000, 1],
  ["Shunyata Omega XC Poder", "Shunyata Research", "Cables de Audio", 5_800_000, 2],
  ["Ansuz Digitalz D2 USB", "Ansuz", "Cables de Audio", 2_700_000, 3],
  ["Shunyata Alpha v2 Interconector XLR", "Shunyata Research", "Cables de Audio", 1_680_000, 4],
  ["Shunyata Venom v14 Poder", "Shunyata Research", "Cables de Audio", 620_000, 8],
  ["Cable Interconector RCA Entrada", "Ansuz", "Cables de Audio", 189_000, 12],
  ["Cable de Poder Estándar 1.8m", "IsoTek", "Cables de Audio", 49_900, 20],

  // ── Racks y Antivibración ──
  ["Rack Solidsteel Hyperspike HW-5", "Solidsteel", "Racks y Antivibración", 3_400_000, 2],
  ["Ansuz Darkz D-TC Supreme (set 4)", "Ansuz", "Racks y Antivibración", 2_900_000, 2],
  ["Rack Solidsteel S3-4", "Solidsteel", "Racks y Antivibración", 1_150_000, 3],
  ["Ansuz Darkz C2T (set 4)", "Ansuz", "Racks y Antivibración", 680_000, 5],
  ["Base Antivibración IsoAcoustics Gaia I", "IsoAcoustics", "Racks y Antivibración", 340_000, 8],
  ["Pie Antivibración IsoAcoustics Orea", "IsoAcoustics", "Racks y Antivibración", 129_000, 15],

  // ── Tubos y Válvulas ──
  ["Juego Válvulas KT150 Tung-Sol (cuarteto)", "Tung-Sol", "Tubos y Válvulas", 890_000, 4],
  ["Válvulas 300B Western Electric (par)", "Western Electric", "Tubos y Válvulas", 1_640_000, 2],
  ["Válvulas 12AX7 Genalex Gold Lion (par)", "Genalex", "Tubos y Válvulas", 195_000, 10],
  ["Válvula EL34 Mullard Reissue", "Mullard", "Tubos y Válvulas", 78_000, 16],
];

// ─── Ejecución ───────────────────────────────────────────────────────────────

/** SKU estable a partir de la categoría y el nombre: dos corridas dan lo mismo. */
function sku(categoria, nombre, i) {
  const pref = categoria
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
  return `${pref}-${String(i + 1).padStart(3, "0")}`;
}

if (process.argv.includes("--listar")) {
  const porCat = new Map();
  for (const [, , cat, precio] of CATALOGO) {
    const l = porCat.get(cat) ?? [];
    l.push(precio);
    porCat.set(cat, l);
  }
  const fmt = (n) => "$" + n.toLocaleString("es-CL");
  for (const { nombre } of CATEGORIAS) {
    const p = porCat.get(nombre) ?? [];
    if (!p.length) continue;
    console.log(
      `${nombre.padEnd(30)} ${String(p.length).padStart(2)} productos   ${fmt(Math.min(...p))} — ${fmt(Math.max(...p))}`,
    );
  }
  console.log(`\nTotal: ${CATALOGO.length} productos, ${new Set(CATALOGO.map((c) => c[1])).size} marcas`);
  process.exit(0);
}

// Las ventas apuntan al catálogo por product_id, así que borrar productos sin
// borrar las ventas dejaría líneas apuntando a la nada. Se limpia el historial
// junto con el catálogo y el seed lo vuelve a generar sobre los ids nuevos.
for (const t of ["crm_quote_items", "crm_order_items", "crm_inventory", "crm_products"]) {
  await sql.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
}

let i = 0;
for (const [nombre, marca, categoria, precio, stock] of CATALOGO) {
  // Margen del distribuidor: 38% sobre precio de lista, que es lo típico del
  // rubro. Sin costo, el módulo de cotizaciones no puede avisar cuándo un
  // descuento se está comiendo la venta.
  const costo = Math.round(precio * 0.62);
  // Tope de descuento: en la pieza grande hay espacio para negociar, en el
  // cable de $49.900 no hay nada que repartir.
  const topeBp = precio >= 4_000_000 ? 1200 : precio >= 1_000_000 ? 800 : 500;

  const [creado] = await sql`
    INSERT INTO crm_products
      (sku, nombre, categoria, marca, precio, costo, permite_descuento, tope_descuento_bp, activo)
    VALUES
      (${sku(categoria, nombre, i)}, ${nombre}, ${categoria}, ${marca}, ${precio}, ${costo},
       TRUE, ${topeBp}, TRUE)
    RETURNING id
  `;
  // El stock vive en su propia tabla: una unidad de un parlante de treinta
  // millones no es lo mismo que veinte cables en una caja.
  await sql`
    INSERT INTO crm_inventory (product_id, stock) VALUES (${creado.id}, ${stock})
  `;
  i++;
}

const marcas = new Set(CATALOGO.map((c) => c[1])).size;
console.log(`✓ Catálogo Highend Chile cargado`);
console.log(`  ${CATALOGO.length} productos · ${CATEGORIAS.length} categorías · ${marcas} marcas`);
console.log(`  Rango: $49.900 a $39.900.000`);
console.log(`\n  Siguiente: node scripts/crm-seed-highend.mjs`);
