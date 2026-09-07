// Slug de una edición: la parte de la URL que la identifica.
//
// ── Por qué el slug es identidad y no presentación ──────────────────────────
//
// Hasta el 07-09-2026 la URL era la fecha (`/cafecito-ia/2026-09-07`). Para
// Google eso no dice nada del contenido, y el título —que es lo que se busca—
// no aparecía en ninguna parte de la URL.
//
// Cambiarlo tiene una consecuencia que manda sobre todo el diseño de este
// archivo: **una URL publicada es una promesa**. Sale por correo, queda en
// bandejas de entrada, se comparte. Por eso:
//
//   - el slug se genera UNA vez, al publicar, y no se recalcula nunca aunque
//     después se corrija el título (ver `publicar`);
//   - las URLs de fecha viejas siguen respondiendo, con 301 a la nueva.
//
// Si esto se saltara, cada corrección de una errata en un título rompería los
// enlaces de los correos ya enviados, en silencio y sin forma de detectarlo.

/** Tope de largo. Suficiente para un titular completo; corta por palabra, no a la mitad. */
const LARGO_MAX = 80;

/**
 * Título → slug. Función pura: mismo título, mismo resultado, siempre.
 *
 * `NFD` separa cada letra de su acento y `\p{Diacritic}` los borra: así
 * `declaró` → `declaro` y `ñ` → `n` sin una tabla de reemplazos que mantener.
 */
export function slugificar(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // La ñ descompuesta ya cayó arriba; esto cubre las que lleguen precompuestas
    // desde una fuente que no normalice (copiar y pegar desde Word, por ejemplo).
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length <= LARGO_MAX) return base;

  // Corta en el último guion que quepa, para no partir una palabra por la mitad.
  // Si no hay ninguno —un título de una sola palabra larguísima— corta seco:
  // mejor un slug feo que uno de 300 caracteres.
  const recorte = base.slice(0, LARGO_MAX);
  const ultimo = recorte.lastIndexOf("-");
  return (ultimo > 0 ? recorte.slice(0, ultimo) : recorte).replace(/-+$/g, "");
}

/**
 * El slug definitivo, esquivando los que ya existen.
 *
 * Dos ediciones pueden tener el mismo título —una serie, una corrección
 * republicada— y `slug` tiene índice único. Se desempata con la fecha, que es
 * legible y estable, en vez de un `-2` que no le dice nada a nadie.
 *
 * `yaExiste` se recibe como función para que esto siga siendo pura y testeable
 * sin base de datos.
 */
export async function slugUnico(
  titulo: string,
  fecha: string,
  yaExiste: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugificar(titulo) || fecha;
  if (!(await yaExiste(base))) return base;

  const conFecha = `${base}-${fecha}`;
  if (!(await yaExiste(conFecha))) return conFecha;

  // Tercera colisión: mismo título y misma fecha ya publicados. Es raro de
  // verdad, pero devolver algo que choca con el índice único sería peor.
  for (let n = 2; n < 100; n++) {
    const intento = `${conFecha}-${n}`;
    if (!(await yaExiste(intento))) return intento;
  }
  throw new Error(`No se pudo generar un slug único para "${titulo}" (${fecha})`);
}

/** `2026-09-07`. Es la forma de las URLs viejas, las que hay que redirigir. */
export const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
