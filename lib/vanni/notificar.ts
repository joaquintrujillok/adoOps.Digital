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
  /** Si llegó fuera del horario de atención: cuándo se le prometió la llamada ("mañana"). */
  fueraDeHorario?: string | null;
}

function llamado(a: AvisoInteresado): string {
  if (a.tipo === "reclamo") return "Contáctalo para resolverlo.";
  if (a.fueraDeHorario) return `Llegó fuera de horario: se le dijo que lo llamarías ${a.fueraDeHorario}.`;
  return "Llámalo hoy: está esperando tu contacto.";
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

// Colores de la marca Vanni (los del logo y de las piezas de campaña).
const VERDE = "#0e8027";
const VERDE_LOGO = "#35a211";
const TINTA = "#25292b";

/**
 * El correo del aviso, con la marca de Vanni. Tablas y estilos en línea: es lo
 * único que Gmail y Outlook respetan. El logo va por URL absoluta.
 */
export function htmlAviso(a: AvisoInteresado, titulo: string, enlace: string): string {
  const fila = (k: string, v: string | null) =>
    v
      ? `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e9e3;color:#5a6570;width:130px;vertical-align:top;font-size:14px">${k}</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #e6e9e3;color:${TINTA};font-size:15px">${escapar(v)}</td></tr>`
      : "";
  const tel = a.telefonoCliente.replace(/\D/g, "");
  const boton = (href: string, texto: string, fondo: string, color: string, borde: string) =>
    `<a href="${href}" style="display:inline-block;background:${fondo};color:${color};border:2px solid ${borde};padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin:0 8px 8px 0">${texto}</a>`;
  const reclamo = a.tipo === "reclamo";
  // El emoji del asunto no va en la franja: sobre el verde se ve como una mancha.
  const encabezado = titulo.replace(/^[^\p{L}]+/u, "");
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f6f1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f1;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;border:1px solid #e1e5dc">
  <tr><td align="center" style="padding:24px 24px 18px;border-bottom:4px solid ${VERDE_LOGO}">
    <img src="${SITE_URL}/clientes/vanni-logo.png" width="180" alt="Vanni" style="display:block;width:180px;height:auto;border:0">
  </td></tr>
  <tr><td style="background:${reclamo ? "#8a3b12" : VERDE};padding:18px 28px">
    <div style="color:#d9f0d2;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:700">${reclamo ? "Atender hoy" : "Por llamar"}</div>
    <div style="color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;margin-top:4px">${escapar(encabezado)}: ${escapar(a.nombreCliente)}</div>
  </td></tr>
  <tr><td style="padding:22px 28px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      ${fila("Teléfono", formatoTelefono(a.telefonoCliente))}
      ${fila("Le interesa", a.interes)}
      ${fila("Resumen", a.resumen)}
      ${fila("Campaña", a.campana)}
      ${fila("Sucursal", a.sucursal)}
    </table>
  </td></tr>
  <tr><td style="padding:18px 28px 8px">
    <p style="margin:0 0 14px;color:${TINTA};font-size:15px;font-weight:700">${escapar(llamado(a))}</p>
    ${boton(`tel:+${tel}`, "Llamar", VERDE, "#ffffff", VERDE)}
    ${boton(`https://wa.me/${tel}`, "Escribirle por WhatsApp", "#ffffff", VERDE, VERDE)}
    ${boton(enlace, "Ver en el backoffice", "#ffffff", TINTA, "#cfd5cb")}
  </td></tr>
  <tr><td style="padding:16px 28px 22px;color:#7a848c;font-size:12px;line-height:1.5;border-top:1px solid #eef0eb">
    Aviso automático del asistente de WhatsApp de Vanni Chile. El cliente respondió a la campaña y ya sabe que lo vas a contactar.
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
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
    llamado(a),
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
      await client.transactionalEmails.sendTransacEmail({
        to: [{ email: ejecutiva.email, name: ejecutiva.nombre }],
        sender: { email: process.env.FROM_EMAIL || "noreply@adoops.ai", name: "Vanni · Reactivación" },
        subject: `${titulo}: ${a.nombreCliente}`,
        htmlContent: htmlAviso(a, titulo, enlace),
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
