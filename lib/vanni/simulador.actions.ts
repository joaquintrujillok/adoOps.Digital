"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vanniMensajes } from "@/db/vanni";
import { requireSesion } from "./auth.actions";
import { cerrarSesion } from "./motor/conversacion";
import { procesarMensaje } from "./motor";
import { normalizarTelefono } from "./telefono";

export interface MensajeChat {
  id: number;
  direccion: "in" | "out";
  texto: string;
  imagenUrl: string | null;
  at: string;
}

/**
 * El simulador corre el motor completo —las mismas reglas, el mismo modelo, la
 * misma base— pero nada sale por WhatsApp. Solo acepta teléfonos inventados
 * (569000…) para que una prueba nunca quede a nombre de un cliente real.
 */
function telefonoSimulado(t: string): string | null {
  const n = normalizarTelefono(t);
  return n && n.startsWith("569000") ? n : null;
}

export async function conversacionSimulada(telefono: string): Promise<MensajeChat[]> {
  await requireSesion();
  const tel = telefonoSimulado(telefono);
  if (!tel) return [];
  const filas = await db
    .select()
    .from(vanniMensajes)
    .where(eq(vanniMensajes.telefono, tel))
    .orderBy(asc(vanniMensajes.createdAt), asc(vanniMensajes.id));
  return filas.map((m) => ({
    id: m.id,
    direccion: m.direccion as "in" | "out",
    texto: m.texto,
    imagenUrl: m.imagenUrl,
    at: m.createdAt.toISOString(),
  }));
}

export async function simularMensaje(telefono: string, texto: string): Promise<MensajeChat[]> {
  await requireSesion();
  const tel = telefonoSimulado(telefono);
  if (!tel) throw new Error("El simulador solo usa teléfonos 569000XXXXX");
  if (texto.trim()) {
    await procesarMensaje({ telefono: tel, texto, nombre: "Carolina Muñoz", simulado: true, enviar: false });
  }
  return conversacionSimulada(tel);
}

export async function reiniciarSimulacion(telefono: string): Promise<MensajeChat[]> {
  await requireSesion();
  const tel = telefonoSimulado(telefono);
  if (!tel) return [];
  await db.delete(vanniMensajes).where(eq(vanniMensajes.telefono, tel));
  await cerrarSesion(tel);
  return [];
}
