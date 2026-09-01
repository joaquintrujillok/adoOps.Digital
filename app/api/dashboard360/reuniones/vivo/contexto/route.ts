// Una pasada del copiloto: recibe el estado y lo último dicho, devuelve el
// estado nuevo.
//
// **Sin estado en el servidor, a propósito.** Vercel no garantiza que dos
// peticiones de la misma reunión caigan en la misma instancia, así que guardar
// el contexto acá obligaría a ir a la base cada veinte segundos por algo que el
// navegador ya tiene en la mano. El estado vive en la pantalla, viaja en cada
// pasada, y se persiste una sola vez: cuando la reunión termina.
//
// Esto además hace la ruta trivialmente reintentable — si una pasada falla, la
// siguiente lleva el mismo estado más un fragmento más largo, y no se perdió
// nada.

import { actualizarCopiloto, type EstadoCopiloto } from "@/lib/reuniones/copiloto";
import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";
// Una pasada son un par de segundos. Treinta es margen de sobra y evita que una
// llamada colgada se lleve puesta la cadencia de la pantalla.
export const maxDuration = 30;

export async function POST(req: Request) {
  const sesion = await getSession();
  if (!sesion) return Response.json({ error: "No autenticado" }, { status: 401 });

  let cuerpo: {
    estado?: EstadoCopiloto;
    fragmento?: string;
    conocimiento?: string;
  };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  const fragmento = (cuerpo.fragmento ?? "").trim();
  if (!fragmento) return Response.json({ error: "sin fragmento" }, { status: 400 });

  const estado: EstadoCopiloto = cuerpo.estado ?? {
    contexto: { tema: "", objetivo: null, puntosClave: [], tensiones: [] },
    preguntas: [],
  };

  try {
    const { estado: nuevo, uso } = await actualizarCopiloto({
      estado,
      fragmento,
      conocimiento: cuerpo.conocimiento,
    });
    return Response.json({ estado: nuevo, costoUsd: uso.costoUsd });
  } catch (e) {
    // El error se devuelve con su mensaje: la pantalla lo muestra en el panel de
    // eventos y sigue escuchando. Que falle una pasada no puede cortar la
    // transcripción, que es lo irrecuperable.
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
