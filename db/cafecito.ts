// =============================================================================
// Cafecito IA (/cafecito-ia) — esquema
// =============================================================================
//
// Dos tablas: las ediciones publicadas y quienes se suscriben.
//
// ── Por qué las ediciones viven en la base y no en archivos ──────────────────
//
// El informe se redacta fuera de este repo (en el Mac que escucha la fuente) y
// se publica por API. Si el contenido fuera MDX en el repo, cada edición
// exigiría un commit y un despliegue completo del sitio de producción tres
// veces por semana. La base desacopla publicar de desplegar.
//
// ── El slug es la fecha ──────────────────────────────────────────────────────
//
// `2026-09-05` y no un titular slugificado. El titular cambia si se corrige una
// errata; la fecha de una edición no cambia nunca, y una URL que se puede
// romper editando un texto no es una URL permanente. Además ordena solo.

import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * Las tres tazas. La metáfora no es decoración: comunica el tamaño de la lectura
 * antes de que nadie lea una palabra, que es justo lo que hay que decidir.
 */
export type CafecitoTaza = "expreso_directivo" | "expreso_builder" | "flat_white";

export const TAZAS: Record<CafecitoTaza, { nombre: string; detalle: string; minutos: string }> = {
  expreso_directivo: {
    nombre: "Expreso directivo",
    detalle: "Qué significa para el negocio: costo, riesgo y posición competitiva.",
    minutos: "2 min",
  },
  expreso_builder: {
    nombre: "Expreso builder",
    detalle: "Qué salió, cuánto cuesta y qué conviene probar. Con cifras y links.",
    minutos: "2 min",
  },
  flat_white: {
    nombre: "Flat white",
    detalle: "El informe completo, con el análisis de fondo y todos los recursos.",
    minutos: "8 min",
  },
};

export const cafecitoEdiciones = pgTable(
  "cafecito_ediciones",
  {
    id: serial("id").primaryKey(),

    /** `2026-09-05`. Es la URL: /cafecito-ia/2026-09-05. */
    slug: varchar("slug", { length: 10 }).notNull(),

    titulo: varchar("titulo", { length: 300 }).notNull(),
    /** La línea bajo el título. Se usa también como description en el <head>. */
    bajada: varchar("bajada", { length: 400 }),

    /** El cuerpo en Markdown, tal como lo dejó el redactor. */
    contenido: text("contenido").notNull(),

    /**
     * Minutos de lectura, calculados al publicar y no al renderizar: así el
     * listado los muestra sin tener que traer el cuerpo de cada edición.
     */
    lectura: varchar("lectura", { length: 20 }),

    /**
     * Una edición se guarda antes de estar visible. Sin esto, corregir una
     * errata obliga a borrar y volver a publicar, y en el intervalo la URL
     * responde 404 a quien ya la tenía abierta.
     */
    publicada: boolean("publicada").notNull().default(true),

    publicadaEn: timestamp("publicada_en").defaultNow().notNull(),
    actualizadaEn: timestamp("actualizada_en").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cafecito_ediciones_slug_idx").on(t.slug),
    index("cafecito_ediciones_publicada_idx").on(t.publicada, t.publicadaEn),
  ],
);

/**
 * Quien se suscribe. Doble opt-in en tres estados:
 *
 *   pendiente ──(clic en el correo)──> confirmado ──(clic en baja)──> baja
 *       │                                   ↑
 *       └───────────(vuelve a pedirlo)──────┘
 *
 * ── Por qué el perfilamiento va DESPUÉS de confirmar ─────────────────────────
 *
 * El formulario del sitio pide solo el correo. Pedir nombre, empresa, rol y taza
 * de entrada cuesta conversión en el momento de menor compromiso, y además los
 * datos no valen nada hasta que la dirección esté verificada. Confirmado el
 * correo, la persona ya invirtió un clic: ahí el formulario largo se completa.
 *
 * Un suscriptor confirmado SIN taza es un estado válido y esperable — confirmó
 * pero abandonó el perfilamiento. Recibe el expreso directivo por defecto; se
 * prefiere mandarle algo a dejarlo en el limbo tras haber dicho que sí.
 *
 * ── Dos tokens, no uno ───────────────────────────────────────────────────────
 *
 * El de confirmación vence: un link que valida una dirección de correo no puede
 * seguir siendo válido un año después. El de baja no vence nunca, porque va en
 * el pie de cada edición y tiene que funcionar en la que se abra dentro de dos
 * años. Reutilizar uno solo obligaría a elegir entre las dos cosas.
 *
 * La fila nunca se borra: se marca `baja_en`. Borrarla permitiría que un
 * reenvío del formulario resucite a quien pidió salir.
 */
export const cafecitoSuscriptores = pgTable(
  "cafecito_suscriptores",
  {
    id: serial("id").primaryKey(),

    email: varchar("email", { length: 254 }).notNull(),

    /** pendiente | confirmado | baja */
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),

    // Datos del perfilamiento. Nulos hasta que la persona complete el formulario.
    nombre: varchar("nombre", { length: 160 }),
    empresa: varchar("empresa", { length: 160 }),
    rol: varchar("rol", { length: 160 }),
    taza: varchar("taza", { length: 30 }).$type<CafecitoTaza>(),

    /** De dónde entró: `web` hoy; deja lugar a importaciones futuras. */
    origen: varchar("origen", { length: 30 }).notNull().default("web"),

    tokenConfirmacion: varchar("token_confirmacion", { length: 64 }),
    /** Sin esto, un link de verificación sería válido para siempre. */
    confirmacionExpiraEn: timestamp("confirmacion_expira_en"),
    confirmadoEn: timestamp("confirmado_en"),

    /** Permanente: viaja en el pie de cada correo y no puede caducar. */
    tokenBaja: varchar("token_baja", { length: 64 }).notNull(),
    bajaEn: timestamp("baja_en"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cafecito_suscriptores_email_idx").on(t.email),
    uniqueIndex("cafecito_suscriptores_conf_idx").on(t.tokenConfirmacion),
    uniqueIndex("cafecito_suscriptores_baja_idx").on(t.tokenBaja),
    index("cafecito_suscriptores_envio_idx").on(t.estado, t.taza),
  ],
);

export type CafecitoEdicion = typeof cafecitoEdiciones.$inferSelect;
export type NuevaCafecitoEdicion = typeof cafecitoEdiciones.$inferInsert;
export type CafecitoSuscriptor = typeof cafecitoSuscriptores.$inferSelect;
export type NuevoCafecitoSuscriptor = typeof cafecitoSuscriptores.$inferInsert;
