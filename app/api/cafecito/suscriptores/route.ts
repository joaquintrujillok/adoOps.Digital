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
//
// `tazaPorDefecto` marca a quien no eligió. El fallback existe —es mejor mandar
// algo que dejar en el limbo a alguien que ya dijo que sí— pero antes era
// invisible: una fila sin taza salía indistinguible de una que eligió expreso
// directivo. Cuando el 04-09-2026 alguien reportó "elegí flat white y me llegó
// el directivo", no había forma de saber, mirando la respuesta, si había elegido
// o si el default se lo había puesto encima. Ahora la respuesta lo dice y el
// despachador lo registra.

import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoSuscriptores, TAZAS, type CafecitoTaza } from "@/db/schema";

/** A quién se le sirve cuando confirmó pero no eligió. */
const TAZA_POR_DEFECTO: CafecitoTaza = "expreso_directivo";

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
      .filter((f) => (f.taza ?? TAZA_POR_DEFECTO) === taza)
      .map(({ email, nombre, tokenBaja, taza: elegida }) => ({
        email,
        nombre,
        tokenBaja,
        // Solo aparece cuando es verdad, para que saltar a la vista en el log
        // sea el caso raro y no el ruido de fondo.
        ...(elegida ? {} : { tazaPorDefecto: true as const }),
      }));

    const porDefecto = suscriptores.filter((x) => "tazaPorDefecto" in x).length;

    return NextResponse.json({
      taza,
      total: suscriptores.length,
      porDefecto,
      suscriptores,
    });
  } catch (err) {
    console.error("suscriptores cafecito error:", err);
    return NextResponse.json({ error: "error al consultar" }, { status: 500 });
  }
}
