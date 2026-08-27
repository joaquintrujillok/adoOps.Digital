"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tunicheVisitas } from "@/db/tuniche";
import { requireEnvioAlAgricultor, requireSesion } from "./auth.actions";
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

// ─── Visto bueno para enviar al agricultor ───────────────────────────────────

/**
 * Da el visto bueno para que una visita salga de Tuniche.
 *
 * **Es una compuerta distinta de la validación, y en eso está todo el punto.**
 * El zonal valida y afirma "esto es lo que yo vi" — nadie más puede afirmarlo, y
 * eso habilita el historial interno. La jefatura aprueba y afirma otra cosa:
 * "esto puede salir de Tuniche". El destinatario es un tercero, y una frase mal
 * dicha en un audio deja de ser una frase de un zonal para pasar a ser una frase
 * que la empresa le escribió a un cliente.
 *
 * **Nunca es automático.** No se aprueba al validar, no se aprueba por lote y no
 * hay un envío programado. Alguien con nombre y apellido decide cada uno, y ese
 * nombre queda en `aprobadaPor`.
 *
 * Un jefe puede aprobar una visita que él mismo levantó: en un área con un solo
 * jefe, lo contrario significaría que sus propias visitas no salen nunca. Lo que
 * no puede pasar es que la apruebe un zonal, y de eso se encarga
 * `requireEnvioAlAgricultor`.
 */
export async function aprobarEnvioAction(fd: FormData): Promise<void> {
  const s = await requireEnvioAlAgricultor();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, id)).limit(1);
  if (!v) return;

  const a = alcanceDe(s);
  if (!a.todo && v.area !== a.area) throw new Error("Esta visita no está en tu alcance");

  // Aprobar una visita que el zonal todavía no confirmó sería dar el visto bueno
  // a lo que entendió la IA, no a lo que vio una persona. Es justo el orden que
  // este sistema existe para no invertir.
  if (v.estado === "pendiente") {
    throw new Error("El zonal todavía no valida esta visita. No hay qué aprobar.");
  }
  if (v.enviadaAlAgricultorEn) return; // ya salió: aprobar de nuevo no significa nada

  await db
    .update(tunicheVisitas)
    .set({ aprobadaPor: s.userId, aprobadaEn: new Date() })
    .where(eq(tunicheVisitas.id, id));

  revalidatePath("/tuniche/visitas");
  if (v.loteId) revalidatePath(`/tuniche/lotes/${v.loteId}`);
}

/**
 * Retira el visto bueno, mientras la visita **no haya salido todavía**.
 *
 * Existe porque un visto bueno que no se puede retirar es una trampa: quien
 * aprueba de más se queda sin salida y aprende a no aprobar. Una vez enviada ya
 * no sirve de nada —el agricultor lo tiene en su teléfono— y por eso ahí se
 * bloquea en vez de fingir que se deshizo.
 */
export async function retirarAprobacionAction(fd: FormData): Promise<void> {
  const s = await requireEnvioAlAgricultor();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, id)).limit(1);
  if (!v) return;

  const a = alcanceDe(s);
  if (!a.todo && v.area !== a.area) throw new Error("Esta visita no está en tu alcance");
  if (v.enviadaAlAgricultorEn) {
    throw new Error("Esta visita ya se le envió al agricultor. El visto bueno no se puede retirar.");
  }

  await db
    .update(tunicheVisitas)
    .set({ aprobadaPor: null, aprobadaEn: null })
    .where(eq(tunicheVisitas.id, id));

  revalidatePath("/tuniche/visitas");
  if (v.loteId) revalidatePath(`/tuniche/lotes/${v.loteId}`);
}
