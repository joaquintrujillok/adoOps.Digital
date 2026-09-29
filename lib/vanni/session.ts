// Sesión del backoffice de Vanni — cookie firmada con HMAC-SHA256, claves con scrypt.
//
// Copiada de lib/tuniche/session.ts y no importada, por la misma razón que
// Tuniche copió la del CRM: es el sistema de otra empresa alojado acá. Cookie
// propia, secreto propio, tabla de usuarios propia. Una sesión de adoOps no abre
// Vanni, y una de Vanni no abre nada más.

import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { VanniRol } from "@/db/vanni";

const COOKIE = "vanni_session";
const MAX_AGE = 60 * 60 * 12;

export interface SesionVanni {
  userId: number;
  username: string;
  nombre: string;
  rol: VanniRol;
  debeCambiarClave: boolean;
}

interface Firmado extends SesionVanni {
  exp: number;
}

function secreto(): string {
  const s = process.env.VANNI_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("VANNI_SESSION_SECRET no está definida o tiene menos de 32 caracteres");
  }
  return s;
}

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

/** Largo y nada más: doce caracteres que la persona elige. */
export function problemaDeClave(clave: string): string | null {
  if (clave.length < 12) return "La contraseña necesita al menos 12 caracteres";
  if (/^\s|\s$/.test(clave)) return "La contraseña no puede empezar ni terminar con espacio";
  return null;
}

export async function crearSesion(data: SesionVanni): Promise<void> {
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

export async function leerSesion(): Promise<SesionVanni | null> {
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

/** Cargar bases, lanzar campañas, editar catálogo y equipo. */
export function esAdmin(s: SesionVanni): boolean {
  return s.rol === "admin";
}
