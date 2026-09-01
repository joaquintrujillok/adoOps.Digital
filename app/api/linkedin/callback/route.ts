// LinkedIn vuelve acá con ?code&state.
//
// Canjea el código, resuelve de quién es la cuenta y deja el token —con su fecha
// de vencimiento— en la fila del emisor.
//
// ── Lo que se verifica antes de escribir nada ────────────────────────────────
//
// 1. Que haya sesión con permiso de publicar. La misma razón que en `conectar`:
//    esto deja guardada la capacidad de publicar como una persona.
// 2. Que el `nonce` del `state` coincida con el de la cookie. Sin eso, un
//    tercero podría inducir al navegador de un gerente a completar SU flujo y
//    dejar su propia cuenta conectada como emisor de H&CO.
//
// El token no se registra en ningún log ni vuelve al navegador. La única señal
// de éxito que ve la persona es la pantalla diciendo "conectado".

import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { getSession, puedePublicar } from "@/lib/dashboard360/session";
import { ESTADO_COOKIE, canjear, leerEstado } from "@/lib/contenido/linkedin";

export const runtime = "nodejs";

const PANTALLA = "/dashboard360/contenido/emisores";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const volver = (estado: string) =>
    NextResponse.redirect(`${origin}${PANTALLA}?li=${estado}`);

  const limpiar = (res: NextResponse) => {
    res.cookies.set(ESTADO_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  const sesion = await getSession();
  if (!sesion || !puedePublicar(sesion)) {
    return limpiar(volver("no-autorizado"));
  }

  // Si la persona canceló en la pantalla de permisos, LinkedIn vuelve con
  // ?error=user_cancelled_authorize. No es una falla del sistema.
  if (url.searchParams.get("error")) return limpiar(volver("cancelado"));

  const estado = leerEstado(url.searchParams.get("state"));
  const esperado = (await cookies()).get(ESTADO_COOKIE)?.value ?? null;
  const code = url.searchParams.get("code");

  if (!code || !estado || !esperado || estado.nonce !== esperado) {
    return limpiar(volver("estado-invalido"));
  }

  try {
    const a = await canjear(origin, code);

    // `nombre` solo se rellena si la fila venía vacía: si alguien ya le puso un
    // nombre a mano en la pantalla, el de LinkedIn no debe pisarlo.
    const r = await db.execute(sql`
      UPDATE contenido_emisores
         SET token = ${a.token},
             autor_urn = ${a.autorUrn},
             scopes = ${a.scopes},
             token_vence_en = ${a.venceEn.toISOString()},
             conectado_en = now(),
             nombre = COALESCE(NULLIF(nombre, ''), ${a.nombre})
       WHERE id = ${estado.emisorId}
      RETURNING id
    `);

    if (r.rows.length === 0) return limpiar(volver("emisor-inexistente"));
    return limpiar(volver("ok"));
  } catch {
    // El detalle no vuelve al navegador a propósito: los errores de canje traen
    // eco de parámetros de la petición, y ahí viaja el client_secret.
    return limpiar(volver("error"));
  }
}
