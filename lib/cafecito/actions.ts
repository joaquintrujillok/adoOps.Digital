"use server";

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoSuscriptores, type CafecitoPerfil } from "@/db/schema";

export type SuscripcionState =
  | { status: "idle" }
  | { status: "success"; perfil: CafecitoPerfil }
  | { status: "error"; message: string };

const PERFILES: CafecitoPerfil[] = ["direccion", "builder"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function suscribir(
  _prev: SuscripcionState,
  formData: FormData,
): Promise<SuscripcionState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const nombre = (formData.get("nombre") as string)?.trim() || null;
  const perfil = formData.get("perfil") as CafecitoPerfil;

  // Honeypot: un campo invisible que solo un bot completa. Se responde éxito
  // para no darle señal de que fue detectado.
  if ((formData.get("empresa_web") as string)?.trim()) {
    return { status: "success", perfil: "direccion" };
  }

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Revisa el correo, parece incompleto." };
  }
  if (!PERFILES.includes(perfil)) {
    return { status: "error", message: "Elige qué edición quieres recibir." };
  }

  try {
    const [existente] = await db
      .select()
      .from(cafecitoSuscriptores)
      .where(eq(cafecitoSuscriptores.email, email))
      .limit(1);

    // Ya estaba: se actualiza el perfil y se revierte una baja previa. Volver a
    // suscribirse desde el formulario es un consentimiento nuevo y explícito.
    if (existente) {
      await db
        .update(cafecitoSuscriptores)
        .set({ perfil, nombre: nombre ?? existente.nombre, bajaEn: null })
        .where(eq(cafecitoSuscriptores.id, existente.id));
      return { status: "success", perfil };
    }

    await db.insert(cafecitoSuscriptores).values({
      email,
      nombre,
      perfil,
      origen: "web",
      token: randomBytes(16).toString("hex"),
    });

    return { status: "success", perfil };
  } catch (err) {
    console.error("suscribir error:", err);
    return { status: "error", message: "No se pudo registrar. Intenta de nuevo." };
  }
}
