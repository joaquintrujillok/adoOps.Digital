// Descarga de la transcripción como .txt.
//
// **Por qué cuelga de /api/dashboard360 y no de /api/reuniones.** Son dos rutas
// con exigencias opuestas. `/api/reuniones/webhook` la llama una extensión sin
// cookie, así que está fuera del `matcher` de `proxy.ts` y se autentica con su
// token. Esta devuelve la transcripción literal de una reunión de trabajo —lo
// que cada persona dijo, con su nombre— y solo la puede leer alguien con sesión
// del tablero. Dejarla bajo el mismo prefijo que el webhook la habría sacado del
// proxy sin que nadie lo notara.
//
// El `getSession()` de acá no sobra: el proxy es un control optimista que evita
// el parpadeo, y la autorización de verdad la hace cada ruta.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reunionRegistros } from "@/db/reuniones";
import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";

/** Nombre de archivo sin acentos ni espacios: viaja en una cabecera HTTP. */
function nombreArchivo(id: number, titulo: string | null, fecha: Date | null): string {
  const base = (titulo || "reunion")
    .normalize("NFD")
    // Los diacríticos combinantes, en forma escapada: escritos literales son
    // invisibles en un editor y el próximo que toque esta línea los borra sin verlos.
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase();
  const dia = (fecha ?? new Date()).toISOString().slice(0, 10);
  return `${dia}-${base || "reunion"}-${id}.txt`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const sesion = await getSession();
  if (!sesion) return new Response("No autenticado", { status: 401 });

  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) return new Response("Id inválido", { status: 400 });

  const [fila] = await db
    .select()
    .from(reunionRegistros)
    .where(eq(reunionRegistros.id, numero))
    .limit(1);

  if (!fila) return new Response("No existe", { status: 404 });

  // `?v=original` baja el texto tal como lo entregó Meet. El default es la
  // versión corregida cuando existe, porque es la que se va a leer; pero la
  // original tiene que poder bajarse sin pasar por ninguna interpretación.
  const url = new URL(req.url);
  const quiereOriginal = url.searchParams.get("v") === "original";
  const cuerpo =
    quiereOriginal || !fila.transcripcionCorregida
      ? fila.transcripcion
      : fila.transcripcionCorregida;

  // El encabezado dice qué versión es. Un .txt que sale de acá termina pegado en
  // otra herramienta, y sin esta línea nadie sabe si está leyendo lo que se dijo
  // o lo que un modelo entendió que se dijo.
  const cabecera = [
    fila.titulo || "Reunión sin título",
    fila.inicioEn ? fila.inicioEn.toISOString() : `recibida ${fila.createdAt.toISOString()}`,
    fila.ambito ? `ámbito: ${fila.ambito}` : null,
    fila.capturadaPor ? `capturada por: ${fila.capturadaPor}` : null,
    quiereOriginal || !fila.transcripcionCorregida
      ? "versión: original, tal como la entregó Google Meet"
      : `versión: corregida con IA (${fila.modelo})`,
    "",
    "".padEnd(60, "-"),
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const nombre = nombreArchivo(
    numero,
    fila.titulo,
    fila.inicioEn ?? fila.createdAt,
  );

  return new Response(cabecera + cuerpo + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
