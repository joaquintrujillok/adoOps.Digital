import { NextResponse, after } from "next/server";
import { dispararCola } from "@/lib/vanni/cola";
import { actualizarEstados, enviarRecordatorios, procesarCola } from "@/lib/vanni/envios";

export const runtime = "nodejs";
export const maxDuration = 60;

// La cola de Vanni: manda lo que alcanza en ~45 s, consulta estados de entrega
// y manda recordatorios. Si quedan pendientes, se vuelve a llamar a sí misma.
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
  const recordatorios = await enviarRecordatorios(8);

  if (cola.pendientes > 0) {
    const origen = new URL(req.url).origin;
    after(() => dispararCola(origen));
  }
  return NextResponse.json({ ...cola, estados, recordatorios });
}

export const GET = correr;
export const POST = correr;
