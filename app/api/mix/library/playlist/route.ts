import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { YT_COOKIE, cookieOptions, getAccess, oauthConfigured, requestOrigin } from "@/lib/mix-auth";
import {
  LIKES_PLAYLIST_ID,
  isQuotaOrAuthError,
  listLikedVideos,
  listPlaylistItems,
} from "@/lib/mix-youtube";

export const runtime = "nodejs";

/**
 * GET /api/mix/library/playlist?id=…&page=… — videos de una playlist.
 * `id=__likes__` devuelve los "Me gusta" del usuario conectado.
 * Playlists públicas funcionan también sin cuenta si hay YOUTUBE_API_KEY.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const page = url.searchParams.get("page") ?? undefined;
  if (!id) return NextResponse.json({ error: "falta id" }, { status: 400 });

  const origin = requestOrigin(req);
  const cookieStore = await cookies();
  const access = oauthConfigured()
    ? await getAccess(cookieStore.get(YT_COOKIE)?.value)
    : { token: null };
  const apiKey = process.env.YOUTUBE_API_KEY ?? null;

  try {
    let result;
    if (id === LIKES_PLAYLIST_ID) {
      if (!access.token) {
        return NextResponse.json({ error: "no conectado" }, { status: 401 });
      }
      result = await listLikedVideos(access.token, page);
    } else {
      if (!access.token && !apiKey) {
        return NextResponse.json({ error: "no conectado" }, { status: 401 });
      }
      result = await listPlaylistItems({ accessToken: access.token, apiKey }, id, page);
    }
    const res = NextResponse.json(result);
    if (access.reseal) res.cookies.set(YT_COOKIE, access.reseal, cookieOptions(origin));
    return res;
  } catch (error) {
    const status = isQuotaOrAuthError(error);
    return NextResponse.json(
      {
        error:
          status === 403
            ? "cuota de la YouTube API agotada por hoy"
            : "no se pudo leer la playlist",
      },
      { status: 502 },
    );
  }
}
