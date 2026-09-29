// La bandeja de conversaciones: un chat por teléfono, el más reciente arriba.

import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface ResumenChat {
  telefono: string;
  nombre: string | null;
  ultimo: string;
  texto: string;
  direccion: "in" | "out";
  /** Flujo del último mensaje: `ofertas` | `tienda` | `sistema`. */
  flujo: string;
  mensajes: number;
  /** Mensajes del cliente sin respuesta de Vanni después. */
  sinResponder: boolean;
}

export async function listaConversaciones(limite = 300): Promise<ResumenChat[]> {
  const r = await db.execute(sql`
    select distinct on (m.telefono)
      m.telefono, m.created_at as ultimo, m.texto, m.direccion, m.flujo,
      (select count(*) from vanni_mensajes x where x.telefono = m.telefono)::int as mensajes,
      coalesce(c.razon_social, c.nombre) as nombre
    from vanni_mensajes m
    left join vanni_contactos c on c.telefono = m.telefono
    order by m.telefono, m.created_at desc, m.id desc`);
  return (r.rows as Record<string, unknown>[])
    .map((x) => ({
      telefono: String(x.telefono),
      nombre: (x.nombre as string | null) ?? null,
      ultimo: new Date(x.ultimo as string).toISOString(),
      texto: String(x.texto),
      direccion: x.direccion === "in" ? ("in" as const) : ("out" as const),
      flujo: String(x.flujo),
      mensajes: Number(x.mensajes),
      sinResponder: x.direccion === "in",
    }))
    .sort((a, b) => +new Date(b.ultimo) - +new Date(a.ultimo))
    .slice(0, limite);
}
