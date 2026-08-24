"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { d360Informes } from "@/db/dashboard360";
import { requirePublicador, requireSession } from "./auth.actions";
import { componerInforme } from "./informe";
import { rangoReciente } from "./metricas";

/**
 * Genera el informe del período reciente y lo deja en borrador.
 *
 * Siempre en borrador, nunca publicado directo: un documento que va al
 * directorio se lee antes de salir, aunque lo haya escrito una máquina que no
 * se equivoca en las cifras.
 */
export async function generarInformeAction(): Promise<void> {
  const sesion = await requireSession();
  const rango = await rangoReciente(30);
  const { titulo, cuerpoMd } = await componerInforme(rango);

  await db.insert(d360Informes).values({
    titulo,
    desde: rango.desde,
    hasta: rango.hasta,
    cuerpoMd,
    estado: "borrador",
    autorId: sesion.userId,
  });

  revalidatePath("/dashboard360/informe");
  revalidatePath("/dashboard360");
}

/** Publicar es la acción con destinatario externo: la reserva gerencia. */
export async function publicarInformeAction(formData: FormData): Promise<void> {
  await requirePublicador();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) throw new Error("Informe inválido");

  await db
    .update(d360Informes)
    .set({ estado: "publicado" })
    .where(eq(d360Informes.id, id));

  revalidatePath("/dashboard360/informe");
  revalidatePath("/dashboard360");
}

export async function listarInformes() {
  await requireSession();
  return db.select().from(d360Informes).orderBy(desc(d360Informes.createdAt)).limit(20);
}
