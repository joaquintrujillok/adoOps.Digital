// =============================================================================
// CRM de adoOps — esquema (/dashboard360/crm)
// =============================================================================
//
// Cuatro tablas con prefijo `venta_`: empresas, contactos, oportunidades y
// actividades. Es el CRM clásico y nada más que eso.
//
// ── Por qué no reusa `crm_*` ─────────────────────────────────────────────────
//
// Porque `crm_*` no es un CRM genérico: es el sistema de Highend montado como
// demo. Tiene audiciones, salas, inventario de relojes, cotizaciones con items y
// una conversación de WhatsApp por contacto. Treinta tablas hechas a la medida de
// una tienda de alta relojería, con datos sembrados adentro que se muestran a
// prospectos.
//
// Colgar de ahí el pipeline real de adoOps mezclaría clientes de verdad con
// fichas inventadas en la misma tabla, que es exactamente lo que `lib/modulos.ts`
// existe para impedir. Y al revés: cada cambio del demo de Highend obligaría a
// pensar si rompe la cartera propia.
//
// ── Qué se copió de allá ─────────────────────────────────────────────────────
//
// La forma, que está probada: empresa opcional, contacto obligatorio, la
// probabilidad como columna sobrescribible, y `ultimaActividad` desnormalizada
// para poder ordenar por "hace cuánto que nadie toca esto" sin un join.
//
// ── La invariante ────────────────────────────────────────────────────────────
//
// UNA OPORTUNIDAD SIEMPRE TIENE CONTACTO. Las empresas son opcionales y muchas
// veces llegan después —al principio uno conoce a una persona, no a un área de
// compras—. Pero una oportunidad sin nadie con quien hablar no es una
// oportunidad: es una idea, y las ideas no van en el pipeline porque inflan el
// pronóstico sin que nadie pueda hacer nada con ellas.

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

// ─── Empresas ────────────────────────────────────────────────────────────────

export const ventaEmpresas = pgTable(
  "venta_empresas",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    rubro: varchar("rubro", { length: 120 }),
    sitio: varchar("sitio", { length: 200 }),
    /** "1-10", "11-50"… Texto y no número: nadie sabe el head count exacto. */
    tamano: varchar("tamano", { length: 40 }),
    ciudad: varchar("ciudad", { length: 120 }),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("venta_empresas_nombre_idx").on(t.nombre)],
);

// ─── Contactos ───────────────────────────────────────────────────────────────

export const ventaContactos = pgTable(
  "venta_contactos",
  {
    id: serial("id").primaryKey(),
    /** Null mientras no se sepa dónde trabaja, que al principio es lo normal. */
    empresaId: integer("empresa_id").references(() => ventaEmpresas.id),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    cargo: varchar("cargo", { length: 160 }),
    email: varchar("email", { length: 254 }),
    telefono: varchar("telefono", { length: 40 }),
    linkedin: varchar("linkedin", { length: 300 }),
    notas: text("notas"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("venta_contactos_empresa_idx").on(t.empresaId),
    index("venta_contactos_nombre_idx").on(t.nombre),
  ],
);

// ─── Oportunidades ───────────────────────────────────────────────────────────

export const ventaOportunidades = pgTable(
  "venta_oportunidades",
  {
    id: serial("id").primaryKey(),
    /** Obligatorio. Ver la invariante en la cabecera de este archivo. */
    contactoId: integer("contacto_id")
      .notNull()
      .references(() => ventaContactos.id),
    empresaId: integer("empresa_id").references(() => ventaEmpresas.id),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    etapa: varchar("etapa", { length: 20 }).notNull().default("nuevo"),
    /** CLP. Cero significa "todavía no se sabe", no "gratis". */
    monto: integer("monto").notNull().default(0),
    /**
     * Se siembra con la de la etapa al mover, y se puede corregir a mano. La
     * etapa dice en qué parte del proceso está; la probabilidad es un juicio
     * sobre ESTE negocio, y quien vende sabe más que la tabla.
     */
    probabilidad: smallint("probabilidad").notNull().default(5),
    fuente: varchar("fuente", { length: 40 }),
    cierreEstimado: date("cierre_estimado"),

    abiertoEn: timestamp("abierto_en", { withTimezone: true }).defaultNow().notNull(),
    cerradoEn: timestamp("cerrado_en", { withTimezone: true }),
    motivoPerdida: varchar("motivo_perdida", { length: 300 }),

    /**
     * Última vez que alguien hizo algo. Desnormalizada a propósito: la pregunta
     * "¿qué está frío?" se hace sobre el tablero entero, y resolverla con un
     * join a actividades por cada tarjeta es el tipo de consulta que se nota.
     */
    ultimaActividad: timestamp("ultima_actividad", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("venta_oportunidades_etapa_idx").on(t.etapa),
    index("venta_oportunidades_contacto_idx").on(t.contactoId),
    index("venta_oportunidades_empresa_idx").on(t.empresaId),
  ],
);

// ─── Actividades ─────────────────────────────────────────────────────────────

/**
 * Qué pasó y cuándo. Es el registro que convierte una ficha en una historia.
 *
 * No se borra ni se edita desde la pantalla: una actividad es algo que ocurrió.
 * Corregir el pasado en un CRM es cómo se pierde la confianza en el CRM.
 */
export const ventaActividades = pgTable(
  "venta_actividades",
  {
    id: serial("id").primaryKey(),
    oportunidadId: integer("oportunidad_id").references(() => ventaOportunidades.id, {
      onDelete: "cascade",
    }),
    contactoId: integer("contacto_id").references(() => ventaContactos.id),
    tipo: varchar("tipo", { length: 20 }).notNull().default("nota"),
    detalle: text("detalle").notNull(),
    /** Quién lo registró. El nombre de la sesión, no un id: sobrevive al usuario. */
    autor: varchar("autor", { length: 160 }),
    ocurrioEn: timestamp("ocurrio_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("venta_actividades_oportunidad_idx").on(t.oportunidadId),
    index("venta_actividades_fecha_idx").on(t.ocurrioEn),
  ],
);

export type VentaEmpresa = typeof ventaEmpresas.$inferSelect;
export type VentaContacto = typeof ventaContactos.$inferSelect;
export type VentaOportunidad = typeof ventaOportunidades.$inferSelect;
export type VentaActividad = typeof ventaActividades.$inferSelect;
