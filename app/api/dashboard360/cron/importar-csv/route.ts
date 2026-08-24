// Carga un informe de campaña de Google Ads exportado desde la interfaz.
//
// Corre dentro del despliegue por el mismo motivo que el endpoint de setup: la
// cadena de conexión de Neon está cifrada en Vercel y no se puede leer desde
// fuera. El CSV viaja en el cuerpo de la petición.
//
// Autenticación propia: `Authorization: Bearer $D360_SETUP_SECRET`. Sin esa
// variable responde 503, que es también la forma de apagarlo.
//
//   D360_SETUP_SECRET=... node scripts/d360-importar-csv.mjs <url> <archivo.csv> [cuenta]

import { NextResponse } from "next/server";
import { importarCsvGoogleAds } from "@/lib/dashboard360/google-ads-csv";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const secreto = process.env.D360_SETUP_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "D360_SETUP_SECRET no configurada" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cuenta = new URL(request.url).searchParams.get("cuenta") ?? undefined;

  try {
    const contenido = await request.text();
    if (!contenido.trim()) {
      return NextResponse.json({ ok: false, error: "El cuerpo viene vacío" }, { status: 400 });
    }
    const r = await importarCsvGoogleAds(contenido, cuenta);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
