// El reloj del motor. Todo lo que diga "hoy" o "a esta hora" pasa por acá.
//
// ── Por qué existe un módulo para esto ───────────────────────────────────────
//
// Vercel corre en UTC. Con `toISOString().slice(0,10)` el "hoy" del panel cambia
// a media tarde hora de Chile, y las cuotas diarias del emisor se reinician en
// mitad de la jornada — o sea, justo cuando más se está enviando.
//
// Y Chile agrega una vuelta que el CRM de CDC no tiene: **horario de verano**.
// El desfase alterna entre −3 y −4 dos veces al año, así que ninguna ventana
// horaria se puede escribir como una constante en UTC. `Intl` conoce la base de
// zonas horarias; nosotros no.

const ZONA = "America/Santiago";

const FMT_FECHA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FMT_PARTES = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA,
  hour: "2-digit",
  hour12: false,
  weekday: "short",
});

/** `2026-08-25` en hora de Chile. Es lo que se guarda en `fecha_chile`. */
export function fechaChile(d: Date = new Date()): string {
  // en-CA da directamente YYYY-MM-DD, sin tener que rearmar las partes.
  return FMT_FECHA.format(d);
}

/** La hora del día (0–23) en Chile. */
export function horaChile(d: Date = new Date()): number {
  const h = FMT_PARTES.formatToParts(d).find((p) => p.type === "hour")?.value;
  // "24" aparece en algunas implementaciones para la medianoche.
  return Number(h) % 24;
}

const DIAS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** 0 = domingo. En hora de Chile, que no siempre es el mismo día que en UTC. */
export function diaSemanaChile(d: Date = new Date()): number {
  const w = FMT_PARTES.formatToParts(d).find((p) => p.type === "weekday")?.value;
  return DIAS[w ?? "Mon"] ?? 1;
}

/** Lunes a viernes. El sábado tampoco: una cuenta activa el fin de semana llama la atención. */
export function esDiaHabil(d: Date = new Date()): boolean {
  const dia = diaSemanaChile(d);
  return dia >= 1 && dia <= 5;
}

export interface Ventana {
  inicio: number;
  fin: number;
}

/**
 * ¿Se puede enviar ahora?
 *
 * Día hábil y dentro de la ventana del emisor, en hora de Chile. Una cuenta que
 * manda mensajes a las 3 de la mañana es la firma de automatización más obvia
 * que existe, y no hace falta ningún modelo para detectarla.
 */
export function dentroDeVentana(v: Ventana, d: Date = new Date()): boolean {
  if (!esDiaHabil(d)) return false;
  const h = horaChile(d);
  return h >= v.inicio && h < v.fin;
}

/**
 * El siguiente día hábil a partir de `desde`, sumando `dias` hábiles.
 *
 * Los D+N de la secuencia son días HÁBILES, no corridos: un paso agendado a
 * D+2 desde un viernes cae el martes, no el domingo.
 */
export function sumarDiasHabiles(desde: Date, dias: number): Date {
  const d = new Date(desde);
  let restantes = Math.max(0, dias);
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (esDiaHabil(d)) restantes--;
  }
  // Si el punto de partida cae en fin de semana y no había días que sumar,
  // igual hay que correrlo: agendar para un domingo es agendar para nunca.
  while (!esDiaHabil(d)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/**
 * Coloca una fecha dentro de la ventana horaria, con jitter.
 *
 * El jitter no es cosmético. Una acción cada 90 segundos exactos, o siempre a
 * las 09:00:00, es un patrón que se ve en cualquier gráfico de actividad. Se
 * reparte el envío dentro de la ventana y se le suman minutos y segundos
 * arbitrarios.
 *
 * Se usa `Math.random` a propósito y a diferencia de la rotación de plantillas
 * del CRM de CDC, que es determinista: acá lo que se sortea es CUÁNDO, no QUÉ.
 * El "qué" hay que poder reconstruirlo para responder un reclamo; el "cuándo"
 * queda registrado en `programada_en` de todos modos.
 */
export function conJitter(dia: Date, v: Ventana): Date {
  const horas = Math.max(1, v.fin - v.inicio);
  const minutoDelDia = v.inicio * 60 + Math.floor(Math.random() * horas * 60);

  // Se construye la hora local de Chile y se convierte a UTC probando el
  // desfase real de ese día, que es lo único que sobrevive al cambio de hora.
  const ymd = fechaChile(dia);
  const [a, m, d] = ymd.split("-").map(Number);
  const tentativa = Date.UTC(a, m - 1, d, Math.floor(minutoDelDia / 60), minutoDelDia % 60, Math.floor(Math.random() * 60));

  // `tentativa` está en UTC como si fuera hora local; se corrige con el offset
  // que Chile tenga ese día concreto (−3 en verano, −4 en invierno).
  const sonda = new Date(tentativa);
  const offsetMin = desfaseChileMinutos(sonda);
  return new Date(tentativa + offsetMin * 60_000);
}

/**
 * Cuántos minutos hay que sumarle a una hora local de Chile para llegar a UTC.
 * Positivo porque Chile está al oeste: 180 en verano, 240 en invierno.
 *
 * En el día mismo del cambio de hora puede errar en 60 minutos, porque se
 * evalúa el desfase sobre una fecha tentativa. Es tolerable: el efecto es que un
 * mensaje sale una hora antes o después dentro de una ventana de nueve.
 */
export function desfaseChileMinutos(d: Date): number {
  return Math.round((d.getTime() - horaChileComoUtc(d)) / 60_000);
}

/** La hora de Chile de `d`, expresada como epoch UTC. Auxiliar de la anterior. */
function horaChileComoUtc(d: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce(
      (acc, x) => (x.type === "literal" ? acc : { ...acc, [x.type]: x.value }),
      {} as Record<string, string>,
    );

  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
}

/** Texto corto para la interfaz: `14:32` en hora de Chile. */
export function horaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export const ZONA_CHILE = ZONA;
