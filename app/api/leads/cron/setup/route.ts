// Puesta en marcha del motor de nurturing, ejecutada dentro del despliegue.
//
// Gemelo de /api/dashboard360/cron/setup y por la misma razón: la cadena de
// Neon vive cifrada en Vercel y no se puede leer desde una máquina local.
//
// `Authorization: Bearer $LEADS_SETUP_SECRET`. **Sin esa variable devuelve 503**,
// que es además la forma de apagarlo: se borra en Vercel y queda inerte. Falla
// cerrado, nunca abierto.
//
// Va bajo /api/leads/cron porque el proxy ya deja pasar ese prefijo sin sesión
// —lo llaman crons y webhooks, no un navegador—, y trae su propia autenticación.
//
//   curl -X POST "$URL/api/leads/cron/setup" -H "Authorization: Bearer $SECRET"

import { NextResponse } from "next/server";
import { crearTablas, sembrarConfiguracion } from "@/lib/leads/setup";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const secreto = process.env.LEADS_SETUP_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: "LEADS_SETUP_SECRET no configurada" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const sentencias = await crearTablas();
    const config = await sembrarConfiguracion({
      emisor: process.env.LEADS_EMISOR_INICIAL,
    });
    return NextResponse.json({ ok: true, sentencias, ...config });
  } catch (e) {
    // El mensaje va tal cual: lo llama quien tiene el secreto, y un error
    // genérico obligaría a ir a buscar los logs de Vercel para saber qué pasó.
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
