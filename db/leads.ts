// =============================================================================
// Motor de nurturing adoOps — esquema (/leads)
// =============================================================================
//
// Diez tablas con prefijo `lead_`. Ojo: la web corporativa ya tiene una tabla
// `leads` (el formulario de contacto) en db/schema.ts. Son cosas distintas y no
// se tocan — por eso acá nada se llama `leads` a secas, ni la tabla ni el tipo.
//
// Lo que este esquema NO es: una base de contactos. Es una máquina de estados.
// El estado de cada prospecto vive en `lead_inscripciones` y avanza solo, desde
// la cola de `lead_acciones`. Todo lo demás alimenta esa decisión.
//
// ── Las tres invariantes que no se negocian ──────────────────────────────────
//
// 1. PROCEDENCIA POR CAMPO. Cada email, teléfono y perfil guarda de qué fuente
//    vino y en qué fecha. No es burocracia: es lo único que permite contestar
//    "¿de dónde saqué este correo?" el día que alguien lo pregunte. Agregarlo
//    ahora cuesta cero; retro-adaptarlo con 20.000 registros adentro es
//    carísimo. Va en el primer CREATE TABLE, no en el segundo.
//
// 2. `memberUrn` DEDUPLICA, EL SLUG NUNCA. El identificador estable de una
//    persona en LinkedIn es `ACoAA...`. El slug `/in/juan-perez` lo cambia el
//    usuario cuando quiere: si deduplicas por slug, alguien edita su URL y el
//    sistema le manda la secuencia entera de nuevo. `publicIdentifier` se
//    guarda solo para construir la URL, y jamás se compara.
//
// 3. LAS SEÑALES VENCEN. `lead_senales` tiene `venceEn` obligatorio. Un panel
//    que solo crece es otra bandeja que nadie mira, y una señal de hace ocho
//    meses no es una señal: es ruido con fecha.
//
// ── Convenciones heredadas del CRM ───────────────────────────────────────────
//
// Enteros, nunca `numeric`: en Drizzle vuelve como string y obliga a parsear en
// cada suma. Las tasas se guardan como porcentaje entero (0–100), no como
// fracción. Una sola organización, sin `org_id`.

import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Vocabulario compartido ──────────────────────────────────────────────────

/**
 * De dónde salió un dato. Se guarda por campo, no por registro: el nombre puede
 * venir del SII y el email de Prospeo, y esos dos hechos tienen fechas distintas.
 */
export type LeadOrigen =
  | "sii"
  | "chilecompra"
  | "prospeo"
  | "fullenrich"
  | "linkedin"
  | "csv"
  | "manual";

/** Los tres canales son salidas del mismo motor, no módulos separados. */
export type LeadCanal = "linkedin" | "email" | "whatsapp";

// ─── Empresas ────────────────────────────────────────────────────────────────

/**
 * La empresa. Se deduplica por RUT normalizado a `12345678-9`.
 *
 * El RUT es `unique` pero acepta null a propósito: Postgres permite varios NULL
 * en un índice único, y una empresa que aparece primero por LinkedIn puede no
 * tener RUT hasta que alguien la cruce con el SII. Exigirlo desde el principio
 * obligaría a inventar RUTs falsos, que es peor.
 *
 * `tramoVentas` viaja con su año comercial. Un tramo sin año es un dato sin
 * fecha de vencimiento: el archivo del SII más reciente es 2024, y en 2027 ese
 * mismo número va a significar otra cosa. Ver docs/layout-sii.md.
 */
export const leadEmpresas = pgTable(
  "lead_empresas",
  {
    id: serial("id").primaryKey(),
    /** Normalizado `12345678-9`: sin puntos, con guion, DV en mayúscula. */
    rut: varchar("rut", { length: 12 }),
    razonSocial: varchar("razon_social", { length: 200 }).notNull(),
    /** Código de actividad económica del SII, 6 dígitos. */
    acteco: varchar("acteco", { length: 6 }),
    /** Glosa del rubro, para leer sin diccionario a mano. */
    rubro: varchar("rubro", { length: 160 }),
    tramoVentas: smallint("tramo_ventas"),
    /** El año comercial del que salió el tramo. Sin esto el tramo no se puede leer. */
    tramoVentasAno: smallint("tramo_ventas_ano"),
    /** Código numérico 1–16. El SII entrega romanos; se normaliza en la ingesta. */
    region: smallint("region"),
    comuna: varchar("comuna", { length: 80 }),
    /** Sin dominio ningún proveedor de enriquecimiento encuentra nada. */
    dominio: varchar("dominio", { length: 200 }),
    dominioOrigen: varchar("dominio_origen", { length: 20 }).$type<LeadOrigen>(),
    dominioObtenidoEn: timestamp("dominio_obtenido_en"),

    origen: varchar("origen", { length: 20 }).$type<LeadOrigen>().notNull(),
    obtenidoEn: timestamp("obtenido_en").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("lead_empresas_rut_idx").on(t.rut),
    index("lead_empresas_acteco_idx").on(t.acteco),
    index("lead_empresas_region_idx").on(t.region),
  ],
);

// ─── Personas ────────────────────────────────────────────────────────────────

/**
 * La persona a la que se le escribe.
 *
 * La clave primaria es un `serial`, no el `memberUrn`, por una razón práctica:
 * el MVP arranca con leads cargados por CSV y la Ruta C es solo email. Si el
 * URN fuera la clave, no se podría guardar a nadie sin LinkedIn — y la mitad
 * del motor es email. El `memberUrn` va como índice único: la garantía de
 * deduplicación se mantiene intacta donde el dato existe, que es lo que la
 * invariante pide. Lo que está prohibido es deduplicar por `publicIdentifier`.
 *
 * `suprimidoEn` vive acá y no en la inscripción, y es deliberado: si el opt-out
 * colgara de la campaña, alguien que pidió BAJA en la campaña A recibiría la
 * campaña B tres meses después. La supresión es de la persona, para siempre.
 */
export const leadPersonas = pgTable(
  "lead_personas",
  {
    id: serial("id").primaryKey(),

    /** `ACoAA...` — permanente. Es lo único que deduplica. */
    memberUrn: varchar("member_urn", { length: 64 }),
    /** El slug de `/in/`. MUTABLE: sirve para armar la URL, jamás para comparar. */
    publicIdentifier: varchar("public_identifier", { length: 160 }),
    linkedinOrigen: varchar("linkedin_origen", { length: 20 }).$type<LeadOrigen>(),
    linkedinObtenidoEn: timestamp("linkedin_obtenido_en"),

    nombre: varchar("nombre", { length: 160 }).notNull(),
    cargo: varchar("cargo", { length: 200 }),
    empresaId: integer("empresa_id"),

    email: varchar("email", { length: 254 }),
    emailOrigen: varchar("email_origen", { length: 20 }).$type<LeadOrigen>(),
    emailObtenidoEn: timestamp("email_obtenido_en"),
    /** Resultado de MillionVerifier. Null = no se ha verificado todavía. */
    emailVerificado: boolean("email_verificado"),

    /** E.164 sin '+', igual que el CRM (lib/crm/telefono.ts). */
    telefono: varchar("telefono", { length: 20 }),
    telefonoOrigen: varchar("telefono_origen", { length: 20 }).$type<LeadOrigen>(),
    telefonoObtenidoEn: timestamp("telefono_obtenido_en"),

    /**
     * El carril barato. Un Open Profile recibe InMail gratis (~800/mes) contra
     * las 20–25 invitaciones diarias que es el recurso realmente escaso.
     * Null = no se ha consultado; false = se consultó y no lo tiene.
     */
    esOpenProfile: boolean("es_open_profile"),
    /** 1, 2 o 3 grados. El grado 1 se mensajea directo, sin gastar invitación. */
    networkDistance: smallint("network_distance"),

    /** Opt-out, BAJA, rebote duro u oposición. Corta TODO, en todos los canales. */
    suprimidoEn: timestamp("suprimido_en"),
    suprimidoMotivo: varchar("suprimido_motivo", { length: 60 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("lead_personas_urn_idx").on(t.memberUrn),
    index("lead_personas_empresa_idx").on(t.empresaId),
    index("lead_personas_email_idx").on(t.email),
    index("lead_personas_suprimido_idx").on(t.suprimidoEn),
  ],
);

// ─── Señales ─────────────────────────────────────────────────────────────────

/**
 * El hecho verificable que justifica el primer contacto.
 *
 * Ningún primer toque sale sin una de estas. Hace tres cosas a la vez: sube la
 * aceptación (que es la métrica que decide si LinkedIn te deja operar), da algo
 * concreto que decir, y es la diferencia entre "traté sus datos porque estaban
 * ahí" y "lo contacté por un hecho público y pertinente".
 *
 * `venceEn` es NOT NULL a propósito. Ver la invariante 3 del encabezado.
 */
export const leadSenales = pgTable(
  "lead_senales",
  {
    id: serial("id").primaryKey(),
    empresaId: integer("empresa_id").notNull(),
    /** adjudicacion | licitacion_publicada | empresa_nueva | cambio_tramo | cambio_domicilio */
    tipo: varchar("tipo", { length: 40 }).notNull(),
    /** En una línea y en castellano: es lo que termina citado en el mensaje. */
    resumen: text("resumen").notNull(),
    /** El link que lo prueba. Sin URL la señal no es verificable. */
    evidenciaUrl: varchar("evidencia_url", { length: 500 }),
    /** Cuándo ocurrió el hecho, NO cuándo lo supimos nosotros. */
    fechaHecho: timestamp("fecha_hecho").notNull(),
    /** Cuándo deja de ser señal. Obligatorio. */
    venceEn: timestamp("vence_en").notNull(),
    /** vigente | usada | vencida */
    estado: varchar("estado", { length: 20 }).notNull().default("vigente"),

    origen: varchar("origen", { length: 20 }).$type<LeadOrigen>().notNull(),
    obtenidoEn: timestamp("obtenido_en").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("lead_senales_empresa_idx").on(t.empresaId),
    index("lead_senales_vence_idx").on(t.venceEn),
    index("lead_senales_estado_idx").on(t.estado),
  ],
);

// ─── Campañas y secuencias ───────────────────────────────────────────────────

export const leadCampanas = pgTable(
  "lead_campanas",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 160 }).notNull(),
    /** El ICP como filtro ejecutable: { acteco: ["62"], region: [13], tramo: [5,6,7] }. */
    icp: jsonb("icp").$type<Record<string, unknown>>(),
    /** Techos propios de esta campaña. Nunca suben por sobre los del emisor. */
    limites: jsonb("limites").$type<Record<string, number>>(),
    canalPreferido: varchar("canal_preferido", { length: 20 }).$type<LeadCanal>(),
    emisorId: integer("emisor_id"),
    /** borrador | activa | pausada | terminada */
    estado: varchar("estado", { length: 20 }).notNull().default("borrador"),
    /**
     * Candado 3. Mientras esté en true, el despacho arma todo y registra todo
     * pero corta ANTES de la red. Es el modo en que se construye y se prueba el
     * motor completo sin una cuenta de LinkedIn conectada.
     */
    simulado: boolean("simulado").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("lead_campanas_estado_idx").on(t.estado)],
);

/**
 * Los pasos de la secuencia. **Es data, no código**: se edita sin desplegar.
 *
 * `esperaDias` se cuenta en días hábiles y se le aplica jitter al agendar. Una
 * acción cada 90 segundos exactos es la firma más obvia de un bot.
 */
export const leadSecuencias = pgTable(
  "lead_secuencias",
  {
    id: serial("id").primaryKey(),
    campanaId: integer("campana_id").notNull(),
    orden: smallint("orden").notNull(),
    esperaDias: smallint("espera_dias").notNull().default(0),
    canal: varchar("canal", { length: 20 }).$type<LeadCanal>().notNull(),
    /** invitacion | mensaje | inmail | email */
    tipo: varchar("tipo", { length: 30 }).notNull(),
    /** Solo email. */
    asunto: varchar("asunto", { length: 200 }),
    /** Con variables `{{nombre}}`, `{{senal}}`. La invitación tope 300 caracteres. */
    plantilla: text("plantilla").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("lead_secuencias_paso_idx").on(t.campanaId, t.orden)],
);

// ─── La máquina de estados ───────────────────────────────────────────────────

/**
 * Persona × campaña. **Acá vive el estado**, y es la tabla que el scheduler mira.
 *
 *   pendiente → invitado → conectado → en_secuencia → respondio → calificado
 *                  │                        │             │
 *                  │                        │             └→ oportunidad en /crm
 *                  │                        └→ agotado (5 toques sin respuesta)
 *                  └→ rechazado / retirado → email (Ruta C)
 *
 *   desde cualquier estado → suprimido
 *
 * `toquesTotales` suma TODOS los canales, no uno por uno. El tope de 5 es
 * transversal: perseguir a alguien por tres frentes es lo que convierte
 * nurturing en hostigamiento.
 */
export const leadInscripciones = pgTable(
  "lead_inscripciones",
  {
    id: serial("id").primaryKey(),
    personaId: integer("persona_id").notNull(),
    campanaId: integer("campana_id").notNull(),
    /** La señal con la que entró. Es lo que se cita en el primer toque. */
    senalId: integer("senal_id"),
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
    pasoActual: smallint("paso_actual").notNull().default(0),
    proximoPasoEn: timestamp("proximo_paso_en"),
    toquesTotales: smallint("toques_totales").notNull().default(0),
    /** Para el retiro automático de invitaciones a los 14 días. */
    invitadaEn: timestamp("invitada_en"),
    respondioEn: timestamp("respondio_en"),
    actualizadoEn: timestamp("actualizado_en").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("lead_inscripciones_unica_idx").on(t.personaId, t.campanaId),
    index("lead_inscripciones_proximo_idx").on(t.proximoPasoEn),
    index("lead_inscripciones_estado_idx").on(t.estado),
  ],
);

/**
 * La cola. El scheduler lee de acá cada 15 minutos.
 *
 * `aprobadaEn` es el candado 1, y es por LOTE: se aprueban los 40 primeros
 * toques de una campaña de una vez. De a un mensaje no escala y nadie lo usa,
 * que es la forma más común de que un candado deje de existir en la práctica.
 */
export const leadAcciones = pgTable(
  "lead_acciones",
  {
    id: serial("id").primaryKey(),
    inscripcionId: integer("inscripcion_id").notNull(),

    /**
     * Denormalizado desde la inscripción, y no es redundancia: es lo que
     * convierte "nunca dos canales el mismo día" en un índice único de la base
     * en vez de una consulta que alguien puede olvidar escribir. Una regla de
     * negocio que vive solo en código tiene dos versiones al primer mes.
     */
    personaId: integer("persona_id").notNull(),

    /** invitacion | mensaje | inmail | email | retiro_invitacion */
    tipo: varchar("tipo", { length: 30 }).notNull(),
    canal: varchar("canal", { length: 20 }).$type<LeadCanal>().notNull(),
    emisorId: integer("emisor_id"),
    /** Ya con jitter aplicado y dentro de la ventana horaria. */
    programadaEn: timestamp("programada_en").notNull(),

    /**
     * El día en Chile de `programadaEn`, calculado en la app al agendar.
     *
     * No se deriva en el índice porque no se puede: `at time zone` es STABLE y
     * Postgres solo indexa expresiones IMMUTABLE. Y no se usa la fecha UTC
     * porque Vercel corre en UTC — el "hoy" del panel cambiaría a media tarde.
     * Ojo con la diferencia respecto del CRM de CDC: Chile tiene horario de
     * verano, así que el desfase alterna entre −3 y −4 dos veces al año.
     */
    fechaChile: date("fecha_chile").notNull(),

    /** pendiente | aprobada | frenada | enviada | fallida | cancelada */
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),

    /**
     * POR QUÉ NO SALIÓ. Es lo contrario de `resultado`: `motivo` se escribe
     * ANTES de tocar la red, `resultado` después.
     *
     * Sin este campo una acción frenada por cuota queda indistinguible de una a
     * la que todavía no le toca, y el panel no puede explicar su propio
     * silencio. Lo escribe únicamente lib/leads/motivo.ts.
     */
    motivo: varchar("motivo", { length: 60 }),

    intentos: smallint("intentos").notNull().default(0),
    /** El cuerpo ya renderizado, para poder aprobarlo antes de que salga. */
    cuerpo: text("cuerpo"),
    /** Qué contestó la red. Los errores de Unipile son inestables: 422, 429, 500. */
    resultado: text("resultado"),
    aprobadaPor: integer("aprobada_por"),
    aprobadaEn: timestamp("aprobada_en"),
    ejecutadaEn: timestamp("ejecutada_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("lead_acciones_cola_idx").on(t.estado, t.programadaEn),
    index("lead_acciones_inscripcion_idx").on(t.inscripcionId),
    index("lead_acciones_dia_idx").on(t.fechaChile, t.estado),

    /**
     * Un solo toque por persona y por día, sumando todos los canales.
     *
     * Va como índice parcial y no como constraint porque una acción frenada o
     * cancelada no debe ocupar el cupo del día: si contara, un descarte por
     * cuota dejaría a esa persona sin poder recibir nada más esa jornada.
     */
    uniqueIndex("lead_acciones_un_toque_dia_idx")
      .on(t.personaId, t.fechaChile)
      .where(sql`estado in ('pendiente', 'aprobada', 'enviada')`),
  ],
);

/**
 * Todo lo enviado y recibido, de los tres canales, en una sola tabla.
 *
 * Unificarlas es lo que hace posible una bandeja única y el tope de 5 toques
 * transversal. Tres tablas serían tres bandejas que nadie mira.
 *
 * `externalId` es único por canal para que un webhook reentregado no duplique
 * el mensaje — Unipile reintenta, y lo va a hacer.
 */
export const leadMensajes = pgTable(
  "lead_mensajes",
  {
    id: serial("id").primaryKey(),
    personaId: integer("persona_id").notNull(),
    inscripcionId: integer("inscripcion_id"),
    accionId: integer("accion_id"),
    emisorId: integer("emisor_id"),
    canal: varchar("canal", { length: 20 }).$type<LeadCanal>().notNull(),
    /** entrante | saliente */
    direccion: varchar("direccion", { length: 10 }).notNull(),
    cuerpo: text("cuerpo").notNull(),
    enviadoEn: timestamp("enviado_en").defaultNow().notNull(),
    /** El id que devuelve la red. Deduplica webhooks reentregados. */
    externalId: varchar("external_id", { length: 200 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("lead_mensajes_external_idx").on(t.canal, t.externalId),
    index("lead_mensajes_persona_idx").on(t.personaId),
    index("lead_mensajes_enviado_idx").on(t.enviadoEn),
  ],
);

// ─── Emisores ────────────────────────────────────────────────────────────────

/**
 * La cuenta que envía. **Sin esta tabla no hay pacing, y sin pacing se queman
 * cuentas.**
 *
 * Unipile declara literalmente que no impone límites de su lado: envía
 * exactamente lo que le pidas, al volumen que le pidas. Todo el warm-up, la
 * cuota, el jitter y la ventana horaria son código nuestro.
 *
 * Nada de esto va hardcodeado: LinkedIn no publica ninguno de estos números y
 * los modula por cuenta. Son configuración, no constantes.
 *
 * Y la cuenta es un ACTIVO DESECHABLE: puede quedar restringida en cualquier
 * momento. Por eso las campañas apuntan a un emisor y no al revés — cambiar de
 * cuenta no debe costar una migración.
 */
export const leadEmisores = pgTable(
  "lead_emisores",
  {
    id: serial("id").primaryKey(),
    tipo: varchar("tipo", { length: 20 }).$type<LeadCanal>().notNull(),
    /** El correo del buzón, o el perfil de LinkedIn que opera. */
    identificador: varchar("identificador", { length: 200 }).notNull(),
    /** El id de la cuenta conectada en Unipile. Null mientras no se conecte. */
    unipileAccountId: varchar("unipile_account_id", { length: 120 }),

    /** Warm-up: 5/día la semana 1, 8, 12, 16, y techo duro en 20–25. */
    cuotaDiaria: smallint("cuota_diaria").notNull().default(5),
    diaWarmup: smallint("dia_warmup").notNull().default(1),
    /** Hora local de Chile. Una cuenta activa a las 3 AM se delata sola. */
    ventanaInicio: smallint("ventana_inicio").notNull().default(9),
    ventanaFin: smallint("ventana_fin").notNull().default(19),
    /** IP residencial dedicada. Cambiar de IP entre sesiones también se detecta. */
    ip: varchar("ip", { length: 45 }),

    /**
     * Porcentaje entero 0–100, no fracción (misma razón que los montos del CRM).
     * Bajo 25 el sistema baja la cuota a la mitad; bajo 15 pausa la cuenta solo.
     * No es una alerta para que alguien decida: cuando alguien la lee, ya es tarde.
     */
    tasaAceptacion7d: smallint("tasa_aceptacion_7d"),
    /** activo | warmup | frenado | pausado | restringido */
    estado: varchar("estado", { length: 20 }).notNull().default("warmup"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("lead_emisores_estado_idx").on(t.estado)],
);

// ─── Configuración operativa ─────────────────────────────────────────────────

/**
 * Interruptores del motor, en la base y no en variables de entorno.
 *
 * Cambiar una variable en Vercel exige redesplegar, y el momento en que se
 * necesita apagar un motor de envíos es exactamente el momento en que no se
 * quiere esperar un despliegue. Hoy la única clave es `motor.encendido`, y
 * **nace en `false`**: el estado por defecto de un sistema que le escribe a
 * desconocidos es no mandar nada.
 */
export const leadConfig = pgTable("lead_config", {
  clave: varchar("clave", { length: 60 }).primaryKey(),
  valor: text("valor").notNull(),
  actualizadoEn: timestamp("actualizado_en").defaultNow().notNull(),
});

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type LeadEmpresa = typeof leadEmpresas.$inferSelect;
export type LeadPersona = typeof leadPersonas.$inferSelect;
export type LeadSenal = typeof leadSenales.$inferSelect;
export type LeadCampana = typeof leadCampanas.$inferSelect;
export type LeadSecuencia = typeof leadSecuencias.$inferSelect;
export type LeadInscripcion = typeof leadInscripciones.$inferSelect;
export type LeadAccion = typeof leadAcciones.$inferSelect;
export type LeadMensaje = typeof leadMensajes.$inferSelect;
export type LeadEmisor = typeof leadEmisores.$inferSelect;
export type LeadConfig = typeof leadConfig.$inferSelect;

export type NuevaLeadEmpresa = typeof leadEmpresas.$inferInsert;
export type NuevaLeadPersona = typeof leadPersonas.$inferInsert;
export type NuevaLeadSenal = typeof leadSenales.$inferInsert;
