// Sesión del Sistema Tuniche — cookie firmada con HMAC-SHA256, claves con scrypt.
//
// Es el mismo mecanismo del CRM y de Dashboard360, copiado y no importado, por
// la misma razón que ellos están copiados entre sí: son productos distintos que
// comparten base de datos por conveniencia, no por diseño. Acá el argumento es
// más fuerte todavía —esto es el sistema de **otra empresa**—, y una sesión de
// adoOps no debe abrir el sistema de Tuniche ni al revés. Cookie propia, secreto
// propio, tabla de usuarios propia.
//
// El secreto no tiene valor por defecto a propósito: un fallback conocido
// convierte todas las sesiones en falsificables el día que alguien olvide
// definir la variable.

import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { AreaId } from "./areas";
import type { TunicheRol } from "@/db/tuniche";

const COOKIE = "tuniche_session";

// 12 horas: una jornada. Un zonal que entra a las 7 de la mañana no debería
// tener que volver a autenticarse a media tarde en un campo sin señal.
const MAX_AGE = 60 * 60 * 12;

export interface SesionTuniche {
  userId: number;
  username: string;
  nombre: string;
  rol: TunicheRol;
  /** `null` solo para admin, que cruza áreas. Ver lib/tuniche/areas.ts */
  area: AreaId | null;
  /** Clave dictada por un administrador: sirve para entrar una vez. */
  debeCambiarClave: boolean;
}

interface Firmado extends SesionTuniche {
  exp: number;
}

function secreto(): string {
  const s = process.env.TUNICHE_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "TUNICHE_SESSION_SECRET no está definida o tiene menos de 32 caracteres",
    );
  }
  return s;
}

// ─── Firma ───────────────────────────────────────────────────────────────────

function firmar(payload: Firmado): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secreto()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verificar(token: string): Firmado | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const esperado = createHmac("sha256", secreto()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Firmado;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Contraseñas ─────────────────────────────────────────────────────────────

export function hashPassword(plano: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(plano, sal, 64);
  return `scrypt$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(plano: string, guardado: string): boolean {
  const [algo, salB64, hashB64] = guardado.split("$");
  if (algo !== "scrypt" || !salB64 || !hashB64) return false;
  const sal = Buffer.from(salB64, "base64url");
  const esperado = Buffer.from(hashB64, "base64url");
  const real = scryptSync(plano, sal, esperado.length);
  return esperado.length === real.length && timingSafeEqual(esperado, real);
}

/**
 * Reglas mínimas de la contraseña. Devuelve el problema, o `null` si sirve.
 *
 * Deliberadamente cortas: largo y nada más. Las reglas de "una mayúscula, un
 * número y un símbolo" producen `Tuniche2026!` en todas las cuentas y una nota
 * pegada al monitor. Doce caracteres y que la persona elija.
 */
export function problemaDeClave(clave: string): string | null {
  if (clave.length < 12) return "La contraseña necesita al menos 12 caracteres";
  if (/^\s|\s$/.test(clave)) return "La contraseña no puede empezar ni terminar con espacio";
  return null;
}

// ─── Ciclo de vida ───────────────────────────────────────────────────────────

export async function crearSesion(data: SesionTuniche): Promise<void> {
  const token = firmar({ ...data, exp: Date.now() + MAX_AGE * 1000 });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function leerSesion(): Promise<SesionTuniche | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = verificar(token);
  if (!payload) return null;
  const { exp: _exp, ...data } = payload;
  return data;
}

export async function cerrarSesion(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const COOKIE_SESION = COOKIE;

// ─── Autorización ────────────────────────────────────────────────────────────
//
// Todo lo que decide "qué puede hacer esta persona" vive acá, en funciones puras
// sobre la sesión. La regla que se rompe sola es la que está escrita en tres
// pantallas distintas: acá se escribe una vez y las pantallas preguntan.

/** Crear, editar y desactivar cuentas. Solo admin. */
export function puedeGestionarUsuarios(s: SesionTuniche): boolean {
  return s.rol === "admin";
}

/**
 * Dar el visto bueno para que un informe salga al agricultor, y enviarlo.
 *
 * Es la única acción con destinatario **fuera** de Tuniche, y por eso no la
 * tiene el zonal. Son dos afirmaciones distintas y las hace gente distinta: el
 * zonal valida —"esto es lo que yo vi", y nadie más puede afirmarlo— y la
 * jefatura aprueba —"esto puede salir de Tuniche"—. Una frase mal dicha en un
 * audio deja de ser una frase de un zonal y pasa a ser una frase que la empresa
 * le escribió a un cliente.
 *
 * **El envío nunca es automático.** No se dispara al validar, no hay envío por
 * lote ni programado: alguien con nombre y apellido decide cada informe, y ese
 * nombre queda guardado en `tuniche_visitas.aprobada_por`.
 *
 * Es la misma línea que ya trazó Dashboard360 con `puedePublicar`.
 */
export function puedeEnviarAlAgricultor(s: SesionTuniche): boolean {
  return s.rol === "admin" || s.rol === "jefe";
}

/** Editar agricultores, lotes y demás maestras. */
export function puedeEditarMaestras(s: SesionTuniche): boolean {
  return s.rol === "admin";
}

/**
 * Qué filas puede ver esta persona.
 *
 * **Este es el contrato de todo el módulo.** Cada consulta que lea visitas,
 * agricultores o lotes tiene que pasar por acá en vez de decidir por su cuenta,
 * porque el filtro que se olvida en una sola pantalla es el que le muestra a un
 * zonal de Mercado Nacional los agricultores de Altué.
 *
 * - admin → todo.
 * - jefe  → toda su área.
 * - zonal → solo lo suyo, dentro de su área.
 */
export interface Alcance {
  /** Sin filtro. Solo admin. */
  todo: boolean;
  /** Área a la que se limita. `null` únicamente cuando `todo` es true. */
  area: AreaId | null;
  /** Si además se limita a las filas de esta persona. */
  soloUsuarioId: number | null;
}

export function alcanceDe(s: SesionTuniche): Alcance {
  if (s.rol === "admin") return { todo: true, area: null, soloUsuarioId: null };
  if (s.rol === "jefe") return { todo: false, area: s.area, soloUsuarioId: null };
  return { todo: false, area: s.area, soloUsuarioId: s.userId };
}
