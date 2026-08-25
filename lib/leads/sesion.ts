// La sesión del motor, que acepta las DOS sesiones del repo.
//
// ── Por qué no se elige una ──────────────────────────────────────────────────
//
// El motor se muda a `/dashboard360/motor` para que todo el flujo de
// prospección se vea en una sola consola. Pero `proxy.ts` dice, y con razón,
// que `/leads` comparte cookie con el CRM a propósito: *"no es otro producto,
// es la misma gente operando dos partes del mismo sistema. Un segundo login
// sería una segunda contraseña que alguien apunta en un papel."*
//
// Mudarlo a la sesión del tablero sin más le habría quitado el motor a quien
// entra por `/crm`. Así que la zona del motor acepta cualquiera de las dos: se
// centraliza la pantalla, no se le quita el acceso a nadie.
//
// Lo que sigue separado es lo importante: una sesión del CRM **no** abre el
// Panel 360, ni al revés. Solo esta zona es común, y solo porque el motor es la
// misma operación mirada desde dos productos.

import { redirect } from "next/navigation";
import { getSession as getSesionCrm } from "@/lib/crm/session";
import { getSession as getSesionD360 } from "@/lib/dashboard360/session";

export type OrigenSesion = "dashboard360" | "crm";

export interface SesionMotor {
  userId: number;
  username: string;
  nombre: string;
  rol: string;
  origen: OrigenSesion;
}

/**
 * La sesión que haya, sin redirigir. `null` si no hay ninguna.
 *
 * Se prueba primero la del tablero porque es donde vive la pantalla: si alguien
 * tiene las dos cookies, el nombre que se muestra arriba a la derecha debe ser
 * el del producto en el que está parado.
 */
export async function getSesionMotor(): Promise<SesionMotor | null> {
  const d360 = await getSesionD360();
  if (d360) return { ...d360, origen: "dashboard360" };

  const crm = await getSesionCrm();
  if (crm) return { ...crm, origen: "crm" };

  return null;
}

/**
 * Sesión obligatoria. Toda página y toda acción del motor empieza por acá — el
 * proxy es una primera barrera, no la autorización.
 *
 * Redirige al login del tablero, que es donde vive la pantalla ahora. Quien
 * tenga cuenta solo en el CRM y llegue sin sesión va a terminar allá; el enlace
 * de vuelta está en la pantalla de login.
 */
export async function requireSesionMotor(): Promise<SesionMotor> {
  const s = await getSesionMotor();
  if (!s) redirect("/dashboard360/login?from=/dashboard360/motor");
  return s;
}

/**
 * Quién puede apagar el motor, aprobar lotes y activar campañas.
 *
 * Son las acciones con destinatario externo: alguien va a recibir un mensaje.
 * Se reservan igual que publicar un informe al directorio en el tablero — el
 * rol `analista` mira y prepara, pero no dispara.
 */
export function puedeDespachar(s: SesionMotor): boolean {
  return s.rol === "admin" || s.rol === "gerente";
}

export async function requireDespachador(): Promise<SesionMotor> {
  const s = await requireSesionMotor();
  if (!puedeDespachar(s)) {
    throw new Error("Aprobar envíos requiere permisos de gerencia");
  }
  return s;
}
