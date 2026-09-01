// =============================================================================
// Máquina de contenido — esquema (/dashboard360/contenido)
// =============================================================================
//
// Tres tablas con prefijo `contenido_`. Es la hermana de `lead_*`: misma forma
// —cola, visto bueno, punto único de salida, registro de lo que salió— pero
// resuelve el problema opuesto.
//
// El motor le escribe a desconocidos, así que su riesgo es a quién le habla y
// por eso su esquema gira en torno a la procedencia y al warm-up. Acá se publica
// en el perfil propio: no hay a quién molestar y no hay cuenta que quemar. El
// riesgo se mudó a otro lado.
//
// ── Las dos invariantes de este esquema ──────────────────────────────────────
//
// 1. EL URN SE GUARDA AL RECIBIR EL 201, O SE PIERDE PARA SIEMPRE.
//    `r_member_social` —el permiso para releer las publicaciones propias— es
//    restringido y no se puede pedir. Verificado el 25-08-2026: la API publica
//    pero no deja consultar qué se publicó. El identificador viene en el header
//    `x-restli-id` de la respuesta y ese es el único momento en que existe.
//    Por eso `contenido_publicaciones` es una tabla y no una columna: si el
//    envío falla, igual queda la fila con el error. Es la misma lección de
//    `pre_quotes.salucloud_env` en el CRM de CDC — el estado se guarda con el
//    dato, no se deduce después.
//
// 2. EL TOKEN VENCE Y NADIE AVISA.
//    Los access tokens de LinkedIn duran 60 días y los refresh programáticos
//    están limitados a partners. Con varios emisores son varios relojes en
//    paralelo, y el síntoma de uno vencido es que ese perfil deja de publicar en
//    silencio. Por eso `tokenVenceEn` es columna de primera clase y no un dato
//    que se calcula al vuelo: la pantalla tiene que poder ordenar por ella.
//
// ── Sobre guardar el token en la base ────────────────────────────────────────
//
// `scripts/google-ads-oauth.mjs` dice, con razón, que un token de larga vida no
// se guarda en un archivo del proyecto: va a las variables de entorno. Acá no se
// puede seguir esa regla y conviene decir por qué en vez de dejarlo pasar: son N
// tokens, uno por persona, que rotan cada dos meses y que la propia pantalla
// tiene que poder reemplazar. Una variable de entorno por emisor obligaría a
// redesplegar cada vez que alguien reautoriza.
//
// La consecuencia es que estas filas son material sensible: quien lee esta tabla
// puede publicar en nombre de esas personas. No se exponen por API, no salen en
// logs, y el token nunca viaja al cliente — la pantalla muestra el vencimiento,
// nunca el valor.

import {
  date,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/** Quién publica. Una persona con su perfil, o la página de la empresa. */
export type TipoEmisor = "persona" | "organizacion";

/** En qué formato sale una pieza. Los cuatro están verificados contra la API. */
export type FormatoPieza = "texto" | "imagen" | "documento" | "video";

/**
 * El recorrido de una pieza. `aprobada` es el visto bueno humano y es la única
 * puerta hacia `programada`: nada llega a LinkedIn sin pasar por acá.
 */
export type EstadoPieza =
  | "borrador"
  | "revision"
  | "aprobada"
  | "programada"
  | "publicada"
  | "descartada";

// ─── Emisores ────────────────────────────────────────────────────────────────

/**
 * Los perfiles conectados.
 *
 * Un emisor es una autorización, no una persona: si alguien reautoriza, se
 * reemplaza el token y el vencimiento sobre la misma fila. El histórico de lo
 * que publicó vive en `contenido_publicaciones` y no se pierde.
 */
export const contenidoEmisores = pgTable(
  "contenido_emisores",
  {
    id: serial("id").primaryKey(),
    /** Nombre visible. El de la persona o el de la página. */
    nombre: varchar("nombre", { length: 200 }).notNull(),
    tipo: varchar("tipo", { length: 20 }).$type<TipoEmisor>().notNull().default("persona"),
    /**
     * Qué ángulo le toca en el programa editorial: `socio legal`, `técnico`,
     * `gobernanza`, `página`. Texto libre a propósito — el reparto de voces
     * cambia por cliente y no vale la pena un enum que haya que migrar.
     */
    rol: varchar("rol", { length: 60 }),

    /**
     * El `author` que va en el POST: `urn:li:person:{sub}` para personas,
     * `urn:li:organization:{id}` para la página. Se resuelve una vez, al
     * conectar, desde `/v2/userinfo`. Null mientras no se haya conectado.
     */
    autorUrn: varchar("autor_urn", { length: 120 }),

    /**
     * El access token. Nunca sale de la capa de servidor. Ver la nota sobre
     * credenciales en la cabecera de este archivo.
     */
    token: text("token"),
    /** Los scopes que se concedieron, para diagnosticar un 403 sin adivinar. */
    scopes: varchar("scopes", { length: 200 }),
    /**
     * Cuándo deja de servir el token. **La columna que justifica la pantalla.**
     * Se calcula al conectar, sumando el `expires_in` que devuelve LinkedIn.
     */
    tokenVenceEn: timestamp("token_vence_en"),
    /** Cuándo se conectó por última vez, para saber si alguien ya reautorizó. */
    conectadoEn: timestamp("conectado_en"),

    /**
     * Pausado a mano. Distinto de "sin token": el emisor está sano pero no le
     * toca publicar — alguien de vacaciones, o una voz que se guarda para
     * después.
     */
    pausado: smallint("pausado").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("contenido_emisores_vence_idx").on(t.tokenVenceEn)],
);

// ─── Piezas ──────────────────────────────────────────────────────────────────

/**
 * El repositorio de contenido: cada borrador, en el estado en que esté.
 *
 * `slot` y `fechaObjetivo` vienen del programa editorial y no del sistema: el
 * calendario se decide antes y la máquina lo ejecuta. Una pieza sin fecha es
 * material de banco, y es válido — se saca cuando haga falta.
 */
export const contenidoPiezas = pgTable(
  "contenido_piezas",
  {
    id: serial("id").primaryKey(),
    emisorId: integer("emisor_id").references(() => contenidoEmisores.id),

    /** Número de slot en el programa. Null si es material suelto. */
    slot: smallint("slot"),
    fechaObjetivo: date("fecha_objetivo"),

    formato: varchar("formato", { length: 20 })
      .$type<FormatoPieza>()
      .notNull()
      .default("texto"),
    /** Referencia interna para la pantalla. No se publica. */
    titulo: varchar("titulo", { length: 200 }).notNull(),
    /** El texto tal como va a salir. Lo que se aprueba es esto, carácter por carácter. */
    cuerpo: text("cuerpo").notNull(),

    /**
     * El medio adjunto, si lo hay: `urn:li:document:...` para un PDF,
     * `urn:li:image:...` para una imagen. Se sube antes de publicar y el URN
     * queda acá para no volver a subirlo si el envío se reintenta.
     */
    medioUrn: varchar("medio_urn", { length: 120 }),
    medioNombre: varchar("medio_nombre", { length: 200 }),

    estado: varchar("estado", { length: 20 })
      .$type<EstadoPieza>()
      .notNull()
      .default("borrador"),

    /** A qué segmento apunta y qué servicio empuja. Para leer el programa, no para filtrar. */
    segmento: varchar("segmento", { length: 120 }),
    servicio: varchar("servicio", { length: 120 }),

    /**
     * Quién dio el visto bueno y cuándo. Si `aprobadaPor` está vacío, esta pieza
     * no pasó por una persona — y entonces no sale. Es el candado 1 del motor,
     * con el mismo criterio: un texto generado que se publica sin revisar es el
     * que termina diciendo algo absurdo con la marca al lado.
     */
    aprobadaPor: varchar("aprobada_por", { length: 120 }),
    aprobadaEn: timestamp("aprobada_en"),

    /**
     * Rendimiento, **llenado a mano**. `r_member_social` es restringido, así que
     * la API no devuelve métricas de las publicaciones propias. Se copian del
     * panel de LinkedIn. Un dato manual y fechado es honesto; uno inventado no.
     */
    impresiones: integer("impresiones"),
    interacciones: integer("interacciones"),
    metricasEn: timestamp("metricas_en"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("contenido_piezas_estado_idx").on(t.estado),
    index("contenido_piezas_fecha_idx").on(t.fechaObjetivo),
  ],
);

// ─── Publicaciones ───────────────────────────────────────────────────────────

/**
 * Qué salió, cuándo y con qué resultado. Una fila por intento, no por éxito.
 *
 * Se guarda el intento fallido a propósito: si una pieza no salió, la pregunta
 * que se hace después es "¿por qué?", y la respuesta tiene que estar acá y no en
 * un log que rotó. Es la misma razón por la que el motor registra los frenos.
 */
export const contenidoPublicaciones = pgTable(
  "contenido_publicaciones",
  {
    id: serial("id").primaryKey(),
    piezaId: integer("pieza_id")
      .references(() => contenidoPiezas.id)
      .notNull(),
    emisorId: integer("emisor_id").references(() => contenidoEmisores.id),

    /**
     * El `x-restli-id` de la respuesta. Llega como `urn:li:share:...` o
     * `urn:li:ugcPost:...` según el caso — se guarda el string completo tal como
     * viene, sin asumir el prefijo, porque la doc admite los dos.
     */
    urn: varchar("urn", { length: 120 }),
    /** El código HTTP. 201 es éxito; cualquier otra cosa deja `error` lleno. */
    http: smallint("http"),
    error: text("error"),

    /** `PUBLIC` o `CONNECTIONS`. Queda registrado con qué alcance salió. */
    visibilidad: varchar("visibilidad", { length: 20 }),
    /** Si fue una corrida en seco. El motor tiene el mismo interruptor. */
    simulado: smallint("simulado").notNull().default(0),

    publicadaEn: timestamp("publicada_en").defaultNow().notNull(),
  },
  (t) => [index("contenido_publicaciones_pieza_idx").on(t.piezaId)],
);

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ContenidoEmisor = typeof contenidoEmisores.$inferSelect;
export type ContenidoPieza = typeof contenidoPiezas.$inferSelect;
export type ContenidoPublicacion = typeof contenidoPublicaciones.$inferSelect;
