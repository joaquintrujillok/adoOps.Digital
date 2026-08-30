// El informe como PDF, servido al navegador.
//
// **El mismo documento que se le adjunta al WhatsApp del agricultor.** Existe
// para dos cosas: que la jefatura pueda revisarlo o mandarlo por otro canal, y
// para poder comprobar el PDF sin gastar un envío real — que es exactamente
// para lo que sirvió la ruta equivalente en el CRM de CDC.
//
// Comprueba sesión y alcance por su cuenta. El proxy ya cubre `/api/tuniche`,
// pero eso es un control optimista: el día que alguien agregue una excepción
// para desatascar otra cosa, este documento —que lleva el nombre de un
// agricultor y lo que se observó en su campo— quedaría descargable sin sesión.

import { NextResponse } from "next/server";
import { sesionVigente } from "@/lib/tuniche/auth.actions";
import { informePorId } from "@/lib/tuniche/informes";
import { generarPdfInforme, nombrePdf } from "@/lib/tuniche/pdf-informe";
import { alcanceDe } from "@/lib/tuniche/session";
import type { ContenidoVisita } from "@/db/tuniche";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Bajar y volver a codificar varias fotos tarda más que servir una página.
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const s = await sesionVigente();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const informe = await informePorId(Number(id), alcanceDe(s));
  if (!informe) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (informe.tipo !== "visita") {
    return NextResponse.json(
      { error: "El informe mensual se imprime desde su propia pantalla." },
      { status: 400 },
    );
  }

  const contenido = informe.contenido as unknown as ContenidoVisita;
  const pdf = await generarPdfInforme({
    contenido,
    demo: informe.demo,
    generadoPor: informe.generadoPorNombre,
    aprobadoPor: informe.aprobadoPorNombre,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `inline` y no `attachment`: se abre en el navegador y desde ahí se
      // guarda si hace falta. Forzar la descarga obliga a abrir el archivo
      // desde el disco solo para mirarlo.
      "Content-Disposition": `inline; filename="${nombrePdf(contenido)}"`,
      "Cache-Control": "no-store",
    },
  });
}
