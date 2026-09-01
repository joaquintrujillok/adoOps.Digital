// Proxy (lo que en Next ≤15 se llamaba middleware).
//
// Custodia las áreas con sesión: el CRM (/crm), Dashboard360 (/dashboard360),
// el motor de nurturing (/dashboard360/motor, más los redirects de /leads) y la
// consola de TorreControl (/torrecontrol/consola). El `matcher` lo limita a esas
// rutas, así que la web corporativa, TV Mix, los tableros de TorreControl y las
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
// El Sistema Tuniche (/tuniche) es el caso más estricto: no es un producto de
// adoOps sino el sistema interno de un cliente, alojado en esta infraestructura.
// Ninguna sesión de adoOps lo abre.
//
// El motor de nurturing es la excepción deliberada: **acepta cualquiera de las
// dos sesiones**. No es otro producto, es la misma gente operando dos partes del
// mismo sistema, y un segundo login sería una segunda contraseña que alguien
// apunta en un papel. Su pantalla vive dentro del tablero (/dashboard360/motor)
// para que el flujo completo se vea en una consola, pero quien entra por /crm no
// pierde el acceso.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolverCuenta, tieneModulo } from "@/lib/cuentas";
import { moduloDeRuta, rutaInicialDe } from "@/lib/dashboard360/nav";

interface Credencial {
  cookie: string;
  /** Nombre de la variable de entorno con el secreto de firma. */
  env: string;
}

interface Area {
  /** Prefijos de ruta que esta área protege. */
  prefijos: string[];
  /**
   * Cualquiera de estas abre el área. Casi todas tienen una sola: dos
   * credenciales solo se justifican cuando la misma gente llega desde dos
   * productos, que es el caso del motor.
   */
  credenciales: Credencial[];
  login: string;
  /**
   * Rutas de API con autenticación propia: las llama un cron o un webhook, no
   * un navegador con sesión.
   */
  apiPublica: string[];
}

const CRM: Credencial = { cookie: "adoops_crm_session", env: "CRM_SESSION_SECRET" };
const D360: Credencial = { cookie: "adoops_d360_session", env: "D360_SESSION_SECRET" };
// El Sistema Tuniche no es un producto de adoOps: es el sistema interno de otra
// empresa, alojado acá. Cookie y secreto propios, sin excepción de doble
// credencial: una sesión de adoOps no abre nada de Tuniche.
const TUNICHE: Credencial = { cookie: "tuniche_session", env: "TUNICHE_SESSION_SECRET" };

// El orden importa: `find` toma la PRIMERA que calce, y /dashboard360/motor
// también empieza por /dashboard360. La zona del motor va antes o quedaría
// tapada por la del tablero y perdería la doble credencial.
const AREAS: Area[] = [
  {
    prefijos: ["/dashboard360/motor", "/leads", "/api/leads"],
    credenciales: [D360, CRM],
    login: "/dashboard360/login",
    // Los webhooks de respuestas entrantes los llama Unipile; el cron del motor
    // y el setup los llama Vercel con su propio secreto. Ninguno trae cookie.
    apiPublica: ["/api/leads/webhook", "/api/leads/cron"],
  },
  {
    prefijos: ["/crm", "/api/crm"],
    credenciales: [CRM],
    login: "/crm/login",
    apiPublica: ["/api/crm/whatsapp/webhook", "/api/crm/cron"],
  },
  // TorreControl es un demo y sus tres tableros se abren sin sesión: es lo que
  // se muestra en una reunión. La consola no, porque no muestra nada: decide a
  // qué tablero entran los mensajes de WhatsApp. Hasta ahora vivía en /admin,
  // fuera de este matcher y sin pedir sesión en la página — cualquiera con la
  // URL redirigía la tubería entera.
  //
  // Usa la credencial del tablero en vez de una propia. Es la misma gente, y una
  // cuarta contraseña sería una cuarta contraseña anotada en un papel.
  {
    prefijos: ["/torrecontrol/consola"],
    credenciales: [D360],
    login: "/dashboard360/login",
    apiPublica: [],
  },
  {
    prefijos: ["/tuniche", "/api/tuniche"],
    credenciales: [TUNICHE],
    login: "/tuniche/login",
    // Vacía, y conviene decir por qué: **Tuniche no tiene webhook propio**. Su
    // entrada de WhatsApp es `/api/whatsapp/webhook`, el mismo que alimenta las
    // demos de TorreControl, que vive fuera de este matcher y se autentica con
    // la firma de WaSender. Ahí dentro el discriminador es el número de quien
    // escribe: si está en `tuniche_usuarios`, el mensaje es de Tuniche.
    //
    // Acá había declarada una excepción para `/api/tuniche/whatsapp`, una ruta
    // que nunca existió. Una excepción de seguridad que apunta a la nada no hace
    // daño hoy, pero le enseña al siguiente lector un mapa que no es el real.
    apiPublica: [],
  },
  {
    prefijos: ["/dashboard360", "/api/dashboard360"],
    credenciales: [D360],
    login: "/dashboard360/login",
    // El endpoint que dispara la sincronía de Airbyte se autentica con
    // CRON_SECRET, igual que las alertas del CRM.
    apiPublica: ["/api/dashboard360/cron"],
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

/**
 * El contenido de un token válido, o `null`.
 *
 * Antes esto devolvía solo un booleano. Ahora hace falta el payload: la cuenta
 * activa viaja adentro de la sesión y decide a qué secciones se puede entrar.
 */
async function leerToken(
  token: string,
  secreto: string,
): Promise<{ exp?: number; cuenta?: string; cuentas?: string[] } | null> {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;

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
    if (!ok) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(body)),
    ) as { exp?: number; cuenta?: string; cuentas?: string[] };
    if (typeof payload.exp !== "number" || Date.now() >= payload.exp) return null;
    return payload;
  } catch {
    return null;
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

  // Una credencial sin secreto no se puede validar: se descarta esa vía en vez
  // de dejar entrar con un fallback conocido. Si NINGUNA es configurable, se
  // cierra el paso entero.
  const utilizables = area.credenciales.filter((c) => {
    const s = process.env[c.env];
    return Boolean(s) && s!.length >= 32;
  });
  if (utilizables.length === 0) {
    // El mensaje decía `${faltan} configurada`, que con una sola credencial —el
    // caso de todas las áreas salvo el motor— se lee como lo contrario de lo que
    // pasa: "TUNICHE_SESSION_SECRET configurada" cuando justamente NO lo está.
    const faltan = area.credenciales.map((c) => c.env).join(" o ");
    return new NextResponse(`Falta configurar ${faltan}`, { status: 500 });
  }

  let autorizado = false;
  let sesion: { cuenta?: string; cuentas?: string[] } | null = null;
  for (const c of utilizables) {
    const t = request.cookies.get(c.cookie)?.value;
    const payload = t ? await leerToken(t, process.env[c.env]!) : null;
    if (payload) {
      autorizado = true;
      sesion = payload;
      break;
    }
  }

  if (!autorizado) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const login = new URL(area.login, request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  // ── Secciones que la cuenta activa no tiene ────────────────────────────────
  //
  // El menú ya no las pinta, pero esconder un enlace no impide llegar por URL —y
  // ni siquiera impedía llegar por redirección: cambiar de cuenta mandaba a
  // `/dashboard360` y dejaba a quien entraba a Soho parado sobre el Panel 360.
  // Un filtro que solo esconde el enlace es decoración.
  //
  // Va acá y no en cada página por lo mismo que va acá la sesión: es una regla
  // que vale para todas las rutas del tablero, y repartida por diez archivos
  // basta que alguien agregue el once para que se rompa. Sigue siendo un control
  // optimista, igual que el resto de este proxy: las cuentas declaran intención,
  // no aíslan datos. Ver la cabecera de `lib/cuentas.ts`.
  if (pathname.startsWith("/dashboard360") && !pathname.startsWith("/api")) {
    const modulo = moduloDeRuta(pathname);
    if (modulo) {
      const cuenta = resolverCuenta(sesion?.cuenta, sesion?.cuentas);
      if (!tieneModulo(cuenta, modulo)) {
        const inicio = rutaInicialDe(cuenta);
        // Comparación EXACTA, no por prefijo. Con `startsWith` esto se rompía en
        // silencio: la ruta de aterrizaje de adoOps es `/dashboard360`, y toda
        // ruta del tablero empieza con `/dashboard360`, así que la guarda
        // anti-bucle suprimía todas las redirecciones de esa cuenta. Se vio
        // probando: adoOps abría `/dashboard360/informe`, que no tiene.
        //
        // Sin `startsWith` no hay bucle posible: `inicio` sale de las secciones
        // que la cuenta sí tiene, así que nunca es una ruta que esta misma
        // condición vuelva a rechazar.
        if (pathname !== inicio) {
          return NextResponse.redirect(new URL(inicio, request.url));
        }
      }
    }
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
    // Solo la consola. Los tableros de TorreControl son parte del demo y se
    // abren por link, sin sesión.
    "/torrecontrol/consola/:path*",
    // Sistema Tuniche: todo bajo sesión. No hay pantalla pública.
    "/tuniche/:path*",
    "/api/tuniche/:path*",
  ],
};
