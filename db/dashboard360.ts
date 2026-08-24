// =============================================================================
// Dashboard360 — esquema (/dashboard360)
// =============================================================================
//
// Prefijo `d360_` por la misma razón que el CRM usa `crm_`: comparten la base
// de Neon con la web corporativa y con TV Mix.
//
// **La forma de estas tablas no es libre.** El demo se siembra con datos
// ficticios, pero el esquema calca lo que Airbyte va a escribir cuando se
// conecten las fuentes reales. Si el demo inventara su propia forma, conectar
// Airbyte después sería reescribir las pantallas. Así es configuración.
//
// **Los montos son enteros en pesos chilenos**, igual que en el CRM: el CLP no
// tiene decimales y `numeric` en Drizzle vuelve como string, lo que obliga a
// parsear en cada suma y termina en errores de redondeo silenciosos.
//
// Una sola organización, sin `org_id`. Dashboard360 se despliega por cliente y
// un campo de aislamiento que nadie filtra es peor que no tenerlo.

import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Usuarios y sesión ───────────────────────────────────────────────────────

/** admin mantiene la plataforma · gerente ve todo · analista no publica informes. */
export type D360Role = "admin" | "gerente" | "analista";

export const d360Users = pgTable(
  "d360_users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 60 }).notNull(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }),
    // scrypt$sal$hash — ver lib/dashboard360/session.ts
    passwordHash: text("password_hash").notNull(),
    rol: varchar("rol", { length: 20 }).notNull().default("analista"),
    activo: boolean("activo").notNull().default(true),
    ultimoIngreso: timestamp("ultimo_ingreso"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("d360_users_username_idx").on(t.username)],
);

export type D360User = typeof d360Users.$inferSelect;

// ─── Fuentes conectadas ──────────────────────────────────────────────────────

/**
 * Cada conector de Airbyte es una fila acá. En el demo están todas en verde con
 * datos sembrados; en producción esta tabla la actualiza el job de sincronía y
 * es lo que delata cuándo una fuente lleva días sin traer nada.
 *
 * Que exista esta pantalla no es decorativo: la falla más común de estos
 * tableros no es un número equivocado, es un número viejo que nadie sabe que
 * está viejo.
 */
export type D360TipoCanal = "ads" | "email" | "social" | "web" | "crm";

export type D360EstadoFuente = "conectada" | "sincronizando" | "error" | "pendiente";

export const d360Fuentes = pgTable(
  "d360_fuentes",
  {
    id: serial("id").primaryKey(),
    /** Identificador estable del conector: `google_ads`, `linkedin_ads`, … */
    slug: varchar("slug", { length: 40 }).notNull(),
    nombre: varchar("nombre", { length: 80 }).notNull(),
    tipo: varchar("tipo", { length: 20 }).$type<D360TipoCanal>().notNull(),
    estado: varchar("estado", { length: 20 })
      .$type<D360EstadoFuente>()
      .notNull()
      .default("pendiente"),
    /** Cuenta o propiedad de origen, tal como la nombra la plataforma. */
    cuenta: varchar("cuenta", { length: 120 }),
    ultimaSync: timestamp("ultima_sync"),
    /** Minutos entre sincronías. Airbyte lo define por conexión. */
    frecuenciaMin: integer("frecuencia_min").notNull().default(1440),
    /** Texto del último error, si lo hubo. Se muestra tal cual en /fuentes. */
    ultimoError: text("ultimo_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("d360_fuentes_slug_idx").on(t.slug)],
);

export type D360Fuente = typeof d360Fuentes.$inferSelect;

// ─── Métricas diarias ────────────────────────────────────────────────────────

/**
 * Tabla de hechos: un día, una fuente, una campaña.
 *
 * **Por qué una tabla ancha con columnas nulas y no una por canal.** Los tres
 * mundos miden cosas distintas —ads tiene costo e impresiones, el email tiene
 * envíos y aperturas, lo orgánico tiene alcance y seguidores— y unir tres
 * tablas en cada consulta para pintar una sola vista es exactamente el trabajo
 * que este producto promete evitar. Las columnas que no aplican quedan en NULL,
 * y cada consulta suma solo las suyas.
 *
 * `fecha` es `varchar(10)` en formato ISO y no `date`: las plataformas reportan
 * en la zona horaria de la cuenta, no en UTC, y un `date` invita a que el
 * driver haga una conversión que corre las cifras un día. El texto no miente.
 */
export const d360Metricas = pgTable(
  "d360_metricas_diarias",
  {
    id: serial("id").primaryKey(),
    fecha: varchar("fecha", { length: 10 }).notNull(),
    fuenteSlug: varchar("fuente_slug", { length: 40 }).notNull(),
    tipo: varchar("tipo", { length: 20 }).$type<D360TipoCanal>().notNull(),
    campania: varchar("campania", { length: 160 }).notNull(),

    // Ads y orgánico
    impresiones: integer("impresiones"),
    clics: integer("clics"),
    /** Inversión del día en pesos chilenos. NULL en canales sin costo directo. */
    costoClp: integer("costo_clp"),

    // Email
    envios: integer("envios"),
    aperturas: integer("aperturas"),

    // Social orgánico
    interacciones: integer("interacciones"),
    seguidoresNuevos: integer("seguidores_nuevos"),

    // Resultado — el único campo que cruza los tres mundos
    /**
     * Leads que la plataforma se atribuye a sí misma. Es el número que infla
     * los tableros: si se suman los `leads` de las cuatro fuentes, el total
     * supera a la realidad porque más de una se cuelga del mismo contacto.
     * Para el número honesto está `d360_leads`, que deduplica por persona.
     */
    leads: integer("leads"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("d360_metricas_fecha_idx").on(t.fecha),
    index("d360_metricas_fuente_idx").on(t.fuenteSlug),
  ],
);

export type D360Metrica = typeof d360Metricas.$inferSelect;

// ─── Leads deduplicados ──────────────────────────────────────────────────────

/**
 * El lead como persona, no como evento de plataforma.
 *
 * Esta tabla existe para poder responder la única pregunta que hace caer un
 * tablero en la sala del directorio: *«¿por qué acá dice 180 leads y en el CRM
 * hay 124?»*. La respuesta casi siempre es que tres plataformas se atribuyen el
 * mismo contacto. Acá cada persona aparece una vez, con la fuente que la trajo
 * primero (`fuentePrimerToque`) y la que se llevó el crédito del cierre
 * (`fuenteUltimoToque`), y la diferencia contra la suma de plataformas queda a
 * la vista en vez de escondida.
 */
export type D360EstadoLead = "nuevo" | "contactado" | "calificado" | "oportunidad" | "descartado";

export const d360Leads = pgTable(
  "d360_leads",
  {
    id: serial("id").primaryKey(),
    fecha: varchar("fecha", { length: 10 }).notNull(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    empresa: varchar("empresa", { length: 120 }),
    email: varchar("email", { length: 254 }),
    fuentePrimerToque: varchar("fuente_primer_toque", { length: 40 }).notNull(),
    fuenteUltimoToque: varchar("fuente_ultimo_toque", { length: 40 }).notNull(),
    campania: varchar("campania", { length: 160 }),
    estado: varchar("estado", { length: 20 })
      .$type<D360EstadoLead>()
      .notNull()
      .default("nuevo"),
    /** Valor estimado de la oportunidad en pesos. NULL si aún no se dimensiona. */
    valorClp: integer("valor_clp"),
    /** `true` cuando el lead existe también en el CRM del cliente. */
    enCrm: boolean("en_crm").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("d360_leads_fecha_idx").on(t.fecha),
    index("d360_leads_estado_idx").on(t.estado),
  ],
);

export type D360Lead = typeof d360Leads.$inferSelect;

// ─── Informes al directorio ──────────────────────────────────────────────────

/**
 * El entregable que justifica el producto.
 *
 * Un tablero muestra que el costo por lead de LinkedIn subió 40%. Un directorio
 * quiere saber si el trimestre va bien, por qué, y qué se hace al respecto. El
 * salto entre esas dos cosas hoy lo hace una persona a mano cada mes, y es
 * precisamente lo que acá se genera.
 *
 * El cuerpo se guarda en Markdown para que la misma pieza sirva en pantalla, en
 * PDF y pegada en un correo sin tres plantillas distintas.
 */
export type D360EstadoInforme = "borrador" | "publicado";

export const d360Informes = pgTable(
  "d360_informes",
  {
    id: serial("id").primaryKey(),
    titulo: varchar("titulo", { length: 160 }).notNull(),
    /** Rango cubierto, en ISO. Ambos inclusive. */
    desde: varchar("desde", { length: 10 }).notNull(),
    hasta: varchar("hasta", { length: 10 }).notNull(),
    cuerpoMd: text("cuerpo_md").notNull(),
    estado: varchar("estado", { length: 20 })
      .$type<D360EstadoInforme>()
      .notNull()
      .default("borrador"),
    autorId: integer("autor_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("d360_informes_hasta_idx").on(t.hasta)],
);

export type D360Informe = typeof d360Informes.$inferSelect;
