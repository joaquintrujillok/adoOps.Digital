// Formateo para las pantallas del motor.
//
// Duplicado de `lib/crm/formato.ts` y no importado, por la misma razón que las
// piezas de interfaz de Dashboard360: son productos que comparten repositorio
// por conveniencia, no por diseño. Son cuatro envoltorios de `Intl`; el costo de
// la duplicación es menor que el del acoplamiento.
//
// La zona horaria va explícita en todas. Vercel corre en UTC y una fecha
// formateada sin zona muestra el día equivocado a partir de las 20:00 de Chile.

const ZONA = "America/Santiago";

export function numero(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString("es-CL");
}

export function porcentaje(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)}%` : "—";
}

export function fecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(d));
}

/** "hace 9 d". Para fechar una señal sin obligar a restar mentalmente. */
export function haceCuanto(d: Date | string | null | undefined, ahora = new Date()): string {
  if (!d) return "—";
  const dias = Math.floor((ahora.getTime() - new Date(d).getTime()) / 86_400_000);
  if (dias < 0) return "en el futuro";
  if (dias === 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} d`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}

/** "en 21 d". Para el vencimiento de una señal. */
export function faltan(d: Date | string | null | undefined, ahora = new Date()): string {
  if (!d) return "—";
  const dias = Math.ceil((new Date(d).getTime() - ahora.getTime()) / 86_400_000);
  if (dias < 0) return "vencida";
  if (dias === 0) return "vence hoy";
  return `vence en ${dias} d`;
}
