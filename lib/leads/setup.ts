// Creación de las tablas del motor y su configuración mínima.
//
// Mismo razonamiento que `lib/dashboard360/demo.ts`, y por la misma razón: la
// cadena de Neon vive cifrada en Vercel y solo el runtime desplegado la tiene.
// Correr esto desde una terminal sin el `.env.local` original es imposible, así
// que se dispara con una llamada HTTP protegida.
//
// Todo es **aditivo e idempotente**. Las tablas llevan prefijo `lead_` y nada de
// lo que ya vive en la base —la web, TV Mix, el CRM, `d360_*`— se toca.
//
// ── Por qué hay ALTERs y no solo CREATEs ────────────────────────────────────
//
// `lead_acciones` pudo haberse creado antes de que existieran `persona_id`,
// `fecha_chile` y `motivo`. Los tres se agregan como nullable, se rellenan desde
// los datos que ya hay, y recién ahí se exige NOT NULL. Hacerlo al revés falla
// en cuanto la tabla tiene una fila.

import { sql } from "drizzle-orm";
import { db } from "@/db";

// ─── DDL ─────────────────────────────────────────────────────────────────────

const SENTENCIAS = [
  `CREATE TABLE IF NOT EXISTS lead_empresas (
    id SERIAL PRIMARY KEY,
    rut VARCHAR(12),
    razon_social VARCHAR(200) NOT NULL,
    acteco VARCHAR(6),
    rubro VARCHAR(160),
    tramo_ventas SMALLINT,
    tramo_ventas_ano SMALLINT,
    region SMALLINT,
    comuna VARCHAR(80),
    dominio VARCHAR(200),
    dominio_origen VARCHAR(20),
    dominio_obtenido_en TIMESTAMP,
    origen VARCHAR(20) NOT NULL,
    obtenido_en TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lead_empresas_rut_idx ON lead_empresas (rut)`,
  `CREATE INDEX IF NOT EXISTS lead_empresas_acteco_idx ON lead_empresas (acteco)`,
  `CREATE INDEX IF NOT EXISTS lead_empresas_region_idx ON lead_empresas (region)`,

  `CREATE TABLE IF NOT EXISTS lead_personas (
    id SERIAL PRIMARY KEY,
    member_urn VARCHAR(64),
    public_identifier VARCHAR(160),
    linkedin_origen VARCHAR(20),
    linkedin_obtenido_en TIMESTAMP,
    nombre VARCHAR(160) NOT NULL,
    cargo VARCHAR(200),
    empresa_id INTEGER,
    email VARCHAR(254),
    email_origen VARCHAR(20),
    email_obtenido_en TIMESTAMP,
    email_verificado BOOLEAN,
    telefono VARCHAR(20),
    telefono_origen VARCHAR(20),
    telefono_obtenido_en TIMESTAMP,
    es_open_profile BOOLEAN,
    network_distance SMALLINT,
    suprimido_en TIMESTAMP,
    suprimido_motivo VARCHAR(60),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lead_personas_urn_idx ON lead_personas (member_urn)`,
  `CREATE INDEX IF NOT EXISTS lead_personas_empresa_idx ON lead_personas (empresa_id)`,
  `CREATE INDEX IF NOT EXISTS lead_personas_email_idx ON lead_personas (email)`,
  `CREATE INDEX IF NOT EXISTS lead_personas_suprimido_idx ON lead_personas (suprimido_en)`,

  `CREATE TABLE IF NOT EXISTS lead_senales (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    resumen TEXT NOT NULL,
    evidencia_url VARCHAR(500),
    fecha_hecho TIMESTAMP NOT NULL,
    vence_en TIMESTAMP NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
    origen VARCHAR(20) NOT NULL,
    obtenido_en TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS lead_senales_empresa_idx ON lead_senales (empresa_id)`,
  `CREATE INDEX IF NOT EXISTS lead_senales_vence_idx ON lead_senales (vence_en)`,
  `CREATE INDEX IF NOT EXISTS lead_senales_estado_idx ON lead_senales (estado)`,

  `CREATE TABLE IF NOT EXISTS lead_campanas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(160) NOT NULL,
    icp JSONB,
    limites JSONB,
    canal_preferido VARCHAR(20),
    emisor_id INTEGER,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    simulado BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS lead_campanas_estado_idx ON lead_campanas (estado)`,

  `CREATE TABLE IF NOT EXISTS lead_secuencias (
    id SERIAL PRIMARY KEY,
    campana_id INTEGER NOT NULL,
    orden SMALLINT NOT NULL,
    espera_dias SMALLINT NOT NULL DEFAULT 0,
    canal VARCHAR(20) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    asunto VARCHAR(200),
    plantilla TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lead_secuencias_paso_idx ON lead_secuencias (campana_id, orden)`,

  `CREATE TABLE IF NOT EXISTS lead_inscripciones (
    id SERIAL PRIMARY KEY,
    persona_id INTEGER NOT NULL,
    campana_id INTEGER NOT NULL,
    senal_id INTEGER,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    paso_actual SMALLINT NOT NULL DEFAULT 0,
    proximo_paso_en TIMESTAMP,
    toques_totales SMALLINT NOT NULL DEFAULT 0,
    invitada_en TIMESTAMP,
    respondio_en TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lead_inscripciones_unica_idx ON lead_inscripciones (persona_id, campana_id)`,
  `CREATE INDEX IF NOT EXISTS lead_inscripciones_proximo_idx ON lead_inscripciones (proximo_paso_en)`,
  `CREATE INDEX IF NOT EXISTS lead_inscripciones_estado_idx ON lead_inscripciones (estado)`,

  `CREATE TABLE IF NOT EXISTS lead_acciones (
    id SERIAL PRIMARY KEY,
    inscripcion_id INTEGER NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    canal VARCHAR(20) NOT NULL,
    emisor_id INTEGER,
    programada_en TIMESTAMP NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    intentos SMALLINT NOT NULL DEFAULT 0,
    cuerpo TEXT,
    resultado TEXT,
    aprobada_por INTEGER,
    aprobada_en TIMESTAMP,
    ejecutada_en TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,

  // Los tres campos que la banda C necesita. Nullable primero: una tabla con
  // filas rechaza un NOT NULL de entrada.
  `ALTER TABLE lead_acciones ADD COLUMN IF NOT EXISTS persona_id INTEGER`,
  `ALTER TABLE lead_acciones ADD COLUMN IF NOT EXISTS fecha_chile DATE`,
  `ALTER TABLE lead_acciones ADD COLUMN IF NOT EXISTS motivo VARCHAR(60)`,

  // Relleno de lo que ya existía. `persona_id` sale de la inscripción, que es
  // de donde habría salido siempre.
  `UPDATE lead_acciones a
     SET persona_id = i.persona_id
     FROM lead_inscripciones i
    WHERE a.inscripcion_id = i.id AND a.persona_id IS NULL`,

  // Acá sí se usa `AT TIME ZONE` porque es un UPDATE, no un índice. Lo que
  // Postgres no acepta es indexar la expresión, no calcularla.
  `UPDATE lead_acciones
      SET fecha_chile = (programada_en AT TIME ZONE 'America/Santiago')::date
    WHERE fecha_chile IS NULL`,

  // El NOT NULL solo se aplica si el relleno dejó la tabla limpia. Una fila
  // huérfana —acción cuya inscripción se borró— no debe tumbar el setup.
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM lead_acciones WHERE persona_id IS NULL) THEN
       ALTER TABLE lead_acciones ALTER COLUMN persona_id SET NOT NULL;
     END IF;
     IF NOT EXISTS (SELECT 1 FROM lead_acciones WHERE fecha_chile IS NULL) THEN
       ALTER TABLE lead_acciones ALTER COLUMN fecha_chile SET NOT NULL;
     END IF;
   END $$`,

  `CREATE INDEX IF NOT EXISTS lead_acciones_cola_idx ON lead_acciones (estado, programada_en)`,
  `CREATE INDEX IF NOT EXISTS lead_acciones_inscripcion_idx ON lead_acciones (inscripcion_id)`,
  `CREATE INDEX IF NOT EXISTS lead_acciones_dia_idx ON lead_acciones (fecha_chile, estado)`,

  // Un toque por persona y por día, sumando canales. Parcial a propósito: una
  // acción frenada no debe ocupar el cupo del día de esa persona.
  `CREATE UNIQUE INDEX IF NOT EXISTS lead_acciones_un_toque_dia_idx
     ON lead_acciones (persona_id, fecha_chile)
     WHERE estado IN ('pendiente', 'aprobada', 'enviada')`,

  `CREATE TABLE IF NOT EXISTS lead_mensajes (
    id SERIAL PRIMARY KEY,
    persona_id INTEGER NOT NULL,
    inscripcion_id INTEGER,
    accion_id INTEGER,
    emisor_id INTEGER,
    canal VARCHAR(20) NOT NULL,
    direccion VARCHAR(10) NOT NULL,
    cuerpo TEXT NOT NULL,
    enviado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    external_id VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS lead_mensajes_external_idx ON lead_mensajes (canal, external_id)`,
  `CREATE INDEX IF NOT EXISTS lead_mensajes_persona_idx ON lead_mensajes (persona_id)`,
  `CREATE INDEX IF NOT EXISTS lead_mensajes_enviado_idx ON lead_mensajes (enviado_en)`,

  `CREATE TABLE IF NOT EXISTS lead_emisores (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,
    identificador VARCHAR(200) NOT NULL,
    unipile_account_id VARCHAR(120),
    cuota_diaria SMALLINT NOT NULL DEFAULT 5,
    dia_warmup SMALLINT NOT NULL DEFAULT 1,
    ventana_inicio SMALLINT NOT NULL DEFAULT 9,
    ventana_fin SMALLINT NOT NULL DEFAULT 19,
    ip VARCHAR(45),
    tasa_aceptacion_7d SMALLINT,
    estado VARCHAR(20) NOT NULL DEFAULT 'warmup',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS lead_emisores_estado_idx ON lead_emisores (estado)`,

  // Interruptor general y cualquier otro ajuste operativo. Dos columnas, en la
  // base y no en una variable de entorno: apagar el motor no puede depender de
  // esperar un despliegue.
  `CREATE TABLE IF NOT EXISTS lead_config (
    clave VARCHAR(60) PRIMARY KEY,
    valor TEXT NOT NULL,
    actualizado_en TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  // Nace apagado, explícitamente. La ausencia de la fila también significa
  // apagado, pero dejarla escrita hace que el panel muestre un estado y no un
  // hueco el primer día.
  `INSERT INTO lead_config (clave, valor)
        VALUES ('motor.encendido', 'false')
   ON CONFLICT (clave) DO NOTHING`,
];

export async function crearTablas(): Promise<number> {
  for (const s of SENTENCIAS) await db.execute(sql.raw(s));
  return SENTENCIAS.length;
}

// ─── Configuración mínima ────────────────────────────────────────────────────
//
// Se siembra la CONFIGURACIÓN —un emisor y una campaña con su secuencia—, nunca
// personas ni empresas de mentira.
//
// La diferencia importa: en un tablero de métricas un dato ficticio es una barra
// que se ve linda en una reunión. Acá una persona ficticia es alguien a quien el
// motor puede intentar escribirle. Los prospectos entran solo por CSV, que ya
// funciona y trae la procedencia de cada campo.

/** Warm-up: la semana 1 son 5 invitaciones al día. No se arranca más arriba. */
const PLANTILLA_INVITACION =
  "Hola {{nombre}}, vi que {{empresa}} {{senal}}. Trabajo con equipos comerciales " +
  "en ese escenario y quería conectar. Sin pitch: si no es el momento, te dejo tranquilo.";

const PLANTILLA_MENSAJE_1 =
  "Gracias por conectar, {{nombre}}. Te escribí por {{senal}} — es el tipo de " +
  "momento en que se nota si el equipo comercial tiene o no dónde apoyarse. " +
  "¿Cómo lo están viendo ustedes?";

const PLANTILLA_MENSAJE_2 =
  "{{nombre}}, sin pedirte nada: medimos que en Chile las empresas del rubro que " +
  "aparecen en ChileCompra reciben en promedio tres cotizaciones por licitación. " +
  "Si te sirve el dato completo te lo mando.";

const PLANTILLA_MENSAJE_3 =
  "Una sola pregunta, {{nombre}}: ¿quién está viendo hoy la prospección en " +
  "{{empresa}}?";

const PLANTILLA_CIERRE =
  "{{nombre}}, te dejo tranquilo. Si más adelante tiene sentido conversarlo, " +
  "acá estoy. Que te vaya bien.";

export interface ResultadoSetup {
  sentencias: number;
  emisorCreado: boolean;
  campanaCreada: boolean;
}

export async function sembrarConfiguracion(opciones: {
  emisor?: string;
}): Promise<Omit<ResultadoSetup, "sentencias">> {
  const identificador = opciones.emisor ?? "linkedin-adops";

  const emisores = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM lead_emisores`,
  );
  const hayEmisor = (emisores.rows[0]?.n ?? 0) > 0;

  if (!hayEmisor) {
    await db.execute(sql`
      INSERT INTO lead_emisores
        (tipo, identificador, cuota_diaria, dia_warmup, ventana_inicio, ventana_fin, estado)
      VALUES ('linkedin', ${identificador}, 5, 1, 9, 18, 'warmup')
    `);
  }

  const campanas = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM lead_campanas`,
  );
  const hayCampana = (campanas.rows[0]?.n ?? 0) > 0;

  if (!hayCampana) {
    // `simulado: true` es el default del esquema y acá se hace explícito: la
    // campaña nace sin poder tocar la red aunque alguien conecte una cuenta.
    const creada = await db.execute<{ id: number }>(sql`
      INSERT INTO lead_campanas (nombre, canal_preferido, estado, simulado)
      VALUES ('Primera campaña', 'linkedin', 'borrador', TRUE)
      RETURNING id
    `);
    const campanaId = creada.rows[0].id;

    const pasos: Array<[number, number, string, string, string | null, string]> = [
      [1, 0, "linkedin", "invitacion", null, PLANTILLA_INVITACION],
      [2, 2, "linkedin", "mensaje", null, PLANTILLA_MENSAJE_1],
      [3, 4, "linkedin", "mensaje", null, PLANTILLA_MENSAJE_2],
      [4, 7, "linkedin", "mensaje", null, PLANTILLA_MENSAJE_3],
      [5, 8, "linkedin", "mensaje", null, PLANTILLA_CIERRE],
    ];

    for (const [orden, espera, canal, tipo, asunto, plantilla] of pasos) {
      await db.execute(sql`
        INSERT INTO lead_secuencias (campana_id, orden, espera_dias, canal, tipo, asunto, plantilla)
        VALUES (${campanaId}, ${orden}, ${espera}, ${canal}, ${tipo}, ${asunto}, ${plantilla})
      `);
    }
  }

  return { emisorCreado: !hayEmisor, campanaCreada: !hayCampana };
}
