// Ritmo de salida de las campañas: lo que protege al número de Vanni de un
// bloqueo de WhatsApp por envío masivo.
//
// Los valores son los de la plataforma de funcionarios de la Muni de Paine
// (`WhatsAppRateLimitConfig`), que lleva meses mandando campañas por WaSender
// sin bloqueos. Allá viven en memoria de un servidor que no se apaga; acá cada
// función de Vercel vive aparte, así que todo se calcula desde la base: cuándo
// salió el último mensaje, cuántos en la última hora, cuántos en el día.
//
// Solo cuentan los envíos masivos reales (campaña y recordatorio). Las
// respuestas del bot a quien escribe no pasan por acá: contestar no es spam.

import { sql } from "drizzle-orm";
import { db } from "@/db";

export const RITMO = {
  /** Entre dos mensajes de texto. */
  separacionTextoMs: 15_000,
  /** Entre dos mensajes con imagen (15 s × 1,5, con piso de 25 s). */
  separacionImagenMs: 25_000,
  /** Mensajes seguidos antes de una pausa larga. */
  lote: 50,
  pausaLoteMs: 30 * 60_000,
  maxPorHora: 100,
  maxPorDia: 500,
  /** Hora de Chile. Domingo no se envía. */
  horario: { semana: { desde: 8, hasta: 20 }, sabado: { desde: 9, hasta: 14 } },
  /** Corte automático: en los últimos 5 min, al menos 5 errores y al menos 5 %. */
  corte: { ventanaMin: 5, minErrores: 5, porcentaje: 5 },
} as const;

const ZONA = "America/Santiago";

function horaChile(d: Date): { dia: number; hora: number } {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(d);
  const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.find((p) => p.type === "weekday")!.value);
  return { dia, hora: Number(partes.find((p) => p.type === "hour")!.value) };
}

function dentroDeHorario(d: Date): boolean {
  const { dia, hora } = horaChile(d);
  if (dia === 0) return false;
  const h = dia === 6 ? RITMO.horario.sabado : RITMO.horario.semana;
  return hora >= h.desde && hora < h.hasta;
}

/** El próximo instante dentro del horario, avanzando de a 15 minutos. */
function proximoHorario(desde: Date): Date {
  const t = new Date(desde);
  t.setUTCMinutes(Math.ceil(t.getUTCMinutes() / 15) * 15, 0, 0);
  for (let i = 0; i < 4 * 24 * 8 && !dentroDeHorario(t); i++) t.setTime(t.getTime() + 15 * 60_000);
  return t;
}

export type Turno = { ok: true } | { ok: false; hasta: Date; motivo: string };

/** Momentos de los envíos masivos reales, del más nuevo al más viejo (últimas 24 h). */
async function enviosRecientes(): Promise<Date[]> {
  const r = await db.execute(sql`
    select t from (
      select e.enviado_at as t from vanni_envios e
      where e.enviado_at > now() - interval '24 hours' and e.entrega is not null
      union all
      select e.recordatorio_at from vanni_envios e
      join vanni_contactos c on c.id = e.contacto_id
      where e.recordatorio_at > now() - interval '24 hours' and not c.ejemplo
    ) x order by t desc`);
  return (r.rows as { t: string | Date }[]).map((x) => new Date(x.t));
}

/**
 * ¿Puede salir un mensaje masivo ahora? Si no, hasta cuándo esperar y por qué.
 * Aplica, en orden: horario, tope diario, tope por hora, pausa de lote y
 * separación entre mensajes.
 */
export async function turnoDeEnvio(conImagen: boolean, ahora = new Date()): Promise<Turno> {
  if (!dentroDeHorario(ahora)) {
    return { ok: false, hasta: proximoHorario(ahora), motivo: "fuera de horario (L-V 8-20 h, sáb 9-14 h)" };
  }
  const envios = await enviosRecientes();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(ahora);
  const delDia = envios.filter((t) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(t) === hoy);
  if (delDia.length >= RITMO.maxPorDia) {
    const manana = new Date(ahora.getTime() + 24 * 3600_000);
    return { ok: false, hasta: proximoHorario(new Date(manana.setUTCHours(10, 0, 0, 0))), motivo: `tope de ${RITMO.maxPorDia} al día` };
  }
  const ultimaHora = envios.filter((t) => ahora.getTime() - t.getTime() < 3600_000);
  if (ultimaHora.length >= RITMO.maxPorHora) {
    const hasta = new Date(ultimaHora[ultimaHora.length - 1].getTime() + 3600_000);
    return { ok: false, hasta, motivo: `tope de ${RITMO.maxPorHora} por hora` };
  }
  // Lote: los últimos N envíos sin una pausa larga entre ellos.
  if (envios.length >= RITMO.lote) {
    const lote = envios.slice(0, RITMO.lote);
    const sinPausa = lote.every((t, i) => i === 0 || lote[i - 1].getTime() - t.getTime() < RITMO.pausaLoteMs);
    if (sinPausa) {
      const hasta = new Date(lote[0].getTime() + RITMO.pausaLoteMs);
      if (hasta > ahora) return { ok: false, hasta, motivo: `pausa de 30 min cada ${RITMO.lote} mensajes` };
    }
  }
  const ultimo = envios[0];
  const separacion = conImagen ? RITMO.separacionImagenMs : RITMO.separacionTextoMs;
  if (ultimo && ahora.getTime() - ultimo.getTime() < separacion) {
    return { ok: false, hasta: new Date(ultimo.getTime() + separacion), motivo: "separación entre mensajes" };
  }
  return { ok: true };
}

/**
 * ¿Hay que cortar? Muchos errores seguidos suelen ser WhatsApp frenando el
 * número: seguir insistiendo es la forma más rápida de que lo bloqueen.
 */
export async function hayQueCortar(): Promise<string | null> {
  const r = await db.execute(sql`
    select count(*) filter (where estado = 'error')::int as errores, count(*)::int as total
    from vanni_envios
    where tomado_at > now() - make_interval(mins => ${RITMO.corte.ventanaMin})
      and estado in ('enviado', 'error')`);
  const { errores, total } = r.rows[0] as { errores: number; total: number };
  if (errores >= RITMO.corte.minErrores && (errores / Math.max(total, 1)) * 100 >= RITMO.corte.porcentaje) {
    return `${errores} de ${total} envíos fallaron en ${RITMO.corte.ventanaMin} min`;
  }
  return null;
}

/**
 * Toma el turno de la cola por `ms`. Una sola función envía a la vez: sin esto,
 * el cron y una cadena corriendo juntos mandarían dos mensajes pegados.
 */
export async function tomarCola(dueno: string, ms: number): Promise<boolean> {
  const r = await db.execute(sql`
    insert into vanni_cola (id, ocupada_hasta, dueno) values (1, now() + make_interval(secs => ${ms / 1000}), ${dueno})
    on conflict (id) do update set ocupada_hasta = excluded.ocupada_hasta, dueno = excluded.dueno
    where vanni_cola.ocupada_hasta < now() or vanni_cola.dueno = ${dueno}
    returning id`);
  return r.rows.length > 0;
}

export async function soltarCola(dueno: string): Promise<void> {
  await db.execute(sql`update vanni_cola set ocupada_hasta = now() where id = 1 and dueno = ${dueno}`);
}

/** El ritmo en una frase, para mostrarlo en la campaña. */
export function describirRitmo(): string {
  return (
    `Sale un mensaje cada ${RITMO.separacionImagenMs / 1000} s con imagen (${RITMO.separacionTextoMs / 1000} s solo texto), ` +
    `pausa de 30 min cada ${RITMO.lote}, máximo ${RITMO.maxPorHora} por hora y ${RITMO.maxPorDia} al día, ` +
    `de lunes a viernes de 8 a 20 h y sábado de 9 a 14 h.`
  );
}
