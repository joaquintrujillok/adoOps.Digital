"use server";

// Altas y bajas de emisores desde la pantalla.
//
// Lo que estas acciones **no** hacen: tocar el token. Conectar es un ida y
// vuelta por LinkedIn (`/api/linkedin/conectar`), y que el token solo se escriba
// en el callback significa que no hay ninguna otra ruta por la que pueda entrar
// uno inventado.

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getSession, puedePublicar } from "@/lib/dashboard360/session";

const PANTALLA = "/dashboard360/contenido/emisores";

async function exigirPermiso() {
  const s = await getSession();
  // Mismo criterio que publicar un informe: es una acción con destinatario
  // externo. Un analista arma el contenido; conectar cuentas es de gerencia.
  if (!s || !puedePublicar(s)) throw new Error("No autorizado");
  return s;
}

export async function crearEmisorAction(formData: FormData) {
  await exigirPermiso();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const rol = String(formData.get("rol") ?? "").trim() || null;
  const tipo = String(formData.get("tipo") ?? "persona") === "organizacion"
    ? "organizacion"
    : "persona";

  if (!nombre) return;

  await db.execute(sql`
    INSERT INTO contenido_emisores (nombre, tipo, rol) VALUES (${nombre}, ${tipo}, ${rol})
  `);
  revalidatePath(PANTALLA);
}

export async function pausarEmisorAction(formData: FormData) {
  await exigirPermiso();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await db.execute(sql`
    UPDATE contenido_emisores SET pausado = 1 - pausado WHERE id = ${id}
  `);
  revalidatePath(PANTALLA);
}

/**
 * Desconectar borra el token, no la fila.
 *
 * El histórico de lo que esa persona publicó vive en `contenido_publicaciones` y
 * tiene que sobrevivir: la pregunta "¿quién publicó esto?" se hace justamente
 * cuando alguien ya no está.
 */
export async function desconectarEmisorAction(formData: FormData) {
  await exigirPermiso();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;

  await db.execute(sql`
    UPDATE contenido_emisores
       SET token = NULL, token_vence_en = NULL, scopes = NULL
     WHERE id = ${id}
  `);
  revalidatePath(PANTALLA);
}
