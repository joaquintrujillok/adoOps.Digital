"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { tunicheUsuarios, type TunicheRol } from "@/db/tuniche";
import type { AreaId } from "./areas";
import {
  alcanceDe,
  cerrarSesion,
  crearSesion,
  leerSesion,
  puedeEditarMaestras,
  puedeEnviarAlAgricultor,
  puedeGestionarUsuarios,
  verifyPassword,
  type Alcance,
  type SesionTuniche,
} from "./session";

const RAIZ = "/tuniche";
const LOGIN = "/tuniche/login";

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
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.username, username))
    .limit(1);

  // El mismo mensaje para usuario inexistente, desactivado o clave mala.
  // Distinguirlos permitiría averiguar quién trabaja en Tuniche probando de a
  // uno, que es información que no tiene por qué estar disponible sin entrar.
  const generico = { error: "Usuario o contraseña incorrectos" };
  if (!u || !u.activo) return generico;
  if (!verifyPassword(password, u.passwordHash)) return generico;

  await db
    .update(tunicheUsuarios)
    .set({ ultimoIngreso: new Date() })
    .where(eq(tunicheUsuarios.id, u.id));

  await crearSesion({
    userId: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol as TunicheRol,
    area: (u.area as AreaId | null) ?? null,
    debeCambiarClave: u.debeCambiarClave,
  });

  // Solo rutas internas del módulo: un `from` con host ajeno convertiría el
  // login en un redirector abierto, y uno con otra ruta del sitio dejaría a
  // alguien de Tuniche dentro de una pantalla de adoOps.
  redirect(from.startsWith(RAIZ) ? from : RAIZ);
}

export async function logoutAction(): Promise<void> {
  await cerrarSesion();
  redirect(LOGIN);
}

/**
 * La sesión **vigente**, o `null`. Contrasta la cookie contra la base.
 *
 * **Por qué no basta la cookie.** Dura doce horas y lleva adentro el rol y el
 * área. Si se creyera sin más, desactivar a alguien no lo sacaría del sistema y
 * bajarle el rol no le quitaría nada: seguiría entrando con lo que decía su
 * cookie hasta la noche. En un sistema cuya única función es controlar quién ve
 * los datos de qué agricultor, una revocación que tarda doce horas no es una
 * revocación.
 *
 * El costo es una consulta por índice único por carga de pantalla. Con un puñado
 * de zonales eso no se nota; que un despido se aplique mañana, sí.
 *
 * **No toca la cookie.** Durante el render de un componente de servidor no se
 * pueden escribir cookies, y esta función corre justamente ahí. No hace falta:
 * la cookie solo dice *quién dice ser*; lo que se devuelve —y por lo tanto lo
 * que se autoriza— sale siempre de la base. Una cookie huérfana no abre nada y
 * se pisa en el siguiente login.
 */
export async function sesionVigente(): Promise<SesionTuniche | null> {
  const cookie = await leerSesion();
  if (!cookie) return null;

  const [u] = await db
    .select({
      id: tunicheUsuarios.id,
      username: tunicheUsuarios.username,
      nombre: tunicheUsuarios.nombre,
      rol: tunicheUsuarios.rol,
      area: tunicheUsuarios.area,
      activo: tunicheUsuarios.activo,
      debeCambiarClave: tunicheUsuarios.debeCambiarClave,
    })
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.id, cookie.userId))
    .limit(1);

  // Cuenta borrada o desactivada: la cookie sigue siendo criptográficamente
  // válida y aun así no vale nada.
  if (!u || !u.activo) return null;

  return {
    userId: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol as TunicheRol,
    area: (u.area as AreaId | null) ?? null,
    debeCambiarClave: u.debeCambiarClave,
  };
}

/**
 * Sesión obligatoria. Todo componente de servidor y toda acción del módulo
 * empieza por acá — el proxy evita el parpadeo, no reemplaza la autorización.
 */
export async function requireSesion(): Promise<SesionTuniche> {
  const s = await sesionVigente();
  if (!s) redirect(LOGIN);
  return s;
}

/** El alcance de filas de quien esté conectado. Lo usa cada consulta. */
export async function alcanceActual(): Promise<Alcance> {
  return alcanceDe(await requireSesion());
}

// Las tres barreras de acción. Lanzan en vez de redirigir: quien llega acá ya
// tiene sesión, así que no es "no has entrado", es "no te corresponde", y un
// redirect silencioso lo haría parecer un error de la aplicación.

export async function requireAdmin(): Promise<SesionTuniche> {
  const s = await requireSesion();
  if (!puedeGestionarUsuarios(s)) {
    throw new Error("Gestionar usuarios requiere permisos de administrador");
  }
  return s;
}

export async function requireEnvioAlAgricultor(): Promise<SesionTuniche> {
  const s = await requireSesion();
  if (!puedeEnviarAlAgricultor(s)) {
    throw new Error("Enviar el informe al agricultor requiere permisos de jefatura");
  }
  return s;
}

export async function requireMaestras(): Promise<SesionTuniche> {
  const s = await requireSesion();
  if (!puedeEditarMaestras(s)) {
    throw new Error("Editar las maestras requiere permisos de administrador");
  }
  return s;
}
