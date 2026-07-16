/**
 * TV Mix — persistencia del estado de salas en Neon (tabla `mix_rooms`).
 *
 * La tabla se crea sola en el primer uso (CREATE TABLE IF NOT EXISTS), así el
 * demo funciona apenas se despliega, sin correr scripts a mano. También existe
 * `scripts/create-mix-tables.mjs` siguiendo la convención del resto de demos.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { mixRooms } from "@/db/schema";
import {
  defaultRoomState,
  mergePatch,
  type RoomPatch,
  type RoomProgress,
  type RoomSnapshot,
} from "@/lib/mix-types";

let tableReady: Promise<unknown> | null = null;

function ensureTable(): Promise<unknown> {
  if (!tableReady) {
    tableReady = db
      .execute(
        sql`CREATE TABLE IF NOT EXISTS mix_rooms (
          code VARCHAR(12) PRIMARY KEY,
          state JSONB NOT NULL,
          progress JSONB,
          version INTEGER NOT NULL DEFAULT 1,
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )`,
      )
      .catch((error) => {
        tableReady = null; // permitir reintento en el próximo request
        throw error;
      });
  }
  return tableReady;
}

type Row = typeof mixRooms.$inferSelect;

function toSnapshot(row: Row): RoomSnapshot {
  return { version: row.version, state: row.state, progress: row.progress ?? null };
}

/** Devuelve la sala; si no existe la crea con el estado por defecto. */
export async function getRoom(code: string): Promise<RoomSnapshot> {
  await ensureTable();
  const found = await db.select().from(mixRooms).where(eq(mixRooms.code, code));
  if (found.length > 0) return toSnapshot(found[0]);

  await db
    .insert(mixRooms)
    .values({ code, state: defaultRoomState() })
    .onConflictDoNothing();
  const created = await db.select().from(mixRooms).where(eq(mixRooms.code, code));
  return toSnapshot(created[0]);
}

/** Aplica un patch de la consola y sube la versión. */
export async function patchRoom(code: string, patch: RoomPatch): Promise<RoomSnapshot> {
  const current = await getRoom(code);
  const nextState = mergePatch(current.state, patch);
  const updated = await db
    .update(mixRooms)
    .set({ state: nextState, version: current.version + 1, updatedAt: new Date() })
    .where(eq(mixRooms.code, code))
    .returning();
  return toSnapshot(updated[0]);
}

/** Guarda telemetría de la TV (tiempos de reproducción). No sube la versión. */
export async function saveProgress(code: string, progress: RoomProgress): Promise<void> {
  await ensureTable();
  await db
    .update(mixRooms)
    .set({ progress, updatedAt: new Date() })
    .where(eq(mixRooms.code, code));
}
