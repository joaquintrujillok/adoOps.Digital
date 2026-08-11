// El texto de la cotización que recibe el cliente.
//
// Vive en su propio módulo, SIN tocar la base de datos, para que la vista
// previa del formulario y el mensaje que realmente sale usen la misma función.
// Si la pantalla reconstruyera el texto por su cuenta, el día que alguien
// cambie una línea estaría aprobando algo distinto de lo que ve.
//
// Portado del CRM de CDC, donde esta separación evitó el error clásico de
// aprobar un borrador y mandar otra cosa.

export interface ItemDocumento {
  nombre: string;
  marca?: string | null;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  total: number;
}

export interface DatosDocumento {
  id?: number;
  cotizanteNombre: string;
  paraSiMismo: boolean;
  destinatarioNombre?: string | null;
  items: ItemDocumento[];
  subtotal: number;
  descuentoItems: number;
  descuentoGlobal: number;
  total: number;
  empresa: string;
  vendedor?: string | null;
  boutique?: string | null;
}

export const clp = (n: number) =>
  `$${Math.round(n).toLocaleString("es-CL")}`;

/**
 * Negrita de WhatsApp: UN asterisco a cada lado, no dos.
 *
 * Con `**texto**` el cliente ve el par sobrante como caracteres literales.
 * Solo se usa en textos que salen por WhatsApp — en una hoja impresa un
 * asterisco es un asterisco.
 */
export const negrita = (t: string) => `*${t}*`;

/** Primer nombre y primer apellido: los registros traen hasta cuatro nombres. */
export function nombreCorto(completo: string): string {
  const partes = completo.trim().split(/\s+/).filter((p) => !/^\d+$/.test(p));
  if (partes.length <= 2) return partes.join(" ");
  return `${partes[0]} ${partes[partes.length - 2]}`;
}

/**
 * El cuerpo de la cotización. NO incluye el cierre.
 *
 * El cierre —invitación a responder y la palabra BAJA— lo agrega
 * `mensajeCompleto()` y no se edita: es la salida del cliente y no puede
 * quedar a criterio de quien redacta.
 */
export function construirDocumento(d: DatosDocumento): string {
  const saludo = nombreCorto(d.cotizanteNombre) || "";
  const lineas: string[] = [];

  lineas.push(`Hola ${saludo}, te saludamos de ${negrita(d.empresa)}.`);
  lineas.push("");

  if (d.paraSiMismo) {
    lineas.push(
      d.id
        ? `Esta es la cotización N.º ${d.id} que preparamos para ti:`
        : "Esta es la cotización que preparamos para ti:",
    );
  } else {
    const para = nombreCorto(d.destinatarioNombre ?? "") || "quien la recibirá";
    lineas.push(
      d.id
        ? `Esta es la cotización N.º ${d.id} que preparamos para ${para}:`
        : `Esta es la cotización que preparamos para ${para}:`,
    );
  }
  lineas.push("");

  for (const i of d.items) {
    const titulo = [i.marca, i.nombre].filter(Boolean).join(" · ");
    const cantidad = i.cantidad > 1 ? ` (x${i.cantidad})` : "";
    lineas.push(`• ${titulo}${cantidad} — ${clp(i.total)}`);
    if (i.descuento > 0) {
      lineas.push(`   antes ${clp(i.precioUnitario * i.cantidad)}, con ${clp(i.descuento)} de descuento`);
    }
  }

  lineas.push("");

  // El desglose solo aparece si hubo descuento. Mostrar "descuento: $0" invita
  // a preguntar por qué no hay descuento, que es justo la conversación que no
  // conviene abrir por escrito.
  const descuentoTotal = d.descuentoItems + d.descuentoGlobal;
  if (descuentoTotal > 0) {
    lineas.push(`Subtotal: ${clp(d.subtotal)}`);
    lineas.push(`Descuento: ${clp(descuentoTotal)}`);
  }
  lineas.push(negrita(`Total: ${clp(d.total)}`));

  if (d.boutique) {
    lineas.push("");
    lineas.push(`Te esperamos en nuestra boutique de ${d.boutique} cuando quieras verlas en persona.`);
  }

  return lineas.join("\n");
}

/**
 * El mensaje entero: cuerpo editable + cierre fijo.
 *
 * `cuerpo` llega editado por quien vende —la referencia de CDC: el mensaje se
 * ajusta antes de mandarlo— pero el cierre se vuelve a pegar acá siempre. La
 * palabra BAJA es la salida del cliente y no puede perderse porque alguien
 * borró la última línea sin darse cuenta.
 */
export function mensajeCompleto(cuerpo: string, vendedor?: string | null): string {
  const firma = vendedor ? `\nQuedo atento, ${nombreCorto(vendedor)}.` : "";
  return [
    cuerpo.trimEnd(),
    "",
    "Si quieres verla en persona o tienes dudas, respóndenos por acá.",
    firma.trim(),
    "Si prefieres no recibir más mensajes, responde BAJA.",
  ]
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n");
}
