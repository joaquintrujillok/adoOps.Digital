"use server";

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoSuscriptores, TAZAS, type CafecitoTaza } from "@/db/schema";
import { enviarConfirmacion } from "./email";
import { normalizarTelefono, PAIS_POR_DEFECTO } from "./telefono";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const token = () => randomBytes(24).toString("hex");
const en7Dias = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

// ─── Paso 1: registro con el correo ──────────────────────────────────────────

export type RegistroState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

/**
 * Crea o reactiva un registro pendiente y manda el correo de confirmación.
 *
 * La respuesta es idéntica exista o no la dirección, y también cuando ya está
 * confirmada. Un formulario que contesta distinto según el caso se convierte en
 * un oráculo para averiguar quién está suscrito a qué.
 */
export async function registrar(
  _prev: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  // Honeypot: campo invisible que solo completa un bot. Se responde éxito para
  // no darle señal de que fue detectado.
  if ((formData.get("empresa_web") as string)?.trim()) return { status: "success" };

  if (!email || !EMAIL_RE.test(email)) {
    return { status: "error", message: "Revisa el correo, parece incompleto." };
  }

  try {
    const [existente] = await db
      .select()
      .from(cafecitoSuscriptores)
      .where(eq(cafecitoSuscriptores.email, email))
      .limit(1);

    // Ya confirmado: no se reenvía nada ni se toca el registro.
    if (existente?.estado === "confirmado") return { status: "success" };

    const tokenConfirmacion = token();

    if (existente) {
      await db
        .update(cafecitoSuscriptores)
        .set({ estado: "pendiente", tokenConfirmacion, confirmacionExpiraEn: en7Dias(), bajaEn: null })
        .where(eq(cafecitoSuscriptores.id, existente.id));
    } else {
      await db.insert(cafecitoSuscriptores).values({
        email,
        estado: "pendiente",
        origen: "web",
        tokenConfirmacion,
        confirmacionExpiraEn: en7Dias(),
        tokenBaja: token(),
      });
    }

    await enviarConfirmacion(email, tokenConfirmacion);
    return { status: "success" };
  } catch (err) {
    console.error("registrar cafecito error:", err);
    return { status: "error", message: "No se pudo registrar. Intenta de nuevo." };
  }
}

// ─── Paso 2: perfilamiento (desde el link del correo) ────────────────────────

export type PerfilState =
  | { status: "idle" }
  | { status: "success"; taza: CafecitoTaza }
  | { status: "error"; message: string };

/**
 * Confirma la dirección y guarda el perfil en la misma operación: el clic en el
 * correo ya verificó el buzón, y este formulario es la contrapartida.
 *
 * Es idempotente. Alguien puede volver al link para cambiar de taza, y debe
 * poder hacerlo sin pasar de nuevo por el correo.
 */
export async function perfilar(
  _prev: PerfilState,
  formData: FormData,
): Promise<PerfilState> {
  const tk = (formData.get("token") as string)?.trim();
  const nombre = (formData.get("nombre") as string)?.trim() || null;
  const empresa = (formData.get("empresa") as string)?.trim() || null;
  const rol = (formData.get("rol") as string)?.trim() || null;
  const taza = formData.get("taza") as CafecitoTaza;

  if (!tk) return { status: "error", message: "Enlace inválido." };
  if (!Object.keys(TAZAS).includes(taza)) {
    return { status: "error", message: "Elige una de las tres tazas." };
  }

  // El teléfono se valida acá y no solo en el navegador. El cliente puede
  // saltarse cualquier validación, y esto es lo último antes de la base: si un
  // número roto pasa, se descubre el día que haya que escribirle a esa persona.
  const tel = normalizarTelefono(
    (formData.get("telefonoPais") as string) || PAIS_POR_DEFECTO,
    formData.get("telefono") as string,
  );
  if (!tel.ok) return { status: "error", message: tel.motivo };

  try {
    const [s] = await db
      .select()
      .from(cafecitoSuscriptores)
      .where(eq(cafecitoSuscriptores.tokenConfirmacion, tk))
      .limit(1);

    if (!s) return { status: "error", message: "Este enlace no es válido." };

    // Vencido solo si aún no había confirmado: quien ya confirmó puede volver a
    // ajustar su perfil cuando quiera.
    if (s.estado === "pendiente" && s.confirmacionExpiraEn && s.confirmacionExpiraEn < new Date()) {
      return { status: "error", message: "El enlace venció. Vuelve a suscribirte en el sitio." };
    }

    await db
      .update(cafecitoSuscriptores)
      .set({
        estado: "confirmado",
        confirmadoEn: s.confirmadoEn ?? new Date(),
        nombre, empresa, rol, taza,
        telefono: tel.e164,
        bajaEn: null,
      })
      .where(eq(cafecitoSuscriptores.id, s.id));

    return { status: "success", taza };
  } catch (err) {
    console.error("perfilar cafecito error:", err);
    return { status: "error", message: "No se pudo guardar. Intenta de nuevo." };
  }
}

// ─── Baja ────────────────────────────────────────────────────────────────────

/**
 * La baja se ejecuta con POST desde un botón, no en el GET de la página.
 *
 * Los escáneres de enlaces de los clientes de correo visitan cada URL de un
 * mensaje: si un GET diera de baja, un antivirus corporativo desuscribiría a
 * quien solo abrió el correo.
 */
export async function darDeBaja(tk: string): Promise<{ ok: boolean }> {
  if (!tk) return { ok: false };
  try {
    await db
      .update(cafecitoSuscriptores)
      .set({ estado: "baja", bajaEn: new Date() })
      .where(eq(cafecitoSuscriptores.tokenBaja, tk));
    return { ok: true };
  } catch (err) {
    console.error("baja cafecito error:", err);
    return { ok: false };
  }
}
