"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { pulsoRespuestas, pulsoSesiones, type PulsoFase } from "@/db/pulso";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { dejarSenal, estadoSala, nuevoCodigo, resolverEmpresa } from "@/lib/pulso/datos";
import { enviarResultado } from "@/lib/pulso/email";
import type { Cuadrante } from "@/lib/pulso/modelo";

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
  revalidatePath("/dashboard360/pulso");
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
  revalidatePath("/dashboard360/pulso");
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
  revalidatePath("/dashboard360/pulso");
}

/**
 * Pausa o reanuda el QR. En pausa la sesión no recibe respuestas ni datos de
 * contacto, pero conserva su fase: no deja señal en el motor ni cierra nada.
 */
export async function pausarSesion(form: FormData): Promise<void> {
  await requireSession();
  const id = Number(form.get("id"));
  if (!id) return;
  await db
    .update(pulsoSesiones)
    .set({ pausada: form.get("pausada") === "si" })
    .where(eq(pulsoSesiones.id, id));
  revalidatePath("/dashboard360/pulso");
}

/**
 * El gatillante: le manda su resultado a quienes dejaron sus datos y todavía no
 * lo reciben.
 *
 * **Hoy sale solo por correo.** El WhatsApp —que es el canal principal, y por
 * eso el teléfono es obligatorio en el formulario— se conecta acá cuando estén
 * las credenciales del proveedor: este es el único lugar que hay que tocar. Por
 * eso quien dejó solo WhatsApp queda pendiente y no se marca como enviado: el
 * día que el canal exista, este mismo botón le llega.
 *
 * Es seguro apretarlo dos veces: cada envío marca `resultado_enviado_en` y la
 * segunda pasada solo toma a los que faltan.
 */
export async function enviarResultados(form: FormData): Promise<void> {
  await requireSession();
  const id = Number(form.get("id"));
  if (!id) return;
  const [sesion] = await db.select().from(pulsoSesiones).where(eq(pulsoSesiones.id, id)).limit(1);
  if (!sesion) return;
  const sala = await estadoSala(sesion.codigo);
  if (!sala) return;

  const pendientes = await db
    .select({
      id: pulsoRespuestas.id,
      nombre: pulsoRespuestas.nombre,
      email: pulsoRespuestas.email,
      cuadrante: pulsoRespuestas.cuadrante,
    })
    .from(pulsoRespuestas)
    .where(
      and(
        eq(pulsoRespuestas.sesionId, id),
        eq(pulsoRespuestas.consiente, true),
        isNotNull(pulsoRespuestas.contactoEn),
        isNotNull(pulsoRespuestas.email),
        isNull(pulsoRespuestas.resultadoEnviadoEn),
      ),
    );

  for (const p of pendientes) {
    try {
      const salio = await enviarResultado({
        email: p.email!,
        nombre: p.nombre ?? "",
        cuadrante: p.cuadrante as Cuadrante,
        sala,
      });
      if (salio) {
        await db.update(pulsoRespuestas).set({ resultadoEnviadoEn: new Date() }).where(eq(pulsoRespuestas.id, p.id));
      }
    } catch (e) {
      // Uno que falla no detiene al resto: queda pendiente y el botón lo vuelve
      // a intentar.
      console.error(`[pulso] no salió el resultado de la respuesta ${p.id}:`, e);
    }
  }
  revalidatePath("/dashboard360/pulso");
}
