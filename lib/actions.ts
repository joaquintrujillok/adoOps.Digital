"use server";

import { db } from "@/db";
import { leads } from "@/db/schema";
import { sendLeadNotification } from "@/lib/email";

export type LeadFormState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

export async function submitLead(
  _prev: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  const nombre = (formData.get("nombre") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const empresa = (formData.get("empresa") as string)?.trim();
  const rol = (formData.get("rol") as string)?.trim() || null;
  const tipo = (formData.get("tipo") as string) || "Assessment";
  const mensaje = (formData.get("mensaje") as string)?.trim() || null;

  if (!nombre || !email || !empresa) {
    return { status: "error", message: "Completá los campos obligatorios." };
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return { status: "error", message: "Email inválido." };
  }

  try {
    const [lead] = await db
      .insert(leads)
      .values({ nombre, email, empresa, rol, tipo, mensaje })
      .returning();

    await sendLeadNotification(lead).catch((err) =>
      console.error("Brevo send failed:", err)
    );

    return { status: "success" };
  } catch (err) {
    console.error("submitLead error:", err);
    return { status: "error", message: "Error al enviar. Intenta nuevamente." };
  }
}
