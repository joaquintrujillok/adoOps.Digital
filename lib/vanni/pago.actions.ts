"use server";

// Pago simulado de un pedido. Es la única acción de Vanni sin sesión: la abre
// el cliente final desde el link que le llegó por WhatsApp. Lo que la protege
// es el token del link (16 bytes aleatorios), no una cookie.

import { revalidatePath } from "next/cache";
import { pedidoPorToken, registrarPago } from "./pedidos";

export async function pagarPedidoAction(token: string): Promise<{ ok: boolean; error?: string }> {
  const encontrado = await pedidoPorToken(token);
  if (!encontrado) return { ok: false, error: "El link de pago no es válido." };
  if (encontrado.pedido.estado === "cancelado") return { ok: false, error: "Este pedido fue cancelado." };
  if (encontrado.pedido.pagadoAt) return { ok: true };
  // Un pedido con despacho o una reserva de pickup: los dos se pueden pagar aquí.
  await registrarPago(encontrado.pedido.id);
  revalidatePath(`/vanni/pagar/${token}`);
  return { ok: true };
}
