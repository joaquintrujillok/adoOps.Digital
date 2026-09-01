// De quién es el webhook que acaba de postear, y a qué mundo pertenece.
//
// ── Los dos problemas que resuelve, que son el mismo ─────────────────────────
//
// 1. Google Meet rotula al usuario local como "Tú" en su interfaz en español, y
//    la extensión lee los subtítulos tal como Meet los escribe. En una reunión
//    de cinco personas, cuatro salen con su nombre y la quinta —justamente la
//    que grabó— sale como "Tú". Verificado en la primera reunión real que entró
//    al módulo, el 01-09-2026. Para una nota que alguien lee un mes después,
//    "Tú se comprometió a mandar la propuesta" no vale nada.
//
// 2. Las reuniones de trabajo y las personales no deberían leerse mezcladas. No
//    es orden por gusto: son dos conjuntos de personas distintas.
//
// El payload de la extensión no trae ninguna de las dos cosas. No trae el
// nombre del usuario ni nada que diga de qué navegador salió. **El único dato
// que distingue un emisor de otro es la URL que esa persona configuró**, y de
// esa URL lo único nuestro es el token. Así que el token deja de ser solo una
// llave y pasa a ser también la identidad y el ámbito.
//
// ── Por qué no un webhook por ámbito ─────────────────────────────────────────
//
// La alternativa evidente era una segunda ruta, `/api/reuniones/personal`. Sería
// el mismo código duplicado para siempre, y el día que haya un tercer contexto,
// tres. Un token por navegador da lo mismo sin duplicar nada: la extensión de
// cada navegador apunta a la misma URL con su propio `?token=`.

import { timingSafeEqual } from "crypto";

export type Emisor = {
  /** Nombre de quien configuró ese token. `null` si el token no lo declara. */
  nombre: string | null;
  /** `soho`, `personal`, o lo que declare. `null` si no declara. */
  ambito: string | null;
};

/**
 * Lee `REUNIONES_WEBHOOK_TOKEN`. Acepta tres formas, y las viejas siguen
 * valiendo:
 *
 *   REUNIONES_WEBHOOK_TOKEN=abc123…
 *   REUNIONES_WEBHOOK_TOKEN=abc123…:Joaquín Trujillo
 *   REUNIONES_WEBHOOK_TOKEN=abc123…:Joaquín Trujillo:soho,def456…:Joaquín Trujillo:personal
 *
 * Un token sin nombre autentica igual; lo único que pierde es el reemplazo de
 * "Tú" y el filtro por ámbito. Eso es deliberado: el día que alguien agregue un
 * token al vuelo y se olvide del resto, el webhook tiene que seguir guardando la
 * reunión. Un transcript sin firmar se arregla después; uno que nunca se guardó,
 * no.
 *
 * El nombre puede llevar espacios y acentos. No puede llevar comas —son el
 * separador entre tokens— ni dos puntos, y está bien: es un nombre de persona.
 */
function emisores(): Map<string, Emisor> {
  const crudo = process.env.REUNIONES_WEBHOOK_TOKEN ?? "";
  const mapa = new Map<string, Emisor>();

  for (const parte of crudo.split(",")) {
    const limpio = parte.trim();
    if (!limpio) continue;

    const [token, nombre, ambito] = limpio.split(":").map((x) => x.trim());

    // Un token corto no se rechaza en silencio: no se carga, y si no queda
    // ninguno cargado el endpoint responde 500 en vez de abrirse.
    if (token && token.length >= 24) {
      mapa.set(token, { nombre: nombre || null, ambito: ambito || null });
    }
  }

  return mapa;
}

/** Si hay al menos un token utilizable configurado. */
export function hayEmisores(): boolean {
  return emisores().size > 0;
}

/**
 * El emisor dueño del token, o `null` si no calza con ninguno.
 *
 * Compara contra todos en tiempo constante y **sin cortar al primer acierto**:
 * con dos o tres tokens el ahorro de salir antes es irrelevante, y no salir
 * elimina la pregunta de si el tiempo de respuesta filtra cuál calzó.
 */
export function identificar(recibido: string | null): Emisor | null {
  if (!recibido) return null;
  const a = Buffer.from(recibido);

  let encontrado: Emisor | null = null;
  for (const [token, emisor] of emisores()) {
    const b = Buffer.from(token);
    if (a.length === b.length && timingSafeEqual(a, b)) encontrado = emisor;
  }
  return encontrado;
}

/** Los ámbitos declarados, para que la pantalla pinte las pestañas que existen. */
export function ambitosDeclarados(): string[] {
  const vistos = new Set<string>();
  for (const e of emisores().values()) if (e.ambito) vistos.add(e.ambito);
  return [...vistos].sort();
}
