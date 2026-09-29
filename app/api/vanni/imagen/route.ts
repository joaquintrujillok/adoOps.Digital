import { randomBytes } from "crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { esAdmin, leerSesion } from "@/lib/vanni/session";

export const runtime = "nodejs";

// Sube la pieza gráfica de una campaña a Vercel Blob y devuelve su URL pública
// (WaSender la descarga desde ahí al enviar). Va por acá y no por un server
// action porque esos cortan el cuerpo en 1 MB y un PNG de diseño pesa más.
//
// Solo PNG o JPG: son los formatos que WhatsApp muestra como imagen. Hasta 5 MB,
// el mismo tope que usa la plataforma de la Muni de Paine.

const TIPOS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const sesion = await leerSesion();
  if (!sesion || !esAdmin(sesion)) return NextResponse.json({ error: "Solo un administrador puede subir imágenes" }, { status: 403 });

  const archivo = (await req.formData()).get("archivo");
  if (!(archivo instanceof File)) return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  const ext = TIPOS[archivo.type];
  if (!ext) return NextResponse.json({ error: "Tiene que ser PNG o JPG" }, { status: 400 });
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: "Pesa más de 5 MB: expórtala más liviana" }, { status: 400 });

  const blob = await put(`vanni/campanas/${randomBytes(9).toString("base64url")}.${ext}`, archivo, {
    access: "public",
    contentType: archivo.type,
  });
  return NextResponse.json({ url: blob.url });
}
