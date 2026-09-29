/**
 * Normaliza un RUT chileno a `12345678-K` (sin puntos, guion, DV en mayúscula)
 * y verifica el dígito verificador. `null` si no es un RUT válido.
 *
 * Validar el DV no es cosmético: en un formulario público evita guardar RUTs
 * mal tipeados que después no cruzan con nada, y le dice al cliente en el
 * momento que se equivocó en un número.
 */
export function normalizarRut(entrada: unknown): string | null {
  const limpio = String(entrada ?? "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
  if (limpio.length < 2 || limpio.length > 9) return null;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return null;
  return dvDe(cuerpo) === dv ? `${Number(cuerpo)}-${dv}` : null;
}

export function dvDe(cuerpo: string): string {
  let suma = 0;
  let mult = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const r = 11 - (suma % 11);
  return r === 11 ? "0" : r === 10 ? "K" : String(r);
}

/** 12.345.678-K, para mostrar. */
export function formatoRut(rut: string): string {
  const [cuerpo, dv] = rut.split("-");
  return `${Number(cuerpo).toLocaleString("es-CL")}-${dv}`;
}
