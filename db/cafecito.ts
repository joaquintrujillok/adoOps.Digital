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
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/** Los dos públicos del boletín. El sitio publica una tercera versión, más larga. */
export type CafecitoPerfil = "direccion" | "builder";

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
 * Quien se suscribe desde el sitio.
 *
 * `perfil` decide qué variante recibe. No es un dato opcional que se pregunta
 * después: el boletín sale segmentado desde el primer envío, y un suscriptor
 * sin perfil no tiene a qué lista entrar.
 *
 * `bajaEn` vive acá y no en otra tabla, por la misma razón que la supresión del
 * motor de nurturing: la baja es de la persona y es para siempre. Nunca se
 * borra la fila — borrarla permitiría que un reenvío de formulario la resucite.
 */
export const cafecitoSuscriptores = pgTable(
  "cafecito_suscriptores",
  {
    id: serial("id").primaryKey(),

    email: varchar("email", { length: 254 }).notNull(),
    nombre: varchar("nombre", { length: 160 }),
    perfil: varchar("perfil", { length: 20 }).$type<CafecitoPerfil>().notNull(),

    /** De dónde entró: `web` hoy; deja lugar a importaciones o formularios futuros. */
    origen: varchar("origen", { length: 30 }).notNull().default("web"),

    /**
     * Token de un solo uso para el link de baja de cada correo. Se genera al
     * suscribirse: sin él, dar de baja exigiría un login que nadie va a hacer.
     */
    token: varchar("token", { length: 40 }).notNull(),

    bajaEn: timestamp("baja_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cafecito_suscriptores_email_idx").on(t.email),
    index("cafecito_suscriptores_perfil_idx").on(t.perfil, t.bajaEn),
    uniqueIndex("cafecito_suscriptores_token_idx").on(t.token),
  ],
);

export type CafecitoEdicion = typeof cafecitoEdiciones.$inferSelect;
export type NuevaCafecitoEdicion = typeof cafecitoEdiciones.$inferInsert;
export type CafecitoSuscriptor = typeof cafecitoSuscriptores.$inferSelect;
export type NuevoCafecitoSuscriptor = typeof cafecitoSuscriptores.$inferInsert;
