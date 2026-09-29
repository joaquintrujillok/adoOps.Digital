"use server";

// Acciones del formulario público del QR. No piden sesión: las usa un cliente
// en la sala. Lo que las protege es el límite de intentos por origen (ver
// lib/vanni/captura.ts) y que nunca devuelven más que un primer nombre y un
// teléfono enmascarado.

import { headers } from "next/headers";
import { buscarRut, completarCaptura, hashOrigen, type ResultadoCaptura, type ResultadoRut } from "./captura";

async function origen(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return hashOrigen(ip);
}

export async function buscarRutAction(rut: string, sucursal: string | null): Promise<ResultadoRut> {
  try {
    return await buscarRut(rut, sucursal, await origen());
  } catch (err) {
    console.error("[vanni] captura: buscar RUT falló", err);
    return { ok: false, error: "No pudimos revisar tu RUT ahora. Intenta de nuevo en un momento." };
  }
}

export async function completarCapturaAction(d: {
  codigo: string;
  confirmaTelefono: boolean;
  telefono?: string | null;
  consentimiento: boolean;
}): Promise<ResultadoCaptura> {
  try {
    return await completarCaptura(d);
  } catch (err) {
    console.error("[vanni] captura: completar falló", err);
    return { ok: false, error: "No pudimos guardar tus datos ahora. Intenta de nuevo en un momento." };
  }
}
