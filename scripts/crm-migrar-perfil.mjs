// Migración del perfil: lo que se sabe de cada persona, y cómo se supo.
//
// Idempotente y aditiva: solo agrega tablas y columnas. No borra ni renombra.
//
// **Por qué una tabla de atributos y no columnas en crm_contacts.**
//
// La tentación era agregar `tiene_parlantes`, `formato_preferido`, `presupuesto`
// y seguir. Tres razones por las que no:
//
//   1. **Hace falta saber cuánto se confía en cada dato.** Que el punto de venta
//      diga que tiene un Accuphase es un hecho: hay factura. Que el vendedor
//      anote que "creo que tiene unos Harbeth" es una corazonada útil pero no es
//      lo mismo, y tratarlas igual hace que el CRM afirme cosas que no sabe.
//   2. **Hace falta saber cuándo se supo.** "Escucha principalmente vinilo" es
//      cierto hasta que la persona compra un streamer. Un dato sin fecha no se
//      puede envejecer.
//   3. **Los atributos van a crecer.** Cada conversación con el negocio agrega
//      cosas que valía la pena preguntar y nadie anticipó. Con columnas, cada
//      una es una migración; acá es una fila en el catálogo de preguntas.
//
// Uso: node scripts/crm-migrar-perfil.mjs

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

const SENTENCIAS = [
  // ── Lo que se sabe de cada persona ──
  //
  // `estado` es el corazón de esta tabla y la corrección más importante del
  // modelo anterior. Antes, un cliente que no había comprado parlantes
  // aparecía como "le faltan parlantes". Es falso: puede tenerlos hace diez
  // años, comprados en otra parte. Son tres cosas distintas:
  //
  //   conocido   se sabe qué tiene, y está en `valor`
  //   sin_dato   no se sabe. Es una pregunta pendiente, no una carencia
  //   no_tiene   se preguntó y confirmó que no lo tiene. ESO sí es oportunidad
  //
  // Vender contra "sin_dato" es ofrecerle parlantes a alguien que ya los tiene,
  // que es la forma más rápida de que el cliente concluya que no lo conocen.
  `CREATE TABLE IF NOT EXISTS crm_perfil_atributos (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER NOT NULL,
    clave VARCHAR(60) NOT NULL,
    valor TEXT,
    /** conocido | sin_dato | no_tiene */
    estado VARCHAR(12) NOT NULL DEFAULT 'conocido',
    /**
     * Qué tan firme es el dato, de 1 a 3:
     *   3  hay documento: una venta, una cotización firmada
     *   2  lo dijo la persona y alguien lo escribió
     *   1  lo dedujo el sistema o lo recuerda el vendedor
     */
    confianza SMALLINT NOT NULL DEFAULT 2,
    /** venta | audicion | cotizacion | conversacion | vendedor | inferido */
    origen VARCHAR(20) NOT NULL DEFAULT 'vendedor',
    /** El id de la venta, audición o cotización de donde salió, si aplica. */
    origen_id INTEGER,
    registrado_por INTEGER,
    registrado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    /**
     * Hasta cuándo vale. Algunos datos caducan: un presupuesto declarado hace
     * dos años no es un presupuesto. NULL = no caduca.
     */
    vigente_hasta TIMESTAMP
  )`,
  // Un atributo por contacto y clave: al volver a saber lo mismo se actualiza
  // la fila, no se apila otra. El historial de cómo cambió vive en la
  // conversación, no acá — si no, la ficha se convierte en un log.
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_perfil_atributo_idx
     ON crm_perfil_atributos (contact_id, clave)`,
  `CREATE INDEX IF NOT EXISTS crm_perfil_clave_idx ON crm_perfil_atributos (clave)`,
  `CREATE INDEX IF NOT EXISTS crm_perfil_estado_idx ON crm_perfil_atributos (estado)`,

  // ── Las salas del showroom ──
  //
  // Son cinco y tienen nombre propio. Cuál sala se usó es un dato de venta, no
  // de logística: quien pidió la Sala Reference y se quedó dos horas está en
  // otra conversación que quien pasó por Lifestyle.
  `CREATE TABLE IF NOT EXISTS crm_salas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    descripcion TEXT,
    capacidad_min SMALLINT NOT NULL DEFAULT 1,
    capacidad_max SMALLINT NOT NULL DEFAULT 4,
    /** Qué tan arriba del catálogo está el equipo montado, de 1 a 5. */
    nivel SMALLINT NOT NULL DEFAULT 3,
    orden SMALLINT NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS crm_salas_nombre_idx ON crm_salas (nombre)`,

  // ── La audición ──
  //
  // Lo más valioso que pasa en el negocio y lo único que hoy no deja rastro.
  // Vive aparte de `crm_showroom_visitas` porque son cosas distintas: la visita
  // es que alguien entró; la audición es que se sentó dos horas a escuchar un
  // sistema concreto en una sala concreta. Una visita puede no tener audición, y
  // un cliente de años puede venir a una audición sin ser "una visita nueva".
  `CREATE TABLE IF NOT EXISTS crm_audiciones (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER,
    visita_id INTEGER,
    sala_id INTEGER,
    /** Con cita previa o pasó y había sala libre. Cambia cómo se lee el interés. */
    con_cita BOOLEAN NOT NULL DEFAULT TRUE,
    fecha TIMESTAMP NOT NULL DEFAULT NOW(),
    duracion_minutos SMALLINT,
    acompanantes SMALLINT NOT NULL DEFAULT 0,
    /** Qué equipo estaba montado. Ids de crm_products, como JSON. */
    equipo_escuchado TEXT,
    /** En sus palabras. Es lo que sirve para volver a llamarlo con argumento. */
    que_dijo TEXT,
    /** Qué le gustó y qué descartó, separados: descartar es tan útil como gustar. */
    le_gusto TEXT,
    descarto TEXT,
    /** Lo que mencionó, si lo mencionó. Nunca se pregunta de frente. */
    presupuesto_mencionado INTEGER,
    atendido_por INTEGER,
    /** Qué hacer después, decidido por quien atendió mientras lo tiene fresco. */
    proximo_paso TEXT,
    proximo_paso_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS crm_audiciones_contacto_idx ON crm_audiciones (contact_id)`,
  `CREATE INDEX IF NOT EXISTS crm_audiciones_fecha_idx ON crm_audiciones (fecha)`,
  `CREATE INDEX IF NOT EXISTS crm_audiciones_sala_idx ON crm_audiciones (sala_id)`,

  // La visita puede terminar en audición; se enlazan sin obligarse.
  `ALTER TABLE crm_showroom_visitas ADD COLUMN IF NOT EXISTS con_cita BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE crm_showroom_visitas ADD COLUMN IF NOT EXISTS sala_id INTEGER`,
];

for (const sentencia of SENTENCIAS) {
  await sql.query(sentencia);
}

// ── Las cinco salas reales ──
const SALAS = [
  ["Hi-Fi", "Equipos de entrada al mundo de la alta fidelidad.", 1, 2, 2, 1],
  ["Lifestyle", "Sistemas integrados y de diseño, para living.", 1, 3, 2, 2],
  ["Highend", "El escalón donde empieza la conversación seria.", 1, 4, 4, 3],
  ["Reference", "El sistema de referencia. Dos horas y con cita.", 1, 4, 5, 4],
  ["Cine", "Sala de cine en casa, procesador y multicanal.", 1, 4, 4, 5],
];

for (const [nombre, descripcion, min, max, nivel, orden] of SALAS) {
  await sql`
    INSERT INTO crm_salas (nombre, descripcion, capacidad_min, capacidad_max, nivel, orden, activa)
    VALUES (${nombre}, ${descripcion}, ${min}, ${max}, ${nivel}, ${orden}, TRUE)
    ON CONFLICT (nombre) DO UPDATE
      SET descripcion = EXCLUDED.descripcion,
          capacidad_min = EXCLUDED.capacidad_min,
          capacidad_max = EXCLUDED.capacidad_max,
          nivel = EXCLUDED.nivel,
          orden = EXCLUDED.orden
  `;
}

console.log("✓ Migración del perfil aplicada");
console.log("  crm_perfil_atributos · crm_salas (5) · crm_audiciones");
console.log("  crm_showroom_visitas: con_cita, sala_id");
