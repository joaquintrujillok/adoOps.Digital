"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tunicheVisitas } from "@/db/tuniche";
import { requireSesion } from "./auth.actions";
import { alcanceDe } from "./session";
import { agricultorDeLote, loteConAgricultor } from "./visitas";

/**
 * Valida una visita desde el sistema. Es la misma decisión que el "OK" por
 * WhatsApp, tomada desde otra pantalla.
 *
 * **Solo la valida quien la levantó, o alguien con alcance sobre su área.** No
 * es burocracia: validar significa "esto es lo que yo vi en el campo", y nadie
 * más que quien estuvo ahí puede afirmarlo. La jefatura puede hacerlo porque
 * puede corregirla antes, y un zonal sin señal en el campo necesita que alguien
 * destrabe su bandeja.
 */
export async function validarVisitaAction(fd: FormData): Promise<void> {
  const s = await requireSesion();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, id)).limit(1);
  if (!v) return;

  const a = alcanceDe(s);
  const puede = a.todo || (v.area === a.area && (a.soloUsuarioId == null || v.usuarioId === a.soloUsuarioId));
  if (!puede) throw new Error("Esta visita no está en tu alcance");

  await db
    .update(tunicheVisitas)
    .set({ estado: "validada", validadaEn: new Date() })
    .where(eq(tunicheVisitas.id, id));

  revalidatePath("/tuniche/visitas");
  if (v.loteId) revalidatePath(`/tuniche/lotes/${v.loteId}`);
}

/**
 * Le asigna un lote a una visita que quedó sin él.
 *
 * Es el caso que la IA declara en vez de adivinar: cuando lo que dijo el zonal
 * no calzó con ninguno de sus lotes, la visita se guarda igual pero huérfana.
 * Sin esta acción, esa visita no entra al historial de nadie y el audio se
 * perdió — que es exactamente lo que este sistema viene a evitar.
 */
export async function asignarLoteAction(fd: FormData): Promise<void> {
  const s = await requireSesion();
  const visitaId = Number(fd.get("visitaId"));
  const loteId = Number(fd.get("loteId"));
  if (!Number.isInteger(visitaId) || !Number.isInteger(loteId)) return;

  const a = alcanceDe(s);
  // Se comprueba que el lote esté en SU alcance, no solo que exista: si no,
  // cualquiera podría colgarle una visita al agricultor de otra área.
  const destino = await loteConAgricultor(loteId, a);
  if (!destino) throw new Error("Ese lote no está en tu alcance");

  const agricultorId = await agricultorDeLote(loteId);
  await db
    .update(tunicheVisitas)
    .set({ loteId, agricultorId, estado: "corregida" })
    .where(eq(tunicheVisitas.id, visitaId));

  revalidatePath("/tuniche/visitas");
  revalidatePath(`/tuniche/lotes/${loteId}`);
}

// El visto bueno vive en `informes.actions.ts` y no acá, a propósito: lo que se
// aprueba es el documento que va a salir, habiéndolo visto en pantalla, no una
// tarjeta resumida en una lista de visitas.
