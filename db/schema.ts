import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
