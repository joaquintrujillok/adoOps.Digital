// Baja en un clic, para la cabecera `List-Unsubscribe` de los correos.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// Gmail y Yahoo exigen a los remitentes masivos una baja en un clic: el cliente
// de correo hace un POST a la URL de la cabecera `List-Unsubscribe` y espera que
// eso desuscriba, sin que la persona visite nada. Es RFC 8058.
//
// Hasta el 07-09-2026 esa cabecera apuntaba a `/cafecito-ia/baja/<token>`, que
// es una **página**. Un POST ahí devuelve 200 —Next la renderiza igual— pero no
// da de baja a nadie: `darDeBaja` solo corre desde el botón del cliente.
//
// Eso es peor que no declarar la cabecera. El proveedor ve un 200, da la baja
// por hecha y deja de ofrecer el botón; la persona cree que se fue y sigue
// recibiendo el boletín. Una baja que falla en silencio es exactamente lo que
// las reglas de Gmail existen para evitar, y lo que penaliza la entrega de todo
// lo que salga de este remitente.
//
// ── Por qué POST desuscribe y GET no ────────────────────────────────────────
//
// Misma razón que en `darDeBaja`: los escáneres de enlaces de los correos
// corporativos visitan cada URL del mensaje con GET. Si un GET diera de baja, un
// antivirus desuscribiría a quien solo abrió el correo. El GET acá redirige a la
// página con su botón, que es la ruta humana; el POST, que ningún escáner hace
// por su cuenta, ejecuta.

import { NextResponse } from "next/server";
import { darDeBaja } from "@/lib/cafecito/actions";
import { url as urlAbsoluta } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Contexto) {
  const { token } = await params;
  const r = await darDeBaja(token);

  // Se responde 200 incluso si el token no existe. La alternativa —404 para un
  // token desconocido— convertiría este endpoint en un oráculo para averiguar
  // qué direcciones están suscritas, y además provoca reintentos del proveedor
  // que no van a mejorar nada.
  return NextResponse.json({ ok: r.ok }, { status: 200 });
}

export async function GET(_req: Request, { params }: Contexto) {
  const { token } = await params;
  return NextResponse.redirect(urlAbsoluta(`/cafecito-ia/baja/${token}`), 302);
}
