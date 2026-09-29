/** $12.990, en pesos chilenos sin decimales. */
export function clp(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

/** 11,8% con coma decimal. `null` cuando no hay base para calcular. */
export function pct(parte: number, total: number): string {
  if (!total) return "—";
  return `${((parte / total) * 100).toFixed(1).replace(".", ",")}%`;
}

export function miles(n: number): string {
  return n.toLocaleString("es-CL");
}

const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return FECHA.format(new Date(d));
}

/** Reemplaza `{campo}` en una plantilla. Un campo sin valor queda vacío, no con llaves. */
export function renderPlantilla(plantilla: string, datos: Record<string, string | null | undefined>): string {
  return plantilla
    .replace(/\{(\w+)\}/g, (_m, k: string) => (datos[k] ?? "").toString().trim())
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}
