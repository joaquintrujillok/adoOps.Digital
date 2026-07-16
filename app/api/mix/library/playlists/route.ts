import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { YT_COOKIE, cookieOptions, getAccess, oauthConfigured, requestOrigin } from "@/lib/mix-auth";
import { isQuotaOrAuthError, listMyPlaylists } from "@/lib/mix-youtube";

export const runtime = "nodejs";

/** GET /api/mix/library/playlists — playlists del usuario conectado. */
export async function GET(req: Request) {
  if (!oauthConfigured()) {
    return NextResponse.json({ error: "OAuth no configurado" }, { status: 503 });
  }
  const origin = requestOrigin(req);
  const cookieStore = await cookies();
  const access = await getAccess(cookieStore.get(YT_COOKIE)?.value);
  if (!access.token) {
    return NextResponse.json({ error: "no conectado" }, { status: 401 });
  }

  try {
    const playlists = await listMyPlaylists(access.token);
    const res = NextResponse.json({ playlists });
    if (access.reseal) res.cookies.set(YT_COOKIE, access.reseal, cookieOptions(origin));
    return res;
  } catch (error) {
    const status = isQuotaOrAuthError(error);
    return NextResponse.json(
      {
        error:
          status === 403
            ? "cuota de la YouTube API agotada por hoy"
            : "no se pudieron listar tus playlists",
      },
      { status: 502 },
    );
  }
}
