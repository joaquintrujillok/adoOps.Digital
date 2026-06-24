import { NextResponse, after } from "next/server";
import { ingestMessage } from "@/lib/reports";
import type { WaIncomingMessage } from "@/lib/wasender";

export const runtime = "nodejs";

// Dedup en memoria del proceso (suficiente para la demo).
const processed = new Set<string>();
const MAX_DEDUP = 1000;

type WaWebhookBody = {
  event?: string;
  data?: { messages?: WaIncomingMessage | WaIncomingMessage[] };
};

/**
 * Webhook entrante de WaSender.
 * Responde 200 de inmediato y procesa el mensaje con `after()` para no
 * bloquear el ack (evita reintentos y timeouts del proveedor).
 */
export async function POST(req: Request) {
  // Verificación opcional de firma del webhook.
  const secret = process.env.WASENDER_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-webhook-signature");
    if (sig !== secret) {
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  }

  let body: WaWebhookBody;
  try {
    body = (await req.json()) as WaWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.event !== "messages.received" || !body.data?.messages) {
    return NextResponse.json({ status: "ignored" });
  }

  const messages = Array.isArray(body.data.messages)
    ? body.data.messages
    : [body.data.messages];

  for (const msg of messages) {
    if (msg.key?.fromMe) continue; // ignorar nuestros propios mensajes
    const id = msg.key?.id;
    if (!id || processed.has(id)) continue;
    processed.add(id);
    if (processed.size > MAX_DEDUP) processed.clear();

    after(() => ingestMessage(msg));
  }

  return NextResponse.json({ status: "ok" });
}

// Algunos paneles validan el endpoint con un GET.
export async function GET() {
  return NextResponse.json({ status: "whatsapp webhook up" });
}
