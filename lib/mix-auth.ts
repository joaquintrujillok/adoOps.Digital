/**
 * TV Mix — OAuth de Google/YouTube para la biblioteca personal.
 *
 * Los tokens del usuario viven SOLO en su navegador, dentro de una cookie
 * httpOnly sellada con AES-256-GCM (no se guardan en la base de datos).
 *
 * Variables: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (OAuth) y opcionalmente
 * MIX_AUTH_SECRET para sellar la cookie (si falta se deriva del client secret).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const YT_COOKIE = "mix_yt";
export const OAUTH_STATE_COOKIE = "mix_yt_state";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export type YtTokens = {
  /** access token */
  at: string;
  /** refresh token (puede faltar si Google no lo reemitió) */
  rt?: string;
  /** expiración del access token, epoch ms */
  exp: number;
};

export function oauthConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

function sealKey(): Buffer {
  const secret = process.env.MIX_AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) throw new Error("MIX_AUTH_SECRET o GOOGLE_CLIENT_SECRET requerido");
  return createHash("sha256").update(secret).digest();
}

/** Sella un payload JSON en base64url (iv + tag + ciphertext). */
export function seal(payload: YtTokens): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sealKey(), iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

export function open(sealed: string): YtTokens | null {
  try {
    const raw = Buffer.from(sealed, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", sealKey(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(json) as YtTokens;
  } catch {
    return null;
  }
}

/** Origen público del request (respeta el proxy de Vercel). */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function redirectUri(origin: string): string {
  return `${origin}/api/mix/auth/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // fuerza refresh_token también en reconexiones
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
};

export async function exchangeCode(origin: string, code: string): Promise<YtTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(origin),
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`intercambio de código falló: ${data.error ?? res.status}`);
  }
  return {
    at: data.access_token,
    rt: data.refresh_token,
    exp: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export async function refreshTokens(refreshToken: string): Promise<YtTokens | null> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) return null; // revocado o inválido
  return {
    at: data.access_token,
    rt: refreshToken,
    exp: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

export type AccessResult = {
  /** access token vigente, o null si no hay sesión */
  token: string | null;
  /** nueva cookie sellada si hubo refresh (hay que re-emitirla) */
  reseal?: string;
  /** true si la sesión existía pero quedó inválida (hay que borrar la cookie) */
  invalid?: boolean;
};

/** Devuelve un access token vigente a partir de la cookie, refrescando si expiró. */
export async function getAccess(cookieValue: string | undefined): Promise<AccessResult> {
  if (!cookieValue) return { token: null };
  const tokens = open(cookieValue);
  if (!tokens) return { token: null, invalid: true };

  if (tokens.exp - 60_000 > Date.now()) return { token: tokens.at };

  if (!tokens.rt) return { token: null, invalid: true };
  const refreshed = await refreshTokens(tokens.rt);
  if (!refreshed) return { token: null, invalid: true };
  return { token: refreshed.at, reseal: seal(refreshed) };
}

export function cookieOptions(origin: string) {
  return {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 días
  };
}
