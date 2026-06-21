import { BrevoClient } from "@getbrevo/brevo";
import type { NewLead } from "@/db/schema";

export async function sendLeadNotification(lead: NewLead) {
  const client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY! });

  await client.transactionalEmails.sendTransacEmail({
    to: [{ email: process.env.NOTIFY_EMAIL!, name: "adoOps" }],
    replyTo: { email: lead.email, name: lead.nombre },
    sender: {
      email: process.env.FROM_EMAIL || "noreply@adoops.ai",
      name: "adoOps Web",
    },
    subject: `[${lead.tipo}] Nuevo lead: ${lead.nombre} — ${lead.empresa}`,
    htmlContent: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;color:#0E1D33;">
        <div style="background:#0E1D33;padding:24px 32px;border-radius:12px 12px 0 0;">
          <span style="font-family:sans-serif;font-weight:700;font-size:20px;color:#fff;">ado<span style="color:#2ED477;">Ops</span></span>
        </div>
        <div style="background:#F6F8F9;padding:32px;border-radius:0 0 12px 12px;border:1px solid #EAEFF2;">
          <h2 style="margin:0 0 20px;font-size:18px;">Nuevo ${lead.tipo}</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#697A88;width:120px;">Nombre</td><td style="padding:8px 0;font-weight:500;">${lead.nombre}</td></tr>
            <tr><td style="padding:8px 0;color:#697A88;">Email</td><td style="padding:8px 0;font-weight:500;">${lead.email}</td></tr>
            <tr><td style="padding:8px 0;color:#697A88;">Empresa</td><td style="padding:8px 0;font-weight:500;">${lead.empresa}</td></tr>
            <tr><td style="padding:8px 0;color:#697A88;">Rol</td><td style="padding:8px 0;">${lead.rol || "—"}</td></tr>
            <tr><td style="padding:8px 0;color:#697A88;">Tipo</td><td style="padding:8px 0;">${lead.tipo}</td></tr>
            ${lead.mensaje ? `<tr><td style="padding:8px 0;color:#697A88;vertical-align:top;">Mensaje</td><td style="padding:8px 0;">${lead.mensaje}</td></tr>` : ""}
          </table>
        </div>
      </div>
    `,
  });
}
