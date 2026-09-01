// Cargar un documento de conocimiento.
//
// ── Por qué se sube el markdown en vez de leerlo del repositorio ─────────────
//
// Lo natural sería que esta ruta abriera `docs/conocimiento/*.md` del propio
// despliegue. No se hace por dos razones. La primera es práctica: Vercel solo
// empaqueta los archivos que rastrea, y un `readFile` de una ruta armada al
// vuelo no se rastrea — funcionaría en local y fallaría en producción, que es el
// peor tipo de falla. La segunda es que así la base se puede actualizar sin
// desplegar: se edita el markdown, se sube, y el copiloto usa lo nuevo en la
// siguiente reunión.
//
// ── Por qué acá y no en un script local ──────────────────────────────────────
//
// Porque la ingesta necesita la clave de OpenAI y esa clave vive en producción.
// Un script local exigiría copiarla al `.env.local` de cada máquina desde donde
// se quiera actualizar la base. Acá la clave no se mueve de donde ya está.

import { ingerir } from "@/lib/conocimiento";
import { cuentaPorId } from "@/lib/cuentas";
import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";
// Embeber 125 trozos son dos llamadas por lote más las inserciones. Dos minutos
// es el mismo techo que usan los crons del repo.
export const maxDuration = 120;

export async function POST(req: Request) {
  const sesion = await getSession();
  if (!sesion) return Response.json({ error: "No autenticado" }, { status: 401 });

  let cuerpo: { cuenta?: string; origen?: string; markdown?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  const cuenta = cuentaPorId(cuerpo.cuenta);
  const origen = (cuerpo.origen ?? "").trim().slice(0, 200);
  const markdown = cuerpo.markdown ?? "";

  if (!cuenta) return Response.json({ error: "cuenta inválida" }, { status: 400 });
  if (!origen) return Response.json({ error: "falta el nombre del archivo" }, { status: 400 });
  if (markdown.trim().length < 100) {
    return Response.json({ error: "el documento viene vacío" }, { status: 422 });
  }

  try {
    const r = await ingerir(cuenta.id, origen, markdown);
    return Response.json({ ok: true, cuenta: cuenta.id, origen, ...r });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
