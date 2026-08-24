// Proxy (lo que en Next ≤15 se llamaba middleware).
//
// Custodia las áreas con sesión: el CRM (/crm), Dashboard360 (/dashboard360) y
// el motor de nurturing (/leads).
// El `matcher` lo limita a esas rutas, así que la web corporativa, TV Mix y las
// demás demos siguen sirviéndose sin pasar por acá.
//
// Verifica el mismo HMAC-SHA256 que emiten lib/crm/session.ts y
// lib/dashboard360/session.ts, pero con Web Crypto en vez de node:crypto para
// funcionar también en el runtime Edge. Esto es un control optimista: cada
// página y cada acción vuelve a pedir la sesión con `requireSession()`. El
// proxy evita el parpadeo, no reemplaza la autorización.
//
// Cada área trae su cookie y su secreto. Son productos que se venden por
// separado: una sesión del CRM no debe abrir el tablero, ni al revés.
//
// /leads es la excepción deliberada: comparte cookie y secreto con /crm porque
// no es otro producto, es la misma gente operando dos partes del mismo sistema.
// Un segundo login sería una segunda contraseña que alguien apunta en un papel.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface Area {
  /** Prefijos de ruta que esta área protege. */
  prefijos: string[];
  cookie: string;
  /** Nombre de la variable de entorno con el secreto de firma. */
  env: string;
  login: string;
  /**
   * Rutas de API con autenticación propia: las llama un cron o un webhook, no
   * un navegador con sesión.
   */
  apiPublica: string[];
}

const AREAS: Area[] = [
  {
    prefijos: ["/crm", "/api/crm"],
    cookie: "adoops_crm_session",
    env: "CRM_SESSION_SECRET",
    login: "/crm/login",
    apiPublica: ["/api/crm/whatsapp/webhook", "/api/crm/cron"],
  },
  {
    prefijos: ["/dashboard360", "/api/dashboard360"],
    cookie: "adoops_d360_session",
    env: "D360_SESSION_SECRET",
    login: "/dashboard360/login",
    // El endpoint que dispara la sincronía de Airbyte se autentica con
    // CRON_SECRET, igual que las alertas del CRM.
    apiPublica: ["/api/dashboard360/cron"],
  },
  {
    prefijos: ["/leads", "/api/leads"],
    cookie: "adoops_crm_session",
    env: "CRM_SESSION_SECRET",
    login: "/crm/login",
    // Los webhooks de respuestas entrantes los llama Unipile y el cron del
    // motor lo llama Vercel con CRON_SECRET. Ninguno de los dos trae cookie.
    apiPublica: ["/api/leads/webhook", "/api/leads/cron"],
  },
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

  const area = AREAS.find((a) => a.prefijos.some((p) => pathname.startsWith(p)));
  // El matcher no debería dejar pasar nada fuera de las áreas, pero si se
  // desincroniza es preferible seguir de largo que romper la ruta.
  if (!area) return NextResponse.next();

  if (pathname === area.login) return NextResponse.next();
  if (area.apiPublica.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const secreto = process.env[area.env];
  // Sin secreto no se puede validar nada: se cierra el paso en vez de dejar
  // entrar con un fallback conocido.
  if (!secreto || secreto.length < 32) {
    return new NextResponse(`${area.env} no configurada`, { status: 500 });
  }

  const token = request.cookies.get(area.cookie)?.value;
  if (!token || !(await tokenValido(token, secreto))) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const login = new URL(area.login, request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/crm/:path*",
    "/api/crm/:path*",
    "/dashboard360/:path*",
    "/api/dashboard360/:path*",
    "/leads/:path*",
    "/api/leads/:path*",
  ],
};
