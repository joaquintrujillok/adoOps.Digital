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
import { guardarVivo } from "@/lib/reuniones/vivo";
import { recuperar } from "@/lib/conocimiento";
import { resolverCuenta } from "@/lib/cuentas";
import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";
// Una pasada son un par de segundos. Treinta es margen de sobra y evita que una
// llamada colgada se lleve puesta la cadencia de la pantalla.
export const maxDuration = 30;

export async function POST(req: Request) {
  const sesion = await getSession();
  if (!sesion) return Response.json({ error: "No autenticado" }, { status: 401 });

  // El conocimiento NO viene del navegador. Lo recupera el servidor con la
  // cuenta de la sesión: si lo mandara el cliente, cualquiera con la pantalla
  // abierta podría inyectarle al copiloto material de otra cuenta, y la
  // separación entre Soho y adoOps dejaría de significar algo.
  let cuerpo: {
    estado?: EstadoCopiloto;
    fragmento?: string;
    /** Identifica la sesión entre pasadas. Sin esto no se guarda nada. */
    clave?: string;
    titulo?: string;
    inicioEn?: string;
    /** La transcripción completa hasta ahora, para guardarla al paso. */
    transcripcion?: string;
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

  const cuenta = resolverCuenta(sesion.cuenta, sesion.cuentas);

  // ── Guardar antes de razonar ───────────────────────────────────────────────
  //
  // Primero se persiste el transcript y después se piensa. El orden importa: si
  // el copiloto falla —cuota, timeout, un modelo que devuelve cualquier cosa—
  // la reunión ya quedó guardada. Al revés, un error en la parte prescindible
  // se llevaría puesta la irrecuperable.
  //
  // Y no rompe la pasada si falla: una reunión sin guardar todavía es peor que
  // una sin contexto, pero cortar la transcripción en vivo por un error de
  // escritura sería peor que las dos.
  if (cuerpo.clave && cuerpo.transcripcion?.trim() && cuerpo.inicioEn) {
    try {
      await guardarVivo({
        clave: cuerpo.clave,
        titulo: (cuerpo.titulo ?? "").trim().slice(0, 300) || "Reunión en vivo",
        inicioEn: new Date(cuerpo.inicioEn),
        transcripcion: cuerpo.transcripcion,
        cuenta: cuenta.id,
        capturadaPor: sesion.nombre,
      });
    } catch {
      // Se sigue: el próximo intento es en veinte segundos y lleva el texto
      // completo, no un incremento, así que un fallo aislado no pierde nada.
    }
  }

  try {
    // La consulta de búsqueda es el CONTEXTO más lo último dicho, no la última
    // frase sola. Veinte segundos de conversación suelen ser "sí, claro,
    // exacto"; el contexto acumulado es una descripción densa de qué se está
    // hablando, que es lo que un embedding sabe comparar.
    const c = estado.contexto;
    const consulta = [c.tema, c.objetivo, ...c.tensiones, fragmento]
      .filter(Boolean)
      .join(". ");

    const trozos = await recuperar(cuenta.id, consulta);
    const conocimiento = trozos.map((t) => t.texto).join("\n\n---\n\n");

    const { estado: nuevo, uso } = await actualizarCopiloto({
      estado,
      fragmento,
      conocimiento,
    });
    return Response.json({
      estado: nuevo,
      costoUsd: uso.costoUsd,
      // Qué se recuperó viaja a la pantalla para poder mirarlo en el panel de
      // eventos. Una búsqueda semántica que nadie puede inspeccionar es una caja
      // negra adentro de otra caja negra.
      fuentes: trozos.map((t) => t.ruta),
    });
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
