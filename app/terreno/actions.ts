"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldReports, workSheets } from "@/db/schema";

/** Valida un reporte desde el dashboard (alternativa a confirmar por WhatsApp). */
export async function validateReport(id: number): Promise<void> {
  await db
    .update(fieldReports)
    .set({ status: "validado", validatedAt: new Date() })
    .where(eq(fieldReports.id, id));
  await db.update(workSheets).set({ estado: "activa" }).where(eq(workSheets.reportId, id));
  revalidatePath("/terreno");
}

/** Marca una tarea de la hoja de trabajo como completada. */
export async function completeTask(id: number): Promise<void> {
  await db.update(workSheets).set({ estado: "completada" }).where(eq(workSheets.id, id));
  revalidatePath("/terreno");
}
