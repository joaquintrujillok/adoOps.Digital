"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { d360Users } from "@/db/dashboard360";
import { cuentaPorId, resolverCuenta } from "@/lib/cuentas";
import { rutaInicialDe } from "./nav";
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

  const permitidas = user.cuentas ?? undefined;

  await createSession({
    userId: user.id,
    username: user.username,
    nombre: user.nombre,
    rol: user.rol as Role,
    // La cuenta con la que se entra se resuelve acá y no se deja en blanco: una
    // sesión sin cuenta obligaría a cada pantalla a decidir un default por su
    // cuenta, y ahí es donde dos pantallas empiezan a discrepar.
    cuenta: resolverCuenta(undefined, permitidas).id,
    cuentas: permitidas,
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

/**
 * Cambiar de cuenta.
 *
 * Se re-emite la sesión entera en vez de guardar la cuenta en una cookie aparte.
 * Cuesta una firma HMAC y compra que la cuenta activa no sea editable desde la
 * consola del navegador — ver la nota de `cuenta` en `session.ts`.
 *
 * **Valida contra las cuentas permitidas**, no contra el registro completo. Que
 * hoy una sola persona use el tablero no es razón para escribir un cambio de
 * contexto que no revisa nada: el día que entre alguien de Soho, esta línea es
 * la única que le impide pararse en adoOps.
 */
export async function cambiarCuentaAction(formData: FormData): Promise<void> {
  const sesion = await getSession();
  if (!sesion) redirect("/dashboard360/login");

  const pedida = String(formData.get("cuenta") ?? "");
  const destino = cuentaPorId(pedida);
  if (!destino) return;

  const permitidas = sesion.cuentas;
  if (permitidas && permitidas.length > 0 && !permitidas.includes(destino.id)) return;

  await createSession({ ...sesion, cuenta: destino.id });

  // A la primera sección de la cuenta de destino, no a la raíz del tablero.
  // Mandar siempre a `/dashboard360` dejaba a quien entraba a Soho parado sobre
  // el Panel 360 —una pantalla que esa cuenta no tiene y que su menú no
  // muestra—, así que el menú decía una cosa y la pantalla otra.
  redirect(rutaInicialDe(destino));
}
