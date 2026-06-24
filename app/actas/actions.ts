"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { actaReports, compromisos } from "@/db/schema";

/** Valida un acta desde el dashboard (alternativa a confirmar por WhatsApp). */
export async function validateActa(id: number): Promise<void> {
  await db
    .update(actaReports)
    .set({ status: "validado", validatedAt: new Date() })
    .where(eq(actaReports.id, id));
  await db.update(compromisos).set({ estado: "activa" }).where(eq(compromisos.actaId, id));
  revalidatePath("/actas");
}

/** Marca un compromiso como completado. */
export async function completeCompromiso(id: number): Promise<void> {
  await db.update(compromisos).set({ estado: "completada" }).where(eq(compromisos.id, id));
  revalidatePath("/actas");
}
