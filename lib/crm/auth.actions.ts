"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { crmUsers } from "@/db/crm";
import {
  clearSession,
  createSession,
  getSession,
  verifyPassword,
  type Role,
  type SessionData,
} from "./session";

export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const from = (formData.get("from") as string) || "/crm";

  if (!username || !password) return { error: "Ingresa usuario y contraseña" };

  const [user] = await db
    .select()
    .from(crmUsers)
    .where(eq(crmUsers.username, username))
    .limit(1);

  // El mismo mensaje para usuario inexistente, inactivo o clave mala: distinguirlos
  // permitiría averiguar qué usuarios existen probando de a uno.
  const generico = { error: "Usuario o contraseña incorrectos" };
  if (!user || !user.activo) return generico;
  if (!verifyPassword(password, user.passwordHash)) return generico;

  await db
    .update(crmUsers)
    .set({ ultimoIngreso: new Date() })
    .where(eq(crmUsers.id, user.id));

  await createSession({
    userId: user.id,
    username: user.username,
    nombre: user.nombre,
    rol: user.rol as Role,
  });

  // Solo rutas internas: un `from` con host ajeno convertiría el login en un
  // redirector abierto.
  redirect(from.startsWith("/crm") ? from : "/crm");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/crm/login");
}

/**
 * Sesión obligatoria. Todo componente de servidor y toda acción del CRM
 * empieza por acá — el proxy es una primera barrera, no la autorización.
 */
export async function requireSession(): Promise<SessionData> {
  const s = await getSession();
  if (!s) redirect("/crm/login");
  return s;
}

/** Restringe una acción a gerencia o admin. */
export async function requireGerencia(): Promise<SessionData> {
  const s = await requireSession();
  if (s.rol !== "gerente" && s.rol !== "admin") {
    throw new Error("Esta acción requiere permisos de gerencia");
  }
  return s;
}
