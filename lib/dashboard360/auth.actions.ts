"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { d360Users } from "@/db/dashboard360";
import {
  clearSession,
  createSession,
  getSession,
  puedePublicar,
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
  const from = (formData.get("from") as string) || "/dashboard360";

  if (!username || !password) return { error: "Ingresa usuario y contraseña" };

  const [user] = await db
    .select()
    .from(d360Users)
    .where(eq(d360Users.username, username))
    .limit(1);

  // El mismo mensaje para usuario inexistente, inactivo o clave mala:
  // distinguirlos permitiría averiguar qué usuarios existen probando de a uno.
  const generico = { error: "Usuario o contraseña incorrectos" };
  if (!user || !user.activo) return generico;
  if (!verifyPassword(password, user.passwordHash)) return generico;

  await db
    .update(d360Users)
    .set({ ultimoIngreso: new Date() })
    .where(eq(d360Users.id, user.id));

  await createSession({
    userId: user.id,
    username: user.username,
    nombre: user.nombre,
    rol: user.rol as Role,
  });

  // Solo rutas internas: un `from` con host ajeno convertiría el login en un
  // redirector abierto.
  redirect(from.startsWith("/dashboard360") ? from : "/dashboard360");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/dashboard360/login");
}

/**
 * Sesión obligatoria. Todo componente de servidor y toda acción del módulo
 * empieza por acá — el proxy es una primera barrera, no la autorización.
 */
export async function requireSession(): Promise<SessionData> {
  const s = await getSession();
  if (!s) redirect("/dashboard360/login");
  return s;
}

/** Restringe una acción a quien puede publicar hacia afuera. */
export async function requirePublicador(): Promise<SessionData> {
  const s = await requireSession();
  if (!puedePublicar(s)) {
    throw new Error("Publicar un informe requiere permisos de gerencia");
  }
  return s;
}
