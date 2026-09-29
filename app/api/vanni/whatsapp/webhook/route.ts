import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vanniMensajes } from "@/db/vanni";
import { estadoDesdeWebhook } from "@/lib/vanni/envios";
import { procesarMensaje } from "@/lib/vanni/motor";
import { enviarTexto, telefonoEntrante, textoEntrante, type WaEntrante } from "@/lib/vanni/wa";

export const runtime = "nodejs";

// Webhook de la sesión de WaSender **de Vanni** (no la de Tuniche ni las demos).
//
// Responde 200 de inmediato y procesa con `after()`: WaSender reintenta si el
// ack tarda, y un reintento es un mensaje duplicado para el cliente.
//
// A diferencia del webhook compartido, acá la firma es obligatoria. Este
// endpoint dispara respuestas a clientes reales de otra empresa: sin el secreto
// configurado no se procesa nada.

const procesados = new Set<string>();

type Cuerpo = {
  event?: string;
  data?: {
    messages?: WaEntrante | WaEntrante[];
    key?: { id?: string; fromMe?: boolean };
    update?: { status?: number };
  } & Record<string, unknown>;
};

export async function POST(req: Request) {
  const secreto = process.env.VANNI_WASENDER_WEBHOOK_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "VANNI_WASENDER_WEBHOOK_SECRET no configurada" }, { status: 503 });
  }
  if (req.headers.get("x-webhook-signature") !== secreto) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let cuerpo: Cuerpo;
  try {
    cuerpo = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  // Estado de entrega de un mensaje que mandamos (enviado, entregado, leído).
  if (cuerpo.event === "messages.update") {
    const lista = Array.isArray(cuerpo.data) ? (cuerpo.data as unknown as Cuerpo["data"][]) : [cuerpo.data];
    after(async () => {
      for (const d of lista) {
        const id = d?.key?.id;
        const status = d?.update?.status;
        if (id && typeof status === "number" && d?.key?.fromMe !== false) await estadoDesdeWebhook(id, status);
      }
    });
    return NextResponse.json({ status: "ok" });
  }

  if (cuerpo.event !== "messages.received" && cuerpo.event !== "messages.upsert") {
    return NextResponse.json({ status: "ignored" });
  }
  const mensajes = cuerpo.data?.messages;
  if (!mensajes) return NextResponse.json({ status: "ignored" });

  for (const msg of Array.isArray(mensajes) ? mensajes : [mensajes]) {
    if (msg.key?.fromMe) continue;
    if (msg.key?.remoteJid?.endsWith("@g.us")) continue; // grupos: no son clientes
    const id = msg.key?.id;
    if (!id || procesados.has(id)) continue;
    procesados.add(id);
    if (procesados.size > 2000) procesados.clear();

    after(async () => {
      // Dedup contra la base además de la memoria: dos invocaciones del webhook
      // no comparten el Set.
      const [ya] = await db.select({ id: vanniMensajes.id }).from(vanniMensajes).where(eq(vanniMensajes.waMsgId, id)).limit(1);
      if (ya) return;
      const telefono = telefonoEntrante(msg);
      const texto = textoEntrante(msg);
      if (!texto) {
        await enviarTexto(telefono, "Por ahora respondo solo mensajes de texto 🙂 ¿Me lo escribes?");
        return;
      }
      try {
        await procesarMensaje({ telefono, texto, nombre: msg.pushName ?? null, waMsgId: id, enviar: true });
      } catch (err) {
        console.error("[vanni] el motor falló con un mensaje entrante", err);
        await enviarTexto(telefono, "Tuve un problema para responderte. Una persona de Vanni te va a contactar.");
      }
    });
  }
  return NextResponse.json({ status: "ok" });
}

export async function GET() {
  return NextResponse.json({ status: "vanni webhook up" });
}
