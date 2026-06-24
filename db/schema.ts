import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  empresa: varchar("empresa", { length: 120 }).notNull(),
  rol: varchar("rol", { length: 120 }),
  tipo: varchar("tipo", { length: 40 }).notNull().default("Assessment"),
  mensaje: text("mensaje"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;

// =============================================================================
// Demo "Reportes de Terreno" — WhatsApp (WaSender) → IA → dashboard
// =============================================================================

/**
 * Estructura completa que la IA extrae del audio/texto de terreno.
 * Calca las 6 categorías del documento de campo.
 */
export type FieldExtraction = {
  identificacion: {
    cliente: string | null;
    sector: string | null;
    cuarteles: string[];
    fecha: string | null;
    responsable: string | null;
    equipo: string | null;
  };
  actividad: {
    tipoTrabajo: string | null;
    avancePct: number | null;
    unidadesRevisadas: string | null;
    estadoTarea: "iniciada" | "en_curso" | "terminada" | "pendiente" | null;
  };
  hallazgos: string[];
  recursos: {
    personas: number | null;
    horas: number | null;
    equiposMateriales: string[];
    insumos: string[];
  };
  evidencias: {
    fotos: number | null;
    pendientes: string[];
    ubicacion: string | null;
  };
  proximasAcciones: string[];
};

export type WorkSheetItem = {
  tarea: string;
  responsableSugerido: string | null;
  prioridad: "alta" | "media" | "baja";
  plazo: string | null;
  recursos: string | null;
  evidenciaRequerida: string | null;
};

export const fieldReports = pgTable("field_reports", {
  id: serial("id").primaryKey(),

  // Origen del mensaje
  senderPhone: varchar("sender_phone", { length: 40 }).notNull(),
  senderName: varchar("sender_name", { length: 160 }),
  source: varchar("source", { length: 10 }).notNull().default("audio"), // audio | texto
  waMessageId: varchar("wa_message_id", { length: 128 }),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),

  // Columnas KPI desnormalizadas (para dashboard rápido)
  cliente: varchar("cliente", { length: 160 }),
  sector: varchar("sector", { length: 120 }),
  cuarteles: text("cuarteles"),
  responsable: varchar("responsable", { length: 160 }),
  equipoPersonas: integer("equipo_personas"),
  avancePct: integer("avance_pct"),
  hectareas: integer("hectareas"),
  estadoTarea: varchar("estado_tarea", { length: 20 }),

  // Datos completos + resumen ejecutivo
  extraction: jsonb("extraction").$type<FieldExtraction>(),
  executiveSummary: text("executive_summary"),
  incidencias: jsonb("incidencias").$type<string[]>(),

  // Validación humana
  status: varchar("status", { length: 20 }).notNull().default("pendiente"), // pendiente | validado | corregido
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validatedAt: timestamp("validated_at"),
});

export const workSheets = pgTable("work_sheets", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id")
    .notNull()
    .references(() => fieldReports.id, { onDelete: "cascade" }),
  tarea: text("tarea").notNull(),
  responsableSugerido: varchar("responsable_sugerido", { length: 160 }),
  prioridad: varchar("prioridad", { length: 10 }).notNull().default("media"), // alta | media | baja
  plazo: varchar("plazo", { length: 120 }),
  recursos: text("recursos"),
  evidenciaRequerida: text("evidencia_requerida"),
  estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FieldReport = typeof fieldReports.$inferSelect;
export type NewFieldReport = typeof fieldReports.$inferInsert;
export type WorkSheet = typeof workSheets.$inferSelect;
export type NewWorkSheet = typeof workSheets.$inferInsert;
