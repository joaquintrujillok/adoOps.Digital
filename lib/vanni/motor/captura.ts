// Flujo de captura en sala: el QR abre WhatsApp con "Quiero mi descuento Vanni
// (sala X)" ya escrito. Desde ahí son dos preguntas y un cupón:
//
//   1. Permiso para ofertas (SÍ / NO). El cupón sale igual: el descuento no se
//      condiciona al permiso, y la respuesta queda registrada.
//   2. RUT, validado con su dígito verificador y cruzado con la base de Vanni.
//   3. El cupón con su QR, como imagen. La conversación se cierra.
//
// El número no se pregunta: es el del teléfono que escribe.

import { formatoRut, normalizarRut } from "../rut";
import { capturarPorWhatsApp } from "../captura";
import { urlCupon, urlQrCupon } from "../cupones";
import { cerrarSesion, guardarSesion } from "./conversacion";
import type { VanniEstadoTienda } from "@/db/vanni";
import type { Salida } from "./tipos";

/** El mensaje que deja escrito el QR de la sala. */
export const LLAVE_SALA = /quiero\s+(mi\s+)?descuento\s+vanni/i;

/** Una conversación de captura abandonada no retiene al teléfono más de esto. */
export const CAPTURA_VIGENTE_MS = 60 * 60_000;

const INTENTOS_RUT = 4;

export type EstadoCaptura = NonNullable<VanniEstadoTienda["captura"]>;

const SI = /^\W*(s[ií]+|sip|acepto|ok[a-z]*|dale|ya|claro|bueno|de acuerdo|👍)\b|^\W*👍/i;
const NO = /^\W*(no|nop|no acepto|no gracias|prefiero que no)\b/i;

export function sucursalDelMensaje(texto: string): string | null {
  return texto.match(/\(\s*sala\s+([^)]{1,60})\)/i)?.[1]?.trim() ?? null;
}

async function guardar(telefono: string, captura: EstadoCaptura): Promise<void> {
  await guardarSesion({ telefono, flujo: "captura", estado: { carrito: [], captura } });
}

export async function iniciarCaptura(telefono: string, texto: string): Promise<Salida[]> {
  const sucursal = sucursalDelMensaje(texto);
  await guardar(telefono, { paso: "permiso", sucursal, intentos: 0 });
  return [
    {
      texto:
        `¡Hola! 👋 Bienvenido a *Vanni Chile*${sucursal ? `, sala ${sucursal}` : ""}. Te doy tu descuento en dos pasos.\n\n` +
        "Primero: ¿aceptas que Vanni guarde tu número y te envíe ofertas y novedades por WhatsApp? " +
        "Puedes darte de baja cuando quieras escribiendo BAJA.\n\n" +
        "Responde *SÍ* o *NO*. Tu descuento lo recibes igual.",
    },
  ];
}

export async function responderCaptura(d: {
  telefono: string;
  texto: string;
  estado: EstadoCaptura;
  nombrePush: string | null;
}): Promise<Salida[]> {
  const { telefono, texto, estado } = d;

  if (estado.paso === "permiso") {
    const si = SI.test(texto);
    const no = !si && NO.test(texto);
    if (!si && !no) {
      return [{ texto: "Para seguir, responde *SÍ* si aceptas recibir ofertas por WhatsApp, o *NO* si prefieres que no. Tu descuento lo recibes igual." }];
    }
    await guardar(telefono, { ...estado, paso: "rut", consentimiento: si });
    return [
      {
        texto:
          (si ? "¡Gracias! 🙌" : "Entendido, no te enviaremos ofertas.") +
          "\n\nAhora escríbeme tu *RUT* (por ejemplo: 12.345.678-5).",
      },
    ];
  }

  // Paso RUT
  const rut = normalizarRut(texto);
  if (!rut) {
    const intentos = estado.intentos + 1;
    if (intentos >= INTENTOS_RUT) {
      await cerrarSesion(telefono);
      return [{ texto: "No pude validar ese RUT. Vuelve a escanear el QR de la sala cuando quieras y lo intentamos de nuevo." }];
    }
    await guardar(telefono, { ...estado, intentos });
    return [{ texto: "Ese RUT no es válido. Revisa los números y el dígito verificador, por ejemplo: *12.345.678-5*." }];
  }

  const r = await capturarPorWhatsApp({
    telefono,
    rut,
    sucursal: estado.sucursal,
    consentimiento: Boolean(estado.consentimiento),
    nombrePush: d.nombrePush,
  });
  await cerrarSesion(telefono);

  if (!r.ok) {
    return [
      {
        texto:
          r.error === "limite"
            ? "Probaste varios RUT seguidos. Espera unos minutos y vuelve a escanear el QR."
            : "Tuve un problema para registrar tu RUT. Vuelve a escanear el QR de la sala e intentémoslo de nuevo.",
      },
    ];
  }

  const { cupon, nombre } = r;
  if (cupon.estado === "canjeado") {
    const cuando = cupon.canjeadoAt?.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
    return [
      {
        texto:
          `${nombre ? `${nombre}, ya` : "Ya"} usaste tu descuento *${cupon.descuento}*` +
          `${cuando ? ` el ${cuando}` : ""}${cupon.sucursalCanje ? ` en ${cupon.sucursalCanje}` : ""}. ` +
          "Te avisaremos por aquí cuando tengas uno nuevo. 🙌",
      },
    ];
  }
  const vence = cupon.venceAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
  return [
    {
      imagenUrl: urlQrCupon(cupon.token),
      texto:
        `¡Listo${nombre ? `, ${nombre}` : ""}! 🎁 Tu cupón: *${cupon.descuento}*\n` +
        `Código *${cupon.codigo}* · RUT ${formatoRut(rut)} · válido hasta el ${vence}.\n\n` +
        "Muestra este QR en caja y te aplicamos el descuento.\n" +
        `También lo puedes abrir aquí: ${urlCupon(cupon.token)}`,
    },
  ];
}
