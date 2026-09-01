// Arranca el OAuth de LinkedIn para un emisor concreto.
//
// ── Por qué esto exige sesión y permiso de publicación ───────────────────────
//
// Conectar un emisor no es leer nada: deja guardado un token que permite
// publicar en nombre de una persona real. Sin este control, cualquiera que
// conociera la URL podría apuntar la fila de un emisor a **su** cuenta y hacer
// que el sistema publique desde ahí.
//
// Se reusa `puedePublicar` —gerencia y admin— por la razón que ese helper ya
// declara: es una acción con destinatario externo. Es el mismo criterio con que
// se reserva publicar un informe al directorio.

import { NextResponse } from "next/server";
import { getSession, puedePublicar } from "@/lib/dashboard360/session";
import {
  ESTADO_COOKIE,
  armarEstado,
  configurado,
  nuevoNonce,
  urlAutorizacion,
} from "@/lib/contenido/linkedin";

export const runtime = "nodejs";

/** GET /api/linkedin/conectar?emisor=3 */
export async function GET(req: Request) {
  const sesion = await getSession();
  if (!sesion || !puedePublicar(sesion)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!configurado()) {
    return NextResponse.json(
      { error: "Falta LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const emisorId = Number(url.searchParams.get("emisor"));
  if (!Number.isInteger(emisorId) || emisorId <= 0) {
    return NextResponse.json({ error: "Falta ?emisor=<id>" }, { status: 400 });
  }

  // El origin sale de la request y no de una variable: en local es
  // http://localhost:3001 y en producción el dominio real, y la `redirect_uri`
  // del canje tiene que ser byte por byte la misma que la de esta autorización.
  const origin = url.origin;
  const nonce = nuevoNonce();

  const res = NextResponse.redirect(urlAutorizacion(origin, armarEstado(emisorId, nonce)));
  res.cookies.set(ESTADO_COOKIE, nonce, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/",
    // Diez minutos: el código de autorización de LinkedIn vive 30, pero si
    // alguien deja la pantalla de permisos abierta media hora, es mejor que
    // vuelva a empezar que arrastrar un nonce viejo.
    maxAge: 600,
  });
  return res;
}
