"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pulsoRespuestas, pulsoSesiones, type PulsoFase } from "@/db/pulso";
import { requireSession } from "@/lib/crm/auth.actions";
import { dejarSenal, nuevoCodigo, resolverEmpresa } from "@/lib/pulso/datos";

export async function crearSesion(form: FormData): Promise<void> {
  await requireSession();
  const titulo = String(form.get("titulo") ?? "").trim().slice(0, 200);
  const organizacion = String(form.get("organizacion") ?? "").trim().slice(0, 200);
  const relator = String(form.get("relator") ?? "").trim().slice(0, 120) || "Nelson García";
  const rut = String(form.get("rut") ?? "").trim() || null;
  const fechaTxt = String(form.get("fecha") ?? "");
  if (!titulo || !organizacion) return;

  let empresaId: number | null = null;
  try {
    empresaId = await resolverEmpresa(organizacion, rut);
  } catch (e) {
    console.error("[pulso] no se pudo resolver la empresa en el motor:", e);
  }

  // Reintenta si el código choca: con 32^5 combinaciones no debería pasar nunca.
  for (let i = 0; i < 5; i++) {
    try {
      await db.insert(pulsoSesiones).values({
        codigo: nuevoCodigo(),
        titulo,
        organizacion,
        relator,
        empresaId,
        fecha: fechaTxt ? new Date(`${fechaTxt}T12:00:00`) : new Date(),
      });
      break;
    } catch (e) {
      if (i === 4) throw e;
    }
  }
  revalidatePath("/crm/pulso");
}

export async function cambiarFase(form: FormData): Promise<void> {
  await requireSession();
  const id = Number(form.get("id"));
  const fase = String(form.get("fase")) as PulsoFase;
  if (!id || !["inicio", "cierre", "cerrada"].includes(fase)) return;
  await db.update(pulsoSesiones).set({ fase }).where(eq(pulsoSesiones.id, id));
  if (fase === "cerrada") {
    try {
      await dejarSenal(id);
    } catch (e) {
      console.error("[pulso] no se pudo dejar la señal en el motor:", e);
    }
  }
  revalidatePath("/crm/pulso");
}

/**
 * Borra una sesión y sus respuestas. Pensado para las de prueba: una sesión
 * real se cierra, no se borra. Las personas que ya pasaron al motor se quedan
 * allá.
 */
export async function borrarSesion(form: FormData): Promise<void> {
  await requireSession();
  const id = Number(form.get("id"));
  if (!id || form.get("confirmar") !== "si") return;
  await db.delete(pulsoRespuestas).where(eq(pulsoRespuestas.sesionId, id));
  await db.delete(pulsoSesiones).where(eq(pulsoSesiones.id, id));
  revalidatePath("/crm/pulso");
}
