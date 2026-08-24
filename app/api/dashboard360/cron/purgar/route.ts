// Deja el tablero solo con datos reales, borrando lo sembrado.
//
// Existe porque un demo con datos inventados y un piloto con datos reales no
// pueden convivir en la misma pantalla sin que alguien lea una cifra falsa como
// verdadera. Cuando se conecta la primera fuente real, lo demás estorba.
//
// Conserva la fuente que se indique y borra el resto. **Borra siempre los leads
// y los informes**, sin importar qué fuente se conserve: los leads sembrados son
// personas inventadas que no se pueden atribuir a nadie, y los informes se
// redactaron sobre cifras que dejaron de existir.
//
// Autenticación: `Authorization: Bearer $D360_SETUP_SECRET`. Sin esa variable,
// 503.
//
// Es reversible: `scripts/d360-setup.mjs --limpiar` vuelve a dejar el demo
// completo.
//
//   curl -X POST "$URL/api/dashboard360/cron/purgar?conservar=google_ads" \
//     -H "Authorization: Bearer $SECRET"

import { NextResponse } from "next/server";
import { ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Informes, d360Leads, d360Metricas } from "@/db/dashboard360";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const secreto = process.env.D360_SETUP_SECRET;
  if (!secreto) {
    return NextResponse.json({ error: "D360_SETUP_SECRET no configurada" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const conservar = new URL(request.url).searchParams.get("conservar");
  if (!conservar) {
    return NextResponse.json(
      { error: "Falta el parámetro `conservar` con el slug de la fuente a mantener" },
      { status: 400 },
    );
  }

  try {
    const antes = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(d360Metricas);

    await db.delete(d360Metricas).where(ne(d360Metricas.fuenteSlug, conservar));
    await db.delete(d360Leads);
    await db.delete(d360Informes);
    await db.delete(d360Fuentes).where(ne(d360Fuentes.slug, conservar));

    const [despues] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(d360Metricas);

    return NextResponse.json({
      ok: true,
      conservada: conservar,
      metricasAntes: antes[0]?.n ?? 0,
      metricasDespues: despues?.n ?? 0,
      leadsBorrados: true,
      informesBorrados: true,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
