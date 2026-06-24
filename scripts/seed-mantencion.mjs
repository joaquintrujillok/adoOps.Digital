// Inserta una incidencia de ejemplo para poblar el dashboard /mantencion sin API keys.
// Uso: node scripts/seed-mantencion.mjs
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
  "Hola, reporto una falla en la bomba de riego número 3 del sector poniente. " +
  "Se detuvo hace como media hora, está botando agua por la conexión y se siente un olor a quemado en el motor. " +
  "La dejé apagada porque estaba recalentando. El sector poniente quedó sin riego mientras tanto. " +
  "Creo que vamos a necesitar un sello mecánico nuevo y revisar el rodamiento. " +
  "Habría que mandar al técnico eléctrico hoy mismo a revisar el motor antes de volver a encenderla. " +
  "Avisé al jefe de turno. Soy Manuel del equipo de riego.";

const extraction = {
  identificacion: {
    equipo: "Bomba de riego N°3",
    codigoActivo: "BR-03",
    ubicacion: "Sector poniente",
    reportadoPor: "Manuel (equipo de riego)",
    fecha: null,
  },
  falla: {
    tipo: "Mecánica / eléctrica",
    descripcion: "Bomba detenida, fuga de agua en la conexión y olor a quemado en el motor por recalentamiento",
    severidad: "alta",
    estadoEquipo: "detenido",
  },
  sintomas: ["Fuga de agua en la conexión", "Olor a quemado en el motor", "Recalentamiento"],
  impacto: "Sector poniente sin riego",
  repuestos: ["Sello mecánico", "Rodamiento (a revisar)"],
  ordenesTrabajo: [
    {
      tarea: "Revisar motor antes de reencender",
      responsableSugerido: "Técnico eléctrico",
      prioridad: "alta",
      plazo: "Hoy",
      repuestos: "Sello mecánico",
    },
  ],
};

const [inc] = await sql`
  INSERT INTO incidencias
    (sender_phone, sender_name, source, transcript, equipo, codigo_activo, ubicacion,
     reportado_por, tipo_falla, severidad, estado_equipo, extraction, executive_summary,
     alertas, status)
  VALUES
    ('+56900000000', 'Manuel', 'audio', ${transcript}, 'Bomba de riego N°3', 'BR-03',
     'Sector poniente', 'Manuel (equipo de riego)', 'Mecánica / eléctrica', 'alta', 'detenido',
     ${JSON.stringify(extraction)},
     ${
       "Falla en la bomba de riego N°3 del sector poniente: se detuvo por recalentamiento, con fuga de " +
       "agua y olor a quemado en el motor. El sector quedó sin riego. Se requiere sello mecánico y revisar " +
       "el rodamiento; debe ir el técnico eléctrico hoy antes de reencender."
     },
     ${JSON.stringify(["Equipo detenido", "Sector poniente sin riego", "Riesgo de daño al motor"])},
     'pendiente')
  RETURNING id
`;

await sql`
  INSERT INTO ordenes_trabajo
    (incidencia_id, tarea, responsable_sugerido, prioridad, plazo, repuestos, estado)
  VALUES
    (${inc.id}, 'Revisar motor antes de reencender', 'Técnico eléctrico', 'alta', 'Hoy',
     'Sello mecánico', 'pendiente')
`;

console.log(`✓ Incidencia demo insertada (id ${inc.id}) con su orden de trabajo.`);
