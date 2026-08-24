// Sincronía diaria de Google Ads.
//
// Autenticación propia —el proxy deja pasar /api/dashboard360/cron sin sesión—:
// `Authorization: Bearer $CRON_SECRET`. Sin CRON_SECRET configurada devuelve
// 503. Falla cerrado, no abierto.
//
// El cron de Vercel se declara en vercel.json y llega con esa misma cabecera.
// También se puede disparar a mano para forzar una resincronización.
//
//   curl "$URL/api/dashboard360/cron/google-ads" -H "Authorization: Bearer $CRON_SECRET"

import { NextResponse } from "next/server";
import { ingestarGoogleAds, registrarFalloGoogleAds } from "@/lib/dashboard360/google-ads";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "CRON_SECRET no configurada" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const r = await ingestarGoogleAds();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    // El fallo queda anotado en la pantalla de fuentes antes de responder: si
    // solo devolviéramos el error, el tablero seguiría mostrando los datos de
    // ayer como si estuvieran al día.
    await registrarFalloGoogleAds(mensaje).catch(() => {});
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
