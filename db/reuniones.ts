// =============================================================================
// Reuniones — esquema (/dashboard360/reuniones)
// =============================================================================
//
// Dos tablas con prefijo `reunion_`. Guardan lo que una extensión de navegador
// —TranscripTonic -- https://github.com/vivek-nexus/transcriptonic, MIT— manda
// por webhook cuando termina una reunión de Google Meet, y el resumen que la IA
// arma después a partir de eso.
//
// ── Por qué esto no cuelga de `acta_reports` ─────────────────────────────────
//
// TorreControl ya tiene un vertical de actas y la tentación es reusar la tabla.
// No se hace, y la razón no es técnica sino de clasificación: `acta_reports` es
// parte de un **demo** que se muestra a prospectos, y su entrada es un audio de
// WhatsApp donde alguien *relata* una reunión. Acá entra la transcripción
// literal de una reunión real del equipo, con nombres de personas reales que
// dijeron cosas reales. Mezclarlas obligaría a que la misma pantalla fuera demo
// y producción al mismo tiempo, que es exactamente lo que `lib/modulos.ts`
// existe para impedir.
//
// La forma sí se copia de allá —jsonb con la extracción completa + columnas
// desnormalizadas para la lista— porque está probada.
//
// ── La invariante de este esquema ────────────────────────────────────────────
//
// LA TRANSCRIPCIÓN SE GUARDA ANTES DE LLAMAR A LA IA, SIEMPRE.
//
// El transcript es irrecuperable: existe una sola vez, en el `chrome.storage`
// del navegador de quien estuvo en la reunión, y la extensión lo manda una vez.
// El resumen, en cambio, se puede volver a generar cuantas veces se quiera
// mientras el texto esté guardado. Por eso la fila se inserta en `recibida` y
// el resumen la actualiza después: si OpenAI está caído, se pierde el resumen
// de ese momento, no la reunión.
//
// Es la misma lección de `contenido_publicaciones` —guardar el intento fallido
// junto al dato, no en un log que rota— aplicada al revés: acá lo que no puede
// perderse es la entrada, no la salida.

import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** En qué estado del recorrido está una reunión recibida. */
export type EstadoReunion =
  /** Llegó el transcript. Todavía no pasó por la IA. */
  | "recibida"
  /** Tiene resumen, decisiones y compromisos. */
  | "resumida"
  /** La IA falló. El transcript está intacto y se puede reintentar. */
  | "error";

/** Un turno de habla, tal como lo entrega la extensión en modo `advanced`. */
export type BloqueTranscripcion = {
  personName: string;
  timestamp: string;
  transcriptText: string;
};

/** Un mensaje del chat de la reunión. */
export type MensajeChat = {
  personName: string;
  timestamp: string;
  chatMessageText: string;
};

/** Lo que la IA extrae de la transcripción. Misma forma que `ActaExtraction`. */
export type ExtraccionReunion = {
  temas: string[];
  decisiones: string[];
  compromisos: {
    compromiso: string;
    responsable: string | null;
    prioridad: "alta" | "media" | "baja";
    plazo: string | null;
  }[];
  riesgos: string[];
  proximaReunion: string | null;
};

export type CompromisoReunion = ExtraccionReunion["compromisos"][number];

// ─── Registros ───────────────────────────────────────────────────────────────

export const reunionRegistros = pgTable(
  "reunion_registros",
  {
    id: serial("id").primaryKey(),

    /**
     * Clave de idempotencia. **La columna que impide el duplicado.**
     *
     * La extensión reintenta sola cuando el POST falla, y además deja un botón
     * para repostear a mano desde su historial. Sin esto, un webhook que
     * respondió 200 tarde aparece dos veces en la pantalla y se resume dos
     * veces —o sea, se paga dos veces—. Se arma con el inicio de la reunión y
     * el título, que es lo único estable que manda el payload: no hay id de
     * reunión en el cuerpo.
     */
    clave: varchar("clave", { length: 200 }).notNull().unique(),

    /** "Google Meet", "Zoom", "Teams". Lo manda la extensión tal cual. */
    plataforma: varchar("plataforma", { length: 40 }),
    titulo: varchar("titulo", { length: 300 }),

    /**
     * Inicio y fin. Nullable a propósito: en modo `simple` la extensión manda
     * las fechas ya formateadas para humanos y no siempre se pueden parsear.
     * Una fila sin fecha se ordena por `createdAt` y sigue sirviendo; una fila
     * con una fecha inventada, no.
     *
     * **Con zona horaria, a diferencia del resto del repo.** El resto usa
     * `timestamp` a secas, que en Postgres es un reloj sin huso: se guarda
     * "14:02" y quien lo lee decide de dónde es esa hora. Para un `created_at`
     * eso casi nunca se nota. Acá sí: se probó con un payload real y una
     * reunión de las 10:02 de Chile aparecía a las 18:02, porque se guardaba el
     * UTC del payload y se releía como si fuera hora local. Un tablero que
     * corre en Vercel (UTC) y se mira desde Santiago tiene dos husos en juego
     * siempre, así que la hora se guarda como instante y la pantalla la
     * convierte a `America/Santiago` al mostrarla.
     */
    inicioEn: timestamp("inicio_en", { withTimezone: true }),
    finEn: timestamp("fin_en", { withTimezone: true }),
    duracionMin: integer("duracion_min"),

    /** Quiénes hablaron. Se deriva de los bloques, no lo manda el payload. */
    participantes: jsonb("participantes").$type<string[]>(),

    /**
     * La transcripción como texto plano, siempre. Es lo que se le pasa a la IA
     * y lo que se lee en pantalla. Se arma acá aunque el payload venga en modo
     * `advanced`, para que la pantalla no dependa del modo con que quedó
     * configurada la extensión de cada persona.
     */
    transcripcion: text("transcripcion").notNull(),
    /** Los turnos con hablante y hora. Null si la extensión mandó modo `simple`. */
    bloques: jsonb("bloques").$type<BloqueTranscripcion[]>(),
    chat: jsonb("chat").$type<MensajeChat[]>(),

    /**
     * El cuerpo entero, tal como llegó.
     *
     * No es paranoia de logs: el día que este parser se equivoque con un
     * payload nuevo —la extensión es de un tercero y cambia—, el dato original
     * es lo único que permite arreglar el parser y reprocesar. Cuesta unos
     * kilobytes por reunión.
     */
    crudo: jsonb("crudo"),

    estado: varchar("estado", { length: 20 })
      .$type<EstadoReunion>()
      .notNull()
      .default("recibida"),
    /** Por qué falló la IA. Vacío mientras no haya fallado. */
    error: text("error"),

    resumen: text("resumen"),
    /**
     * Todo lo que la IA extrajo. Las decisiones NO tienen columna propia
     * desnormalizada como en `acta_reports`: allá la lista de decisiones se
     * pinta en el tablero y traer el jsonb entero por fila costaba. Acá la
     * lista muestra el resumen y el detalle lee la fila completa igual, así que
     * una columna duplicada sería un dato que se escribe y nadie lee — la peor
     * clase de columna, porque el día que las dos no coincidan nadie sabrá cuál
     * es la buena.
     */
    extraccion: jsonb("extraccion").$type<ExtraccionReunion>(),

    /**
     * Cuántas veces se le pidió el resumen a la IA. Se muestra en la pantalla
     * de detalle cuando falló: "falló al tercer intento" y "falló recién" son
     * dos problemas distintos.
     */
    intentos: smallint("intentos").notNull().default(0),

    // ── Lo que costó ─────────────────────────────────────────────────────────
    //
    // Se guarda por reunión y no como un total en otra parte porque la pregunta
    // que se hace de verdad no es "¿cuánto llevamos gastado?" sino "¿vale la
    // pena esta reunión?". Un número global no responde eso; una columna al
    // lado del resumen sí, y sumarla es trivial.
    //
    // El modelo también se guarda: el día que se cambie, las reuniones viejas
    // tienen que seguir diciendo con qué se hicieron.

    /** El nombre exacto que devolvió OpenAI, con sufijo de versión. */
    modelo: varchar("modelo", { length: 80 }),
    tokensEntrada: integer("tokens_entrada"),
    /** De los de entrada, cuántos venían cacheados. Salen a mitad de precio. */
    tokensEntradaCache: integer("tokens_entrada_cache"),
    tokensSalida: integer("tokens_salida"),
    /**
     * USD de esta reunión, congelado al momento de la llamada. Ver la nota de
     * `lib/reuniones/costo.ts`: las tarifas cambian y recalcular después daría
     * un número que nunca se pagó. Seis decimales porque un resumen cuesta del
     * orden de $0,002 y redondear a centavos lo dejaría siempre en cero.
     *
     * Drizzle devuelve los `numeric` como string. La pantalla los pasa por
     * `Number()`; sumarlos como texto sería un error silencioso.
     */
    costoUsd: numeric("costo_usd", { precision: 12, scale: 6 }),

    // Mismo criterio que `inicioEn`: la lista cae en `createdAt` cuando no hay
    // fecha de reunión, así que tiene que ser tan confiable como ella.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resumidaEn: timestamp("resumida_en", { withTimezone: true }),
  },
  (t) => [
    index("reunion_registros_inicio_idx").on(t.inicioEn),
    index("reunion_registros_estado_idx").on(t.estado),
  ],
);

// ─── Compromisos ─────────────────────────────────────────────────────────────

/**
 * Los compromisos salen a su propia tabla, además de vivir dentro de
 * `extraccion`. La duplicación es deliberada y es la misma de `compromisos` en
 * TorreControl: el jsonb es el registro de lo que dijo la IA en su momento —no
 * se toca— y la tabla es lo que una persona marca como hecho. Si fueran lo
 * mismo, cerrar una tarea reescribiría el acta.
 */
export const reunionCompromisos = pgTable(
  "reunion_compromisos",
  {
    id: serial("id").primaryKey(),
    reunionId: integer("reunion_id")
      .notNull()
      .references(() => reunionRegistros.id, { onDelete: "cascade" }),
    compromiso: text("compromiso").notNull(),
    responsable: varchar("responsable", { length: 160 }),
    prioridad: varchar("prioridad", { length: 10 }).notNull().default("media"),
    plazo: varchar("plazo", { length: 120 }),
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("reunion_compromisos_reunion_idx").on(t.reunionId)],
);

export type ReunionRegistro = typeof reunionRegistros.$inferSelect;
export type ReunionCompromiso = typeof reunionCompromisos.$inferSelect;
