// ═════════════════════════════════════════════════════════════════════════════
//  PUNTO ÚNICO DE SALIDA HACIA LINKEDIN
//
//  Este es el ÚNICO módulo de la máquina de contenido autorizado a hablar con
//  la API de LinkedIn. Es la misma invariante que `lib/leads/despacho.ts`, por
//  la misma razón: hace auditable con un comando qué sale y desde dónde.
//
//    grep -rn "api.linkedin.com" lib app --include=*.ts | grep -v node_modules
//
//  Debe devolver solo este archivo. (`scripts/linkedin-probar.mjs` pega a la API
//  a propósito y no cuenta: es una herramienta de diagnóstico que se corre a
//  mano, no código que se despliega.)
// ═════════════════════════════════════════════════════════════════════════════
//
// ── Lo verificado el 25-08-2026, contra la API real ──────────────────────────
//
// Todo lo de abajo se probó de punta a punta con una app real: los dos productos
// autoservicio alcanzan para publicar como persona. Ver
// `docs/verificacion-share-on-linkedin.md` para el detalle y las fuentes.

import { randomBytes } from "node:crypto";

/**
 * El header de versión caduca. La 202508 se apagó el 17-08-2026 y el ciclo es de
 * unos doce meses. Cuando esta deje de servir, el síntoma NO menciona la
 * versión: llega un 400 o un 426 que parece un problema del cuerpo.
 *
 * Se deja override por entorno para poder subirla sin desplegar el día que pase.
 */
export const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202608";

/**
 * Los tres scopes que necesitamos y ni uno más. `email` se omite a propósito:
 * la doc de LinkedIn recomienda pedir el mínimo, y no tenemos uso para el correo.
 *
 * Ojo: si esta lista cambia, **todos los emisores tienen que reautorizar**. La
 * doc lo dice explícito — pedir un scope distinto invalida los tokens anteriores.
 */
export const SCOPES = ["openid", "profile", "w_member_social"] as const;

export const ESTADO_COOKIE = "li_oauth_state";

export function configurado(): boolean {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

/**
 * La URL de retorno tiene que coincidir **exacta** con una de las registradas en
 * la pestaña Auth de la app. LinkedIn exige HTTPS y URL absoluta, ignora los
 * parámetros y rechaza el `#`.
 *
 * Con `www`, por lo mismo que ya está anotado para Google en `env.example`: el
 * apex redirige a www y LinkedIn compara el string, no el destino final. El
 * error que produce equivocarse —`redirect_uri doesn't match`— es de los pocos
 * que dice exactamente qué pasa.
 */
export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/linkedin/callback`;
}

export function nuevoNonce(): string {
  return randomBytes(16).toString("hex");
}

/** El `state` viaja por LinkedIn: lleva a qué emisor volver y el nonce a cotejar. */
export function armarEstado(emisorId: number, nonce: string): string {
  return Buffer.from(JSON.stringify({ e: emisorId, n: nonce })).toString("base64url");
}

export function leerEstado(raw: string | null): { emisorId: number; nonce: string } | null {
  try {
    const p = JSON.parse(Buffer.from(raw ?? "", "base64url").toString("utf8")) as {
      e?: number;
      n?: string;
    };
    if (typeof p.e !== "number" || !p.n) return null;
    return { emisorId: p.e, nonce: p.n };
  } catch {
    return null;
  }
}

export function urlAutorizacion(origin: string, estado: string): string {
  return (
    "https://www.linkedin.com/oauth/v2/authorization?" +
    new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri(origin),
      state: estado,
      scope: SCOPES.join(" "),
    })
  );
}

export interface Autorizacion {
  token: string;
  /** Instante en que deja de servir. LinkedIn los emite a 60 días. */
  venceEn: Date;
  scopes: string;
  /** `urn:li:person:{sub}` — el autor que va en cada publicación. */
  autorUrn: string;
  nombre: string;
}

/**
 * Canjea el código por un token y resuelve de quién es.
 *
 * Son dos llamadas y no una porque LinkedIn no dice en el token a qué miembro
 * pertenece: hay que preguntárselo a `/v2/userinfo`, cuyo campo `sub` es el id
 * con el que se arma el `urn:li:person:`. Es la única vía de autoservicio —
 * `/v2/me` exige permisos que no tenemos.
 *
 * **Nada de acá se registra en logs.** El token que devuelve permite publicar en
 * nombre de una persona real.
 */
export async function canjear(origin: string, code: string): Promise<Autorizacion> {
  const r = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
    }),
  });

  if (!r.ok) throw new Error(`accessToken devolvió ${r.status}`);
  const datos = (await r.json()) as { access_token?: string; expires_in?: number; scope?: string };
  if (!datos.access_token) throw new Error("accessToken no devolvió access_token");

  const info = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { authorization: `Bearer ${datos.access_token}` },
  });
  if (!info.ok) throw new Error(`userinfo devolvió ${info.status}`);
  const perfil = (await info.json()) as { sub?: string; name?: string };
  if (!perfil.sub) throw new Error("userinfo no devolvió sub");

  // Si LinkedIn no manda `expires_in` se asumen 60 días, que es lo documentado.
  // Asumir de más sería peor: haría que la pantalla diga "al día" sobre un token
  // que ya venció, que es exactamente el fallo que esta columna existe para evitar.
  const segundos = datos.expires_in ?? 60 * 24 * 3600;

  return {
    token: datos.access_token,
    venceEn: new Date(Date.now() + segundos * 1000),
    scopes: datos.scope ?? SCOPES.join(" "),
    autorUrn: `urn:li:person:${perfil.sub}`,
    nombre: perfil.name ?? "",
  };
}
