"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSesion } from "./auth.actions";
import { canjearCupon, cuponPorCodigo } from "./cupones";

/** Canje en caja. Cualquier cuenta del backoffice puede canjear, incluida la de caja. */
export async function canjearAction(
  token: string,
  _prev: { ok?: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const s = await requireSesion();
  const monto = Number(String(formData.get("monto") ?? "").replace(/\D/g, "")) || null;
  const r = await canjearCupon({
    token,
    usuarioId: s.userId,
    sucursal: String(formData.get("sucursal") ?? "").trim() || null,
    boleta: String(formData.get("boleta") ?? "").trim() || null,
    monto,
  });
  revalidatePath(`/vanni/cupon/${token}`);
  return r.ok ? { ok: true } : { error: r.error };
}

/** Si el QR no se puede escanear, la caja escribe el código corto. */
export async function buscarCodigoAction(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string }> {
  await requireSesion();
  const c = await cuponPorCodigo(String(formData.get("codigo") ?? ""));
  if (!c) return { error: "No encontré un cupón con ese código." };
  redirect(`/vanni/cupon/${c.token}`);
}
