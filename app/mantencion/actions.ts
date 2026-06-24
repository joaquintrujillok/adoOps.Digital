"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incidencias, ordenesTrabajo } from "@/db/schema";

/** Valida una incidencia desde el dashboard (alternativa a confirmar por WhatsApp). */
export async function validateIncidencia(id: number): Promise<void> {
  await db
    .update(incidencias)
    .set({ status: "validado", validatedAt: new Date() })
    .where(eq(incidencias.id, id));
  await db
    .update(ordenesTrabajo)
    .set({ estado: "activa" })
    .where(eq(ordenesTrabajo.incidenciaId, id));
  revalidatePath("/mantencion");
}

/** Marca una orden de trabajo como completada. */
export async function completeOrden(id: number): Promise<void> {
  await db.update(ordenesTrabajo).set({ estado: "completada" }).where(eq(ordenesTrabajo.id, id));
  revalidatePath("/mantencion");
}
