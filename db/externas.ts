// =============================================================================
// Tablas AJENAS a este proyecto
// =============================================================================
//
// Esta base de Neon la comparten varios proyectos. Las tablas de acá NO son de
// adoOps: no las lee ni las escribe ningún código de este repo.
//
// ── Entonces por qué están declaradas ────────────────────────────────────────
//
// Porque `drizzle-kit push` sincroniza la base al esquema: toda tabla que exista
// y no esté declarada la interpreta como sobrante y propone eliminarla. El 3 de
// septiembre de 2026 propuso borrar 14 tablas con datos reales por exactamente
// este motivo. Declararlas tal cual son las vuelve invisibles al diff — no
// generan ningún cambio — y a la vez las protege.
//
// ── Reglas ───────────────────────────────────────────────────────────────────
//
// 1. NO se usan desde este repo. Si algún día adoOps necesita estos datos, se
//    accede por una API del proyecto dueño, no por SQL directo: dos proyectos
//    escribiendo las mismas tablas sin un dueño claro es cómo se corrompen.
// 2. NO se modifican acá. Si el proyecto dueño les cambia la forma, esta
//    declaración se actualiza para reflejarlo, nunca al revés.
// 3. La definición debe calcar la realidad. Cualquier diferencia hace que una
//    migración de adoOps altere tablas de otro proyecto.
//
// ── Pendiente ────────────────────────────────────────────────────────────────
//
// La solución de fondo es moverlas a su propio esquema de Postgres
// (`CREATE SCHEMA memoria`), porque drizzle solo mira `public` y dejarían de
// estar al alcance de cualquier migración de este repo. Requiere coordinar con
// el proyecto dueño; mientras tanto, esta declaración es la red de seguridad.

import { bigserial, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Historial de mensajes de una app de conversación. Ajena. */
export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    conversationId: text("conversation_id").notNull().default("family"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("idx_messages_conv").on(t.conversationId, t.id)],
);

/** Memoria persistente de esa misma app. Ajena. */
export const memories = pgTable("memories", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  conversationId: text("conversation_id").notNull().default("family"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
