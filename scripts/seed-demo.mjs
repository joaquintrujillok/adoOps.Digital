// Inserta el reporte de ejemplo del documento de campo (Santa Elvira) para
// poblar el dashboard /terreno sin necesitar API keys.
// Uso: node scripts/seed-demo.mjs
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
  "Hola, reporte de terreno de hoy para el campo Santa Elvira, sector norte, cuarteles 4 y 5. " +
  "Estuvo a cargo Pedro Muñoz con una cuadrilla de seis personas. Se revisaron 18 hectáreas durante " +
  "la mañana y se completó cerca del 80% del trabajo planificado. En el cuartel 4 no hubo observaciones " +
  "relevantes, pero en el cuartel 5 encontramos baja actividad en dos zonas y falta revisar nuevamente " +
  "mañana temprano. También hubo retraso porque el acceso al sector estaba complicado por barro. " +
  "Se tomaron cuatro fotos como evidencia. Para mañana se recomienda enviar la misma cuadrilla, sumar " +
  "una persona más y priorizar el sector 5 antes de las 10 de la mañana. Queda pendiente avisar al " +
  "cliente y generar hoja de trabajo para seguimiento.";

const extraction = {
  identificacion: {
    cliente: "Santa Elvira",
    sector: "Norte",
    cuarteles: ["4", "5"],
    fecha: null,
    responsable: "Pedro Muñoz",
    equipo: "Cuadrilla de 6 personas",
  },
  actividad: {
    tipoTrabajo: "Revisión de cuarteles",
    avancePct: 80,
    unidadesRevisadas: "18 hectáreas",
    estadoTarea: "en_curso",
  },
  hallazgos: [
    "Cuartel 4 sin observaciones relevantes",
    "Cuartel 5 con baja actividad en dos zonas",
    "Retraso por acceso complicado por barro",
  ],
  recursos: {
    personas: 6,
    horas: null,
    equiposMateriales: [],
    insumos: [],
  },
  evidencias: { fotos: 4, pendientes: ["Avisar al cliente"], ubicacion: "Sector norte" },
  proximasAcciones: [
    "Revisar nuevamente cuartel 5 mañana temprano",
    "Enviar la misma cuadrilla + 1 persona",
    "Avisar al cliente",
    "Generar hoja de trabajo de seguimiento",
  ],
};

const [report] = await sql`
  INSERT INTO field_reports
    (sender_phone, sender_name, source, transcript, cliente, sector, cuarteles,
     responsable, equipo_personas, avance_pct, hectareas, estado_tarea,
     extraction, executive_summary, incidencias, status)
  VALUES
    ('+56900000000', 'Pedro Muñoz', 'audio', ${transcript}, 'Santa Elvira', 'Norte', '4, 5',
     'Pedro Muñoz', 6, 80, 18, 'en_curso',
     ${JSON.stringify(extraction)}, ${
       "Se completó el 80% del trabajo planificado en los cuarteles 4 y 5 del campo Santa Elvira. " +
       "No se observaron problemas relevantes en el cuartel 4. En el cuartel 5 se detectaron zonas con " +
       "baja actividad y se recomienda una nueva revisión durante la mañana. Se requiere generar hoja de " +
       "trabajo de seguimiento y notificar al cliente."
     },
     ${JSON.stringify(["Baja actividad en cuartel 5", "Acceso con barro"])}, 'pendiente')
  RETURNING id
`;

await sql`
  INSERT INTO work_sheets
    (report_id, tarea, responsable_sugerido, prioridad, plazo, recursos, evidencia_requerida, estado)
  VALUES
    (${report.id}, 'Revisar cuartel 5', 'Supervisor de terreno', 'alta',
     'Mañana antes de las 10:00', 'Misma cuadrilla + 1 persona adicional',
     'Fotos posteriores', 'pendiente')
`;

console.log(`✓ Reporte demo insertado (id ${report.id}) con su hoja de trabajo.`);
