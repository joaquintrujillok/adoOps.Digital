// Sesión del CRM — cookie firmada con HMAC-SHA256 y contraseñas con scrypt.
//
// No hay JWT ni librería de auth: el payload va firmado, no cifrado, y lo único
// que contiene es quién eres y hasta cuándo. Sin el secreto no se puede forjar,
// y con el secreto no hace falta consultar la BD en cada request.
//
// El secreto no tiene valor por defecto a propósito. Un fallback conocido
// convierte todas las sesiones de producción en falsificables el día que
// alguien olvide definir la variable.

import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const COOKIE = "adoops_crm_session";
const MAX_AGE = 60 * 60 * 12; // 12 horas: una jornada comercial completa

export type Role = "admin" | "gerente" | "vendedor";

export interface SessionData {
  userId: number;
  username: string;
  nombre: string;
  rol: Role;
}

interface SignedPayload extends SessionData {
  exp: number;
}

function secret(): string {
  const s = process.env.CRM_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "CRM_SESSION_SECRET no está definida o tiene menos de 32 caracteres",
    );
  }
  return s;
}

// ─── Firma ───────────────────────────────────────────────────────────────────

function sign(payload: SignedPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function unsign(token: string): SignedPayload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

  const esperado = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SignedPayload;
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

// ─── API ─────────────────────────────────────────────────────────────────────

export async function createSession(data: SessionData): Promise<void> {
  const token = sign({ ...data, exp: Date.now() + MAX_AGE * 1000 });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const payload = unsign(token);
  if (!payload) return null;
  const { exp: _exp, ...data } = payload;
  return data;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;

// ─── Autorización ────────────────────────────────────────────────────────────

/** Gerencia y admin ven la cartera completa; un vendedor, solo la suya. */
export function veTodo(s: SessionData): boolean {
  return s.rol === "gerente" || s.rol === "admin";
}

/**
 * `null` = sin restricción de dueño. Cualquier consulta de cartera pasa por acá
 * para que el alcance del vendedor no dependa de que cada pantalla se acuerde.
 */
export function ownerScope(s: SessionData): number | null {
  return veTodo(s) ? null : s.userId;
}
