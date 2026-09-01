// Qué secciones del menú se pintan según la cuenta activa.
//
// **La decisión vive en `lib/cuentas.ts`; acá solo se aplica.** El layout arma
// el menú completo como siempre —con sus contadores y sus condiciones de
// despliegue— y esto lo recorta al final. Separado así por una razón práctica:
// el layout ya decide muchas cosas (si el motor está desplegado, si hay
// contenido, cuántos badges), y meterle además el filtro por cuenta lo volvía
// ilegible.
//
// ── Por qué el mapa es de ruta a módulo y no al revés ────────────────────────
//
// Porque lo que existe es el menú, y el menú son rutas. Un mapa al revés
// obligaría a mantener en dos lados la lista de qué URLs cuelgan de cada
// sección, y el día que se agregue una pantalla nueva al motor nadie se
// acordaría de venir a anotarla acá. Así, una ruta que no calce con ningún
// prefijo simplemente no se filtra y sigue apareciendo: el modo de falla es que
// sobre una entrada, no que desaparezca sin que nadie sepa por qué.

import type { GrupoNav } from "@/components/dashboard360/Nav";
import { tieneModulo, type Cuenta, type ModuloCuenta } from "@/lib/cuentas";

/**
 * Prefijo de ruta → sección. **El orden importa**: se toma el primero que
 * calce, y `/dashboard360` calzaría con todo, así que va último.
 */
const RUTAS: [string, ModuloCuenta][] = [
  ["/dashboard360/canales", "canales"],
  ["/dashboard360/prospeccion", "mercado"],
  ["/dashboard360/motor", "motor"],
  ["/dashboard360/informe", "informe"],
  ["/dashboard360/fuentes", "fuentes"],
  ["/dashboard360/contenido", "contenido"],
  ["/dashboard360/reuniones", "reuniones"],
  ["/dashboard360", "panel"],
];

/**
 * A qué sección pertenece una ruta. `undefined` si no está en el mapa.
 *
 * Se exporta porque la usan dos consumidores con exigencias distintas: el menú
 * —que recorta lo que se pinta— y `proxy.ts`, que impide llegar por URL. Tener
 * dos copias del mapa sería garantizar que algún día discrepen, y el síntoma
 * sería una pantalla que no aparece en el menú pero se abre igual.
 */
export function moduloDeRuta(href: string): ModuloCuenta | undefined {
  return RUTAS.find(([prefijo]) => href.startsWith(prefijo))?.[1];
}

/**
 * Orden canónico de las secciones. Es el del menú, y se escribe una vez acá para
 * que "la primera sección de una cuenta" signifique siempre lo mismo.
 */
const ORDEN: ModuloCuenta[] = [
  "panel",
  "canales",
  "mercado",
  "motor",
  "informe",
  "fuentes",
  "contenido",
  "reuniones",
];

/**
 * Dónde aterrizar al entrar a una cuenta.
 *
 * Existe por un error que se vio en pantalla: cambiar de cuenta mandaba siempre
 * a `/dashboard360`, o sea al Panel 360. En adoOps está bien; en Soho, que solo
 * tiene reuniones, dejaba a la persona parada sobre una pantalla que su cuenta
 * no tiene y que el menú no muestra. El menú decía una cosa y la pantalla otra.
 */
export function rutaInicialDe(cuenta: Cuenta): string {
  const primera = ORDEN.find((m) => tieneModulo(cuenta, m));
  if (!primera) return "/dashboard360";
  return RUTAS.find(([, m]) => m === primera)?.[0] ?? "/dashboard360";
}

export function filtrarPorCuenta(grupos: GrupoNav[], cuenta: Cuenta): GrupoNav[] {
  return grupos
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        const modulo = moduloDeRuta(it.href);
        // Una ruta que no está en el mapa se deja pasar. Ver la nota de arriba:
        // que sobre una entrada es un error visible; que falte, uno silencioso.
        return modulo ? tieneModulo(cuenta, modulo) : true;
      }),
    }))
    // Un grupo vacío deja un título flotando sobre nada. En Soho, que solo tiene
    // reuniones, sin esto quedarían cuatro títulos y una sola entrada.
    .filter((g) => g.items.length > 0);
}
