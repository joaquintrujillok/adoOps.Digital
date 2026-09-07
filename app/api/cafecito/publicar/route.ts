// Publicación de una edición de Cafecito IA.
//
// La escribe el proceso que redacta el boletín, que corre fuera de Vercel. Por
// eso entra por API con un token compartido y no por commit: publicar tres veces
// por semana no debe implicar un despliegue del sitio de producción.
//
//   POST /api/cafecito/publicar
//   Authorization: Bearer $CAFECITO_TOKEN
//   { "fecha": "2026-09-05", "contenido": "# Titular\n\n...", "publicada": true }
//
// ── La identidad de una edición es su fecha, no su slug ─────────────────────
//
// Hasta el 07-09-2026 el cuerpo traía `slug` con forma `YYYY-MM-DD` y la
// idempotencia salía de un `ON CONFLICT (slug)`. Ahora el slug se deriva del
// título, y un título se corrige: si la identidad siguiera siendo el slug,
// arreglar una errata crearía una edición nueva en vez de actualizar la que
// existe, y dejaría la vieja publicada en su URL.
//
// Así que se busca por `fecha` y, si la fila ya existe, **se conserva su slug
// tal cual**. Ese slug ya salió por correo; recalcularlo rompería enlaces que
// están en bandejas de entrada ajenas. Solo se genera cuando no hay fila.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { url } from "@/lib/site";
import { eq } from "drizzle-orm";
import { cafecitoEdiciones } from "@/db/schema";
import {
  cuerpoSinTitulo,
  extraerBajada,
  extraerTitulo,
  minutosDeLectura,
} from "@/lib/cafecito/markdown";
import { ES_FECHA, slugUnico } from "@/lib/cafecito/slug";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = process.env.CAFECITO_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "CAFECITO_TOKEN no configurado" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  let body: { fecha?: string; slug?: string; contenido?: string; publicada?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  // `slug` se sigue aceptando cuando trae una fecha: es el nombre que usaba el
  // publicador antes de este cambio, y los dos repos se despliegan por separado
  // —el otro ni siquiera está bajo git—, así que una versión vieja publicando
  // contra este endpoint no debe romperse.
  const fecha = body.fecha ?? (body.slug && ES_FECHA.test(body.slug) ? body.slug : undefined);
  const { contenido } = body;

  if (!fecha || !ES_FECHA.test(fecha)) {
    return NextResponse.json({ error: "fecha debe ser YYYY-MM-DD" }, { status: 400 });
  }
  if (!contenido || contenido.trim().length < 100) {
    return NextResponse.json({ error: "contenido vacío o demasiado corto" }, { status: 400 });
  }

  const titulo = extraerTitulo(contenido);
  const bajada = extraerBajada(contenido);
  const cuerpo = cuerpoSinTitulo(contenido);
  const campos = {
    titulo,
    bajada,
    contenido: cuerpo,
    lectura: minutosDeLectura(cuerpo),
    publicada: body.publicada !== false,
  };

  try {
    const [existente] = await db
      .select({ id: cafecitoEdiciones.id, slug: cafecitoEdiciones.slug })
      .from(cafecitoEdiciones)
      .where(eq(cafecitoEdiciones.fecha, fecha))
      .limit(1);

    let fila;

    if (existente) {
      // Se actualiza todo menos el slug. Ese es el punto.
      [fila] = await db
        .update(cafecitoEdiciones)
        .set({ ...campos, actualizadaEn: new Date() })
        .where(eq(cafecitoEdiciones.id, existente.id))
        .returning();
    } else {
      const slug = await slugUnico(titulo, fecha, async (s) => {
        const [c] = await db
          .select({ id: cafecitoEdiciones.id })
          .from(cafecitoEdiciones)
          .where(eq(cafecitoEdiciones.slug, s))
          .limit(1);
        return Boolean(c);
      });

      [fila] = await db
        .insert(cafecitoEdiciones)
        .values({ slug, fecha, ...campos })
        .returning();
    }

    return NextResponse.json({
      ok: true,
      slug: fila.slug,
      fecha: fila.fecha,
      titulo: fila.titulo,
      url: url(`/cafecito-ia/${fila.slug}`),
    });
  } catch (err) {
    console.error("publicar cafecito error:", err);
    return NextResponse.json({ error: "error al guardar" }, { status: 500 });
  }
}
