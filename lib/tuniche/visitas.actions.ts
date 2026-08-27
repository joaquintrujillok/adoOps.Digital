"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tunicheInformes, tunicheVisitas } from "@/db/tuniche";
import { VISITA } from "./plantillas";
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

  // Y que sea del área de la visita. Comprobar solo el alcance no alcanza: un
  // admin los ve todos, y sin esto podría colgarle a una visita de maíz un lote
  // de repollo de la otra área. La visita se levantó con una plantilla; el lote
  // tiene que pertenecer a esa misma.
  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, visitaId)).limit(1);
  if (!v) return;
  if (v.area !== destino.lote.area) {
    throw new Error("Ese lote es de otra área. Una visita solo puede pegarse a un lote de su misma área.");
  }

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

// ─── Descartar y editar ──────────────────────────────────────────────────────

/**
 * Un informe es un snapshot: se congela al generarse. Si el contenido de la
 * visita cambia después, ese snapshot pasa a decir algo que ya no es cierto.
 *
 * Mientras no haya salido, la salida correcta es **borrar el borrador** y
 * obligar a regenerarlo con el contenido corregido. Dejar los dos y sincronizar
 * el snapshot sería reintroducir por la puerta de atrás justo lo que la tabla de
 * informes existe para evitar: que corregir una visita cambie retroactivamente
 * lo que dice un documento.
 *
 * Si ya salió, no hay nada que hacer: el destinatario lo tiene.
 */
async function invalidarInformeDe(visitaId: number, accion: string): Promise<void> {
  const [inf] = await db
    .select()
    .from(tunicheInformes)
    .where(eq(tunicheInformes.visitaId, visitaId))
    .limit(1);
  if (!inf) return;
  if (inf.estado === "enviado") {
    throw new Error(
      `El informe de esta visita ya se envió, así que no se puede ${accion}. El destinatario ya lo tiene.`,
    );
  }
  await db.delete(tunicheInformes).where(eq(tunicheInformes.id, inf.id));
}

/**
 * Descarta una visita: un audio mandado por error, cortado, o el micrófono
 * apretado sin querer.
 *
 * **Descarta, no borra.** La fila sobrevive con su transcripción, fuera de la
 * bandeja y fuera del historial. Si alguien descarta por equivocación el audio
 * de una visita que sí ocurrió, borrarla de verdad significaría perderla para
 * siempre — el audio original en WhatsApp también expira, así que no habría de
 * dónde recuperarla.
 *
 * Solo se descarta lo que todavía no entró al historial. Una visita validada ya
 * es parte del registro de un agricultor; sacarla de ahí es otra decisión.
 */
export async function descartarVisitaAction(fd: FormData): Promise<void> {
  const s = await requireSesion();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, id)).limit(1);
  if (!v) return;

  const a = alcanceDe(s);
  const puede =
    a.todo || (v.area === a.area && (a.soloUsuarioId == null || v.usuarioId === a.soloUsuarioId));
  if (!puede) throw new Error("Esta visita no está en tu alcance");
  if (v.estado === "descartada") return;

  await invalidarInformeDe(id, "descartar la visita");

  await db.update(tunicheVisitas).set({ estado: "descartada" }).where(eq(tunicheVisitas.id, id));
  revalidatePath("/tuniche/visitas");
  if (v.loteId) revalidatePath(`/tuniche/lotes/${v.loteId}`);
}

/** Devuelve una visita descartada a la bandeja. Descartar tiene que ser reversible. */
export async function recuperarVisitaAction(fd: FormData): Promise<void> {
  const s = await requireSesion();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, id)).limit(1);
  if (!v || v.estado !== "descartada") return;

  const a = alcanceDe(s);
  const puede =
    a.todo || (v.area === a.area && (a.soloUsuarioId == null || v.usuarioId === a.soloUsuarioId));
  if (!puede) throw new Error("Esta visita no está en tu alcance");

  await db.update(tunicheVisitas).set({ estado: "pendiente" }).where(eq(tunicheVisitas.id, id));
  revalidatePath("/tuniche/visitas");
}

/**
 * Corrige lo que la IA entendió mal.
 *
 * **Sin esto, la validación es una compuerta falsa.** Todo el diseño se apoya en
 * "la IA propone, la persona confirma"; si al confirmar lo único posible es
 * aceptar o rechazar en bloque, quien encuentre un campo mal puesto va a validar
 * igual —porque el resto está bien— y el error entra al historial.
 *
 * Se guarda como `corregida` y no como `validada`: el historial tiene que poder
 * distinguir lo que salió tal cual del audio de lo que alguien ajustó a mano.
 */
export async function editarVisitaAction(
  _prev: { error?: string; ok?: string },
  fd: FormData,
): Promise<{ error?: string; ok?: string }> {
  const s = await requireSesion();
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Visita inválida" };

  const [v] = await db.select().from(tunicheVisitas).where(eq(tunicheVisitas.id, id)).limit(1);
  if (!v) return { error: "Esa visita ya no existe" };

  const a = alcanceDe(s);
  const puede =
    a.todo || (v.area === a.area && (a.soloUsuarioId == null || v.usuarioId === a.soloUsuarioId));
  if (!puede) return { error: "Esta visita no está en tu alcance" };

  try {
    await invalidarInformeDe(id, "editar la visita");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo editar" };
  }

  // La transcripción NO se toca nunca. Es la constancia de lo que dijo la
  // persona; si se pudiera editar, dejaría de servir para lo único que hace,
  // que es poder contrastar lo que la IA entendió contra lo que se dijo.
  const datos: Record<string, unknown> = {};
  for (const c of VISITA) {
    if (c.id === "etapa" || c.tipo === "fotos") continue;
    if (c.tipo === "opciones") {
      const vals = fd.getAll(c.id).map(String).filter(Boolean);
      if (vals.length) datos[c.id] = vals;
      continue;
    }
    const bruto = ((fd.get(c.id) as string) ?? "").trim();
    if (!bruto) continue;
    if (c.tipo === "lista") {
      const lineas = bruto.split("\n").map((x) => x.trim()).filter(Boolean);
      if (lineas.length) datos[c.id] = lineas;
      continue;
    }
    datos[c.id] = bruto;
  }

  // El comentario que dejó la extracción cuando no supo el lote se conserva:
  // es lo único que permite entender por qué quedó huérfana.
  const previo = (v.datos ?? {}) as Record<string, unknown>;
  if (previo._loteMencionado) datos._loteMencionado = previo._loteMencionado;

  const notaBruta = ((fd.get("nota_agronomica") as string) ?? "").trim();
  const nota = notaBruta === "" ? null : Number(notaBruta);
  if (nota !== null && (!Number.isFinite(nota) || nota < 0 || nota > 100)) {
    return { error: "La nota agronómica va de 0 a 100" };
  }

  const etapa = ((fd.get("etapa") as string) ?? "").trim() || null;
  const resumen = ((fd.get("resumen") as string) ?? "").trim();

  await db
    .update(tunicheVisitas)
    .set({
      etapa,
      datos,
      notaAgronomica: nota === null ? null : Math.round(nota),
      resumen,
      estado: "corregida",
    })
    .where(eq(tunicheVisitas.id, id));

  revalidatePath("/tuniche/visitas");
  if (v.loteId) revalidatePath(`/tuniche/lotes/${v.loteId}`);
  return { ok: "Visita corregida." };
}
