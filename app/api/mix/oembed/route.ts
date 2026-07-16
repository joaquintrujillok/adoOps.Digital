import { NextResponse } from "next/server";
import { VIDEO_ID_RE } from "@/lib/mix-types";

export const runtime = "nodejs";

/**
 * GET /api/mix/oembed?id=VIDEO_ID
 * Proxy del oEmbed de YouTube para obtener el título de un video sin pelear
 * con CORS desde el navegador y sin necesitar API key.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!VIDEO_ID_RE.test(id)) {
    return NextResponse.json({ error: "id de video inválido" }, { status: 400 });
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${id}`,
  )}&format=json`;

  try {
    const res = await fetch(oembedUrl, { next: { revalidate: 86400 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: "video no encontrado o no embebible" },
        { status: 404 },
      );
    }
    const data = (await res.json()) as { title?: string; author_name?: string };
    return NextResponse.json({
      title: data.title ?? null,
      author: data.author_name ?? null,
    });
  } catch {
    return NextResponse.json({ error: "no se pudo consultar YouTube" }, { status: 502 });
  }
}
