// Correo de confirmación de Cafecito IA.
//
// Sale por Brevo, igual que las notificaciones de leads (lib/email.ts), pero con
// remitente propio: quien se suscribe a un boletín espera que le escriba el
// boletín, no el formulario de contacto de una web.

import { BrevoClient } from "@getbrevo/brevo";
import { SITE_URL as BASE } from "@/lib/site";

const REMITENTE = {
  email: process.env.CAFECITO_FROM_EMAIL || "hola@adoops.digital",
  name: "Cafecito IA",
};

function envoltorio(contenido: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EEF1F3;-webkit-font-smoothing:antialiased">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#EEF1F3">
<tr><td align="center" style="padding:32px 14px">
  <table cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#FFFFFF;border:1px solid #E3E8EC;border-radius:10px">
    <tr><td style="padding:26px 34px 20px;border-bottom:2px solid #20C463">
      <img src="${BASE}/logo.png" alt="adoOps" width="112" style="display:block;width:112px;height:auto;border:0">
    </td></tr>
    <tr><td style="padding:30px 34px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
${contenido}
    </td></tr>
  </table>
  <div style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#8B98A4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;text-align:center">
    Cafecito IA · el boletín de inteligencia artificial de adoOps
  </div>
</td></tr></table></body></html>`;
}

const BOTON = (href: string, texto: string) =>
  `<table cellpadding="0" cellspacing="0" style="margin:26px 0"><tr><td style="background:#20C463;border-radius:9px">
   <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:15.5px;font-weight:600;color:#06281A;text-decoration:none">${texto}</a>
   </td></tr></table>`;

/**
 * El correo del doble opt-in. Hace dos cosas a la vez: verifica la dirección y
 * lleva al perfilamiento. Separarlas en dos correos duplicaría los envíos y
 * perdería a la mitad de la gente entre uno y otro.
 */
export async function enviarConfirmacion(email: string, token: string) {
  const url = `${BASE}/cafecito-ia/confirmar/${token}`;

  await new BrevoClient({ apiKey: process.env.BREVO_API_KEY! })
    .transactionalEmails.sendTransacEmail({
      to: [{ email }],
      sender: REMITENTE,
      subject: "Confirma tu suscripción a Cafecito IA",
      htmlContent: envoltorio(`
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;font-weight:700;color:#0E1D33;letter-spacing:-.4px">
          Un clic y quedas dentro
        </h1>
        <p style="margin:0 0 6px;font-size:15.5px;line-height:1.62;color:#2C3844">
          Alguien —esperamos que tú— pidió recibir Cafecito IA en esta dirección.
          Confírmalo y de paso elige cómo lo quieres: hay tres tamaños de taza.
        </p>
        ${BOTON(url, "Confirmar y elegir mi taza")}
        <p style="margin:0 0 6px;font-size:13.5px;line-height:1.6;color:#7B8894">
          El enlace vence en 7 días. Si no fuiste tú, ignora este correo: sin ese
          clic no te llega nada.
        </p>
        <p style="margin:18px 0 0;font-size:12.5px;line-height:1.6;color:#9AA6B1;word-break:break-all">
          ¿No funciona el botón? Copia esta dirección: ${url}
        </p>
      `),
      textContent:
        `Confirma tu suscripción a Cafecito IA y elige tu taza: ${url}\n\n` +
        `El enlace vence en 7 días. Si no fuiste tú, ignora este correo.`,
    });
}

/**
 * El correo de bienvenida, con la última edición publicada.
 *
 * ── Por qué existe ───────────────────────────────────────────────────────────
 *
 * Hasta el 07-09-2026, quien confirmaba no recibía absolutamente nada hasta la
 * siguiente publicación. Suscribirse un lunes a las 18:00 significaba dos días
 * de silencio después de haber hecho dos clics, que es el momento de mayor
 * interés y el peor para no dar señales de vida. Alguien que se suscribe quiere
 * leer el boletín, no esperar el próximo.
 *
 * ── Por qué lleva un enlace y no la edición completa ────────────────────────
 *
 * La plantilla del boletín —con imágenes, estilos en línea y una variante por
 * taza— vive en el repo que redacta y despacha, no acá. Rehacerla en el sitio
 * daría dos plantillas que se separan a la primera corrección, que es el mismo
 * problema que se evitó con la lógica de slugs.
 *
 * Así que este correo hace lo que sí puede hacer bien: presenta la última
 * edición y lleva a leerla al sitio, que además es la versión completa. La
 * edición de verdad, en la taza que la persona eligió, llega en la próxima
 * publicación.
 */
export async function enviarBienvenida(
  email: string,
  edicion: { slug: string; titulo: string; bajada: string | null; lectura: string | null },
) {
  const url = `${BASE}/cafecito-ia/${edicion.slug}`;

  await new BrevoClient({ apiKey: process.env.BREVO_API_KEY! })
    .transactionalEmails.sendTransacEmail({
      to: [{ email }],
      sender: REMITENTE,
      subject: `Ya estás dentro — empieza por: ${edicion.titulo}`,
      htmlContent: envoltorio(`
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.3;font-weight:700;color:#0E1D33;letter-spacing:-.4px">
          Listo, quedaste dentro
        </h1>
        <p style="margin:0 0 22px;font-size:15.5px;line-height:1.62;color:#2C3844">
          Cafecito IA sale los lunes, miércoles y viernes a las 9 de la mañana.
          Mientras llega la próxima, esta es la última edición publicada.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;background:#F6F8F9;border:1px solid #E3E8EC;border-radius:9px">
          <tr><td style="padding:20px 22px">
            <p style="margin:0 0 8px;font-size:19px;line-height:1.35;font-weight:650;color:#0E1D33;letter-spacing:-.3px">
              ${edicion.titulo}
            </p>
            ${
              edicion.bajada
                ? `<p style="margin:0;font-size:14.5px;line-height:1.6;color:#5C6B79">${edicion.bajada}</p>`
                : ""
            }
            ${
              edicion.lectura
                ? `<p style="margin:10px 0 0;font-size:12.5px;color:#8B98A4">${edicion.lectura}</p>`
                : ""
            }
          </td></tr>
        </table>
        ${BOTON(url, "Leer la edición")}
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:#7B8894">
          Puedes cambiar de taza o darte de baja cuando quieras, desde el pie de
          cualquier edición.
        </p>
      `),
      textContent:
        `Ya estás dentro de Cafecito IA. Sale lunes, miércoles y viernes a las 9:00.\n\n` +
        `Mientras llega la próxima, la última edición publicada es:\n\n` +
        `${edicion.titulo}\n${edicion.bajada ?? ""}\n\n${url}\n`,
    });
}
