// Publicación de una edición de Cafecito IA.
//
// La escribe el proceso que redacta el boletín, que corre fuera de Vercel. Por
// eso entra por API con un token compartido y no por commit: publicar tres veces
// por semana no debe implicar un despliegue del sitio de producción.
//
//   POST /api/cafecito/publicar
//   Authorization: Bearer $CAFECITO_TOKEN
//   { "slug": "2026-09-05", "contenido": "# Titular\n\n...", "publicada": true }
//
// Es idempotente: reenviar el mismo slug actualiza la edición en vez de
// duplicarla, que es lo que hace posible corregir una errata sin romper la URL.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { cafecitoEdiciones } from "@/db/schema";
import {
  cuerpoSinTitulo,
  extraerBajada,
  extraerTitulo,
  minutosDeLectura,
} from "@/lib/cafecito/markdown";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = process.env.CAFECITO_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "CAFECITO_TOKEN no configurado" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  let body: { slug?: string; contenido?: string; publicada?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const { slug, contenido } = body;
  if (!slug || !/^\d{4}-\d{2}-\d{2}$/.test(slug)) {
    return NextResponse.json({ error: "slug debe ser YYYY-MM-DD" }, { status: 400 });
  }
  if (!contenido || contenido.trim().length < 100) {
    return NextResponse.json({ error: "contenido vacío o demasiado corto" }, { status: 400 });
  }

  const titulo = extraerTitulo(contenido);
  const bajada = extraerBajada(contenido);
  const cuerpo = cuerpoSinTitulo(contenido);

  try {
    const [fila] = await db
      .insert(cafecitoEdiciones)
      .values({
        slug,
        titulo,
        bajada,
        contenido: cuerpo,
        lectura: minutosDeLectura(cuerpo),
        publicada: body.publicada !== false,
      })
      .onConflictDoUpdate({
        target: cafecitoEdiciones.slug,
        set: {
          titulo,
          bajada,
          contenido: cuerpo,
          lectura: minutosDeLectura(cuerpo),
          publicada: body.publicada !== false,
          actualizadaEn: new Date(),
        },
      })
      .returning();

    return NextResponse.json({
      ok: true,
      slug: fila.slug,
      titulo: fila.titulo,
      url: `https://adoops.digital/cafecito-ia/${fila.slug}`,
    });
  } catch (err) {
    console.error("publicar cafecito error:", err);
    return NextResponse.json({ error: "error al guardar" }, { status: 500 });
  }
}
