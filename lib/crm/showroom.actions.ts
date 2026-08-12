"use server";

// Acciones de la captura de showroom.
//
// `accionRegistrarVisita` es **pública**: la ejecuta el visitante desde su
// propio teléfono, sin sesión. Por eso valida todo del lado del servidor y no
// confía en nada que venga del formulario. Las demás sí exigen sesión.

import { revalidatePath } from "next/cache";
import { requireSession } from "./auth.actions";
import {
  cambiarEstadoVisita,
  convertirVisita,
  registrarVisita,
  type ResultadoCaptura,
} from "./showroom";

export async function accionRegistrarVisita(
  _prev: { ok?: boolean; error?: string; yaExistia?: boolean },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string; yaExistia?: boolean }> {
  const resultado: ResultadoCaptura = await registrarVisita({
    nombre: String(formData.get("nombre") || ""),
    telefono: String(formData.get("telefono") || "") || null,
    email: String(formData.get("email") || "") || null,
    interes: String(formData.get("interes") || "") || null,
    detalle: String(formData.get("detalle") || "") || null,
    boutique: String(formData.get("boutique") || "") || null,
    medio: String(formData.get("medio") || "qr"),
    evento: String(formData.get("evento") || "") || null,
    // La casilla solo viaja si está marcada: la ausencia es un "no".
    consentimiento: Boolean(formData.get("consentimiento")),
  });

  if (!resultado.ok) return { ok: false, error: resultado.error };

  revalidatePath("/crm/showroom");
  return { ok: true, yaExistia: resultado.yaExistia };
}

export async function accionConvertirVisita(formData: FormData): Promise<void> {
  const sesion = await requireSession();
  await convertirVisita(Number(formData.get("visitaId")), sesion.userId);
  revalidatePath("/crm/showroom");
  revalidatePath("/crm/contactos");
}

export async function accionEstadoVisita(formData: FormData): Promise<void> {
  await requireSession();
  await cambiarEstadoVisita(
    Number(formData.get("visitaId")),
    String(formData.get("estado")) as "pendiente" | "contactado" | "convertido" | "descartado",
  );
  revalidatePath("/crm/showroom");
}
