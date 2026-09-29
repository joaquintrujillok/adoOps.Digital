// Memoria del motor: el historial de mensajes y en qué flujo está cada teléfono.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniMensajes,
  vanniSesiones,
  type VanniEstadoTienda,
  type VanniSesion,
} from "@/db/vanni";

export type Flujo = "ofertas" | "tienda";

export async function guardarMensaje(m: {
  telefono: string;
  flujo: Flujo | "sistema";
  direccion: "in" | "out";
  texto: string;
  imagenUrl?: string | null;
  simulado?: boolean;
  waMsgId?: string | null;
}): Promise<boolean> {
  // `false` = ese mensaje entrante ya estaba guardado (WaSender lo mandó dos
  // veces). Quien recibe `false` no debe responderlo.
  const r = await db
    .insert(vanniMensajes)
    .values({
      telefono: m.telefono,
      flujo: m.flujo,
      direccion: m.direccion,
      texto: m.texto,
      imagenUrl: m.imagenUrl ?? null,
      simulado: m.simulado ?? false,
      waMsgId: m.waMsgId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: vanniMensajes.id });
  return r.length > 0;
}

/**
 * Los últimos mensajes de un flujo, del más antiguo al más nuevo. Como en el
 * bot de Paine, el historial se carga antes de decidir: con historial, una
 * frase suelta ("y el grande?") tiene contexto.
 */
export async function historial(telefono: string, n = 10): Promise<{ rol: "cliente" | "vanni"; texto: string }[]> {
  const filas = await db
    .select({ direccion: vanniMensajes.direccion, texto: vanniMensajes.texto })
    .from(vanniMensajes)
    .where(eq(vanniMensajes.telefono, telefono))
    .orderBy(desc(vanniMensajes.createdAt))
    .limit(n);
  return filas.reverse().map((f) => ({ rol: f.direccion === "in" ? "cliente" : "vanni", texto: f.texto }));
}

export async function leerSesion(telefono: string): Promise<VanniSesion | null> {
  const [s] = await db.select().from(vanniSesiones).where(eq(vanniSesiones.telefono, telefono)).limit(1);
  return s ?? null;
}

export async function guardarSesion(s: {
  telefono: string;
  flujo: Flujo;
  contactoId?: number | null;
  campanaId?: number | null;
  estado?: VanniEstadoTienda | null;
}): Promise<void> {
  const valores = {
    flujo: s.flujo,
    contactoId: s.contactoId ?? null,
    campanaId: s.campanaId ?? null,
    estado: s.estado ?? null,
    actualizadaAt: new Date(),
  };
  await db
    .insert(vanniSesiones)
    .values({ telefono: s.telefono, ...valores })
    .onConflictDoUpdate({ target: vanniSesiones.telefono, set: valores });
}

export async function cerrarSesion(telefono: string): Promise<void> {
  await db.delete(vanniSesiones).where(eq(vanniSesiones.telefono, telefono));
}

export function estadoTienda(s: VanniSesion | null): VanniEstadoTienda {
  return s?.flujo === "tienda" && s.estado ? s.estado : { carrito: [] };
}
