// Cerrar una sesión en vivo: fija el fin y la manda a procesar.
//
// El transcript ya está guardado —se persiste en cada pasada del copiloto, ver
// `lib/reuniones/vivo.ts`—, así que esta ruta no es la que salva la reunión.
// Solo la termina: pone la hora de fin, calcula la duración, y dispara la
// corrección y el resumen para que quede como cualquier otra del archivo.
//
// Por eso puede fallar sin consecuencias graves: si nadie la llama —porque se
// cerró la pestaña de golpe— la reunión queda igual en la lista, con su
// transcripción completa y en estado "recibida", y el botón de reintentar la
// termina de procesar.

import { after } from "next/server";
import { procesar } from "@/lib/reuniones/registro";
import { cerrarVivo } from "@/lib/reuniones/vivo";
import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const sesion = await getSession();
  if (!sesion) return Response.json({ error: "No autenticado" }, { status: 401 });

  let cuerpo: { clave?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  const clave = (cuerpo.clave ?? "").trim();
  if (!clave) return Response.json({ error: "falta la clave" }, { status: 400 });

  const id = await cerrarVivo(clave, new Date());
  if (!id) return Response.json({ error: "esa sesión no está guardada" }, { status: 404 });

  // Corrección y resumen fuera del ciclo de la respuesta: la pantalla ya cerró
  // el micrófono y no tiene por qué esperar a la IA.
  after(() => procesar(id));

  return Response.json({ ok: true, id });
}
