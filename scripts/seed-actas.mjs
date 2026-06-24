// Inserta un acta de ejemplo para poblar el dashboard /actas sin necesitar API keys.
// Uso: node scripts/seed-actas.mjs
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());

const transcript =
  "Hola, te dejo el resumen de la reunión de coordinación de operaciones de hoy martes. " +
  "Participamos Carolina de operaciones, Felipe de logística, yo y se conectó por Meet don Rodrigo. " +
  "Vimos tres temas: el avance del plan de la temporada, el quiebre de stock de insumos y la dotación para la próxima semana. " +
  "Acordamos adelantar la compra de insumos críticos y que logística va a consolidar los pedidos en una sola orden. " +
  "Quedó Felipe de enviar la cotización actualizada el jueves y Carolina de revisar la dotación y confirmar el viernes. " +
  "Hay un riesgo con los plazos de entrega del proveedor principal, así que se decidió evaluar un proveedor alternativo. " +
  "La próxima reunión queda para el lunes a las 9.";

const extraction = {
  reunion: {
    titulo: "Coordinación de operaciones",
    fecha: "Martes",
    lugar: "Sala de reuniones + Meet",
    participantes: ["Carolina (Operaciones)", "Felipe (Logística)", "Rodrigo"],
    duracion: null,
  },
  temas: [
    "Avance del plan de la temporada",
    "Quiebre de stock de insumos",
    "Dotación para la próxima semana",
  ],
  decisiones: [
    "Adelantar la compra de insumos críticos",
    "Consolidar los pedidos en una sola orden (logística)",
    "Evaluar un proveedor alternativo por riesgo de plazos",
  ],
  compromisos: [
    { compromiso: "Enviar la cotización actualizada", responsable: "Felipe", prioridad: "alta", plazo: "Jueves" },
    { compromiso: "Revisar la dotación y confirmar", responsable: "Carolina", prioridad: "media", plazo: "Viernes" },
  ],
  riesgos: ["Plazos de entrega del proveedor principal"],
  proximaReunion: "Lunes a las 9:00",
};

const [acta] = await sql`
  INSERT INTO acta_reports
    (sender_phone, sender_name, source, transcript, titulo, fecha, lugar,
     participantes, extraction, executive_summary, decisiones, status)
  VALUES
    ('+56900000000', 'Operaciones', 'audio', ${transcript}, 'Coordinación de operaciones',
     'Martes', 'Sala de reuniones + Meet',
     ${JSON.stringify(extraction.reunion.participantes)},
     ${JSON.stringify(extraction)},
     ${
       "Reunión de coordinación de operaciones donde se revisó el avance de la temporada, el quiebre " +
       "de stock de insumos y la dotación de la próxima semana. Se decidió adelantar compras críticas, " +
       "consolidar pedidos y evaluar un proveedor alternativo por riesgo de plazos. Próxima reunión el lunes."
     },
     ${JSON.stringify(extraction.decisiones)}, 'pendiente')
  RETURNING id
`;

await sql`
  INSERT INTO compromisos (acta_id, compromiso, responsable, prioridad, plazo, estado)
  VALUES
    (${acta.id}, 'Enviar la cotización actualizada', 'Felipe', 'alta', 'Jueves', 'pendiente'),
    (${acta.id}, 'Revisar la dotación y confirmar', 'Carolina', 'media', 'Viernes', 'pendiente')
`;

console.log(`✓ Acta demo insertada (id ${acta.id}) con sus compromisos.`);
