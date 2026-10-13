// Pulso IA — el diagnóstico en vivo de las charlas de Nelson.
//
// Reemplaza el rompehielos de Slido. La sala responde cinco preguntas con el
// celular, la pantalla arma el mapa de madurez en tiempo real y, al final de la
// misma dinámica (no al comienzo), cada uno puede dejar sus datos para recibir
// su resultado. Quien no los deja sigue contando en el mapa: la respuesta es
// anónima hasta que la persona decide lo contrario.
//
// Dos tablas, prefijo `pulso_`. Las crea `scripts/pulso-setup.mjs`.

import {
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
  boolean,
} from "drizzle-orm/pg-core";

/**
 * inicio  la sala responde las cinco preguntas
 * cierre  al terminar la charla se repiten dos, para el antes/después
 * cerrada ya no recibe respuestas; el mapa queda como registro
 */
export type PulsoFase = "inicio" | "cierre" | "cerrada";

/** Una charla. El `codigo` es lo que va en el QR: adoops.digital/p/CODIGO. */
export const pulsoSesiones = pgTable(
  "pulso_sesiones",
  {
    id: serial("id").primaryKey(),
    codigo: varchar("codigo", { length: 12 }).notNull(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    /** La organización tal como se la nombra en la sala. */
    organizacion: varchar("organizacion", { length: 200 }).notNull(),
    /** La misma organización en el motor de prospección, si se pudo resolver. */
    empresaId: integer("empresa_id"),
    relator: varchar("relator", { length: 120 }).notNull().default("Nelson García"),
    fase: varchar("fase", { length: 12 }).$type<PulsoFase>().notNull().default("inicio"),
    fecha: timestamp("fecha").defaultNow().notNull(),
    /** La señal que dejó en el motor al cerrarse. Evita duplicarla. */
    senalId: integer("senal_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("pulso_sesiones_codigo_idx").on(t.codigo)],
);

/**
 * Una persona en una charla. Se identifica por un token que vive en su
 * navegador: así vuelve al cierre y responde las dos preguntas finales sobre la
 * misma fila, sin haber dado su nombre.
 */
export const pulsoRespuestas = pgTable(
  "pulso_respuestas",
  {
    id: serial("id").primaryKey(),
    sesionId: integer("sesion_id").notNull(),
    token: varchar("token", { length: 40 }).notNull(),

    // ── Inicio ──
    uso: smallint("uso").notNull(),
    tarea: text("tarea"),
    freno: varchar("freno", { length: 30 }).notNull(),
    expectativa: smallint("expectativa").notNull(),
    rol: varchar("rol", { length: 30 }).notNull(),
    cuadrante: varchar("cuadrante", { length: 20 }).notNull(),

    // ── Cierre ──
    expectativaCierre: smallint("expectativa_cierre"),
    frenoCierre: varchar("freno_cierre", { length: 30 }),
    cierreEn: timestamp("cierre_en"),

    // ── Datos, solo si los deja (al final) ──
    nombre: varchar("nombre", { length: 160 }),
    cargo: varchar("cargo", { length: 200 }),
    email: varchar("email", { length: 254 }),
    /** E.164 sin '+', igual que el CRM y el motor. */
    telefono: varchar("telefono", { length: 20 }),
    /** Aceptó recibir su resultado y seguir en contacto. Sin esto no se guarda contacto. */
    consiente: boolean("consiente").notNull().default(false),
    contactoEn: timestamp("contacto_en"),
    /** La persona en el motor (`lead_personas`), cuando dejó datos. */
    leadPersonaId: integer("lead_persona_id"),
    resultadoEnviadoEn: timestamp("resultado_enviado_en"),

    extra: jsonb("extra"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("pulso_respuestas_token_idx").on(t.sesionId, t.token),
    index("pulso_respuestas_sesion_idx").on(t.sesionId),
  ],
);

export type PulsoSesion = typeof pulsoSesiones.$inferSelect;
export type PulsoRespuesta = typeof pulsoRespuestas.$inferSelect;
