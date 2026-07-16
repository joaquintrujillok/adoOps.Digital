import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { YT_COOKIE, cookieOptions, getAccess, oauthConfigured, requestOrigin } from "@/lib/mix-auth";
import { isQuotaOrAuthError, searchVideos } from "@/lib/mix-youtube";

export const runtime = "nodejs";

/**
 * GET /api/mix/search?q=… — búsqueda visual de videos.
 * Usa la cuenta conectada del usuario si existe; si no, la YOUTUBE_API_KEY.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (!q) return NextResponse.json({ error: "falta q" }, { status: 400 });

  const origin = requestOrigin(req);
  const cookieStore = await cookies();
  const access = oauthConfigured()
    ? await getAccess(cookieStore.get(YT_COOKIE)?.value)
    : { token: null };
  const apiKey = process.env.YOUTUBE_API_KEY ?? null;

  if (!access.token && !apiKey) {
    return NextResponse.json(
      { error: "Búsqueda no disponible: conecta tu YouTube o configura YOUTUBE_API_KEY" },
      { status: 503 },
    );
  }

  try {
    const items = await searchVideos({ accessToken: access.token, apiKey }, q);
    const res = NextResponse.json({ items });
    if (access.reseal) res.cookies.set(YT_COOKIE, access.reseal, cookieOptions(origin));
    return res;
  } catch (error) {
    const status = isQuotaOrAuthError(error);
    return NextResponse.json(
      { error: status === 403 ? "cuota de la YouTube API agotada por hoy" : "falló la búsqueda" },
      { status: 502 },
    );
  }
}
