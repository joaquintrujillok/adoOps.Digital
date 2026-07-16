import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  YT_COOKIE,
  cookieOptions,
  getAccess,
  oauthConfigured,
  requestOrigin,
} from "@/lib/mix-auth";
import { searchConfigured } from "@/lib/mix-youtube";

export const runtime = "nodejs";

/** GET /api/mix/auth/status — qué hay disponible para este navegador. */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const cookieStore = await cookies();
  const access = oauthConfigured()
    ? await getAccess(cookieStore.get(YT_COOKIE)?.value)
    : { token: null };

  const res = NextResponse.json({
    oauthConfigured: oauthConfigured(),
    connected: !!access.token,
    searchAvailable: !!access.token || searchConfigured(),
  });
  if (access.reseal) res.cookies.set(YT_COOKIE, access.reseal, cookieOptions(origin));
  else if (access.invalid) res.cookies.set(YT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
