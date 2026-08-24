// Puebla d360_mercado leyendo la nómina de empresas del SII.
//
// Se corre a mano cuando el SII publica la nómina nueva (una vez al año). No es
// un cron: el dato cambia una vez al año y un cron diario sobre 378 MB sería
// gastar por nada.
//
// Uso:
//   node scripts/d360-mercado.mjs [ruta-al-txt]
//
// Por defecto busca scripts/datos_sii/empresas/PUB_EMPRESAS_PJ_<año>.txt, que
// baja `fase0_sii.py perfilar --archivos empresas`.
//
// El archivo se lee en streaming: son 994.476 filas y cargarlo entero en
// memoria son varios GB para terminar guardando ~2.000 celdas agregadas.

import { createReadStream, existsSync, readdirSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { neon } from "@neondatabase/serverless";

const DIR = new URL("./datos_sii/empresas/", import.meta.url);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL no encontrada");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

/** El más reciente por el año del nombre, no por tamaño: no siempre coinciden. */
function archivoMasReciente() {
  if (process.argv[2]) return new URL(process.argv[2], `file://${process.cwd()}/`);
  if (!existsSync(DIR)) {
    console.error(
      "No encuentro scripts/datos_sii/empresas/.\n" +
        "Bájalo antes con:  python3 scripts/fase0_sii.py perfilar --archivos empresas",
    );
    process.exit(1);
  }
  const conAno = readdirSync(DIR)
    .filter((n) => n.endsWith(".txt"))
    .map((n) => [Number((n.match(/(20\d{2})/) || [])[1] ?? 0), n])
    .sort((a, b) => b[0] - a[0]);
  if (!conAno.length) {
    console.error("La carpeta no tiene .txt");
    process.exit(1);
  }
  return new URL(conAno[0][1], DIR);
}

// El SII escribe la región como "XIII REGION METROPOLITANA". El romano es
// siempre la primera palabra. Ver docs/layout-sii.md.
const ROMANOS = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16,
};

/**
 * Un vehículo de inversión no es una empresa a la que prospectar: no tiene
 * operación, no tiene trabajadores y no hay nadie a quien escribirle. En el
 * rubro financiero son el 78% del total.
 */
const ES_INVERSION = /FONDOS Y SOCIEDADES DE INVERSION|SOCIEDADES DE CARTERA/;

/** Bajo esto no hay una organización con la que trabajar, solo un RUT. */
const MIN_TRABAJADORES = 10;

const ruta = archivoMasReciente();
console.log(`leyendo ${ruta.pathname.split("/").pop()} ...`);

const rl = createInterface({
  input: createReadStream(ruta, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

// clave: ano|rubro|region|tramo
const celdas = new Map();
let filas = 0;
let cols = null;
let ix = {};

for await (const linea of rl) {
  const campos = linea.split("\t");

  if (cols === null) {
    cols = campos.map((c) => c.trim());
    const buscar = (frag) => cols.findIndex((c) => c.toUpperCase().includes(frag));
    ix = {
      ano: buscar("COMERCIAL"),
      tramo: buscar("TRAMO SEG"),
      trabajadores: buscar("TRABAJADORES"),
      rubro: buscar("RUBRO"),
      actividad: buscar("ACTIVIDAD ECON"),
      region: buscar("REGI"),
    };
    const faltan = Object.entries(ix).filter(([, i]) => i < 0).map(([k]) => k);
    if (faltan.length) {
      console.error(`No encontré las columnas: ${faltan.join(", ")}`);
      console.error(`Cabeceras reales: ${cols.join(" | ")}`);
      process.exit(1);
    }
    continue;
  }

  const ano = Number(campos[ix.ano]);
  if (!ano) continue;

  const rubro = (campos[ix.rubro] || "SIN RUBRO").trim().toUpperCase();
  const romano = (campos[ix.region] || "").trim().toUpperCase().split(/\s+/)[0];
  const region = ROMANOS[romano] ?? null;
  const tramo = Number(campos[ix.tramo]) || null;

  const actividad = (campos[ix.actividad] || "").toUpperCase();
  const trabajadores = Number(campos[ix.trabajadores]) || 0;
  const inversion = ES_INVERSION.test(actividad);

  const clave = `${ano}|${rubro}|${region}|${tramo}`;
  let c = celdas.get(clave);
  if (!c) {
    c = { ano, rubro, region, tramo, empresas: 0, operativas: 0, inversion: 0 };
    celdas.set(clave, c);
  }
  c.empresas++;
  if (inversion) c.inversion++;
  else if (trabajadores >= MIN_TRABAJADORES) c.operativas++;

  if (++filas % 200000 === 0) console.log(`  ${filas.toLocaleString("es-CL")} filas...`);
}

console.log(`${filas.toLocaleString("es-CL")} filas leídas -> ${celdas.size.toLocaleString("es-CL")} celdas`);

const sql = neon(loadDatabaseUrl());

// Se reemplaza el año completo en vez de hacer upsert celda por celda: si el
// SII deja de reportar una combinación, un upsert la dejaría ahí para siempre.
const anos = [...new Set([...celdas.values()].map((c) => c.ano))];
for (const ano of anos) {
  await sql`DELETE FROM d360_mercado WHERE ano_comercial = ${ano}`;
}

const filasAInsertar = [...celdas.values()];
const LOTE = 500;
for (let i = 0; i < filasAInsertar.length; i += LOTE) {
  const lote = filasAInsertar.slice(i, i + LOTE);
  const valores = lote
    .map(
      (c) =>
        `(${c.ano}, ${sqlLiteral(c.rubro)}, ${c.region ?? "NULL"}, ${c.tramo ?? "NULL"}, ${c.empresas}, ${c.operativas}, ${c.inversion}, 'sii')`,
    )
    .join(",");
  await sql.query(
    `INSERT INTO d360_mercado (ano_comercial, rubro, region, tramo, empresas, operativas, inversion, fuente) VALUES ${valores}`,
  );
  console.log(`  insertadas ${Math.min(i + LOTE, filasAInsertar.length)}/${filasAInsertar.length}`);
}

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const [{ n }] = await sql`SELECT count(*)::int n FROM d360_mercado`;
const [{ e }] = await sql`SELECT sum(empresas)::int e FROM d360_mercado`;
console.log(`\nd360_mercado: ${n} celdas · ${e.toLocaleString("es-CL")} empresas`);
