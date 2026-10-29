// Gobierno y adopción de IA (gia) — el levantamiento por voz del CoE.
//
// Una persona responde seis temas hablando; cada respuesta se transcribe al
// llegar y el audio NO se guarda. Al terminar, un modelo arma su ficha: tareas
// repetitivas, uso de IA, alertas de gobierno y el perfil de adopción
// (arquetipo × madurez) con la evidencia citada de lo que dijo.
//
// El back office mezcla dos cosas, y la columna que las separa es `origen`:
// una empresa demo sembrada en código (`lib/gia/semilla.ts`, no en la base) y
// las entrevistas que se hacen en vivo durante una reunión. Solo las segundas
// viven en estas tablas.
//
// Prefijo `gia_`. Se crean con la migración de `drizzle/`.

import { index, integer, jsonb, pgTable, serial, smallint, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import type { AnalisisGia } from "../lib/gia/modelo";

/**
 * en_curso   respondiendo los temas
 * analizando terminó de hablar; el modelo arma la ficha
 * lista      ficha armada, falta que la persona la confirme
 * confirmada la persona la revisó; aparece en el back office
 * error      el análisis falló; se puede reintentar
 */
export type EstadoEntrevistaGia = "en_curso" | "analizando" | "lista" | "confirmada" | "error";

export const giaEntrevistas = pgTable(
  "gia_entrevistas",
  {
    id: serial("id").primaryKey(),
    /** Vive en el navegador de quien responde. Es su única credencial. */
    token: varchar("token", { length: 40 }).notNull(),
    /** Solo nombre de pila o como quiera aparecer: no se pide apellido ni RUT. */
    nombre: varchar("nombre", { length: 80 }).notNull(),
    cargo: varchar("cargo", { length: 160 }).notNull(),
    gerencia: varchar("gerencia", { length: 80 }).notNull(),
    estado: varchar("estado", { length: 12 }).$type<EstadoEntrevistaGia>().notNull().default("en_curso"),
    analisis: jsonb("analisis").$type<AnalisisGia>(),
    error: text("error"),
    modelo: varchar("modelo", { length: 60 }),
    confirmadaEn: timestamp("confirmada_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("gia_entrevistas_token_idx").on(t.token)],
);

/**
 * Una respuesta hablada. `ronda` 0 es la pregunta del tema; 1 es la repregunta
 * que el agente hizo sobre lo que la persona acababa de decir.
 */
export const giaRespuestas = pgTable(
  "gia_respuestas",
  {
    id: serial("id").primaryKey(),
    entrevistaId: integer("entrevista_id")
      .notNull()
      .references(() => giaEntrevistas.id, { onDelete: "cascade" }),
    tema: varchar("tema", { length: 20 }).notNull(),
    ronda: smallint("ronda").notNull().default(0),
    pregunta: text("pregunta").notNull(),
    transcripcion: text("transcripcion").notNull(),
    /** voz | texto. Texto es el respaldo cuando el micrófono no está disponible. */
    canal: varchar("canal", { length: 6 }).notNull().default("voz"),
    segundos: integer("segundos"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("gia_respuestas_turno_idx").on(t.entrevistaId, t.tema, t.ronda),
    index("gia_respuestas_entrevista_idx").on(t.entrevistaId),
  ],
);

export type GiaEntrevista = typeof giaEntrevistas.$inferSelect;
export type GiaRespuesta = typeof giaRespuestas.$inferSelect;
