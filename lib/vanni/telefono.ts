/**
 * Normaliza un teléfono chileno a 569XXXXXXXX, que es como lo identifica
 * WhatsApp. Devuelve `null` si no hay forma razonable de leerlo.
 *
 * Acepta lo que llega en una planilla real: "+56 9 1234 5678", "912345678",
 * "56912345678", "9 1234-5678", o un número de celda que Excel guardó como
 * número (56912345678).
 */
export function normalizarTelefono(entrada: unknown): string | null {
  if (entrada === null || entrada === undefined) return null;
  const digitos = String(entrada).replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length === 11 && digitos.startsWith("569")) return digitos;
  if (digitos.length === 9 && digitos.startsWith("9")) return `56${digitos}`;
  if (digitos.length === 8) return `569${digitos}`;
  // Otros países: se aceptan con su código si tienen un largo plausible.
  if (digitos.length >= 10 && digitos.length <= 15 && !digitos.startsWith("0")) return digitos;
  return null;
}

/** +56 9 1234 5678, para mostrar. */
export function formatoTelefono(t: string): string {
  if (/^569\d{8}$/.test(t)) return `+56 9 ${t.slice(3, 7)} ${t.slice(7)}`;
  return `+${t}`;
}
