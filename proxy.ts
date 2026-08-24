// Proxy (lo que en Next ≤15 se llamaba middleware).
//
// Custodia el CRM y el motor de nurturing: el `matcher` lo limita a /crm, /leads
// y sus APIs, así que la web corporativa, TV Mix y las demos siguen sirviéndose
// sin pasar por acá.
//
// /leads usa la MISMA sesión que /crm —misma cookie, mismo login— porque es la
// misma gente operando dos partes del mismo sistema. Un segundo login sería una
// segunda contraseña que alguien apunta en un papel.
//
// Verifica el mismo HMAC-SHA256 que emite lib/crm/session.ts, pero con Web
// Crypto en vez de node:crypto para funcionar también en el runtime Edge. Esto
// es un control optimista: cada página y cada acción vuelve a pedir la sesión
// con `requireSession()`. El proxy evita el parpadeo, no reemplaza la
// autorización.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "adoops_crm_session";

// Rutas de /api/crm con autenticación propia: las llama un cron o WaSender, no
// un navegador con sesión.
const API_PUBLICA = [
  "/api/crm/whatsapp/webhook",
  "/api/crm/cron",
  // Los webhooks de respuestas entrantes los llama Unipile, no un navegador, y
  // el cron del motor lo llama Vercel con CRON_SECRET. Ninguno trae cookie.
  "/api/leads/webhook",
  "/api/leads/cron",
];

// El tipo lleva `<ArrayBuffer>` explícito: sin eso, TypeScript infiere
// ArrayBufferLike (que incluye SharedArrayBuffer) y crypto.subtle no lo acepta.
function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function utf8(s: string): Uint8Array<ArrayBuffer> {
  const src = new TextEncoder().encode(s);
  const bytes = new Uint8Array(new ArrayBuffer(src.length));
  bytes.set(src);
  return bytes;
}

async function tokenValido(token: string, secreto: string): Promise<boolean> {
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      utf8(secreto),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlToBytes(mac),
      utf8(body),
    );
    if (!ok) return false;

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(body)),
    ) as { exp?: number };
    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/crm/login") return NextResponse.next();
  if (API_PUBLICA.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const secreto = process.env.CRM_SESSION_SECRET;
  // Sin secreto no se puede validar nada: se cierra el paso en vez de dejar
  // entrar con un fallback conocido.
  if (!secreto || secreto.length < 32) {
    return new NextResponse("CRM_SESSION_SECRET no configurada", { status: 500 });
  }

  const token = request.cookies.get(COOKIE)?.value;
  if (!token || !(await tokenValido(token, secreto))) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const login = new URL("/crm/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crm/:path*", "/api/crm/:path*", "/leads/:path*", "/api/leads/:path*"],
};
