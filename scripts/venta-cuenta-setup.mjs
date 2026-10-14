// Agrega la columna `cuenta` al CRM del tablero y siembra la cartera de Demo.
//
// ── Por qué ──────────────────────────────────────────────────────────────────
//
// El CRM lo abren dos cuentas: adoOps (el pipeline real) y Demo (lo que se
// muestra en una reunión). Sin esta columna las dos veían las mismas filas, o
// sea que Demo mostraba clientes, montos y correos reales. Ver
// `lib/venta/cuenta.ts`.
//
// ── Qué hace ─────────────────────────────────────────────────────────────────
//
// 1. `ALTER TABLE … ADD COLUMN IF NOT EXISTS cuenta` en las tres tablas con
//    cara. Aditivo: todo lo que ya existe queda en `adoops`, que es el valor por
//    defecto, y el código desplegado antes de este cambio simplemente no la lee.
// 2. Siembra clientes FICTICIOS en la cartera `demo`: empresas, personas y
//    oportunidades repartidas en todas las etapas. Ningún nombre es de una
//    empresa o persona real, y los correos usan `.example`, un dominio reservado
//    que no entrega a nadie.
//
// Idempotente: la siembra no hace nada si la cartera `demo` ya tiene empresas.
// Para volver a sembrar, hay que borrar esas filas a mano primero.
//
// **Hay una sola base: esto corre contra producción.** Se corre ANTES del
// despliegue que lee la columna, no después.
//
// Uso: node scripts/venta-cuenta-setup.mjs

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

// ─── 1. La columna ───────────────────────────────────────────────────────────

await sql`ALTER TABLE venta_empresas      ADD COLUMN IF NOT EXISTS cuenta VARCHAR(20) NOT NULL DEFAULT 'adoops'`;
await sql`ALTER TABLE venta_contactos     ADD COLUMN IF NOT EXISTS cuenta VARCHAR(20) NOT NULL DEFAULT 'adoops'`;
await sql`ALTER TABLE venta_oportunidades ADD COLUMN IF NOT EXISTS cuenta VARCHAR(20) NOT NULL DEFAULT 'adoops'`;
console.log("columna cuenta lista en venta_empresas, venta_contactos y venta_oportunidades");

// ─── 2. La cartera de Demo ───────────────────────────────────────────────────

const [{ n }] = await sql`SELECT count(*)::int AS n FROM venta_empresas WHERE cuenta = 'demo'`;
if (n > 0) {
  console.log(`la cartera demo ya tiene ${n} empresas: no se siembra de nuevo`);
} else {
  // Ficticias a propósito y a la vista: «(ejemplo)» en el rubro no deja dudas a
  // quien abra la ficha. Días hacia atrás en vez de fechas fijas, para que la
  // demo no envejezca: `dias` es hace cuánto se tocó por última vez.
  const EMPRESAS = [
    { nombre: "Frigorífico Los Aromos", rubro: "Alimentos (ejemplo)", tamano: "201-500", ciudad: "Rancagua" },
    { nombre: "Clínica Dental Andina", rubro: "Salud (ejemplo)", tamano: "51-200", ciudad: "Santiago" },
    { nombre: "Transportes Cordillera Sur", rubro: "Logística (ejemplo)", tamano: "201-500", ciudad: "Concepción" },
    { nombre: "Ferretería El Roble", rubro: "Retail (ejemplo)", tamano: "51-200", ciudad: "Temuco" },
    { nombre: "Inmobiliaria Costa Norte", rubro: "Inmobiliario (ejemplo)", tamano: "11-50", ciudad: "La Serena" },
    { nombre: "Viña Quebrada Honda", rubro: "Vitivinícola (ejemplo)", tamano: "51-200", ciudad: "Curicó" },
    { nombre: "Colegio Altos del Maipo", rubro: "Educación (ejemplo)", tamano: "51-200", ciudad: "Santiago" },
    { nombre: "Seguros Pacífico Austral", rubro: "Seguros (ejemplo)", tamano: "501-1000", ciudad: "Santiago" },
  ];
  const PERSONAS = [
    { empresa: 0, nombre: "Marcela Fuentealba", cargo: "Gerenta de Operaciones", email: "marcela.fuentealba@losaromos.example" },
    { empresa: 1, nombre: "Rodrigo Sanhueza", cargo: "Director médico", email: "rodrigo.sanhueza@dentalandina.example" },
    { empresa: 2, nombre: "Carolina Inostroza", cargo: "Jefa de Tecnología", email: "carolina.inostroza@cordillerasur.example" },
    { empresa: 3, nombre: "Patricio Leiva", cargo: "Gerente Comercial", email: "patricio.leiva@elroble.example" },
    { empresa: 4, nombre: "Daniela Órdenes", cargo: "Gerenta de Ventas", email: "daniela.ordenes@costanorte.example" },
    { empresa: 5, nombre: "Felipe Arriagada", cargo: "Gerente General", email: "felipe.arriagada@quebradahonda.example" },
    { empresa: 6, nombre: "Ximena Poblete", cargo: "Directora de Administración", email: "ximena.poblete@altosdelmaipo.example" },
    { empresa: 7, nombre: "Gonzalo Riquelme", cargo: "Subgerente de Experiencia de Clientes", email: "gonzalo.riquelme@pacificoaustral.example" },
  ];
  const PROB = { nuevo: 5, contactado: 15, reunion: 35, propuesta: 55, negociacion: 75, ganado: 100, perdido: 0 };
  const OPORTUNIDADES = [
    { persona: 3, titulo: "Agente de cotizaciones por WhatsApp", etapa: "nuevo", monto: 9800000, fuente: "linkedin", dias: 2 },
    { persona: 6, titulo: "Asistente de admisión y matrículas", etapa: "nuevo", monto: 6400000, fuente: "web", dias: 1 },
    { persona: 4, titulo: "Calificación automática de visitas a pilotos", etapa: "contactado", monto: 12500000, fuente: "evento", dias: 6 },
    { persona: 1, titulo: "Agenda y recordatorios con IA", etapa: "reunion", monto: 8900000, fuente: "referido", dias: 3, cierre: 30 },
    { persona: 5, titulo: "Reporte de vendimia por audio", etapa: "reunion", monto: 15200000, fuente: "clases", dias: 16, cierre: 45 },
    { persona: 0, titulo: "Asistente documental de inocuidad", etapa: "propuesta", monto: 24600000, fuente: "clases", dias: 5, cierre: 20 },
    { persona: 2, titulo: "Agente de seguimiento de despachos", etapa: "propuesta", monto: 18300000, fuente: "motor", dias: 9, cierre: 25 },
    { persona: 7, titulo: "Agente de siniestros de primera línea", etapa: "negociacion", monto: 41500000, fuente: "referido", dias: 4, cierre: 15 },
    { persona: 0, titulo: "Programa de adopción para jefaturas", etapa: "ganado", monto: 13800000, fuente: "clases", dias: 38 },
    { persona: 7, titulo: "Assessment de madurez en IA", etapa: "ganado", monto: 7200000, fuente: "referido", dias: 61 },
    { persona: 3, titulo: "Tienda con retiro en sucursal", etapa: "perdido", monto: 21000000, fuente: "linkedin", dias: 27, motivo: "Eligieron seguir con su proveedor actual de e-commerce." },
    { persona: 4, titulo: "CRM con IA para la sala de ventas", etapa: "perdido", monto: 16700000, fuente: "evento", dias: 52, motivo: "El proyecto quedó sin presupuesto este año." },
  ];

  const empresaIds = [];
  for (const e of EMPRESAS) {
    const [f] = await sql`
      INSERT INTO venta_empresas (nombre, rubro, tamano, ciudad, cuenta)
      VALUES (${e.nombre}, ${e.rubro}, ${e.tamano}, ${e.ciudad}, 'demo') RETURNING id`;
    empresaIds.push(f.id);
  }
  const personaIds = [];
  for (const p of PERSONAS) {
    const [f] = await sql`
      INSERT INTO venta_contactos (nombre, cargo, email, empresa_id, cuenta)
      VALUES (${p.nombre}, ${p.cargo}, ${p.email}, ${empresaIds[p.empresa]}, 'demo') RETURNING id`;
    personaIds.push(f.id);
  }
  for (const o of OPORTUNIDADES) {
    const cerrada = o.etapa === "ganado" || o.etapa === "perdido";
    const empresaId = empresaIds[PERSONAS[o.persona].empresa];
    const [f] = await sql`
      INSERT INTO venta_oportunidades
        (titulo, contacto_id, empresa_id, etapa, monto, probabilidad, fuente, cierre_estimado,
         abierto_en, cerrado_en, motivo_perdida, ultima_actividad, cuenta)
      VALUES
        (${o.titulo}, ${personaIds[o.persona]}, ${empresaId}, ${o.etapa}, ${o.monto}, ${PROB[o.etapa]}, ${o.fuente},
         current_date + ${o.cierre ?? null}::int,
         now() - make_interval(days => ${o.dias + 20}::int),
         CASE WHEN ${cerrada}::boolean THEN now() - make_interval(days => ${o.dias}::int) END,
         ${o.motivo ?? null},
         now() - make_interval(days => ${o.dias}::int),
         'demo')
      RETURNING id`;
    await sql`
      INSERT INTO venta_actividades (oportunidad_id, contacto_id, tipo, detalle, autor, ocurrio_en)
      VALUES (${f.id}, ${personaIds[o.persona]}, 'nota', 'Oportunidad de ejemplo de la cartera Demo.', 'Datos de ejemplo',
              now() - make_interval(days => ${o.dias}::int))`;
  }
  console.log(`cartera demo sembrada: ${EMPRESAS.length} empresas, ${PERSONAS.length} personas, ${OPORTUNIDADES.length} oportunidades`);
}

console.table(await sql`
  SELECT cuenta, etapa, count(*)::int AS oportunidades, sum(monto)::bigint AS monto
  FROM venta_oportunidades GROUP BY cuenta, etapa ORDER BY cuenta, etapa`);
