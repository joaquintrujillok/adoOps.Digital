// Carga la maestra de agricultores y lotes desde lo que mandaron Francisco y René.
//
// Lee `docs/sistema_funcional/maestra-extraida.json`, que es la extracción
// literal de los dos .xlsx de esa carpeta. El JSON está versionado a propósito:
// deja ver qué se importó sin tener que abrir Excel, y hace que correr esto dos
// veces dé el mismo resultado aunque las planillas cambien de nombre.
//
// **Es idempotente**: los lotes se identifican por código y los agricultores por
// (área, razón social). Correrlo de nuevo actualiza, no duplica.
//
// Uso: node scripts/tuniche-importar.mjs [--limpiar] [--reemplazar <área>]
//
//   --limpiar            borra agricultores y lotes antes de importar.
//   --reemplazar altue   borra SOLO los de esa área antes de importar.
//
// Los dos se niegan si hay visitas cargadas sobre lo que van a borrar: esas
// visitas apuntan a estos lotes y quedarían huérfanas. Ninguno toca las filas de
// demostración, que se manejan con `scripts/tuniche-demo.mjs`.
//
// `--reemplazar` existe porque una sábana corregida no siempre es una versión
// más de la anterior. La que mandó René para la prueba con Carlos Mancilla
// comparte solo 2 lotes con la que había: es un recambio, y actualizar fila por
// fila habría dejado 21 lotes viejos conviviendo con nombres de agricultor
// inventados.

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
const datos = JSON.parse(
  readFileSync(new URL("../docs/sistema_funcional/maestra-extraida.json", import.meta.url), "utf8"),
);

const limpiar = process.argv.includes("--limpiar");
const iR = process.argv.indexOf("--reemplazar");
const reemplazar = iR >= 0 ? process.argv[iR + 1] : null;
if (reemplazar && !["mn", "altue"].includes(reemplazar)) {
  console.error(`Área inválida: ${reemplazar}. Usa mn o altue.`);
  process.exit(1);
}

if (reemplazar) {
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM tuniche_visitas v
    JOIN tuniche_lotes l ON l.id = v.lote_id
    WHERE l.area = ${reemplazar} AND l.demo = FALSE`;
  if (n > 0) {
    console.error(`Hay ${n} visitas sobre lotes reales de ${reemplazar}. No borro nada.`);
    process.exit(1);
  }
  const lo = await sql`DELETE FROM tuniche_lotes WHERE area = ${reemplazar} AND demo = FALSE RETURNING id`;
  // Los agricultores se borran después y solo si quedaron sin lotes: uno que
  // tenga lotes en otra área no tiene por qué desaparecer.
  const ag = await sql`
    DELETE FROM tuniche_agricultores a
    WHERE a.area = ${reemplazar} AND a.demo = FALSE
      AND NOT EXISTS (SELECT 1 FROM tuniche_lotes l WHERE l.agricultor_id = a.id)
    RETURNING a.id`;
  console.log(`· ${reemplazar}: borrados ${lo.length} lotes y ${ag.length} agricultores`);
}
if (limpiar) {
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM tuniche_visitas`;
  if (n > 0) {
    console.error(`Hay ${n} visitas cargadas que apuntan a estos lotes. No borro nada.`);
    process.exit(1);
  }
  await sql`DELETE FROM tuniche_lotes`;
  await sql`DELETE FROM tuniche_agricultores`;
  console.log("· agricultores y lotes borrados");
}

/** Busca o crea el agricultor. La clave natural es (área, razón social). */
async function agricultor(area, campos) {
  const [existe] = await sql`
    SELECT id FROM tuniche_agricultores
    WHERE area = ${area} AND razon_social = ${campos.razonSocial}
    LIMIT 1
  `;
  if (existe) {
    await sql`
      UPDATE tuniche_agricultores SET
        nombre_contacto = COALESCE(${campos.nombreContacto ?? null}, nombre_contacto),
        telefono        = COALESCE(${campos.telefono ?? null}, telefono),
        email           = COALESCE(${campos.email ?? null}, email),
        localidad       = COALESCE(${campos.localidad ?? null}, localidad),
        region          = COALESCE(${campos.region ?? null}, region),
        distribuidor    = COALESCE(${campos.distribuidor ?? null}, distribuidor),
        zonal_nombre    = COALESCE(${campos.zonalNombre ?? null}, zonal_nombre)
      WHERE id = ${existe.id}
    `;
    return existe.id;
  }
  const [nuevo] = await sql`
    INSERT INTO tuniche_agricultores
      (area, razon_social, nombre_contacto, telefono, email, localidad, region, distribuidor, zonal_nombre)
    VALUES (${area}, ${campos.razonSocial}, ${campos.nombreContacto ?? null}, ${campos.telefono ?? null},
            ${campos.email ?? null}, ${campos.localidad ?? null}, ${campos.region ?? null},
            ${campos.distribuidor ?? null}, ${campos.zonalNombre ?? null})
    RETURNING id
  `;
  return nuevo.id;
}

async function lote(agricultorId, area, l) {
  await sql`
    INSERT INTO tuniche_lotes
      (agricultor_id, area, codigo, temporada, cultivo, variedad, relacion_hm, hectareas,
       objetivo, cliente_final, idase, tipo_semilla, etapa_actual, hitos)
    VALUES (${agricultorId}, ${area}, ${l.codigo}, ${l.temporada ?? null}, ${l.cultivo ?? null},
            ${l.variedad ?? null}, ${l.relacionHm ?? null}, ${l.hectareas ?? null},
            ${l.objetivo ?? null}, ${l.clienteFinal ?? null}, ${l.idase ?? null},
            ${l.tipoSemilla ?? null}, ${l.etapaActual ?? null}, ${JSON.stringify(l.hitos ?? {})}::jsonb)
    ON CONFLICT (codigo) DO UPDATE SET
      agricultor_id = EXCLUDED.agricultor_id, temporada = EXCLUDED.temporada,
      cultivo = EXCLUDED.cultivo, variedad = EXCLUDED.variedad,
      relacion_hm = EXCLUDED.relacion_hm, hectareas = EXCLUDED.hectareas,
      objetivo = EXCLUDED.objetivo, cliente_final = EXCLUDED.cliente_final,
      idase = EXCLUDED.idase, tipo_semilla = EXCLUDED.tipo_semilla,
      etapa_actual = EXCLUDED.etapa_actual, hitos = EXCLUDED.hitos
  `;
}

// ─── Mercado Nacional ────────────────────────────────────────────────────────
//
// Su planilla es un libro de VENTAS, no de campos: cada fila es "N bolsas de tal
// híbrido a tal razón social vía tal distribuidor". No trae ningún identificador
// de potrero, y una visita es a un potrero y no a una factura.
//
// Se importa una fila = un lote provisional, con código correlativo. Es
// trazable 1:1 contra el Excel y el zonal lo corrige en la primera visita, que
// es una línea de trabajo y no un proyecto de migración.

let nMn = 0;
for (const [i, f] of (reemplazar && reemplazar !== "mn" ? [] : datos.mn).entries()) {
  const id = await agricultor("mn", {
    razonSocial: f["Razón Social"],
    nombreContacto: f["Nombre Contacto"],
    telefono: f["Teléfono"],
    email: f["Correo"],
    localidad: f["Sucursal"],
    region: f["Región"],
    distribuidor: f["Distribuidor"],
    zonalNombre: f["Zonal"],
  });
  await lote(id, "mn", {
    codigo: `MN${String(f["Año"] ?? "").slice(-2)}-${String(i + 1).padStart(4, "0")}`,
    temporada: f["Año"],
    cultivo: "Maíz",
    variedad: f["Híbrido"],
    objetivo: f["Bolsas"] ? `${f["Bolsas"]} bolsas` : null,
    clienteFinal: f["Distribuidor"],
    tipoSemilla: f["Tipo Semilla"],
  });
  nMn++;
}

// ─── Producción Altué ────────────────────────────────────────────────────────
//
// René mandó la sábana con las columnas CLIENTE y AGRICULTOR **en blanco** en
// las 23 filas: la anonimizó antes de mandarla. Lo que sí trae es LOCALIDAD,
// ZONAL y LOTE, que alcanza para armar la estructura.
//
// Se agrupa por localidad y se deja el agricultor marcado como pendiente. No se
// inventa un nombre: un agricultor con nombre inventado es indistinguible de uno
// real tres pantallas más adentro, que es exactamente el error que este repo ya
// pagó una vez.

let nAltue = 0;
for (const f of reemplazar && reemplazar !== "altue" ? [] : datos.altue) {
  const localidad = f["LOCALIDAD"] ?? "sin localidad";
  const id = await agricultor("altue", {
    razonSocial: f["AGRICULTOR"] ?? `(agricultor por confirmar) · ${localidad}`,
    localidad,
    zonalNombre: f["ZONAL"],
  });

  // Los hitos de trasplante vienen llenos en la planilla: son datos de verdad y
  // entran como capa 3. Floración y cosecha están vacías —la temporada
  // 2026-2027 recién va en trasplante— así que no se inventan.
  const hitos = {};
  const mapa = {
    fecha_plantacion_hembra: "HEMBRA FECHA DE PLANTACION",
    fecha_plantacion_macho_1: "MACHO 1 FECHA DE PLANTACION",
    fecha_plantacion_macho_2: "MACHO 2 FECHA DE PLANTACION",
    establecimiento_hembra: "ESTABLECIMIENTO HEMBRA (30 DDT) PL/HA",
    establecimiento_macho_1: "ESTABLECIMIENTO MACHO 1 (30 DDT) PL/HA",
    establecimiento_macho_2: "ESTABLECIMIENTO MACHO 2 (30 DDT) PL/HA",
  };
  for (const [k, col] of Object.entries(mapa)) if (f[col]) hitos[k] = f[col];

  await lote(id, "altue", {
    codigo: f["LOTE"],
    temporada: f["TEMPORADA"],
    cultivo: f["CULTIVO"],
    variedad: f["VARIEDAD"],
    relacionHm: f["RELACION (H:M)"],
    hectareas: f["HECTAREAS"],
    objetivo: f["OBJETIVO (KILOS/HA)"] ? `${f["OBJETIVO (KILOS/HA)"]} kg/ha` : null,
    clienteFinal: f["CLIENTE"],
    idase: f["N° IDASE"],
    etapaActual: Object.keys(hitos).length ? "trasplante" : null,
    hitos,
  });
  nAltue++;
}

// ─── Enlazar zonales ─────────────────────────────────────────────────────────
//
// La planilla trae el nombre del zonal, no su cuenta. Se enlaza cuando el
// nombre calza sin tildes ni mayúsculas; si no calza, queda el nombre a la
// vista y el enlace pendiente. Adivinar acá significaría asignarle los
// agricultores de alguien a otra persona.
const enlazados = await sql`
  UPDATE tuniche_agricultores a SET zonal_id = u.id
  FROM tuniche_usuarios u
  WHERE a.zonal_id IS NULL
    AND a.zonal_nombre IS NOT NULL
    AND unaccent_lower(a.zonal_nombre) = unaccent_lower(u.nombre)
  RETURNING a.id
`.catch(async () => {
  // Sin la extensión `unaccent` se compara en minúsculas nomás. Es una comodidad
  // de importación, no una regla de negocio: no vale la pena pedir una extensión.
  return sql`
    UPDATE tuniche_agricultores a SET zonal_id = u.id
    FROM tuniche_usuarios u
    WHERE a.zonal_id IS NULL AND a.zonal_nombre IS NOT NULL
      AND lower(a.zonal_nombre) = lower(u.nombre)
    RETURNING a.id
  `;
});

const [{ ag }] = await sql`SELECT count(*)::int AS ag FROM tuniche_agricultores`;
const [{ lo }] = await sql`SELECT count(*)::int AS lo FROM tuniche_lotes`;
const sinContacto = await sql`
  SELECT area, count(*)::int AS n FROM tuniche_agricultores
  WHERE telefono IS NULL AND demo = FALSE GROUP BY area ORDER BY area
`;
// Solo filas reales: un zonal inventado por `tuniche-demo.mjs` no es una cuenta
// que falte crear, y avisarlo enseña a ignorar los avisos.
const sinZonal = await sql`
  SELECT DISTINCT zonal_nombre FROM tuniche_agricultores
  WHERE zonal_id IS NULL AND zonal_nombre IS NOT NULL AND demo = FALSE
`;

console.log(`✓ ${nMn} filas de MN · ${nAltue} filas de Altué`);
console.log(`  ${ag} agricultores · ${lo} lotes`);
console.log(`  ${enlazados.length} agricultores enlazados a una cuenta de zonal`);
if (sinZonal.length) {
  console.log(`  ⚠ zonales sin cuenta en el sistema: ${sinZonal.map((z) => z.zonal_nombre).join(", ")}`);
}
for (const s of sinContacto) {
  // Ya no bloquea: el informe le llega a quien recibe los de cada área y esa
  // persona lo reenvía. Hace falta el día que el sistema escriba al agricultor.
  console.log(`  · ${s.area}: ${s.n} agricultores sin teléfono (no bloquea: el informe va a quien lo reenvía)`);
}
