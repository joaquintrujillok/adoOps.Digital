import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { normalizeRoomCode } from "@/lib/mix-types";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB por clip

/**
 * POST /api/mix/upload — subida directa del navegador a Vercel Blob.
 * El archivo NO pasa por esta función (los videos superan el límite de body):
 * aquí solo se firma el token de subida y se valida la sala.
 */
export async function POST(req: Request) {
  // Dos modos de auth del SDK: OIDC (stores nuevos: BLOB_STORE_ID + el token
  // OIDC que Vercel inyecta) o el token clásico BLOB_READ_WRITE_TOKEN.
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Subida no disponible: falta el Blob store (BLOB_STORE_ID)" },
      { status: 503 },
    );
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // clientPayload trae el código de sala: si no es válido, no se firma.
        const room = normalizeRoomCode(String(clientPayload ?? ""));
        if (!room) throw new Error("sala inválida");
        if (!pathname.startsWith(`mix/${room}/`)) throw new Error("ruta inválida");
        return {
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // La consola agrega el clip al estado de la sala; nada que hacer aquí.
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "error";
    return NextResponse.json({ error: `no se pudo subir: ${detail}` }, { status: 400 });
  }
}
