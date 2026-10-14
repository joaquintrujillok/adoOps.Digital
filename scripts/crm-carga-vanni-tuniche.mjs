// Carga única: las oportunidades de Vanni y Tuniche en el CRM de adoOps
// (/dashboard360/crm), con su empresa y su persona de contacto.
//
// Los montos salen de las propuestas de octubre de 2026 y son solo los pagos
// únicos: la mensualidad y el consumo no entran, porque el CRM guarda un número
// por oportunidad y esos dependen de cuánto dure el servicio.
//
//   Vanni    361,7 UF = $14.851.575 (piloto 31,7 UF + pickup en 41 sucursales
//            330 UF; UF del 01-10-2026, $41.065,38). Aparte: plataforma 28 UF al
//            mes más consumo.
//   Tuniche  117,6 UF = $4.809.109 (implementación de la opción A, servicio
//            mensual; UF del 10-09-2026, $40.893,78). Aparte: 4,9 UF por área al
//            mes.
//
// Entraron como perdidas; Vanni se corrigió después a "Propuesta enviada" (se
// había cargado mal). Idempotente: se puede correr dos veces sin duplicar
// (la persona se busca por correo y la oportunidad por título y persona).
//
// Uso: node scripts/crm-carga-vanni-tuniche.mjs

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

const CARGA = [
  {
    empresa: "Vanni Chile",
    persona: { nombre: "Boris Valenzuela", email: "bvalenzuela@vannichile.cl" },
    titulo: "Agente comercial por WhatsApp",
    monto: 14851575,
    fuente: "referido",
    nota:
      "Propuesta comercial de octubre de 2026. Pagos únicos: 361,7 UF ($14.851.575) — piloto 31,7 UF " +
      "e implementación del pickup en 41 sucursales 330 UF. Aparte: plataforma 28 UF al mes más consumo.",
  },
  {
    empresa: "Semillas Tuniche",
    persona: { nombre: "Benjamin Álamos", email: "balamos@tuniche.cl" },
    titulo: "Sistema de visitas a campo",
    monto: 4809109,
    fuente: "clases",
    nota:
      "Propuesta de octubre de 2026, opción A (servicio mensual). Implementación: 117,6 UF ($4.809.109). " +
      "Aparte: 4,9 UF por área al mes (9,8 UF por las dos áreas).",
  },
];

for (const c of CARGA) {
  let [empresa] = await sql`SELECT id FROM venta_empresas WHERE lower(nombre) = lower(${c.empresa}) LIMIT 1`;
  if (!empresa) [empresa] = await sql`INSERT INTO venta_empresas (nombre) VALUES (${c.empresa}) RETURNING id`;

  let [persona] = await sql`SELECT id FROM venta_contactos WHERE lower(email) = lower(${c.persona.email}) LIMIT 1`;
  if (!persona) {
    [persona] = await sql`
      INSERT INTO venta_contactos (nombre, email, empresa_id)
      VALUES (${c.persona.nombre}, ${c.persona.email}, ${empresa.id})
      RETURNING id`;
  }

  const [ya] = await sql`
    SELECT id FROM venta_oportunidades WHERE contacto_id = ${persona.id} AND titulo = ${c.titulo} LIMIT 1`;
  if (ya) {
    console.log(`= ${c.empresa}: la oportunidad #${ya.id} ya existía, no se toca`);
    continue;
  }

  const [op] = await sql`
    INSERT INTO venta_oportunidades
      (titulo, contacto_id, empresa_id, etapa, monto, probabilidad, fuente, cerrado_en, ultima_actividad)
    VALUES
      (${c.titulo}, ${persona.id}, ${empresa.id}, 'perdido', ${c.monto}, 0, ${c.fuente}, now(), now())
    RETURNING id`;
  await sql`
    INSERT INTO venta_actividades (oportunidad_id, contacto_id, tipo, detalle, autor)
    VALUES (${op.id}, ${persona.id}, 'nota', ${"Oportunidad cargada como perdida. " + c.nota}, 'Carga desde las propuestas')`;
  console.log(`+ ${c.empresa}: empresa #${empresa.id}, persona #${persona.id}, oportunidad #${op.id}`);
}

const filas = await sql`
  SELECT o.id, o.titulo, o.etapa, o.monto, o.probabilidad, o.fuente, c.nombre AS persona, c.email, e.nombre AS empresa
  FROM venta_oportunidades o
  JOIN venta_contactos c ON c.id = o.contacto_id
  LEFT JOIN venta_empresas e ON e.id = o.empresa_id
  ORDER BY o.id`;
console.table(filas);
