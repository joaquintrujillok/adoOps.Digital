import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
// Import relativo (no alias) para que drizzle-kit resuelva sin tsconfig paths.
import type {
  RoomProgress as MixRoomProgress,
  RoomState as MixRoomState,
} from "../lib/mix-types";

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

// Demo selector — una sola fila, actualizada desde /admin
export const demoSettings = pgTable("demo_settings", {
  id: serial("id").primaryKey(),
  activeDemo: varchar("active_demo", { length: 20 }).notNull().default("terreno"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FieldReport = typeof fieldReports.$inferSelect;
export type NewFieldReport = typeof fieldReports.$inferInsert;
export type WorkSheet = typeof workSheets.$inferSelect;
export type NewWorkSheet = typeof workSheets.$inferInsert;

// =============================================================================
// Demo "Actas de Reunión" — WhatsApp (WaSender) → IA → dashboard (/actas)
// =============================================================================

/** Estructura completa que la IA extrae del audio/texto de una reunión. */
export type ActaExtraction = {
  reunion: {
    titulo: string | null;
    fecha: string | null;
    lugar: string | null;
    participantes: string[];
    duracion: string | null;
  };
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

export type CompromisoItem = {
  compromiso: string;
  responsable: string | null;
  prioridad: "alta" | "media" | "baja";
  plazo: string | null;
};

export const actaReports = pgTable("acta_reports", {
  id: serial("id").primaryKey(),

  // Origen del mensaje
  senderPhone: varchar("sender_phone", { length: 40 }).notNull(),
  senderName: varchar("sender_name", { length: 160 }),
  source: varchar("source", { length: 10 }).notNull().default("audio"), // audio | texto
  waMessageId: varchar("wa_message_id", { length: 128 }),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),

  // Columnas KPI desnormalizadas (para dashboard rápido)
  titulo: varchar("titulo", { length: 200 }),
  fecha: varchar("fecha", { length: 120 }),
  lugar: varchar("lugar", { length: 160 }),
  participantes: jsonb("participantes").$type<string[]>(),

  // Datos completos + resumen ejecutivo
  extraction: jsonb("extraction").$type<ActaExtraction>(),
  executiveSummary: text("executive_summary"),
  decisiones: jsonb("decisiones").$type<string[]>(),

  // Validación humana
  status: varchar("status", { length: 20 }).notNull().default("pendiente"), // pendiente | validado | corregido
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validatedAt: timestamp("validated_at"),
});

export const compromisos = pgTable("compromisos", {
  id: serial("id").primaryKey(),
  actaId: integer("acta_id")
    .notNull()
    .references(() => actaReports.id, { onDelete: "cascade" }),
  compromiso: text("compromiso").notNull(),
  responsable: varchar("responsable", { length: 160 }),
  prioridad: varchar("prioridad", { length: 10 }).notNull().default("media"), // alta | media | baja
  plazo: varchar("plazo", { length: 120 }),
  estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActaReport = typeof actaReports.$inferSelect;
export type NewActaReport = typeof actaReports.$inferInsert;
export type Compromiso = typeof compromisos.$inferSelect;
export type NewCompromiso = typeof compromisos.$inferInsert;

// =============================================================================
// Demo "Incidencias / Mantención" — WhatsApp (WaSender) → IA → dashboard (/mantencion)
// =============================================================================

/** Estructura completa que la IA extrae del audio/texto de una incidencia. */
export type IncidenciaExtraction = {
  identificacion: {
    equipo: string | null;
    codigoActivo: string | null;
    ubicacion: string | null;
    reportadoPor: string | null;
    fecha: string | null;
  };
  falla: {
    tipo: string | null;
    descripcion: string | null;
    severidad: "critica" | "alta" | "media" | "baja" | null;
    estadoEquipo: "detenido" | "operativo_con_riesgo" | "operativo" | null;
  };
  sintomas: string[];
  impacto: string | null;
  repuestos: string[];
  ordenesTrabajo: {
    tarea: string;
    responsableSugerido: string | null;
    prioridad: "alta" | "media" | "baja";
    plazo: string | null;
    repuestos: string | null;
  }[];
};

export type OrdenItem = {
  tarea: string;
  responsableSugerido: string | null;
  prioridad: "alta" | "media" | "baja";
  plazo: string | null;
  repuestos: string | null;
};

export const incidencias = pgTable("incidencias", {
  id: serial("id").primaryKey(),

  // Origen del mensaje
  senderPhone: varchar("sender_phone", { length: 40 }).notNull(),
  senderName: varchar("sender_name", { length: 160 }),
  source: varchar("source", { length: 10 }).notNull().default("audio"), // audio | texto
  waMessageId: varchar("wa_message_id", { length: 128 }),
  audioUrl: text("audio_url"),
  transcript: text("transcript"),

  // Columnas KPI desnormalizadas (para dashboard rápido)
  equipo: varchar("equipo", { length: 160 }),
  codigoActivo: varchar("codigo_activo", { length: 80 }),
  ubicacion: varchar("ubicacion", { length: 160 }),
  reportadoPor: varchar("reportado_por", { length: 160 }),
  tipoFalla: varchar("tipo_falla", { length: 160 }),
  severidad: varchar("severidad", { length: 20 }), // critica | alta | media | baja
  estadoEquipo: varchar("estado_equipo", { length: 30 }), // detenido | operativo_con_riesgo | operativo

  // Datos completos + resumen ejecutivo
  extraction: jsonb("extraction").$type<IncidenciaExtraction>(),
  executiveSummary: text("executive_summary"),
  alertas: jsonb("alertas").$type<string[]>(),

  // Validación humana
  status: varchar("status", { length: 20 }).notNull().default("pendiente"), // pendiente | validado | corregido
  createdAt: timestamp("created_at").defaultNow().notNull(),
  validatedAt: timestamp("validated_at"),
});

export const ordenesTrabajo = pgTable("ordenes_trabajo", {
  id: serial("id").primaryKey(),
  incidenciaId: integer("incidencia_id")
    .notNull()
    .references(() => incidencias.id, { onDelete: "cascade" }),
  tarea: text("tarea").notNull(),
  responsableSugerido: varchar("responsable_sugerido", { length: 160 }),
  prioridad: varchar("prioridad", { length: 10 }).notNull().default("media"), // alta | media | baja
  plazo: varchar("plazo", { length: 120 }),
  repuestos: text("repuestos"),
  estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Incidencia = typeof incidencias.$inferSelect;
export type NewIncidencia = typeof incidencias.$inferInsert;
export type OrdenTrabajo = typeof ordenesTrabajo.$inferSelect;
export type NewOrdenTrabajo = typeof ordenesTrabajo.$inferInsert;

// =============================================================================
// TV Mix — mixer de YouTube sincronizado con TV (/mix consola · /tv pantalla)
// =============================================================================

/**
 * Estado compartido de una sala de mixeo. La consola (celular/computador)
 * escribe `state`; la TV escribe `progress` (telemetría de reproducción,
 * no incrementa `version`).
 */
export const mixRooms = pgTable("mix_rooms", {
  code: varchar("code", { length: 12 }).primaryKey(),
  state: jsonb("state").$type<MixRoomState>().notNull(),
  progress: jsonb("progress").$type<MixRoomProgress>(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MixRoom = typeof mixRooms.$inferSelect;
export type NewMixRoom = typeof mixRooms.$inferInsert;
