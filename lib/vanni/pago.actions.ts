"use server";

// Pago simulado de un pedido. Es la única acción de Vanni sin sesión: la abre
// el cliente final desde el link que le llegó por WhatsApp. Lo que la protege
// es el token del link (16 bytes aleatorios), no una cookie.

import { revalidatePath } from "next/cache";
import { cambiarEstadoPedido, pedidoPorToken } from "./pedidos";

export async function pagarPedidoAction(token: string): Promise<{ ok: boolean; error?: string }> {
  const encontrado = await pedidoPorToken(token);
  if (!encontrado) return { ok: false, error: "El link de pago no es válido." };
  if (encontrado.pedido.estado !== "pendiente_pago") return { ok: true };
  await cambiarEstadoPedido(encontrado.pedido.id, "pagado");
  revalidatePath(`/vanni/pagar/${token}`);
  return { ok: true };
}
