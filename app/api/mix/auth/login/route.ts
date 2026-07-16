import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  buildAuthUrl,
  oauthConfigured,
  requestOrigin,
} from "@/lib/mix-auth";
import { normalizeRoomCode } from "@/lib/mix-types";

export const runtime = "nodejs";

/** GET /api/mix/auth/login?room=XK42 — inicia el OAuth de Google/YouTube. */
export async function GET(req: Request) {
  if (!oauthConfigured()) {
    return NextResponse.json(
      { error: "OAuth no configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)" },
      { status: 503 },
    );
  }

  const origin = requestOrigin(req);
  const room = normalizeRoomCode(new URL(req.url).searchParams.get("room") ?? "");
  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ room, n: nonce })).toString("base64url");

  const res = NextResponse.redirect(buildAuthUrl(origin, state));
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
