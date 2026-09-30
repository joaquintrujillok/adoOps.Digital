// Avisos a la ejecutiva: por WhatsApp y por correo, como pide el flujo de la
// campaña. Los dos canales van por separado y el fallo de uno no bloquea al
// otro: si Brevo no está configurado, el WhatsApp sale igual, y al revés.

import { BrevoClient } from "@getbrevo/brevo";
import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { vanniUsuarios, type VanniUsuario } from "@/db/vanni";
import { SITE_URL } from "@/lib/site";
import { formatoTelefono } from "./telefono";
import { enviarTexto } from "./wa";

export interface AvisoInteresado {
  tipo: "interes" | "reclamo";
  oportunidadId: number;
  nombreCliente: string;
  telefonoCliente: string;
  interes: string | null;
  resumen: string | null;
  campana: string | null;
  sucursal: string | null;
}

/** La ejecutiva a cargo, o en su defecto el primer admin con teléfono. */
export async function ejecutivaPara(id: number | null | undefined): Promise<VanniUsuario | null> {
  if (id) {
    const [u] = await db
      .select()
      .from(vanniUsuarios)
      .where(and(eq(vanniUsuarios.id, id), eq(vanniUsuarios.activo, true)));
    if (u) return u;
  }
  const [respaldo] = await db
    .select()
    .from(vanniUsuarios)
    // La cuenta de caja no atiende interesados: solo canjea.
    .where(and(eq(vanniUsuarios.activo, true), isNotNull(vanniUsuarios.telefono), ne(vanniUsuarios.rol, "caja")))
    .orderBy(asc(vanniUsuarios.id))
    .limit(1);
  return respaldo ?? null;
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function avisarEjecutiva(
  ejecutiva: VanniUsuario | null,
  a: AvisoInteresado,
): Promise<{ whatsapp: boolean; correo: boolean }> {
  const resultado = { whatsapp: false, correo: false };
  if (!ejecutiva) return resultado;

  const titulo = a.tipo === "reclamo" ? "⚠️ Cliente con un reclamo" : "🟢 Cliente interesado";
  const enlace = `${SITE_URL}/vanni/oportunidades`;
  const lineas = [
    `*${titulo}: ${a.nombreCliente}*`,
    `Teléfono: ${formatoTelefono(a.telefonoCliente)}`,
    a.interes ? `Le interesa: ${a.interes}` : null,
    a.resumen ? `Resumen: ${a.resumen}` : null,
    a.campana ? `Campaña: ${a.campana}` : null,
    a.sucursal ? `Sucursal: ${a.sucursal}` : null,
    "",
    a.tipo === "reclamo" ? "Contáctalo para resolverlo." : "Llámalo hoy: está esperando tu contacto.",
    enlace,
  ].filter((l): l is string => l !== null);

  if (ejecutiva.telefono) {
    const r = await enviarTexto(ejecutiva.telefono, lineas.join("\n"));
    resultado.whatsapp = r.ok;
    if (!r.ok) console.error("[vanni] aviso por WhatsApp a la ejecutiva falló:", r.error);
  }

  const apiKey = process.env.BREVO_API_KEY?.trim();
  if (ejecutiva.email && apiKey) {
    try {
      const client = new BrevoClient({ apiKey });
      const fila = (k: string, v: string | null) =>
        v ? `<tr><td style="padding:6px 0;color:#5A6570;width:120px">${k}</td><td style="padding:6px 0">${escapar(v)}</td></tr>` : "";
      await client.transactionalEmails.sendTransacEmail({
        to: [{ email: ejecutiva.email, name: ejecutiva.nombre }],
        sender: { email: process.env.FROM_EMAIL || "noreply@adoops.ai", name: "Vanni · Reactivación" },
        subject: `${titulo}: ${a.nombreCliente}`,
        htmlContent: `
          <div style="font-family:'DM Sans',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1B2A2F">
            <div style="background:#1B2A2F;color:#F6F4EF;padding:20px 28px;border-radius:12px 12px 0 0;font-size:18px;font-weight:600">${escapar(titulo)}</div>
            <div style="background:#FDFCFA;border:1px solid #D9D3C7;border-top:none;padding:24px 28px;border-radius:0 0 12px 12px">
              <table style="width:100%;border-collapse:collapse;font-size:14px">
                ${fila("Cliente", a.nombreCliente)}
                ${fila("Teléfono", formatoTelefono(a.telefonoCliente))}
                ${fila("Le interesa", a.interes)}
                ${fila("Resumen", a.resumen)}
                ${fila("Campaña", a.campana)}
                ${fila("Sucursal", a.sucursal)}
              </table>
              <a href="${enlace}" style="display:inline-block;margin-top:18px;background:#17705B;color:#F6F4EF;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Ver en el backoffice</a>
            </div>
          </div>`,
      });
      resultado.correo = true;
    } catch (err) {
      console.error("[vanni] aviso por correo a la ejecutiva falló", err);
    }
  }
  return resultado;
}

/** Lo que el cliente recibe en cada cambio de estado de su pedido. */
export function mensajeEstadoPedido(estado: string, codigo: string): string | null {
  switch (estado) {
    case "pagado":
      return `✅ Pago recibido. Tu pedido *${codigo}* está confirmado y pasa a preparación.`;
    case "preparacion":
      return `📦 Estamos preparando tu pedido *${codigo}*.`;
    case "despachado":
      return `🚚 Tu pedido *${codigo}* está saliendo de bodega.`;
    case "en_camino":
      return `🛣️ Tu pedido *${codigo}* va en camino. Te avisamos cuando llegue.`;
    case "llega_hoy":
      return `📍 Tu pedido *${codigo}* llega hoy. ¡Atento a la entrega!`;
    case "entregado":
      return `🏁 Tu pedido *${codigo}* llegó a destino. ¡Gracias por comprar en Vanni! Si algo no está bien, respóndenos por aquí.`;
    case "cancelado":
      return `Tu pedido *${codigo}* fue cancelado. Si fue un error, respóndenos y lo revisamos.`;
    default:
      return null;
  }
}
