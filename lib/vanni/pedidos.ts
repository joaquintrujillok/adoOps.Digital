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
import { enviarImagen, enviarTexto } from "./wa";

export function linkDePago(token: string): string {
  return `${SITE_URL}/vanni/pagar/${token}`;
}

/** La boleta (de demostración) de un pedido pagado, como imagen. */
export function urlBoleta(token: string): string {
  return `${SITE_URL}/api/vanni/boleta/${token}`;
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
  /** Pickup: queda reservado para retiro (sin link de pago) y descuenta stock. */
  reserva?: boolean;
}): Promise<VanniPedido> {
  if (!p.carrito.length) throw new Error("El carrito está vacío");

  // Precios vigentes al momento de confirmar, no los que quedaron en la sesión.
  const actuales = await db
    .select({ id: vanniProductos.id, precio: vanniProductos.precio, nombre: vanniProductos.nombre, stock: vanniProductos.stock })
    .from(vanniProductos)
    .where(inArray(vanniProductos.id, p.carrito.map((c) => c.productoId)));
  const items = p.carrito.map((c) => {
    const a = actuales.find((x) => x.id === c.productoId);
    return {
      productoId: c.productoId,
      nombre: a?.nombre ?? c.nombre,
      precio: a?.precio ?? c.precio,
      cantidad: c.cantidad,
      stockAlCotizar: a?.stock ?? null,
    };
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
          estado: p.reserva ? "reservado" : "pendiente_pago",
          historial: [{ estado: p.reserva ? "reservado" : "pendiente_pago", at: ahora }],
          simulado: p.simulado,
        })
        .returning();
      await db.insert(vanniPedidoItems).values(items.map((i) => ({ ...i, pedidoId: pedido.id })));
      // Una reserva aparta el stock al confirmarse; un pedido con link, al pagarse.
      if (p.reserva) await descontarStock(pedido.id);
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
/** "Retiro en sucursal Centro" → "Centro". `null` si es un despacho. */
export function sucursalDeRetiro(direccion: string | null): string | null {
  const m = (direccion ?? "").match(/^Retiro en sucursal\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function descontarStock(pedidoId: number): Promise<void> {
  const items = await db.select().from(vanniPedidoItems).where(eq(vanniPedidoItems.pedidoId, pedidoId));
  for (const i of items) {
    if (!i.productoId) continue;
    await db
      .update(vanniProductos)
      .set({ stock: sql`greatest(${vanniProductos.stock} - ${i.cantidad}, 0)` })
      .where(eq(vanniProductos.id, i.productoId));
  }
}

async function avisar(pedido: VanniPedido, texto: string): Promise<void> {
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

async function enviarBoleta(pedido: VanniPedido): Promise<void> {
  const imagen = urlBoleta(pedido.tokenPago);
  const epigrafe = `🧾 Tu boleta del pedido *${pedido.codigo}*. _Documento de demostración._`;
  const r = pedido.simulado
    ? { ok: true, simulado: true, msgId: undefined as string | undefined }
    : await enviarImagen(pedido.telefono, imagen, epigrafe);
  if (!r.ok) console.error("[vanni] no salió la boleta del pedido", pedido.codigo, r.error);
  await guardarMensaje({
    telefono: pedido.telefono,
    flujo: "tienda",
    direccion: "out",
    texto: epigrafe,
    imagenUrl: imagen,
    simulado: pedido.simulado || r.simulado,
    waMsgId: r.msgId ?? null,
  });
}

/**
 * El pago desde el link. Un pedido con despacho pasa a "pagado" y sigue su
 * recorrido; una reserva de pickup queda pagada pero sigue en su recorrido de
 * retiro (reservado → preparación → listo → retirado): solo cambia que ya no
 * paga en caja. En los dos casos llegan "Pago recibido" y la boleta.
 */
export async function registrarPago(id: number): Promise<void> {
  const [actual] = await db.select().from(vanniPedidos).where(eq(vanniPedidos.id, id));
  if (!actual || actual.pagadoAt || actual.estado === "cancelado") return;
  const sucursal = sucursalDeRetiro(actual.direccion);
  if (!sucursal) {
    await cambiarEstadoPedido(id, "pagado");
    return;
  }
  const [pedido] = await db
    .update(vanniPedidos)
    .set({
      pagadoAt: new Date(),
      updatedAt: new Date(),
      historial: [...(actual.historial ?? []), { estado: "pagado", at: new Date().toISOString() }],
    })
    .where(eq(vanniPedidos.id, id))
    .returning();
  await avisar(pedido, `✅ Pago recibido. Tu pedido *${pedido.codigo}* quedó pagado; retíralo en *${sucursal}* cuando te avisemos que está listo.`);
  await enviarBoleta(pedido);
}

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

  if (estado === "pagado" && actual.estado === "pendiente_pago") await descontarStock(id);

  const texto = mensajeEstadoPedido(estado, pedido.codigo, sucursalDeRetiro(pedido.direccion), Boolean(pedido.pagadoAt));
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

  // Tras "Pago recibido", la boleta: el comprobante con productos y unidades.
  if (estado === "pagado") await enviarBoleta(pedido);
  return pedido;
}
