// Buscador del catálogo para el armador de cotizaciones.
//
// Es una ruta de API y no una Server Action porque se llama mientras alguien
// teclea con el cliente delante: necesita ser cancelable y responder en cada
// pulsación, cosa que una acción de formulario no hace bien.
//
// El proxy exige sesión para todo /api/crm salvo webhook y cron, así que este
// endpoint no está abierto.

import { NextResponse } from "next/server";
import { buscarPiezas } from "@/lib/crm/cotizaciones";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ piezas: [] });

  const piezas = await buscarPiezas(q, 10);
  return NextResponse.json({ piezas });
}
