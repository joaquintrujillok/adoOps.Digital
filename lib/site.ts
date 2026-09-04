/**
 * La URL canónica del sitio, en un solo lugar.
 *
 * ── Por qué www y no la apex ─────────────────────────────────────────────────
 *
 * En Vercel, `adoops.digital` redirige con 308 a `www.adoops.digital`, que es el
 * dominio de producción. Durante un tiempo el código declaró la apex como
 * canónica: cada página le decía a Google "mi URL oficial es esta" apuntando a
 * una URL que redirige a otra. Google lo resuelve, pero diluye la señal y llena
 * los informes de Search Console con redirecciones.
 *
 * Si algún día se invierte la redirección en Vercel, se cambia acá y en
 * NEXT_PUBLIC_BASE_URL, y no en ocho archivos.
 *
 * ── Por qué una constante y no leer el env en cada archivo ───────────────────
 *
 * Estaba duplicada en siete módulos con su propio valor por defecto. Basta que
 * uno quede desactualizado para que un canónico, un sitemap o un enlace de baja
 * apunten a otra parte, y son errores silenciosos: nada falla, solo dejan de
 * funcionar bien.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.adoops.digital";

/** `https://www.adoops.digital/cafecito-ia/2026-09-05` */
export const url = (ruta: string) => `${SITE_URL}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
