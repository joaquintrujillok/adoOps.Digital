// Sistema Tuniche — esquema.
//
// **Qué es este módulo.** El sistema de visitas a campo de Semillas Tuniche:
// un zonal manda un audio de WhatsApp desde la camioneta, el audio se convierte
// en un informe estructurado, y ese informe queda en el historial del agricultor
// y se le puede enviar. Reemplaza lo que hoy es una conversación de WhatsApp que
// nadie puede consultar seis meses después.
//
// **Por qué las tablas empiezan con `tuniche_`.** Hay una sola base de datos
// —`db/index.ts` abre un único `DATABASE_URL`— y los módulos se separan por
// prefijo, no por ambiente. Ver `lib/modulos.ts` y `docs/modulos.md`.
//
// **Adentro hay personas reales.** Agricultores con nombre, teléfono y correo,
// y trabajadores de Tuniche con contraseña. Este módulo es `produccion` desde el
// primer día, aunque el contrato diga "prueba de concepto": la clasificación la
// decide el dato que hay adentro, no la etapa comercial.

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Quién es cada persona dentro del sistema.
 *
 * Tres roles y no más, porque cada rol extra es una regla que alguien tiene que
 * recordar. Están definidos por lo que **dejan hacer**, no por el cargo:
 *
 * - `zonal`   — carga visitas y ve **solo sus propios** agricultores.
 * - `jefe`    — ve toda **su área** y puede enviarle el informe al agricultor.
 * - `admin`   — todas las áreas, más la gestión de usuarios y de las maestras.
 *
 * El cargo real de una persona no importa acá: René es jefe de Producción Altué
 * y Francisco es zonal de Mercado Nacional, pero mañana el mismo Francisco puede
 * necesitar ver el área completa. Se cambia el rol, no el código.
 */
export type TunicheRol = "admin" | "jefe" | "zonal";

/**
 * Usuarios internos de Tuniche. **El agricultor no entra acá**: recibe su
 * informe por WhatsApp, que es exactamente lo que ya hace hoy y lo único que ha
 * demostrado que usa.
 *
 * Tres columnas merecen explicación:
 *
 * **`telefono`.** No es un dato de contacto: es la **identidad en WhatsApp**.
 * Cuando entra un audio desde +56 9 …, el sistema tiene que saber qué zonal es
 * para saber a qué área pertenece la visita y qué plantilla aplicar. Sin este
 * campo el flujo de audio no tiene forma de saber quién habla. Por eso es único.
 *
 * **`area`.** Mercado Nacional y Producción Altué llenan sábanas distintas —lo
 * dijeron ellos mismos: "puede ser que Altué necesite 6 campos más y MN otros
 * 6"—. El área decide qué plantilla ve la persona y qué filas puede mirar.
 * `null` solo para `admin`, que es el único que cruza áreas.
 *
 * **`debeCambiarClave`.** Un administrador crea la cuenta y le dicta la clave a
 * la persona por teléfono. Esa clave la conocen dos personas desde el minuto
 * cero, así que sirve para entrar una vez y nada más.
 */
export const tunicheUsuarios = pgTable(
  "tuniche_usuarios",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 60 }).notNull(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }),
    /** E.164 sin '+' (569…). Ver lib/crm/telefono.ts. */
    telefono: varchar("telefono", { length: 20 }),
    /** scrypt$sal$hash — ver lib/tuniche/session.ts */
    passwordHash: text("password_hash").notNull(),
    rol: varchar("rol", { length: 20 }).notNull().default("zonal"),
    /** `mn` | `altue`. NULL solo para admin. Ver lib/tuniche/areas.ts */
    area: varchar("area", { length: 20 }),
    activo: boolean("activo").notNull().default(true),
    debeCambiarClave: boolean("debe_cambiar_clave").notNull().default(false),
    ultimoIngreso: timestamp("ultimo_ingreso"),
    /**
     * El área que este usuario **simula** al mandar un audio.
     *
     * Solo tiene sentido para `admin`: no tiene área porque cruza las dos, y un
     * audio sin área no tiene plantilla contra la cual estructurarse. En vez de
     * adivinar, el admin declara desde cuál está probando. Para `jefe` y
     * `zonal` es siempre NULL — su `area` ya responde la pregunta.
     */
    areaAudio: varchar("area_audio", { length: 20 }),
    /** Quién le dio el acceso. La pregunta que siempre se hace después. */
    creadoPor: integer("creado_por"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tuniche_usuarios_username_idx").on(t.username),
    // Único porque es la identidad en WhatsApp: dos personas con el mismo
    // número harían que un audio entre a nombre de cualquiera de las dos.
    uniqueIndex("tuniche_usuarios_telefono_idx").on(t.telefono),
    index("tuniche_usuarios_area_idx").on(t.area),
  ],
);

export type TunicheUsuario = typeof tunicheUsuarios.$inferSelect;
export type NuevoTunicheUsuario = typeof tunicheUsuarios.$inferInsert;

// ─── Capa 1 · Identificación ─────────────────────────────────────────────────

/**
 * El agricultor. Una fila por empresa o persona a la que se le visita un campo.
 *
 * **La asimetría entre las dos planillas está acá.** El export de MN es un libro
 * de ventas: razón social, bolsas, distribuidor, mes de facturación. El de Altué
 * es un libro de producción: agricultor, lote, hectáreas, objetivo kg/ha. Los
 * dos nombran al agricultor, así que esta tabla se puede compartir; lo que no se
 * puede compartir es lo de abajo, y por eso `lotes` existe aparte.
 *
 * `nombreContacto`/`telefono`/`email` vienen de MN, que sí los trae. **La
 * planilla de Altué no los tiene**, y sin ellos no hay a quién mandarle el
 * informe. Es lo primero que hay que pedirle a René.
 */
export const tunicheAgricultores = pgTable(
  "tuniche_agricultores",
  {
    id: serial("id").primaryKey(),
    /** `mn` | `altue`. Un agricultor pertenece a un área. */
    area: varchar("area", { length: 20 }).notNull(),
    /** Altué: AGRICULTOR · MN: Razón Social */
    razonSocial: varchar("razon_social", { length: 200 }).notNull(),
    /** MN: Nombre Contacto. En Altué falta y hay que pedirlo. */
    nombreContacto: varchar("nombre_contacto", { length: 160 }),
    /** E.164 sin '+'. Es a quien se le manda el informe. */
    telefono: varchar("telefono", { length: 20 }),
    email: varchar("email", { length: 254 }),
    /** Altué: LOCALIDAD · MN: Sucursal */
    localidad: varchar("localidad", { length: 120 }),
    /** MN: Región. Altué no la trae. */
    region: varchar("region", { length: 120 }),
    /** MN: Distribuidor (CALS, SO Agricoltura…). No aplica en Altué. */
    distribuidor: varchar("distribuidor", { length: 200 }),
    /** El zonal a cargo. Es lo que hace cumplir el alcance de un rol `zonal`. */
    zonalId: integer("zonal_id"),
    /** Altué: ZONAL · MN: Zonal — el nombre tal cual venía, antes de calzarlo. */
    zonalNombre: varchar("zonal_nombre", { length: 120 }),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tuniche_agricultores_area_idx").on(t.area),
    index("tuniche_agricultores_zonal_idx").on(t.zonalId),
  ],
);

/**
 * El lote: el pedazo de campo que se visita.
 *
 * **En MN esto no existe todavía y hay que crearlo.** Su planilla no tiene
 * ningún identificador de campo — cada fila es una venta de N bolsas de un
 * híbrido a una razón social vía un distribuidor. No hay dónde anclar una
 * visita, porque una visita es a un potrero, no a una factura. La salida es que
 * el zonal lo cree en su primera visita: es una línea de trabajo, no un
 * proyecto de migración.
 *
 * `hitos` guarda la capa 3 —las respuestas de las etapas— como JSON y no como
 * columnas. Son 37 campos en Altué y 30 en MN, con vocabularios que no se
 * cruzan; una tabla con 67 columnas mayormente nulas es una tabla que nadie
 * puede leer. Las claves son los `id` de `lib/tuniche/plantillas.ts`.
 */
export const tunicheLotes = pgTable(
  "tuniche_lotes",
  {
    id: serial("id").primaryKey(),
    agricultorId: integer("agricultor_id").notNull(),
    area: varchar("area", { length: 20 }).notNull(),
    /** Altué: LOTE (ALT26270130) · MN: lo crea el zonal en la primera visita. */
    codigo: varchar("codigo", { length: 60 }).notNull(),
    /** Altué: TEMPORADA (2026-2027) · MN: Año (2026) */
    temporada: varchar("temporada", { length: 20 }),
    /** Altué: CULTIVO (CABBAGE) · MN: maíz, implícito en su planilla. */
    cultivo: varchar("cultivo", { length: 80 }),
    /** Altué: VARIEDAD (C-001FM) · MN: Híbrido (TUNICHE 2775) */
    variedad: varchar("variedad", { length: 80 }),
    /** Altué: RELACION (H:M) — 2:2, 3:1. No aplica en MN. */
    relacionHm: varchar("relacion_hm", { length: 20 }),
    /** Altué: HECTAREAS. **En MN falta**: su planilla mide en bolsas. */
    hectareas: numeric("hectareas", { precision: 8, scale: 2 }),
    /** Altué: OBJETIVO (KILOS/HA) · MN: Bolsas */
    objetivo: varchar("objetivo", { length: 60 }),
    /** Altué: CLIENTE (el del extranjero) · MN: Distribuidor */
    clienteFinal: varchar("cliente_final", { length: 200 }),
    /** Altué: N° IDASE — la inscripción en ANPROS. No aplica en MN. */
    idase: varchar("idase", { length: 40 }),
    /** MN: Tipo Semilla (Silero / Grano / Growtech Silo). No aplica en Altué. */
    tipoSemilla: varchar("tipo_semilla", { length: 60 }),
    /** El `id` de etapa de lib/tuniche/plantillas.ts en que va el lote. */
    etapaActual: varchar("etapa_actual", { length: 40 }),
    /** Capa 3: respuestas de los hitos, por `id` de campo. */
    hitos: jsonb("hitos").$type<Record<string, unknown>>().default({}),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tuniche_lotes_agricultor_idx").on(t.agricultorId),
    uniqueIndex("tuniche_lotes_codigo_idx").on(t.codigo),
  ],
);

// ─── Capa 2 · La visita ──────────────────────────────────────────────────────

/**
 * Una visita a campo. Es lo que produce el audio.
 *
 * `notaAgronomica` sale del JSON a una columna propia a propósito: es el único
 * campo que se ordena, se compara y se grafica. Dentro del JSON habría que
 * extraerlo en cada consulta y no se podría indexar.
 *
 * `estado` existe porque **la IA propone y la persona confirma**. Una visita
 * `pendiente` no entra al historial del agricultor: si nadie mira lo que la IA
 * entendió, el sistema produce basura estructurada, que es peor que un audio.
 */
export const tunicheVisitas = pgTable(
  "tuniche_visitas",
  {
    id: serial("id").primaryKey(),
    loteId: integer("lote_id"),
    agricultorId: integer("agricultor_id"),
    area: varchar("area", { length: 20 }).notNull(),
    /** Quién la levantó. Sale del teléfono que mandó el audio. */
    usuarioId: integer("usuario_id").notNull(),
    fecha: timestamp("fecha").defaultNow().notNull(),
    /** `audio` | `texto` | `web` */
    origen: varchar("origen", { length: 20 }).notNull().default("audio"),
    waMessageId: varchar("wa_message_id", { length: 120 }),
    audioUrl: text("audio_url"),
    transcripcion: text("transcripcion"),
    /** El `id` de etapa en que estaba el lote. */
    etapa: varchar("etapa", { length: 40 }),
    /** Capa 2: respuestas por `id` de campo de `VISITA`. */
    datos: jsonb("datos").$type<Record<string, unknown>>().default({}),
    /** 0-100. Fuera del JSON porque es la que se ordena y se compara. */
    notaAgronomica: integer("nota_agronomica"),
    /** Dos o tres frases. Es lo que se le manda al agricultor. */
    resumen: text("resumen"),
    /** `pendiente` | `validada` | `corregida` */
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
    validadaEn: timestamp("validada_en"),
    /**
     * Cuándo salió efectivamente el informe de esta visita.
     *
     * **El visto bueno no vive acá**: vive en `tuniche_informes`, porque lo que
     * se aprueba es el documento que va a salir, habiéndolo visto, y no una
     * tarjeta en una lista. Esta columna es solo el eco para poder marcar la
     * visita en el historial sin consultar la otra tabla.
     */
    enviadaAlAgricultorEn: timestamp("enviada_al_agricultor_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tuniche_visitas_lote_idx").on(t.loteId),
    index("tuniche_visitas_usuario_idx").on(t.usuarioId),
    index("tuniche_visitas_fecha_idx").on(t.fecha),
    index("tuniche_visitas_estado_idx").on(t.estado),
  ],
);

/**
 * Las fotos. Tabla aparte y no un arreglo dentro de la visita porque llegan
 * **después**: el zonal manda el audio y a continuación tres fotos, cada una en
 * su propio mensaje de WhatsApp. Se enganchan a la última visita de ese zonal.
 */
export const tunicheFotos = pgTable(
  "tuniche_fotos",
  {
    id: serial("id").primaryKey(),
    visitaId: integer("visita_id").notNull(),
    url: text("url").notNull(),
    /** `general` | `hembra` | `macho` | `dron` | `otra` — Altué pide las tres primeras. */
    tipo: varchar("tipo", { length: 20 }).notNull().default("general"),
    waMessageId: varchar("wa_message_id", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tuniche_fotos_visita_idx").on(t.visitaId)],
);

export type TunicheAgricultor = typeof tunicheAgricultores.$inferSelect;
export type TunicheLote = typeof tunicheLotes.$inferSelect;
export type TunicheVisita = typeof tunicheVisitas.$inferSelect;
export type TunicheFoto = typeof tunicheFotos.$inferSelect;

// ─── El repositorio de informes ──────────────────────────────────────────────

/**
 * Un informe. Es lo único de este sistema que sale de Tuniche.
 *
 * **Por qué es una tabla y no una vista sobre las visitas.** Un informe es una
 * *constancia*: dice qué se le comunicó a alguien, en qué fecha y con qué
 * contenido. Si fuera una vista, corregir una visita en octubre cambiaría
 * retroactivamente lo que dice el informe que se envió en marzo — y entonces
 * deja de servir para lo único que importa, que es poder mostrarle a un
 * agricultor qué se le dijo y cuándo.
 *
 * Por eso `contenido` es un **snapshot completo**, no un puñado de ids. Nombres,
 * cifras, fotos y resumen quedan congelados en el momento de generarlo.
 *
 * **Dos tipos, un mismo repositorio.** El de `visita` es el que Francisco hoy
 * manda por WhatsApp después de cada recorrido. El `mensual` es el que René arma
 * a mano pegando fotos de Drive en un PowerPoint, para el cliente en el
 * extranjero. Distinto destinatario y distinta cadencia, pero es el mismo acto
 * —comunicar hacia afuera lo que se vio en el campo— y por eso el mismo visto
 * bueno, el mismo registro de envío y el mismo lugar donde buscarlo después.
 */
export type TunicheTipoInforme = "visita" | "mensual";

/** `borrador` → `aprobado` → `enviado`. No hay vuelta atrás desde `enviado`. */
export type TunicheEstadoInforme = "borrador" | "aprobado" | "enviado";

export const tunicheInformes = pgTable(
  "tuniche_informes",
  {
    id: serial("id").primaryKey(),
    tipo: varchar("tipo", { length: 20 }).notNull(),
    area: varchar("area", { length: 20 }).notNull(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    estado: varchar("estado", { length: 20 }).notNull().default("borrador"),

    // Un informe de visita apunta a su visita; uno mensual, a un cliente y un
    // periodo. Las columnas del otro tipo quedan nulas — con dos tipos y siete
    // columnas, una tabla por tipo costaría más de lo que ahorra.
    visitaId: integer("visita_id"),
    loteId: integer("lote_id"),
    agricultorId: integer("agricultor_id"),
    cliente: varchar("cliente", { length: 200 }),
    periodoDesde: timestamp("periodo_desde"),
    periodoHasta: timestamp("periodo_hasta"),

    /** El snapshot. Es el informe: la pantalla lee de acá, no de las visitas. */
    contenido: jsonb("contenido").$type<Record<string, unknown>>().notNull(),

    generadoPor: integer("generado_por").notNull(),
    generadoEn: timestamp("generado_en").defaultNow().notNull(),

    /**
     * El visto bueno. Vive acá y **no** en la visita, a propósito: se aprueba el
     * documento que va a salir, habiéndolo visto, y no una tarjeta en una lista.
     */
    aprobadoPor: integer("aprobado_por"),
    aprobadoEn: timestamp("aprobado_en"),

    /**
     * Cuándo salió de verdad, y a dónde. Es distinto de `aprobadoEn`: entre
     * aprobar y que WhatsApp entregue puede fallar la red, y un informe que se
     * cree enviado sin haberlo sido es la peor de las dos mentiras posibles.
     */
    enviadoPor: integer("enviado_por"),
    enviadoEn: timestamp("enviado_en"),
    enviadoA: varchar("enviado_a", { length: 200 }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("tuniche_informes_tipo_idx").on(t.tipo),
    index("tuniche_informes_estado_idx").on(t.estado),
    index("tuniche_informes_agricultor_idx").on(t.agricultorId),
    index("tuniche_informes_lote_idx").on(t.loteId),
    index("tuniche_informes_generado_idx").on(t.generadoEn),
    // Una visita produce un informe y solo uno: dos informes de la misma visita
    // significarían dos constancias distintas del mismo hecho.
    uniqueIndex("tuniche_informes_visita_idx").on(t.visitaId),
  ],
);

export type TunicheInforme = typeof tunicheInformes.$inferSelect;

/** El snapshot de un informe de visita. Lo que se congela al generarlo. */
export interface ContenidoVisita {
  agricultor: string;
  contacto: string | null;
  localidad: string | null;
  lote: string;
  cultivo: string | null;
  variedad: string | null;
  hectareas: string | null;
  zonal: string;
  fecha: string;
  etapa: string | null;
  campos: { etiqueta: string; valor: string }[];
  notaAgronomica: number | null;
  resumen: string;
  fotos: { url: string; tipo: string }[];
}

/** El snapshot de un informe mensual al cliente. */
export interface ContenidoMensual {
  cliente: string;
  desde: string;
  hasta: string;
  lotes: {
    codigo: string;
    agricultor: string;
    localidad: string | null;
    cultivo: string | null;
    variedad: string | null;
    hectareas: string | null;
    objetivo: string | null;
    notaPromedio: number | null;
    visitas: {
      fecha: string;
      zonal: string;
      etapa: string | null;
      notaAgronomica: number | null;
      resumen: string;
      fotos: { url: string; tipo: string }[];
    }[];
  }[];
}
