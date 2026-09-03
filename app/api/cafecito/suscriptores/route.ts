// Los suscriptores confirmados de una taza, para el proceso que envía el boletín.
//
// El envío corre fuera de Vercel (api.brevo.com está fuera de la lista de egreso
// del entorno donde se redacta), así que la lista se consulta por API con el
// mismo token compartido que publica las ediciones.
//
//   GET /api/cafecito/suscriptores?taza=expreso_directivo
//   Authorization: Bearer $CAFECITO_TOKEN
//
// Devuelve solo `confirmado` y sin baja: la consulta es la garantía de que nunca
// se le escribe a alguien que no completó el doble opt-in. Que esa regla viva
// acá y no en el que envía es deliberado — un cliente puede olvidarla, la fuente
// de la lista no.
//
// `tokenBaja` viaja con cada fila porque el pie de cada correo necesita un
// enlace distinto por persona.

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoSuscriptores, TAZAS, type CafecitoTaza } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = process.env.CAFECITO_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "CAFECITO_TOKEN no configurado" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const taza = new URL(req.url).searchParams.get("taza") as CafecitoTaza | null;
  if (!taza || !(taza in TAZAS)) {
    return NextResponse.json(
      { error: `taza debe ser uno de: ${Object.keys(TAZAS).join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const filas = await db
      .select({
        email: cafecitoSuscriptores.email,
        nombre: cafecitoSuscriptores.nombre,
        tokenBaja: cafecitoSuscriptores.tokenBaja,
        taza: cafecitoSuscriptores.taza,
      })
      .from(cafecitoSuscriptores)
      .where(
        and(
          eq(cafecitoSuscriptores.estado, "confirmado"),
          isNull(cafecitoSuscriptores.bajaEn),
        ),
      );

    // Quien confirmó pero no eligió taza recibe el expreso directivo: se prefiere
    // mandarle algo antes que dejarlo en el limbo tras haber dicho que sí.
    const suscriptores = filas
      .filter((f) => (f.taza ?? "expreso_directivo") === taza)
      .map(({ email, nombre, tokenBaja }) => ({ email, nombre, tokenBaja }));

    return NextResponse.json({ taza, total: suscriptores.length, suscriptores });
  } catch (err) {
    console.error("suscriptores cafecito error:", err);
    return NextResponse.json({ error: "error al consultar" }, { status: 500 });
  }
}
