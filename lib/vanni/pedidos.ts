// Pedidos de la tienda por WhatsApp.
//
// El pago es **simulado**: el link lleva a una página de adoops.digital que
// marca el pedido como pagado. Es lo que la demo necesita para mostrar el ciclo
// completo —link, pago, preparación, despacho, entrega— sin una pasarela real,
// que es una decisión de la fase 3 y no de este piloto.

import { randomBytes } from "crypto";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniPedidoItems,
  vanniPedidos,
  vanniProductos,
  type VanniEstadoPedido,
  type VanniEstadoTienda,
  type VanniPedido,
} from "@/db/vanni";
import { SITE_URL } from "@/lib/site";
import { guardarMensaje } from "./motor/conversacion";
import { mensajeEstadoPedido } from "./notificar";
import { enviarTexto } from "./wa";

export function linkDePago(token: string): string {
  return `${SITE_URL}/vanni/pagar/${token}`;
}

function codigoNuevo(): string {
  const n = parseInt(randomBytes(3).toString("hex"), 16) % 9000;
  return `V-${1000 + n}`;
}

export async function crearPedido(p: {
  telefono: string;
  contactoId: number | null;
  nombreCliente: string | null;
  direccion: string | null;
  carrito: VanniEstadoTienda["carrito"];
  simulado: boolean;
}): Promise<VanniPedido> {
  if (!p.carrito.length) throw new Error("El carrito está vacío");

  // Precios vigentes al momento de confirmar, no los que quedaron en la sesión.
  const actuales = await db
    .select({ id: vanniProductos.id, precio: vanniProductos.precio, nombre: vanniProductos.nombre })
    .from(vanniProductos)
    .where(inArray(vanniProductos.id, p.carrito.map((c) => c.productoId)));
  const items = p.carrito.map((c) => {
    const a = actuales.find((x) => x.id === c.productoId);
    return { productoId: c.productoId, nombre: a?.nombre ?? c.nombre, precio: a?.precio ?? c.precio, cantidad: c.cantidad };
  });
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const ahora = new Date().toISOString();

  for (let intento = 0; intento < 5; intento++) {
    try {
      const [pedido] = await db
        .insert(vanniPedidos)
        .values({
          codigo: codigoNuevo(),
          telefono: p.telefono,
          contactoId: p.contactoId,
          nombreCliente: p.nombreCliente,
          direccion: p.direccion,
          total,
          tokenPago: randomBytes(16).toString("base64url"),
          historial: [{ estado: "pendiente_pago", at: ahora }],
          simulado: p.simulado,
        })
        .returning();
      await db.insert(vanniPedidoItems).values(items.map((i) => ({ ...i, pedidoId: pedido.id })));
      return pedido;
    } catch (err) {
      // Choque del código corto: se prueba otro. Cualquier otro error sube.
      if (!String(err).includes("vanni_pedidos_codigo_idx")) throw err;
    }
  }
  throw new Error("No se pudo generar un código de pedido");
}

export async function pedidoPorToken(token: string) {
  const [pedido] = await db.select().from(vanniPedidos).where(eq(vanniPedidos.tokenPago, token)).limit(1);
  if (!pedido) return null;
  const items = await db.select().from(vanniPedidoItems).where(eq(vanniPedidoItems.pedidoId, pedido.id));
  return { pedido, items };
}

export async function ultimoPedido(telefono: string): Promise<VanniPedido | null> {
  const [p] = await db
    .select()
    .from(vanniPedidos)
    .where(eq(vanniPedidos.telefono, telefono))
    .orderBy(desc(vanniPedidos.createdAt))
    .limit(1);
  return p ?? null;
}

/**
 * Cambia el estado y le avisa al cliente. Descuenta stock al pagar: es la
 * primera vez que el pedido es de verdad.
 */
export async function cambiarEstadoPedido(id: number, estado: VanniEstadoPedido): Promise<VanniPedido> {
  const [actual] = await db.select().from(vanniPedidos).where(eq(vanniPedidos.id, id));
  if (!actual) throw new Error("Pedido no encontrado");
  if (actual.estado === estado) return actual;

  const historial = [...(actual.historial ?? []), { estado, at: new Date().toISOString() }];
  const [pedido] = await db
    .update(vanniPedidos)
    .set({
      estado,
      historial,
      updatedAt: new Date(),
      ...(estado === "pagado" ? { pagadoAt: new Date() } : {}),
    })
    .where(eq(vanniPedidos.id, id))
    .returning();

  if (estado === "pagado") {
    const items = await db.select().from(vanniPedidoItems).where(eq(vanniPedidoItems.pedidoId, id));
    for (const i of items) {
      if (!i.productoId) continue;
      await db
        .update(vanniProductos)
        .set({ stock: sql`greatest(${vanniProductos.stock} - ${i.cantidad}, 0)` })
        .where(eq(vanniProductos.id, i.productoId));
    }
  }

  const texto = mensajeEstadoPedido(estado, pedido.codigo);
  if (texto) {
    const r = pedido.simulado
      ? { ok: true, simulado: true, msgId: undefined as string | undefined }
      : await enviarTexto(pedido.telefono, texto);
    await guardarMensaje({
      telefono: pedido.telefono,
      flujo: "tienda",
      direccion: "out",
      texto,
      simulado: pedido.simulado || r.simulado,
      waMsgId: r.msgId ?? null,
    });
  }
  return pedido;
}
