// Normalización de teléfonos a E.164 sin '+', con Chile por defecto.
//
// Un número mal normalizado en un CRM no es un detalle cosmético: es un mensaje
// que no llega, o peor, que llega a otra persona. Por eso la función devuelve
// `null` en vez de adivinar cuando el número no calza con nada razonable.

/** Código país por defecto. Chile. */
const PAIS = "56";

/**
 * Devuelve el número en formato E.164 sin '+' (ej: 56912345678), o `null` si no
 * hay forma defendible de interpretarlo.
 *
 * Casos que acepta para Chile:
 *   +56 9 1234 5678 / 56912345678  → ya viene completo
 *   9 1234 5678 → móvil sin país
 *   09 1234 5678 → móvil con el 0 de discado nacional
 *   2 2345 6789 → fijo de Santiago sin país
 */
export function normalizarTelefono(crudo: string | null | undefined): string | null {
  if (!crudo) return null;

  let d = crudo.replace(/\D/g, "");
  if (!d) return null;

  // 00 de discado internacional
  if (d.startsWith("00")) d = d.slice(2);

  // Ya trae código país
  if (d.startsWith(PAIS) && d.length >= 11) return d.slice(0, 12);

  // Números de otros países que ya vienen completos (12-15 dígitos) se respetan.
  if (d.length >= 12 && d.length <= 15) return d;

  // 0 de discado nacional
  if (d.startsWith("0")) d = d.slice(1);

  // Móvil chileno: 9 + 8 dígitos
  if (d.length === 9 && d.startsWith("9")) return PAIS + d;
  // Fijo chileno: 8 dígitos (2 2345 6789 ya sin el 0)
  if (d.length === 9) return PAIS + d;
  if (d.length === 8) return PAIS + d;

  return null;
}

/** ¿Es un móvil chileno? Solo a estos tiene sentido mandarles WhatsApp. */
export function esMovilChileno(e164: string | null): boolean {
  if (!e164) return false;
  return e164.startsWith("569") && e164.length === 11;
}

/** Formato legible para la UI: +56 9 1234 5678 */
export function formatearTelefono(e164: string | null | undefined): string {
  if (!e164) return "—";
  if (e164.startsWith("569") && e164.length === 11) {
    return `+56 9 ${e164.slice(3, 7)} ${e164.slice(7)}`;
  }
  return `+${e164}`;
}
