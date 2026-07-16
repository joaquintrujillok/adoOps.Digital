import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  OAUTH_STATE_COOKIE,
  YT_COOKIE,
  cookieOptions,
  exchangeCode,
  requestOrigin,
  seal,
} from "@/lib/mix-auth";
import { normalizeRoomCode } from "@/lib/mix-types";

export const runtime = "nodejs";

/** GET /api/mix/auth/callback — Google vuelve aquí con ?code&state. */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const url = new URL(req.url);

  // Sala de vuelta desde el state (best effort).
  let room: string | null = null;
  let stateNonce: string | null = null;
  try {
    const parsed = JSON.parse(
      Buffer.from(url.searchParams.get("state") ?? "", "base64url").toString("utf8"),
    ) as { room?: string; n?: string };
    room = normalizeRoomCode(parsed.room ?? "");
    stateNonce = parsed.n ?? null;
  } catch {
    // state ilegible → error abajo
  }
  const target = (ok: boolean) =>
    `${origin}${room ? `/mix/${room}` : "/mix"}?yt=${ok ? "ok" : "error"}`;

  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
  const code = url.searchParams.get("code");

  const fail = () => {
    const res = NextResponse.redirect(target(false));
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  if (
    url.searchParams.get("error") ||
    !code ||
    !stateNonce ||
    !expectedNonce ||
    stateNonce !== expectedNonce
  ) {
    return fail();
  }

  try {
    const tokens = await exchangeCode(origin, code);
    const res = NextResponse.redirect(target(true));
    res.cookies.set(YT_COOKIE, seal(tokens), cookieOptions(origin));
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return fail();
  }
}
