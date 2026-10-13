// API pública de Pulso IA. La llaman el celular de quien responde y la pantalla
// proyectada; ninguna de las dos tiene sesión.
//
// GET  el estado agregado de la sala (sin nombres ni contactos). Con ?t=TOKEN
//      agrega lo que esa persona ya respondió, para retomar si recarga.
// POST { accion: "inicio" | "cierre" | "contacto", token, ... }

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pulsoRespuestas } from "@/db/pulso";
import {
  estadoSala,
  guardarCierre,
  guardarContacto,
  guardarInicio,
  miRespuesta,
  sesionPorCodigo,
  tokenValido,
} from "@/lib/pulso/datos";
import { enviarResultado } from "@/lib/pulso/email";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ codigo: string }> };

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET(req: Request, { params }: Ctx) {
  const { codigo } = await params;
  const sala = await estadoSala(codigo);
  if (!sala) return NextResponse.json({ error: "No existe esa sesión." }, { status: 404 });

  const t = new URL(req.url).searchParams.get("t");
  let yo = null;
  if (tokenValido(t)) {
    const s = await sesionPorCodigo(codigo);
    if (s) yo = await miRespuesta(s.id, t);
  }
  return NextResponse.json({ sala, yo }, { headers: SIN_CACHE });
}

export async function POST(req: Request, { params }: Ctx) {
  const { codigo } = await params;
  const sesion = await sesionPorCodigo(codigo);
  if (!sesion) return NextResponse.json({ error: "No existe esa sesión." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const token = body.token;
  if (!tokenValido(token)) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  if (body.accion === "inicio") {
    const r = await guardarInicio(sesion, token, body as never);
    return r.ok
      ? NextResponse.json(r.valor, { headers: SIN_CACHE })
      : NextResponse.json({ error: r.error }, { status: 400 });
  }

  if (body.accion === "cierre") {
    const r = await guardarCierre(sesion, token, body as never);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }

  if (body.accion === "contacto") {
    const r = await guardarContacto(sesion, token, body as never);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

    let enviado = false;
    if (r.valor.email) {
      try {
        const sala = await estadoSala(sesion.codigo);
        if (sala) {
          enviado = await enviarResultado({
            email: r.valor.email,
            nombre: r.valor.nombre,
            cuadrante: r.valor.cuadrante,
            sala,
          });
          if (enviado) {
            await db
              .update(pulsoRespuestas)
              .set({ resultadoEnviadoEn: new Date() })
              .where(eq(pulsoRespuestas.id, r.valor.id));
          }
        }
      } catch (e) {
        console.error("[pulso] no salió el correo de resultado:", e);
      }
    }
    return NextResponse.json({ ok: true, enviado });
  }

  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
