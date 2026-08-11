// Formateo compartido. Vive en un solo archivo para que "$ 1.250.000" se vea
// igual en las 9 pantallas y no haya dos criterios de redondeo dando vueltas.

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

/** Montos en CLP: enteros, sin decimales. */
export function clp(monto: number | null | undefined): string {
  return CLP.format(monto ?? 0);
}

/** Versión corta para tarjetas y ejes: $1,2M / $850K */
export function clpCorto(monto: number | null | undefined): string {
  const n = monto ?? 0;
  const signo = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${signo}$${(abs / 1_000_000_000).toFixed(1)}MM`;
  if (abs >= 1_000_000) return `${signo}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${signo}$${Math.round(abs / 1_000)}K`;
  return `${signo}$${abs}`;
}

export function numero(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-CL").format(n ?? 0);
}

export function porcentaje(n: number | null | undefined, decimales = 0): string {
  return `${(n ?? 0).toFixed(decimales)}%`;
}

export function fecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** "hace 3 días", "en 2 semanas". Devuelve "—" si no hay fecha. */
export function relativo(d: Date | string | null | undefined, ahora = new Date()): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const dias = Math.round((date.getTime() - ahora.getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (Math.abs(dias) < 30) return rtf.format(dias, "day");
  if (Math.abs(dias) < 365) return rtf.format(Math.round(dias / 30), "month");
  return rtf.format(Math.round(dias / 365), "year");
}

export function diasDesde(d: Date | string | null | undefined, ahora = new Date()): number | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return Math.floor((ahora.getTime() - date.getTime()) / 86_400_000);
}
