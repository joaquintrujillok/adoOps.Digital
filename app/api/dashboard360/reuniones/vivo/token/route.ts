// Credencial efímera para que el navegador hable directo con OpenAI Realtime.
//
// ── Por qué el audio no pasa por acá ─────────────────────────────────────────
//
// Vercel corre funciones serverless: no sostienen una conexión abierta mientras
// dura una reunión. Todo el "tiempo real" que existe hoy en este repo es polling
// —los `AutoRefresh` de TorreControl, TV Mix—, y no hay un solo WebSocket. Así
// que relayear el audio por nuestro servidor no es una opción de diseño que se
// descarte por elegancia: no se puede sin levantar un segundo servicio.
//
// La forma que sí funciona es la que documenta OpenAI para clientes de navegador:
// el servidor pide una credencial de corta vida con la API key de verdad, y el
// navegador abre la sesión WebRTC con esa credencial. **La API key nunca sale de
// acá.** Lo que viaja al navegador vence en una hora y solo sirve para abrir una
// sesión de transcripción.
//
// Esta ruta cuelga de /api/dashboard360 y no de /api/reuniones por la misma razón
// que la descarga de .txt: el webhook está fuera del `matcher` de `proxy.ts`
// porque lo llama una extensión sin cookie, y esto emite credenciales que cuestan
// plata. Acá exigimos sesión del tablero.

import { getSession } from "@/lib/dashboard360/session";

export const runtime = "nodejs";

/**
 * El modelo de transcripción en vivo. US$0,017 el minuto.
 *
 * Se elige **acá y no en el navegador**, y eso importa: la credencial efímera
 * lleva la configuración de la sesión adentro, así que lo que viaja al cliente
 * solo sirve para transcribir con este modelo. Si la eligiera el navegador,
 * cualquiera con la credencial podría abrir una sesión de voz completa, que
 * cuesta veinte veces más.
 */
const MODELO = process.env.REUNIONES_MODELO_VIVO || "gpt-live-transcribe";

export async function POST() {
  const sesion = await getSession();
  if (!sesion) return Response.json({ error: "No autenticado" }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });
  }

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // `expires_in` fue lo primero que probé, por una guía desactualizada, y la
      // API contestó `unknown_parameter`. La forma real es un objeto con ancla y
      // segundos; el máximo son 7200 y el default 600, que para una reunión se
      // queda corto.
      //
      // Ojo con qué vence: la credencial deja de servir para ABRIR sesiones
      // pasado ese plazo, pero una sesión ya abierta sigue corriendo. Una hora
      // es margen para empezar, no un límite de duración.
      expires_after: { anchor: "created_at", seconds: 3600 },

      // La sesión se declara en la credencial y no por el canal de eventos.
      // Un solo lugar donde está definida, y del lado que no puede editar quien
      // recibe la credencial.
      session: {
        type: "transcription",
        audio: {
          input: {
            transcription: { model: MODELO },
            // Sin `turn_detection`, y no por omisión: la API lo rechaza con
            // "Turn detection is not supported for this transcription model".
            //
            // Tiene sentido y conviene anotarlo, porque invita a "arreglarlo":
            // el VAD del servidor existe para decidir cuándo termina el turno de
            // un usuario y le toca responder al modelo. Acá nadie responde —esto
            // solo escucha— y `gpt-live-transcribe` corta las frases por su
            // cuenta, que es justamente para lo que está hecho.
          },
        },
      },
      // No se manda `format`: con WebRTC el códec lo negocia el propio
      // transporte. Declarar PCM es cosa de las sesiones por WebSocket.
    }),
  });

  const texto = await res.text();
  if (!res.ok) {
    // El cuerpo del error de OpenAI se devuelve tal cual y a propósito: esta
    // ruta existe hoy para descubrir si la cuenta tiene Realtime habilitada, y
    // un "error al conectar" genérico no responde esa pregunta.
    return Response.json(
      { error: "OpenAI rechazó la credencial", detalle: texto, status: res.status },
      { status: 502 },
    );
  }

  const datos = JSON.parse(texto) as {
    value?: string;
    client_secret?: { value?: string };
  };

  // La forma de la respuesta cambió entre la beta y la GA. Se aceptan las dos en
  // vez de asumir una: si mañana cambia otra vez, falla con un mensaje que dice
  // qué llegó, no con un `undefined` silencioso.
  const secreto = datos.value ?? datos.client_secret?.value;
  if (!secreto) {
    return Response.json(
      { error: "La respuesta no traía credencial", detalle: texto },
      { status: 502 },
    );
  }

  return Response.json({ secreto, modelo: MODELO });
}
