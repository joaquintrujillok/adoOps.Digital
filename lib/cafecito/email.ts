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
