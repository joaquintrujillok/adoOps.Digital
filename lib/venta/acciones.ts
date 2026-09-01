"use server";

// Las acciones del CRM de adoOps.
//
// ── Toda acción sobre una oportunidad deja actividad ─────────────────────────
//
// Mover de etapa, cerrar, ganar: cada una escribe una fila en `venta_actividades`
// además de actualizar la oportunidad. No es auditoría por si acaso: es que la
// pregunta que uno se hace tres meses después no es "¿en qué etapa está?" sino
// "¿por qué se movió, y cuándo?", y un CRM que solo guarda el estado actual no
// la puede responder.
//
// Por eso también las actividades no se editan ni se borran desde la pantalla.
// Una actividad es algo que ocurrió. Corregir el pasado es cómo se pierde la
// confianza en un CRM.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  ventaActividades,
  ventaContactos,
  ventaEmpresas,
  ventaOportunidades,
} from "@/db/venta";
import { getSession } from "@/lib/dashboard360/session";
import { esCerrada, nombreEtapa, probabilidadDe } from "./etapas";

const TABLERO = "/dashboard360/crm";

async function exigirSesion() {
  const s = await getSession();
  if (!s) throw new Error("No autorizado");
  return s;
}

function texto(fd: FormData, campo: string, max = 300): string | null {
  const v = String(fd.get(campo) ?? "").trim();
  return v ? v.slice(0, max) : null;
}

// ─── Alta ────────────────────────────────────────────────────────────────────

export async function crearEmpresaAction(formData: FormData) {
  await exigirSesion();
  const nombre = texto(formData, "nombre", 200);
  if (!nombre) return;

  await db.insert(ventaEmpresas).values({
    nombre,
    rubro: texto(formData, "rubro", 120),
    sitio: texto(formData, "sitio", 200),
    tamano: texto(formData, "tamano", 40),
    ciudad: texto(formData, "ciudad", 120),
  });
  revalidatePath("/dashboard360/crm/contactos");
}

export async function crearContactoAction(formData: FormData) {
  await exigirSesion();
  const nombre = texto(formData, "nombre", 200);
  if (!nombre) return;

  const empresaId = Number(formData.get("empresaId"));

  await db.insert(ventaContactos).values({
    nombre,
    empresaId: Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null,
    cargo: texto(formData, "cargo", 160),
    email: texto(formData, "email", 254),
    telefono: texto(formData, "telefono", 40),
    linkedin: texto(formData, "linkedin", 300),
  });
  revalidatePath("/dashboard360/crm/contactos");
}

/**
 * Crear una oportunidad exige contacto. Ver la invariante en `db/venta.ts`: una
 * oportunidad sin nadie con quien hablar no es una oportunidad, es una idea, y
 * las ideas inflan el pronóstico sin que nadie pueda hacer nada con ellas.
 */
export async function crearOportunidadAction(formData: FormData) {
  const sesion = await exigirSesion();
  const titulo = texto(formData, "titulo", 200);
  const contactoId = Number(formData.get("contactoId"));
  if (!titulo || !Number.isInteger(contactoId) || contactoId <= 0) return;

  // La empresa se hereda del contacto si no se especifica: en la práctica es
  // siempre la misma, y pedirla dos veces es una forma de que quede en blanco.
  const [contacto] = await db
    .select({ empresaId: ventaContactos.empresaId })
    .from(ventaContactos)
    .where(eq(ventaContactos.id, contactoId))
    .limit(1);
  if (!contacto) return;

  const monto = Number(formData.get("monto"));
  const cierre = texto(formData, "cierreEstimado", 10);

  const [creada] = await db
    .insert(ventaOportunidades)
    .values({
      titulo,
      contactoId,
      empresaId: contacto.empresaId,
      etapa: "nuevo",
      probabilidad: probabilidadDe("nuevo"),
      monto: Number.isFinite(monto) && monto > 0 ? Math.round(monto) : 0,
      fuente: texto(formData, "fuente", 40),
      cierreEstimado: cierre,
      ultimaActividad: new Date(),
    })
    .returning({ id: ventaOportunidades.id });

  await db.insert(ventaActividades).values({
    oportunidadId: creada.id,
    contactoId,
    tipo: "nota",
    detalle: "Oportunidad creada.",
    autor: sesion.nombre,
  });

  revalidatePath(TABLERO);
}

// ─── Movimiento ──────────────────────────────────────────────────────────────

export async function moverEtapaAction(formData: FormData) {
  const sesion = await exigirSesion();
  const id = Number(formData.get("id"));
  const etapa = String(formData.get("etapa") ?? "");
  if (!Number.isInteger(id) || !etapa) return;

  const [antes] = await db
    .select({ etapa: ventaOportunidades.etapa, contactoId: ventaOportunidades.contactoId })
    .from(ventaOportunidades)
    .where(eq(ventaOportunidades.id, id))
    .limit(1);
  if (!antes || antes.etapa === etapa) return;

  const ahora = new Date();
  const cierra = esCerrada(etapa);

  await db
    .update(ventaOportunidades)
    .set({
      etapa,
      // La probabilidad se resiembra con la de la etapa nueva. Si alguien la
      // había corregido a mano, esa corrección era sobre la etapa anterior.
      probabilidad: probabilidadDe(etapa),
      cerradoEn: cierra ? ahora : null,
      motivoPerdida: etapa === "perdido" ? texto(formData, "motivo", 300) : null,
      ultimaActividad: ahora,
    })
    .where(eq(ventaOportunidades.id, id));

  await db.insert(ventaActividades).values({
    oportunidadId: id,
    contactoId: antes.contactoId,
    tipo: "nota",
    // Con los nombres y no con los ids: la historia la lee una persona, y
    // "Movida de nuevo a reunion" obliga a traducir mentalmente cada línea.
    detalle: `Movida de "${nombreEtapa(antes.etapa)}" a "${nombreEtapa(etapa)}".`,
    autor: sesion.nombre,
    ocurrioEn: ahora,
  });

  revalidatePath(TABLERO);
  revalidatePath(`/dashboard360/crm/oportunidades/${id}`);
}

export async function registrarActividadAction(formData: FormData) {
  const sesion = await exigirSesion();
  const id = Number(formData.get("id"));
  const detalle = texto(formData, "detalle", 4000);
  if (!Number.isInteger(id) || !detalle) return;

  const [op] = await db
    .select({ contactoId: ventaOportunidades.contactoId })
    .from(ventaOportunidades)
    .where(eq(ventaOportunidades.id, id))
    .limit(1);
  if (!op) return;

  const ahora = new Date();
  await db.insert(ventaActividades).values({
    oportunidadId: id,
    contactoId: op.contactoId,
    tipo: String(formData.get("tipo") ?? "nota").slice(0, 20),
    detalle,
    autor: sesion.nombre,
    ocurrioEn: ahora,
  });

  // El toque a `ultimaActividad` es el punto de todo esto: es lo que saca la
  // oportunidad del contador de frías.
  await db
    .update(ventaOportunidades)
    .set({ ultimaActividad: ahora })
    .where(eq(ventaOportunidades.id, id));

  revalidatePath(`/dashboard360/crm/oportunidades/${id}`);
  revalidatePath(TABLERO);
}

export async function editarOportunidadAction(formData: FormData) {
  await exigirSesion();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  const monto = Number(formData.get("monto"));
  const probabilidad = Number(formData.get("probabilidad"));

  await db
    .update(ventaOportunidades)
    .set({
      monto: Number.isFinite(monto) && monto >= 0 ? Math.round(monto) : 0,
      probabilidad:
        Number.isFinite(probabilidad) && probabilidad >= 0 && probabilidad <= 100
          ? Math.round(probabilidad)
          : undefined,
      cierreEstimado: texto(formData, "cierreEstimado", 10),
    })
    .where(eq(ventaOportunidades.id, id));

  revalidatePath(`/dashboard360/crm/oportunidades/${id}`);
  revalidatePath(TABLERO);
}
