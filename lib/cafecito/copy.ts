// Copy de Cafecito derivado de `TAZAS`, no repetido a mano.
//
// ── Por qué existe ───────────────────────────────────────────────────────────
//
// La portada afirmaba "2 ediciones" y "5 min de lectura" en seis lugares
// distintos. Eran ciertos cuando había dos tazas; el día que apareció el flat
// white nadie los tocó, porque no había forma de saber que existían. El 07-09
// seguían ahí, contradiciendo al propio formulario que ofrecía tres opciones.
//
// El arreglo no es corregir los seis textos: es que dejen de ser textos. Todo lo
// que se pueda deducir de `TAZAS` se deduce acá, y `TAZAS` queda como la única
// fila que hay que editar cuando cambie una taza o sus minutos.
//
// Lo que NO se deriva —el tono del hero, la promesa— sigue escrito a mano, que
// es donde una plantilla haría daño.

import { TAZAS, type CafecitoTaza } from "@/db/cafecito";

/** De la más corta a la más larga: es el orden en que se decide. */
export const TAZAS_ORDEN: CafecitoTaza[] = [
  "expreso_directivo",
  "expreso_builder",
  "flat_white",
];

/** `"4 min"` → `4`. Si el formato cambiara, esto grita en los tests, no en producción. */
export function minutosDe(taza: CafecitoTaza): number {
  const n = parseInt(TAZAS[taza].minutos, 10);
  if (!Number.isFinite(n)) {
    throw new Error(`TAZAS.${taza}.minutos no empieza con un número: "${TAZAS[taza].minutos}"`);
  }
  return n;
}

const TODOS = TAZAS_ORDEN.map(minutosDe);
const MIN = Math.min(...TODOS);
const MAX = Math.max(...TODOS);

export const CUANTAS_TAZAS = TAZAS_ORDEN.length;

/** "de 4 a 8 minutos" · "en 4 minutos" si todas midieran lo mismo. */
export const RANGO_LECTURA =
  MIN === MAX ? `en ${MIN} minutos` : `de ${MIN} a ${MAX} minutos`;

/** "4–8 min", para la fila de cifras del hero. */
export const RANGO_LECTURA_CORTO = MIN === MAX ? `${MIN} min` : `${MIN}–${MAX} min`;

/** "Expreso directivo, expreso builder y flat white." */
export const TAZAS_EN_PROSA = (() => {
  const nombres = TAZAS_ORDEN.map((t, i) =>
    i === 0 ? TAZAS[t].nombre : TAZAS[t].nombre.toLowerCase(),
  );
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
})();

/** La frase que se repetía en el `<head>`, el JSON-LD y el hero. */
export const PROMESA = `Lo que pasó en inteligencia artificial, cada dos días, en una lectura ${RANGO_LECTURA}.`;
