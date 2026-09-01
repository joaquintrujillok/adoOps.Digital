// Entrada de las reuniones: el webhook que dispara TranscripTonic al colgar.
//
// ── Por qué el token va en la URL ────────────────────────────────────────────
//
// Porque la extensión no manda cabeceras propias. Su `fetch` pone
// `Content-Type: application/json` y nada más —verificado en
// `extension/background-script/exporters.js`—, así que no hay dónde poner un
// `Authorization` ni una firma HMAC del cuerpo como la que valida
// `/api/whatsapp/webhook`. Lo único configurable es la URL.
//
// La consecuencia hay que decirla en vez de esconderla: **este token queda
// escrito en los logs de acceso de Vercel**, y en el `chrome.storage.sync` de
// quien configure la extensión, que Chrome sincroniza entre los dispositivos de
// esa cuenta de Google. No es un secreto de la misma categoría que
// `D360_SESSION_SECRET`. Lo que protege también es acotado, y por eso el
// riesgo es aceptable: quien lo tenga puede *insertar* reuniones falsas y
// gastar tokens de OpenAI. No puede leer nada — este endpoint no devuelve
// datos— ni tocar ninguna otra tabla.
//
// Si aparece en un log que no debía, se rota la variable y se reconfigura la
// extensión. Que sea rotable sin consecuencias es la razón por la que es una
// variable propia y no una que ya exista.
//
// ── Por qué esta ruta no pasa por el proxy ───────────────────────────────────
//
// `/api/reuniones` no está en el `matcher` de `proxy.ts`, igual que
// `/api/whatsapp/webhook`: la llama una extensión de navegador que no tiene
// cookie de sesión. La autenticación es la de acá, y es la única.

import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "crypto";
import { normalizar, type CuerpoWebhook } from "@/lib/reuniones/payload";
import { recibir, resumir } from "@/lib/reuniones/registro";

export const runtime = "nodejs";

/**
 * El resumen corre en un `after()`, y ese trabajo cuenta dentro de la duración
 * de la función igual que la respuesta. Con el default de 10 segundos, una
 * reunión larga se quedaría a medias: la fila guardada en `recibida` y el
 * resumen muerto sin que nadie se entere. Dos minutos es el mismo techo que
 * usan los crons del repo.
 */
export const maxDuration = 120;

/** Comparación en tiempo constante. Distinta longitud ya es distinto token. */
function tokenValido(recibido: string | null, esperado: string): boolean {
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const esperado = process.env.REUNIONES_WEBHOOK_TOKEN;
  // Sin token configurado el endpoint se cierra, no se abre. Un fallback
  // permisivo acá sería una ruta pública que escribe en la base y llama a una
  // API que se paga.
  if (!esperado || esperado.length < 24) {
    return NextResponse.json(
      { error: "REUNIONES_WEBHOOK_TOKEN no configurada" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  if (!tokenValido(url.searchParams.get("token"), esperado)) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  let cuerpo: CuerpoWebhook;
  try {
    cuerpo = (await req.json()) as CuerpoWebhook;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const reunion = normalizar(cuerpo);
  if (!reunion) {
    // La extensión no debería llegar acá: se niega a postear cuando el
    // transcript y el chat están vacíos (su error 014). Si igual llega, se
    // responde con error para que quien configuró el webhook vea la
    // notificación de fallo en vez de creer que quedó guardado.
    return NextResponse.json({ error: "sin transcripción" }, { status: 422 });
  }

  const { id, duplicada } = await recibir(reunion, cuerpo);

  // El resumen va fuera del ciclo de la respuesta. La extensión trata cualquier
  // respuesta que no sea `ok` como fallo y le muestra una notificación a la
  // persona; esperar a OpenAI acá sería arriesgar ese fallo por algo que no
  // tiene nada que ver con haber recibido bien la reunión.
  if (!duplicada) after(() => resumir(id));

  return NextResponse.json({ ok: true, id, duplicada });
}
