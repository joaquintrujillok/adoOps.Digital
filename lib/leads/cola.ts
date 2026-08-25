// La cola del motor: qué está por salir, qué se frenó y cómo están los emisores.
//
// ══ La regla que sostiene este archivo ═══════════════════════════════════════
//
// **Los descartes van en el WHERE, no en memoria.**
//
// No es una preferencia de estilo. En el CRM de CDC la función equivalente
// pedía N candidatas, traía `N * 3` filas por margen, y filtraba el resto en
// JavaScript. Las descartadas encabezaban el orden —nunca se les marcaba nada—
// así que consumían el margen entero y el motor recibía una lista vacía
// mientras había candidatas más abajo.
//
// El resultado fueron **seis días sin mandar un solo mensaje**, con el cron
// corriendo cada dos minutos y respondiendo 200. El síntoma es engañoso: no se
// diagnostica mirando si el cron se ejecuta, se diagnostica mirando qué
// devuelve esta consulta.
//
// Todo lo que se pueda expresar en SQL va en el `WHERE`. Lo que no —el estado
// del emisor, que depende del reloj y de conteos del día— se evalúa después,
// pero sobre un conjunto que ya está limpio.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fechaChile, dentroDeVentana } from "./reloj";
import { NOMBRE_CARRIL, type Carril } from "./escalera";
import {
  evaluarFreno,
  fichaDeFreno,
  MAX_TOQUES,
  PISO_ACEPTACION,
  type ContextoDespacho,
  type EmisorEnContexto,
  type Freno,
} from "./motivo";
import { motorEncendido } from "./config";

// ─── Emisores ────────────────────────────────────────────────────────────────

export interface FilaEmisor extends EmisorEnContexto {
  tipo: string;
  diaWarmup: number;
  conectado: boolean;
  /** Cómo se pinta el chip: activo | sin cupo | frenado | fuera de horario | pausado. */
  resumen: string;
  tono: "ok" | "warn" | "risk";
}

export async function estadoEmisores(ahora = new Date()): Promise<FilaEmisor[]> {
  const hoy = fechaChile(ahora);

  // Los usados del día salen de las acciones efectivamente enviadas, no de un
  // contador aparte: un contador se desincroniza y nadie lo nota hasta que el
  // emisor manda de más.
  const filas = await db.execute<{
    id: number;
    tipo: string;
    identificador: string;
    unipile_account_id: string | null;
    cuota_diaria: number;
    dia_warmup: number;
    ventana_inicio: number;
    ventana_fin: number;
    tasa_aceptacion_7d: number | null;
    estado: string;
    usados_hoy: number;
  }>(sql`
    SELECT e.id, e.tipo, e.identificador, e.unipile_account_id,
           e.cuota_diaria, e.dia_warmup, e.ventana_inicio, e.ventana_fin,
           e.tasa_aceptacion_7d, e.estado,
           COALESCE(u.n, 0)::int AS usados_hoy
      FROM lead_emisores e
      LEFT JOIN (
        SELECT emisor_id, count(*)::int AS n
          FROM lead_acciones
         WHERE estado = 'enviada' AND fecha_chile = ${hoy}
         GROUP BY emisor_id
      ) u ON u.emisor_id = e.id
     ORDER BY e.tipo, e.id
  `);

  return filas.rows.map((r) => {
    const ventana = { inicio: r.ventana_inicio, fin: r.ventana_fin };
    const enVentana = dentroDeVentana(ventana, ahora);
    const frenado =
      typeof r.tasa_aceptacion_7d === "number" && r.tasa_aceptacion_7d < PISO_ACEPTACION;
    const sinCupo = r.usados_hoy >= r.cuota_diaria;
    const pausado = r.estado === "pausado" || r.estado === "restringido";

    const { resumen, tono } = pausado
      ? { resumen: r.estado, tono: "risk" as const }
      : frenado
        ? { resumen: "frenado", tono: "risk" as const }
        : sinCupo
          ? { resumen: "sin cupo", tono: "warn" as const }
          : !enVentana
            ? { resumen: "fuera de horario", tono: "warn" as const }
            : { resumen: r.estado === "warmup" ? "warm-up" : "activo", tono: "ok" as const };

    return {
      id: r.id,
      tipo: r.tipo,
      identificador: r.identificador,
      estado: r.estado,
      cuotaDiaria: r.cuota_diaria,
      usadosHoy: r.usados_hoy,
      diaWarmup: r.dia_warmup,
      ventanaInicio: r.ventana_inicio,
      ventanaFin: r.ventana_fin,
      tasaAceptacion7d: r.tasa_aceptacion_7d,
      dentroDeVentana: enVentana,
      conectado: Boolean(r.unipile_account_id),
      resumen,
      tono,
    };
  });
}

export async function contexto(ahora = new Date()): Promise<ContextoDespacho> {
  const [encendido, emisores] = await Promise.all([motorEncendido(), estadoEmisores(ahora)]);
  return {
    ahora,
    motorEncendido: encendido,
    emisores: new Map(emisores.map((e) => [e.id, e])),
  };
}

// ─── La cola ─────────────────────────────────────────────────────────────────

export interface FilaCola {
  id: number;
  inscripcionId: number;
  personaId: number;
  nombre: string;
  cargo: string | null;
  empresa: string | null;
  senalTipo: string | null;
  senalResumen: string | null;
  senalFechaHecho: Date | null;
  senalVenceEn: Date | null;
  carril: string;
  tipo: string;
  canal: string;
  emisor: string | null;
  paso: number;
  totalPasos: number;
  programadaEn: Date;
  estado: string;
  cuerpo: string | null;
  aprobadaEn: Date | null;
  campanaNombre: string;
  campanaSimulada: boolean;
}

/**
 * Las columnas que necesitan tanto la cola como el evaluador de frenos. Se
 * escriben una vez para que las dos consultas no se desincronicen.
 */
const SELECCION = sql`
  a.id, a.inscripcion_id, a.persona_id, a.tipo, a.canal, a.emisor_id,
  a.programada_en, a.fecha_chile, a.estado, a.cuerpo, a.aprobada_en, a.motivo,
  p.nombre, p.cargo, p.suprimido_en, p.suprimido_motivo,
  emp.razon_social,
  s.tipo AS senal_tipo, s.resumen AS senal_resumen,
  s.fecha_hecho AS senal_fecha_hecho, s.vence_en AS senal_vence_en,
  c.nombre AS campana_nombre, c.estado AS campana_estado, c.simulado AS campana_simulado,
  i.paso_actual, i.toques_totales, i.estado AS inscripcion_estado,
  em.identificador AS emisor_identificador,
  (SELECT count(*)::int FROM lead_secuencias sq WHERE sq.campana_id = c.id) AS total_pasos
`;

const DESDE = sql`
  FROM lead_acciones a
  JOIN lead_inscripciones i ON i.id = a.inscripcion_id
  JOIN lead_personas p ON p.id = a.persona_id
  JOIN lead_campanas c ON c.id = i.campana_id
  LEFT JOIN lead_empresas emp ON emp.id = p.empresa_id
  LEFT JOIN lead_senales s ON s.id = i.senal_id
  LEFT JOIN lead_emisores em ON em.id = a.emisor_id
`;

/**
 * Los descartes duros, en SQL. **Nada de esto se filtra después.**
 *
 * La señal se exige solo en el primer toque (`paso_actual = 0`): pedirla en el
 * paso 3 dejaría conversaciones a medias porque venció un hecho de hace un mes,
 * y a esa altura lo que justifica escribir es la conversación, no la señal.
 */
const DESCARTES = sql`
      p.suprimido_en IS NULL
  AND i.estado IN ('pendiente', 'invitado', 'conectado', 'en_secuencia')
  AND i.toques_totales < ${MAX_TOQUES}
  AND (
        i.paso_actual > 0
     OR (s.id IS NOT NULL AND s.estado = 'vigente' AND s.vence_en > NOW())
  )
`;

/**
 * Prioridad por señal. Una adjudicación tiene presupuesto detrás y una ventana
 * corta; una empresa nueva puede esperar. El orden secundario es la antigüedad
 * de la acción, para que nada quede al fondo indefinidamente.
 */
const ORDEN = sql`
  ORDER BY CASE s.tipo
             WHEN 'adjudicacion' THEN 1
             WHEN 'licitacion_publicada' THEN 2
             WHEN 'empresa_nueva' THEN 3
             ELSE 4
           END,
           a.programada_en ASC
`;

/* eslint-disable @typescript-eslint/no-explicit-any */
function aFilaCola(r: any): FilaCola {
  const carril = (r.tipo === "invitacion"
    ? "invitacion"
    : r.tipo === "inmail"
      ? "inmail_open"
      : r.tipo === "email"
        ? "email"
        : "dm") as Carril;

  return {
    id: r.id,
    inscripcionId: r.inscripcion_id,
    personaId: r.persona_id,
    nombre: r.nombre,
    cargo: r.cargo,
    empresa: r.razon_social,
    senalTipo: r.senal_tipo,
    senalResumen: r.senal_resumen,
    senalFechaHecho: r.senal_fecha_hecho ? new Date(r.senal_fecha_hecho) : null,
    senalVenceEn: r.senal_vence_en ? new Date(r.senal_vence_en) : null,
    carril: NOMBRE_CARRIL[carril],
    tipo: r.tipo,
    canal: r.canal,
    emisor: r.emisor_identificador,
    paso: (r.paso_actual ?? 0) + 1,
    totalPasos: r.total_pasos ?? 0,
    programadaEn: new Date(r.programada_en),
    estado: r.estado,
    cuerpo: r.cuerpo,
    aprobadaEn: r.aprobada_en ? new Date(r.aprobada_en) : null,
    campanaNombre: r.campana_nombre,
    campanaSimulada: Boolean(r.campana_simulado),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** La banda B: lo que está agendado para hoy y todavía puede salir. */
export async function colaDeHoy(ahora = new Date(), limite = 60): Promise<FilaCola[]> {
  const hoy = fechaChile(ahora);
  const r = await db.execute(sql`
    SELECT ${SELECCION} ${DESDE}
     WHERE a.estado IN ('pendiente', 'aprobada')
       AND a.fecha_chile <= ${hoy}
       AND ${DESCARTES}
     ${ORDEN}
     LIMIT ${limite}
  `);
  return r.rows.map(aFilaCola);
}

/**
 * La siguiente acción a despachar. **Una sola, y sin margen.**
 *
 * No se pide `limite * 3` para después filtrar: si un descarte no cabe en el
 * `WHERE`, no se compensa con margen — se arregla el `WHERE`.
 */
export async function proximaAccion(ahora = new Date()): Promise<FilaCola | null> {
  const r = await db.execute(sql`
    SELECT ${SELECCION} ${DESDE}
     WHERE a.estado = 'aprobada'
       AND a.programada_en <= ${ahora}
       AND ${DESCARTES}
     ${ORDEN}
     LIMIT 1
  `);
  return r.rows[0] ? aFilaCola(r.rows[0]) : null;
}

/** Igual que `proximaAccion`, pero con los datos que el evaluador de frenos pide. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function aAccionAEvaluar(r: FilaCola, crudo: any) {
  return {
    id: r.id,
    personaId: r.personaId,
    tipo: r.tipo,
    canal: r.canal,
    emisorId: crudo?.emisor_id ?? null,
    estado: r.estado,
    pasoActual: crudo?.paso_actual ?? 0,
    toquesTotales: crudo?.toques_totales ?? 0,
    inscripcionEstado: crudo?.inscripcion_estado ?? "pendiente",
    personaSuprimidaEn: crudo?.suprimido_en ? new Date(crudo.suprimido_en) : null,
    personaSuprimidaMotivo: crudo?.suprimido_motivo ?? null,
    senalVenceEn: r.senalVenceEn,
    campanaEstado: crudo?.campana_estado ?? "borrador",
    campanaSimulada: r.campanaSimulada,
    aprobadaEn: r.aprobadaEn,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── La banda C ──────────────────────────────────────────────────────────────

export interface FilaFrenada {
  motivo: string;
  tipo: string;
  cuantos: number;
  candado: number | null;
  desbloquea: string;
  reintenta: string;
  /** Un par de nombres, para que la fila no sea solo un número. */
  ejemplos: string[];
}

const REINTENTO: Record<string, string> = {
  hoy: "en el próximo tick",
  manana: "mañana",
  manual: "manual",
  nunca: "nunca",
};

/**
 * Lo que el motor frenó hoy, agrupado por motivo.
 *
 * Sale de `lead_acciones.motivo`, que escribe el tick. Es la mitad de la banda
 * C; la otra mitad —lo que ni siquiera llega a la cola— la da
 * `descartadasAntesDeLaCola()`.
 */
export async function frenadasDeHoy(ahora = new Date()): Promise<FilaFrenada[]> {
  const hoy = fechaChile(ahora);
  const r = await db.execute<{
    motivo: string;
    cuantos: number;
    ejemplos: string[];
  }>(sql`
    SELECT a.motivo,
           count(*)::int AS cuantos,
           (array_agg(p.nombre ORDER BY p.nombre))[1:3] AS ejemplos
      FROM lead_acciones a
      JOIN lead_personas p ON p.id = a.persona_id
     WHERE a.estado = 'frenada'
       AND a.fecha_chile = ${hoy}
       AND a.motivo IS NOT NULL
     GROUP BY a.motivo
     ORDER BY count(*) DESC
  `);

  return r.rows.map((f) => {
    const tipo = f.motivo.split(":")[0];
    const ficha = fichaDeFreno(tipo);
    return {
      motivo: f.motivo.includes(":") ? f.motivo.slice(tipo.length + 1) : f.motivo,
      tipo,
      cuantos: f.cuantos,
      candado: ficha.candado,
      desbloquea: ficha.desbloquea,
      reintenta: REINTENTO[ficha.reintenta] ?? ficha.reintenta,
      ejemplos: (f.ejemplos ?? []).filter(Boolean),
    };
  });
}

/**
 * Lo que el `WHERE` deja fuera, contado por razón.
 *
 * **Esta función es la que evita repetir el bug de los seis días.** Los
 * descartes duros son invisibles por definición: la consulta principal no los
 * devuelve. Sin contarlos aparte, un motor que no manda nada porque las 40
 * candidatas están suprimidas se ve exactamente igual que uno que no tiene nada
 * agendado.
 */
export async function descartadasAntesDeLaCola(ahora = new Date()): Promise<FilaFrenada[]> {
  const hoy = fechaChile(ahora);
  const r = await db.execute<{
    razon: string;
    cuantos: number;
    ejemplos: string[];
  }>(sql`
    SELECT CASE
             WHEN p.suprimido_en IS NOT NULL THEN 'opt_out'
             WHEN i.estado IN ('respondio', 'calificado') THEN 'ya_respondio'
             WHEN i.toques_totales >= ${MAX_TOQUES} THEN 'tope_toques'
             WHEN i.estado NOT IN ('pendiente','invitado','conectado','en_secuencia')
               THEN 'inscripcion_cerrada'
             ELSE 'sin_senal'
           END AS razon,
           count(*)::int AS cuantos,
           (array_agg(p.nombre ORDER BY p.nombre))[1:3] AS ejemplos
      FROM lead_acciones a
      JOIN lead_inscripciones i ON i.id = a.inscripcion_id
      JOIN lead_personas p ON p.id = a.persona_id
      LEFT JOIN lead_senales s ON s.id = i.senal_id
     WHERE a.estado IN ('pendiente', 'aprobada')
       AND a.fecha_chile <= ${hoy}
       AND NOT (${DESCARTES})
     GROUP BY 1
     ORDER BY count(*) DESC
  `);

  const TEXTO: Record<string, string> = {
    opt_out: "Suprimido · oposición u opt-out",
    ya_respondio: "Respondió · salió de la automatización",
    tope_toques: `Alcanzó los ${MAX_TOQUES} toques`,
    inscripcion_cerrada: "La inscripción ya está cerrada",
    sin_senal: "Sin señal vigente para el primer toque",
  };

  return r.rows.map((f) => {
    const ficha = fichaDeFreno(f.razon);
    return {
      motivo: TEXTO[f.razon] ?? f.razon,
      tipo: f.razon,
      cuantos: f.cuantos,
      candado: ficha.candado,
      desbloquea: ficha.desbloquea,
      reintenta: REINTENTO[ficha.reintenta] ?? ficha.reintenta,
      ejemplos: (f.ejemplos ?? []).filter(Boolean),
    };
  });
}

/** Las dos mitades de la banda C, en una sola lista ordenada por volumen. */
export async function bandaFrenados(ahora = new Date()): Promise<FilaFrenada[]> {
  const [frenadas, descartadas] = await Promise.all([
    frenadasDeHoy(ahora),
    descartadasAntesDeLaCola(ahora),
  ]);
  return [...frenadas, ...descartadas].sort((a, b) => b.cuantos - a.cuantos);
}

// ─── Evaluación en seco ──────────────────────────────────────────────────────

/**
 * Qué pasaría ahora mismo con cada acción de la cola, sin tocar nada.
 *
 * Es el `?simular=1` del CRM de CDC, pero permanente y en la pantalla principal.
 * Existe porque diagnosticar una cola mirando si el cron responde 200 no sirve:
 * el cron respondía 200 los seis días que no mandó nada.
 */
export async function simular(ahora = new Date()): Promise<
  Array<{ fila: FilaCola; freno: Freno | null }>
> {
  const ctx = await contexto(ahora);
  const hoy = fechaChile(ahora);

  const r = await db.execute(sql`
    SELECT ${SELECCION} ${DESDE}
     WHERE a.estado IN ('pendiente', 'aprobada')
       AND a.fecha_chile <= ${hoy}
       AND ${DESCARTES}
     ${ORDEN}
     LIMIT 60
  `);

  return r.rows.map((crudo) => {
    const fila = aFilaCola(crudo);
    return { fila, freno: evaluarFreno(aAccionAEvaluar(fila, crudo), ctx) };
  });
}
