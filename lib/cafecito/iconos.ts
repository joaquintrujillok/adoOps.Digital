// Íconos de Cafecito, incrustados como data URI.
//
// ── Por qué no se cargan de un CDN ──────────────────────────────────────────
//
// Antes salían de `https://unpkg.com/lucide-static@latest/icons/X.svg` dentro de
// un `mask` de CSS. Dos problemas, y el segundo es el grave:
//
//   1. `@latest` no es una versión. El día que Lucide redibuje un ícono, el
//      selector de tazas cambia sin que nadie toque este repo.
//   2. Un `mask` que apunta a un host externo falla en silencio. No hay `onerror`
//      ni fallback: si unpkg está caído o bloqueado —una red corporativa, un
//      bloqueador—, la opción se ve como un cuadro vacío y la persona no sabe
//      qué está eligiendo. Es una dependencia de terceros en la ruta crítica de
//      un formulario, a cambio de cinco trazos de SVG.
//
// Van inline y pesan nada. Son de lucide-static v0.544.0, licencia ISC,
// copiados literales: mismo `viewBox`, mismo grosor de trazo, mismos remates.
//
// `currentColor` no sirve dentro de un `mask` —la máscara solo usa el canal
// alfa— así que el color lo pone el `background` del elemento, como ya hacía el
// código anterior.

const svg = (cuerpo: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`,
  )}")`;

export const ICONOS = {
  briefcase: svg(
    '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  ),
  terminal: svg('<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>'),
  "book-open": svg(
    '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  ),
  coffee: svg(
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
  ),
  check: svg('<path d="M20 6 9 17l-5-5"/>'),
} as const;

export type NombreIcono = keyof typeof ICONOS;

/** Las tres props que hacen falta para pintar un ícono como máscara. */
export const mascara = (icono: NombreIcono, color: string) => ({
  background: color,
  WebkitMask: `${ICONOS[icono]} center/contain no-repeat`,
  mask: `${ICONOS[icono]} center/contain no-repeat`,
});
