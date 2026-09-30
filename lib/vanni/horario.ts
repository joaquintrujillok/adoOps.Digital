// Horario de atención de Vanni y la hora de Chile.
//
// El horario es el que Vanni declaró en el RFI (pregunta 9): tiendas de lunes
// a viernes de 8 a 17 h y sábado de 10 a 12 h. Decide qué se le promete a un
// cliente que dice OK: si es fuera de horario, no se le dice "te llamamos hoy".

const ZONA = "America/Santiago";

/** Día de la semana (0 = domingo) y hora, en Chile. */
export function horaChile(d: Date): { dia: number; hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.find((p) => p.type === "weekday")!.value);
  return { dia, hora: Number(partes.find((p) => p.type === "hour")!.value), minuto: Number(partes.find((p) => p.type === "minute")!.value) };
}

const ATENCION: Record<number, { desde: number; hasta: number } | null> = {
  0: null,
  1: { desde: 8, hasta: 17 },
  2: { desde: 8, hasta: 17 },
  3: { desde: 8, hasta: 17 },
  4: { desde: 8, hasta: 17 },
  5: { desde: 8, hasta: 17 },
  6: { desde: 10, hasta: 12 },
};

export function enHorarioAtencion(d = new Date()): boolean {
  const { dia, hora } = horaChile(d);
  const h = ATENCION[dia];
  return Boolean(h && hora >= h.desde && hora < h.hasta);
}

/**
 * Cuándo vuelve a haber alguien, dicho como se le diría a un cliente:
 * "hoy desde las 8:00", "mañana" o "el lunes". `null` si ahora hay atención.
 */
export function proximaAtencion(d = new Date()): string | null {
  if (enHorarioAtencion(d)) return null;
  const { dia, hora } = horaChile(d);
  const hoy = ATENCION[dia];
  if (hoy && hora < hoy.desde) return `hoy desde las ${hoy.desde}:00`;
  for (let i = 1; i <= 7; i++) {
    const siguiente = (dia + i) % 7;
    if (!ATENCION[siguiente]) continue;
    if (i === 1) return "mañana";
    return `el ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][siguiente]}`;
  }
  return "el próximo día hábil";
}
