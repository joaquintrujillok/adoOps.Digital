// Consultas sobre los usuarios de Tuniche.
//
// Separado de `usuarios.actions.ts` a propósito: acá no hay `"use server"` y
// nada muta. Eso permite que el flujo de WhatsApp —que no es una acción de
// formulario— use `usuarioPorTelefono` sin arrastrar el resto.

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tunicheUsuarios, type TunicheUsuario } from "@/db/tuniche";
import { normalizarTelefono } from "@/lib/crm/telefono";

/**
 * Si el módulo está desplegado en este entorno.
 *
 * Las tablas `tuniche_*` se crean con `scripts/tuniche-setup.mjs`, no con el
 * despliegue. Un entorno sin ellas es un estado legítimo —el sitio de adoOps se
 * sirve entero sin el sistema de Tuniche—, y preguntar antes de consultar evita
 * llenar los registros de errores que no son fallas.
 */
export async function disponible(): Promise<boolean> {
  try {
    await db.select({ id: tunicheUsuarios.id }).from(tunicheUsuarios).limit(1);
    return true;
  } catch {
    return false;
  }
}

/** Todos los usuarios, para la pantalla de administración. */
export async function listarUsuarios(): Promise<TunicheUsuario[]> {
  return db
    .select()
    .from(tunicheUsuarios)
    .orderBy(asc(tunicheUsuarios.area), asc(tunicheUsuarios.nombre));
}

export async function usuarioPorId(id: number): Promise<TunicheUsuario | null> {
  const [u] = await db
    .select()
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.id, id))
    .limit(1);
  return u ?? null;
}

/**
 * Quién es el número que acaba de mandar un audio.
 *
 * **Esta función es la bisagra del sistema.** Un audio de WhatsApp no trae
 * usuario ni contraseña: trae un número. Si el número no está registrado, el
 * mensaje no tiene autor, no tiene área y por lo tanto no tiene plantilla —y la
 * respuesta correcta es rechazarlo, no adivinar. Un informe atribuido a la
 * persona equivocada es peor que un informe que no se creó.
 *
 * Devuelve `null` también para usuarios desactivados: desactivar una cuenta
 * tiene que cortar todas las vías de entrada, no solo el formulario de login.
 */
export async function usuarioPorTelefono(
  crudo: string | null | undefined,
): Promise<TunicheUsuario | null> {
  const e164 = normalizarTelefono(crudo);
  if (!e164) return null;

  const [u] = await db
    .select()
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.telefono, e164))
    .limit(1);

  if (!u || !u.activo) return null;
  return u;
}
