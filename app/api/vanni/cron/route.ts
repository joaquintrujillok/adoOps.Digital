import { NextResponse, after } from "next/server";
import { dispararCola } from "@/lib/vanni/cola";
import { actualizarEstados, debeEncadenar, procesarCola } from "@/lib/vanni/envios";

export const runtime = "nodejs";
export const maxDuration = 60;

// La cola de Vanni: manda lo que el ritmo permite en ~45 s (campaña y
// recordatorios, ver lib/vanni/ritmo.ts) y consulta estados de entrega. Si
// quedan pendientes y la espera es corta, se vuelve a llamar a sí misma; las
// esperas largas (pausa de lote, horario) las retoma el cron.
//
// La llaman tres cosas: el botón "Lanzar campaña", ella misma (encadenada) y
// el cron de Vercel cada 10 minutos, que es la red por si una cadena se corta.
//
//   GET|POST /api/vanni/cron · Authorization: Bearer $CRON_SECRET

async function correr(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const cola = await procesarCola(45_000);
  const estados = await actualizarEstados(30);

  if (debeEncadenar(cola)) {
    const origen = new URL(req.url).origin;
    after(() => dispararCola(origen));
  }
  return NextResponse.json({ ...cola, estados });
}

export const GET = correr;
export const POST = correr;
