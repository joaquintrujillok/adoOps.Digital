// Recálculo periódico de alertas.
//
// La misma función que corre el botón "Volver a analizar", expuesta para que un
// cron la llame sola. Es lo que convierte la bandeja en algo que avisa, en vez
// de algo que alguien tiene que acordarse de mirar.
//
// Autenticación propia (el proxy deja pasar /api/crm/cron sin sesión):
// `Authorization: Bearer $CRON_SECRET`. Sin CRON_SECRET configurada devuelve
// 503 — falla cerrado, no abierto.
//
// Para programarlo en Vercel, agregar a vercel.json:
//   { "crons": [{ "path": "/api/crm/cron/alertas", "schedule": "0 11 * * 1-5" }] }
// (11:00 UTC ≈ 07:00 en Chile continental, antes de que parta la jornada.)

import { NextResponse } from "next/server";
import { recalcularAlertas } from "@/lib/crm/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: "CRON_SECRET no configurada" },
      { status: 503 },
    );
  }

  const autorizacion = request.headers.get("authorization");
  if (autorizacion !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultado = await recalcularAlertas();
  return NextResponse.json({ ok: true, ...resultado });
}
