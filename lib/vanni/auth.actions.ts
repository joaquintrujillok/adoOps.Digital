"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vanniUsuarios, type VanniRol } from "@/db/vanni";
import {
  cerrarSesion,
  crearSesion,
  esAdmin,
  hashPassword,
  leerSesion,
  problemaDeClave,
  verifyPassword,
  type SesionVanni,
} from "./session";

const RAIZ = "/vanni";
const LOGIN = "/vanni/login";

export async function loginAction(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const username = (formData.get("username") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const from = (formData.get("from") as string) || RAIZ;
  if (!username || !password) return { error: "Ingresa usuario y contraseña" };

  const [u] = await db
    .select()
    .from(vanniUsuarios)
    .where(eq(vanniUsuarios.username, username))
    .limit(1);

  const generico = { error: "Usuario o contraseña incorrectos" };
  if (!u || !u.activo) return generico;
  if (!verifyPassword(password, u.passwordHash)) return generico;

  await db
    .update(vanniUsuarios)
    .set({ ultimoIngreso: new Date() })
    .where(eq(vanniUsuarios.id, u.id));

  await crearSesion({
    userId: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol as VanniRol,
    debeCambiarClave: u.debeCambiarClave,
  });

  // Solo rutas del módulo y nunca la página pública de pago.
  redirect(from.startsWith(RAIZ) && !from.startsWith("/vanni/pagar") ? from : RAIZ);
}

export async function logoutAction(): Promise<void> {
  await cerrarSesion();
  redirect(LOGIN);
}

/**
 * La sesión vigente, contrastada contra la base: una cuenta desactivada o con
 * el rol cambiado se nota en la siguiente pantalla, no doce horas después.
 */
export async function sesionVigente(): Promise<SesionVanni | null> {
  const s = await leerSesion();
  if (!s) return null;
  const [u] = await db
    .select()
    .from(vanniUsuarios)
    .where(eq(vanniUsuarios.id, s.userId))
    .limit(1);
  if (!u || !u.activo) return null;
  return {
    userId: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol as VanniRol,
    debeCambiarClave: u.debeCambiarClave,
  };
}

export async function requireSesion(): Promise<SesionVanni> {
  const s = await sesionVigente();
  if (!s) redirect(LOGIN);
  return s;
}

export async function requireAdmin(): Promise<SesionVanni> {
  const s = await requireSesion();
  if (!esAdmin(s)) throw new Error("Solo un administrador puede hacer esto");
  return s;
}

export async function cambiarClaveAction(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const s = await requireSesion();
  const actual = formData.get("actual") as string;
  const nueva = formData.get("nueva") as string;
  const repetida = formData.get("repetida") as string;

  const problema = problemaDeClave(nueva ?? "");
  if (problema) return { error: problema };
  if (nueva !== repetida) return { error: "Las contraseñas no coinciden" };

  const [u] = await db.select().from(vanniUsuarios).where(eq(vanniUsuarios.id, s.userId));
  if (!u || !verifyPassword(actual ?? "", u.passwordHash)) {
    return { error: "La contraseña actual no es correcta" };
  }

  await db
    .update(vanniUsuarios)
    .set({ passwordHash: hashPassword(nueva), debeCambiarClave: false })
    .where(eq(vanniUsuarios.id, s.userId));
  await crearSesion({ ...s, debeCambiarClave: false });
  redirect(RAIZ);
}
