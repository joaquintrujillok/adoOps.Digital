// Lecturas y escrituras del levantamiento (/gia).
//
// Las lecturas del back office van envueltas: si las tablas no existen o la
// base falla, la pantalla muestra solo la empresa demo sembrada en vez de caerse
// (ver la nota de `lib/cafecito/consultas.ts` en AGENTS.md).

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { giaEntrevistas, giaRespuestas, type GiaEntrevista } from "@/db/gia";
import { TEMAS, type AnalisisGia } from "./modelo";

export function tokenValido(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);
}

export function nuevoToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Respuestas por entrevista: un turno por tema y a lo más una repregunta cada uno. */
export const MAX_TURNOS = TEMAS.length * 2;

export async function crearEntrevista(p: { nombre: string; cargo: string; gerencia: string }): Promise<string> {
  const token = nuevoToken();
  await db.insert(giaEntrevistas).values({ token, ...p });
  return token;
}

export async function entrevistaPorToken(token: string): Promise<GiaEntrevista | null> {
  const [e] = await db.select().from(giaEntrevistas).where(eq(giaEntrevistas.token, token)).limit(1);
  return e ?? null;
}

export async function turnosDe(entrevistaId: number) {
  return db
    .select({
      tema: giaRespuestas.tema,
      ronda: giaRespuestas.ronda,
      pregunta: giaRespuestas.pregunta,
      transcripcion: giaRespuestas.transcripcion,
    })
    .from(giaRespuestas)
    .where(eq(giaRespuestas.entrevistaId, entrevistaId))
    .orderBy(asc(giaRespuestas.id));
}

/** Guarda una respuesta. Si se repite el mismo turno (reintento), la reemplaza. */
export async function guardarTurno(
  entrevistaId: number,
  t: { tema: string; ronda: number; pregunta: string; transcripcion: string; canal: "voz" | "texto"; segundos: number | null },
) {
  await db
    .delete(giaRespuestas)
    .where(and(eq(giaRespuestas.entrevistaId, entrevistaId), eq(giaRespuestas.tema, t.tema), eq(giaRespuestas.ronda, t.ronda)));
  await db.insert(giaRespuestas).values({ entrevistaId, ...t });
}

export async function marcarEstado(id: number, cambios: Partial<Pick<GiaEntrevista, "estado" | "analisis" | "error" | "modelo" | "confirmadaEn">>) {
  await db.update(giaEntrevistas).set(cambios).where(eq(giaEntrevistas.id, id));
}

// ─── Back office ─────────────────────────────────────────────────────────────

export interface FichaEnVivo {
  id: number;
  nombre: string;
  cargo: string;
  gerencia: string;
  analisis: AnalisisGia;
  confirmadaEn: Date | null;
  createdAt: Date;
}

/** Entrevistas en vivo con ficha (lista o confirmada), más recientes primero. */
export async function fichasEnVivo(): Promise<FichaEnVivo[]> {
  try {
    const filas = await db.select().from(giaEntrevistas).orderBy(desc(giaEntrevistas.id)).limit(200);
    return filas
      .filter((f) => (f.estado === "confirmada" || f.estado === "lista") && f.analisis)
      .map((f) => ({
        id: f.id,
        nombre: f.nombre,
        cargo: f.cargo,
        gerencia: f.gerencia,
        analisis: f.analisis!,
        confirmadaEn: f.confirmadaEn,
        createdAt: f.createdAt,
      }));
  } catch (e) {
    console.error("[gia] fichasEnVivo falló; se muestra solo la empresa demo", e);
    return [];
  }
}

export async function fichaEnVivo(id: number): Promise<FichaEnVivo | null> {
  try {
    const [f] = await db.select().from(giaEntrevistas).where(eq(giaEntrevistas.id, id)).limit(1);
    if (!f || !f.analisis) return null;
    return { id: f.id, nombre: f.nombre, cargo: f.cargo, gerencia: f.gerencia, analisis: f.analisis, confirmadaEn: f.confirmadaEn, createdAt: f.createdAt };
  } catch (e) {
    console.error("[gia] fichaEnVivo falló", e);
    return null;
  }
}
