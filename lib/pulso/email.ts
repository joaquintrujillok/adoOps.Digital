// El resultado que le llega a cada persona que dejó su correo.
//
// Sale por Brevo como el resto del sitio. El remitente es Nelson, no "adoOps
// Web": la persona estuvo en una charla de Nelson y espera que le escriba él.

import { BrevoClient } from "@getbrevo/brevo";
import { SITE_URL as BASE } from "@/lib/site";
import { CASOS, CUADRANTES, type Cuadrante, type EstadoSala } from "./modelo";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FUENTE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace";

export function htmlResultado(p: {
  nombre: string;
  cuadrante: Cuadrante;
  sala: EstadoSala;
}): string {
  const c = CUADRANTES[p.cuadrante];
  const total = p.sala.total || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  const filas = (Object.keys(CUADRANTES) as Cuadrante[])
    .map((k) => {
      const yo = k === p.cuadrante;
      const v = pct(p.sala.cuadrantes[k]);
      return `<tr>
        <td style="padding:6px 0;font-family:${MONO};font-size:13px;color:${yo ? "#0F7D3B" : "#44546A"};font-weight:${yo ? 600 : 400};width:110px">${CUADRANTES[k].nombre}${yo ? " ·&nbsp;tú" : ""}</td>
        <td style="padding:6px 0"><div style="background:#EFEEE6;border-radius:3px;height:10px"><div style="background:${yo ? "#20C463" : "#B9C3CC"};width:${Math.max(v, 2)}%;height:10px;border-radius:3px"></div></div></td>
        <td style="padding:6px 0 6px 10px;font-family:${MONO};font-size:13px;color:#44546A;width:44px;text-align:right">${v}%</td>
      </tr>`;
    })
    .join("");

  const casos = CASOS[p.cuadrante];
  const bloqueCasos = casos.length
    ? `<p style="margin:28px 0 10px;font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0F7D3B">// Dos casos para tu perfil</p>
       ${casos
         .map(
           (k) => `<div style="border-top:1px solid #DCDBD2;padding:14px 0">
             <p style="margin:0 0 4px;font-family:${MONO};font-weight:600;font-size:15px;color:#0E1D33">${esc(k.titulo)}</p>
             <p style="margin:0;font-size:14.5px;line-height:1.55;color:#44546A">${esc(k.resumen)}</p>
             ${k.url ? `<p style="margin:8px 0 0"><a href="${esc(k.url)}" style="font-family:${MONO};font-size:13px;color:#0F7D3B">Leer el caso →</a></p>` : ""}
           </div>`,
         )
         .join("")}`
    : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFEEE6">
<table cellpadding="0" cellspacing="0" style="width:100%;background:#EFEEE6"><tr><td align="center" style="padding:32px 14px">
<table cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#F8F7F3;border:1px solid #DCDBD2;border-radius:10px">
  <tr><td style="padding:24px 32px;border-bottom:1px solid #DCDBD2">
    <img src="${BASE}/logo.png" alt="adoOps" width="104" style="display:block;width:104px;height:auto;border:0">
  </td></tr>
  <tr><td style="padding:30px 32px 8px;font-family:${FUENTE};color:#0E1D33">
    <p style="margin:0 0 6px;font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0F7D3B">// Pulso IA · ${esc(p.sala.organizacion)}</p>
    <p style="margin:0 0 18px;font-size:15px;color:#44546A">Hola ${esc(p.nombre.split(" ")[0])}, este es tu resultado de la charla.</p>
    <p style="margin:0;font-family:${MONO};font-size:30px;font-weight:500;letter-spacing:-.03em;line-height:1.1">${c.nombre}</p>
    <p style="margin:6px 0 18px;font-family:${MONO};font-size:14px;color:#0F7D3B">${c.lema}</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0E1D33">${c.lectura}</p>
    <div style="background:#0F8542;border-radius:8px;padding:18px 20px;margin:0 0 26px">
      <p style="margin:0 0 6px;font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#B7F2CF">Tu siguiente paso</p>
      <p style="margin:0;font-size:15px;line-height:1.55;color:#FFFFFF">${c.siguiente}</p>
    </div>
    <p style="margin:0 0 8px;font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#7C8A9A">Cómo quedó la sala · ${p.sala.total} personas</p>
    <table cellpadding="0" cellspacing="0" style="width:100%">${filas}</table>
    ${bloqueCasos}
  </td></tr>
  <tr><td style="padding:22px 32px 30px;font-family:${FUENTE}">
    <p style="margin:0 0 4px;font-size:14px;color:#0E1D33;font-weight:600">${esc(p.sala.relator)}</p>
    <p style="margin:0;font-family:${MONO};font-size:12.5px;color:#7C8A9A">adoops.digital</p>
  </td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-family:${FUENTE};font-size:12px;line-height:1.6;color:#7C8A9A;text-align:center">
Recibes este correo porque lo pediste al final de la charla. Si no quieres recibir más, responde "baja" y no te escribimos de nuevo.
</p>
</td></tr></table></body></html>`;
}

/** Devuelve true si salió. Sin BREVO_API_KEY no intenta (desarrollo local). */
export async function enviarResultado(p: {
  email: string;
  nombre: string;
  cuadrante: Cuadrante;
  sala: EstadoSala;
}): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) return false;
  const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  await client.transactionalEmails.sendTransacEmail({
    to: [{ email: p.email, name: p.nombre }],
    sender: {
      email: process.env.PULSO_FROM_EMAIL || process.env.CAFECITO_FROM_EMAIL || "hola@adoops.digital",
      name: `${p.sala.relator} · adoOps`,
    },
    replyTo: { email: process.env.PULSO_REPLY_TO || "nelson.garcia.m@gmail.com", name: p.sala.relator },
    subject: `Tu Pulso IA: ${CUADRANTES[p.cuadrante].nombre}`,
    htmlContent: htmlResultado(p),
  });
  return true;
}
