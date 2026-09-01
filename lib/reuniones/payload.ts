// Traducción del cuerpo que manda TranscripTonic a algo que esta app entienda.
//
// La extensión es de un tercero (https://github.com/vivek-nexus/transcriptonic,
// MIT) y su contrato está verificado leyendo su código, no su documentación:
// `extension/background-script/exporters.js`, función `postTranscriptToWebhook`.
// Dos cosas de ahí mandan sobre todo este archivo.
//
// ── 1. Manda dos formatos distintos y el usuario elige cuál ──────────────────
//
// En la pantalla de webhooks de la extensión hay un selector, "simple" o
// "advanced", y el cuerpo cambia entero:
//
//   advanced → transcript: [{ personName, timestamp (ISO), transcriptText }]
//              meetingStartTimestamp: ISO
//   simple   → transcript: "Nombre (20/08/2026, 10:30 AM)\ntexto\n\n..."
//              meetingStartTimestamp: la misma fecha ya formateada para humanos
//
// Se aceptan los dos, y no por generosidad: si alguien del equipo instala la
// extensión y deja el selector como venía, el webhook tiene que funcionar
// igual. Un endpoint que solo entiende un modo falla en silencio el día que
// otra persona lo configura distinto — y el síntoma sería "mi reunión no
// apareció", que es el peor error posible acá porque el transcript ya se perdió.
//
// Lo que sí se pierde en modo simple es la fecha: viene con
// `toLocaleString("default", ...)`, o sea en el locale del navegador de quien
// grabó. Parsear eso es adivinar si 08/03 es marzo o agosto. Se deja en null y
// la reunión se ordena por hora de llegada. **Preferimos no tener el dato a
// tenerlo mal**: una reunión fechada en el mes equivocado es peor que una sin
// fecha.
//
// ── 2. No manda ninguna cabecera propia ──────────────────────────────────────
//
// El `fetch` de la extensión pone `Content-Type: application/json` y nada más.
// No hay forma de mandar un `Authorization`, ni una firma HMAC del cuerpo. La
// única cosa que el usuario controla es la URL. Por eso el token del webhook
// viaja en la query string — ver `app/api/reuniones/webhook/route.ts`, donde
// está anotada la consecuencia.

import type { BloqueTranscripcion, MensajeChat } from "@/db/reuniones";

/** El cuerpo tal como puede llegar. Todo opcional: viene de afuera. */
export type CuerpoWebhook = {
  webhookBodyType?: "simple" | "advanced";
  meetingSoftware?: string;
  meetingTitle?: string;
  meetingStartTimestamp?: string;
  meetingEndTimestamp?: string;
  transcript?: BloqueTranscripcion[] | string;
  chatMessages?: MensajeChat[] | string;
};

/**
 * Cómo rotula Meet a quien tiene la extensión corriendo.
 *
 * "Tú" en interfaz en español, "You" en inglés. No es un dato del payload: es
 * literalmente lo que Google escribe en el subtítulo, así que llega adentro del
 * texto y hay que reemplazarlo antes de guardarlo. Ver `lib/reuniones/tokens.ts`
 * para de dónde sale el nombre real.
 */
const YO = new Set(["tú", "tu", "you"]);

function esYo(nombre: string): boolean {
  return YO.has(nombre.trim().toLowerCase());
}

export type ReunionNormalizada = {
  clave: string;
  plataforma: string | null;
  titulo: string | null;
  inicioEn: Date | null;
  finEn: Date | null;
  duracionMin: number | null;
  participantes: string[];
  transcripcion: string;
  bloques: BloqueTranscripcion[] | null;
  chat: MensajeChat[] | null;
};

/** Fecha solo si es una ISO real. Ver la nota 1 de la cabecera. */
function fechaIso(valor: unknown): Date | null {
  if (typeof valor !== "string" || valor.length === 0) return null;
  // El modo simple manda "20/08/2026, 10:30 AM". `new Date()` lo acepta a
  // veces, con el mes y el día invertidos según el runtime. Se exige forma ISO.
  if (!/^\d{4}-\d{2}-\d{2}T/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function textoDeBloques(bloques: BloqueTranscripcion[]): string {
  return bloques
    .map((b) => `${b.personName}: ${b.transcriptText}`)
    .join("\n")
    .trim();
}

/**
 * Quiénes hablaron. Sale de los bloques porque el payload no trae lista de
 * participantes: la extensión lee los subtítulos, y en los subtítulos solo
 * aparece quien habló. Alguien que estuvo callado toda la reunión no figura, y
 * eso es correcto — es lo que el transcript puede afirmar.
 */
function participantesDe(bloques: BloqueTranscripcion[]): string[] {
  const vistos = new Set<string>();
  for (const b of bloques) {
    const n = (b.personName || "").trim();
    if (n) vistos.add(n);
  }
  return [...vistos];
}

/**
 * En modo simple no hay bloques: el nombre viene adentro del texto, en su propia
 * línea con la forma `Nombre (FECHA)`. Para reemplazar "Tú" hay que tocar el
 * texto, y solo esas líneas de cabecera — nunca lo que la persona dijo, donde
 * "tú" es una palabra normal del español.
 */
function reemplazarYoEnTexto(texto: string, nombre: string): string {
  return texto
    .split("\n")
    .map((linea) => {
      const m = linea.match(/^(.+?)(\s+\([^)]*\)\s*)$/);
      if (m && esYo(m[1])) return `${nombre}${m[2]}`;
      return linea;
    })
    .join("\n");
}

/**
 * En modo simple el nombre queda dentro del texto, con la forma
 * `Nombre (FECHA)` en su propia línea. Se rescatan de ahí, sin inventar: si el
 * formato cambia, la lista queda vacía y la pantalla lo dice.
 */
function participantesDeTexto(texto: string): string[] {
  const vistos = new Set<string>();
  for (const linea of texto.split("\n")) {
    const m = linea.match(/^(.+?)\s+\([^)]*\)\s*$/);
    if (m) {
      const n = m[1].trim();
      if (n && n.length <= 80) vistos.add(n);
    }
  }
  return [...vistos];
}

/**
 * La clave de idempotencia.
 *
 * El payload no trae identificador de reunión —se revisó: no existe—, así que
 * se arma con lo único estable que manda: el instante de inicio y el título.
 * Dos reuniones distintas no empiezan en el mismo milisegundo con el mismo
 * nombre; el mismo POST repetido sí produce la misma clave, que es justo lo que
 * se quiere frenar.
 */
function claveDe(cuerpo: CuerpoWebhook): string {
  const inicio = (cuerpo.meetingStartTimestamp || "").trim();
  const titulo = (cuerpo.meetingTitle || "").trim();
  return `${inicio}|${titulo}`.slice(0, 200) || `sin-clave-${Date.now()}`;
}

/**
 * Normaliza el cuerpo. Devuelve `null` si no hay transcripción utilizable: sin
 * texto no hay nada que resumir y guardar la fila solo ensucia la pantalla.
 */
export function normalizar(
  cuerpo: CuerpoWebhook,
  /** Nombre de quien grabó, para reemplazar el "Tú" de Meet. */
  quienGrabo?: string | null,
): ReunionNormalizada | null {
  const crudos = Array.isArray(cuerpo.transcript) ? cuerpo.transcript : null;

  // El reemplazo se hace acá, antes de armar el texto, y no en la pantalla: el
  // rótulo queda escrito adentro de lo que se guarda, y una fila vieja con "Tú"
  // ya no se puede desambiguar después.
  const bloques =
    crudos && quienGrabo
      ? crudos.map((b) =>
          esYo(b.personName || "") ? { ...b, personName: quienGrabo } : b,
        )
      : crudos;

  const chat = Array.isArray(cuerpo.chatMessages) ? cuerpo.chatMessages : null;

  let transcripcion = bloques
    ? textoDeBloques(bloques)
    : typeof cuerpo.transcript === "string"
      ? cuerpo.transcript.trim()
      : "";

  if (!bloques && quienGrabo && transcripcion) {
    transcripcion = reemplazarYoEnTexto(transcripcion, quienGrabo);
  }

  if (!transcripcion) return null;

  const inicioEn = fechaIso(cuerpo.meetingStartTimestamp);
  const finEn = fechaIso(cuerpo.meetingEndTimestamp);
  const duracionMin =
    inicioEn && finEn
      ? Math.max(0, Math.round((finEn.getTime() - inicioEn.getTime()) / 60000))
      : null;

  return {
    clave: claveDe(cuerpo),
    plataforma: cuerpo.meetingSoftware?.trim() || null,
    titulo: cuerpo.meetingTitle?.trim().slice(0, 300) || null,
    inicioEn,
    finEn,
    duracionMin,
    participantes: bloques
      ? participantesDe(bloques)
      : participantesDeTexto(transcripcion),
    transcripcion,
    bloques,
    chat,
  };
}
