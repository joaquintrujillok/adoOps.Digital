// Descarga de la sábana en CSV.
//
// Es una ruta y no una acción de servidor porque el navegador tiene que recibir
// un archivo con su nombre y su tipo, y eso solo se consigue con una respuesta
// HTTP propia.
//
// **Comprueba la sesión por su cuenta.** El proxy ya cubre `/api/tuniche`, pero
// eso es un control optimista: si mañana alguien agrega esta ruta a `apiPublica`
// para desatascar otra cosa, la sábana entera de un área quedaría descargable
// sin sesión. La autorización se hace donde están los datos.

import { NextResponse } from "next/server";
import { esAreaValida, type AreaId } from "@/lib/tuniche/areas";
import { sesionVigente } from "@/lib/tuniche/auth.actions";
import { aCsv, columnasDe, filasDe } from "@/lib/tuniche/sabana";
import { alcanceDe } from "@/lib/tuniche/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await sesionVigente();
  if (!s) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const cruda = new URL(req.url).searchParams.get("area") ?? "";
  if (!esAreaValida(cruda)) {
    return NextResponse.json({ error: "Área inválida" }, { status: 400 });
  }
  const area = cruda as AreaId;

  const alcance = alcanceDe(s);
  // Un jefe o un zonal no descargan la otra área. Sin esta comprobación, la
  // pantalla les cerraría la puerta y la URL se la abriría.
  if (!alcance.todo && alcance.area !== area) {
    return NextResponse.json({ error: "Esa área no está en tu alcance" }, { status: 403 });
  }

  // Siempre la vista completa: quien baja el archivo lo hace para trabajarlo, y
  // un CSV al que le faltan los hitos obliga a volver a la pantalla.
  const columnas = columnasDe(area, "completa");
  const filas = await filasDe(area, alcance);
  const csv = aCsv(columnas, filas);

  const hoy = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sabana-${area}-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
