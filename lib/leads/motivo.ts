// Por qué una acción no sale. **Una sola descripción, para todo el sistema.**
//
// Ninguna pantalla escribe este texto a mano. El panel, el detalle del prospecto
// y el log del cron leen la misma función, y por eso no pueden contradecirse.
//
// La lección viene del CRM de CDC: la bandeja tenía el cartel "Envío
// deshabilitado" escrito fijo en el JSX. Resultó cierto por casualidad mientras
// todo estaba apagado, y habría mentido apenas se encendiera el envío. Acá el
// costo de esa mentira es peor, porque quien aprueba un lote lo aprueba leyendo
// que va a salir.
//
// ── El orden de los candados es parte del contrato ───────────────────────────
//
// Se evalúan 1 → 2 → 3 → 4 y se devuelve el PRIMERO que frena. Nunca al revés:
// consultar la cuota antes de mirar el opt-out significa gastar una consulta
// —y, peor, razonar sobre cupo— para alguien a quien no se le puede escribir.

/** El tope de toques es transversal a los tres canales, no por canal. */
export const MAX_TOQUES = 5;

/** Bajo este piso de aceptación a 7 días el emisor se frena solo. */
export const PISO_ACEPTACION = 25;

export type Candado = 1 | 2 | 3 | 4;

export interface Freno {
  /** `null` cuando el descarte ocurre antes de la cola, no en un candado. */
  candado: Candado | null;
  /** Clave estable. Es lo que se guarda en `lead_acciones.motivo`. */
  tipo: string;
  /** Una línea, en castellano, lista para pintar. */
  texto: string;
  /** Qué lo desbloquea. Vacío cuando no hay nada que hacer y está bien así. */
  desbloquea: string;
  /** Cuándo tiene sentido reintentar. Para la última columna de la banda C. */
  reintenta: "hoy" | "manana" | "manual" | "nunca";
}

export interface AccionAEvaluar {
  id: number;
  personaId: number;
  tipo: string;
  canal: string;
  emisorId: number | null;
  estado: string;
  pasoActual: number;
  toquesTotales: number;
  inscripcionEstado: string;
  personaSuprimidaEn: Date | null;
  personaSuprimidaMotivo: string | null;
  senalVenceEn: Date | null;
  campanaEstado: string;
  campanaSimulada: boolean;
  aprobadaEn: Date | null;
}

export interface EmisorEnContexto {
  id: number;
  identificador: string;
  estado: string;
  cuotaDiaria: number;
  usadosHoy: number;
  ventanaInicio: number;
  ventanaFin: number;
  tasaAceptacion7d: number | null;
  dentroDeVentana: boolean;
}

export interface ContextoDespacho {
  ahora: Date;
  /** El interruptor general del motor. Sin él no sale nada, de ninguna campaña. */
  motorEncendido: boolean;
  emisores: Map<number, EmisorEnContexto>;
}

// ─── Catálogo ────────────────────────────────────────────────────────────────
//
// Los frenos viven en un objeto y no como strings sueltos por el código: es lo
// que permite que la banda C agrupe por `tipo` y que el texto se corrija en un
// solo lugar.

const F = {
  sinAprobar: (): Freno => ({
    candado: 1,
    tipo: "sin_aprobar",
    texto: "Esperando aprobación del lote",
    desbloquea: "Aprobar desde el panel",
    reintenta: "hoy",
  }),
  optOut: (motivo: string | null): Freno => ({
    candado: 2,
    tipo: "opt_out",
    texto: motivo ? `Suprimido · ${motivo}` : "Suprimido · oposición registrada",
    desbloquea: "Nada, y es definitivo",
    reintenta: "nunca",
  }),
  yaRespondio: (): Freno => ({
    candado: 2,
    tipo: "ya_respondio",
    texto: "Respondió · salió de la automatización",
    desbloquea: "Está en la bandeja esperando a una persona",
    reintenta: "nunca",
  }),
  topeToques: (): Freno => ({
    candado: 2,
    tipo: "tope_toques",
    texto: `Alcanzó los ${MAX_TOQUES} toques · supresión`,
    desbloquea: "Nada. Más que eso es hostigamiento y no convierte",
    reintenta: "nunca",
  }),
  inscripcionCerrada: (estado: string): Freno => ({
    candado: 2,
    tipo: "inscripcion_cerrada",
    texto: `La inscripción está en "${estado}"`,
    desbloquea: "Reinscribir manualmente si corresponde",
    reintenta: "manual",
  }),
  sinSenal: (): Freno => ({
    candado: null,
    tipo: "sin_senal",
    texto: "Sin señal vigente",
    desbloquea: "Vuelve solo cuando entre una señal nueva de esa empresa",
    reintenta: "manual",
  }),
  motorApagado: (): Freno => ({
    candado: 3,
    tipo: "motor_apagado",
    texto: "Interruptor general apagado",
    desbloquea: "Encender el motor en el panel",
    reintenta: "hoy",
  }),
  campanaInactiva: (estado: string): Freno => ({
    candado: 3,
    tipo: "campana_inactiva",
    texto: `La campaña está en "${estado}"`,
    desbloquea: "Activar la campaña",
    reintenta: "manual",
  }),
  simulado: (): Freno => ({
    candado: 3,
    tipo: "simulado",
    texto: "Modo simulado · corta antes de la red",
    desbloquea: "Apagar el simulado de la campaña, con el emisor ya conectado",
    reintenta: "manual",
  }),
  sinEmisor: (): Freno => ({
    candado: 4,
    tipo: "sin_emisor",
    texto: "La acción no tiene emisor asignado",
    desbloquea: "Asignar un emisor a la campaña",
    reintenta: "manual",
  }),
  emisorPausado: (estado: string): Freno => ({
    candado: 4,
    tipo: "emisor_pausado",
    texto: `Emisor en estado "${estado}"`,
    desbloquea: "Revisar la cuenta y reactivarla a mano",
    reintenta: "manual",
  }),
  emisorFrenado: (tasa: number): Freno => ({
    candado: 4,
    tipo: "emisor_frenado",
    texto: `Aceptación 7d ${tasa}% · bajo el piso de ${PISO_ACEPTACION}%`,
    desbloquea: "Reescribir el primer toque y reanudar a mano",
    reintenta: "manual",
  }),
  sinCupo: (usados: number, cuota: number): Freno => ({
    candado: 4,
    tipo: "sin_cupo",
    texto: `Cuota diaria agotada (${usados} de ${cuota})`,
    desbloquea: "Nada. Es el pacing haciendo su trabajo",
    reintenta: "manana",
  }),
  fueraDeVentana: (v: { inicio: number; fin: number }): Freno => ({
    candado: 4,
    tipo: "fuera_ventana",
    texto: `Fuera de la ventana ${v.inicio}:00–${v.fin}:00 de Chile`,
    desbloquea: "Nada. Una cuenta activa de madrugada se delata sola",
    reintenta: "manana",
  }),
} as const;

export const FRENOS = F;

// ─── La evaluación ───────────────────────────────────────────────────────────

/**
 * `null` significa que la acción sale. Cualquier otra cosa se escribe en
 * `lead_acciones.motivo` y aparece en la banda C con su candado.
 *
 * **Un freno nunca consume cupo.** Por eso el candado 4 —el único que mira la
 * cuota— es el último: si el orden se invirtiera, el emisor perdería turnos por
 * gente a la que nunca le escribió, y el síntoma sería "hoy salieron menos de
 * los que decía el panel".
 */
export function evaluarFreno(a: AccionAEvaluar, ctx: ContextoDespacho): Freno | null {
  // ── Candado 1 · aprobación humana, por lote ──
  if (a.estado !== "aprobada" || !a.aprobadaEn) return F.sinAprobar();

  // ── Candado 2 · nadie que haya dicho que no, ni que ya haya contestado ──
  if (a.personaSuprimidaEn) return F.optOut(a.personaSuprimidaMotivo);
  if (a.inscripcionEstado === "respondio" || a.inscripcionEstado === "calificado") {
    return F.yaRespondio();
  }
  if (a.toquesTotales >= MAX_TOQUES) return F.topeToques();
  if (!["pendiente", "invitado", "conectado", "en_secuencia"].includes(a.inscripcionEstado)) {
    return F.inscripcionCerrada(a.inscripcionEstado);
  }
  // La señal solo se exige en el primer toque. Pedirla en el paso 3 dejaría a
  // media conversación colgada porque venció un hecho de hace un mes, y a esa
  // altura el vínculo ya existe: lo que justifica escribir es la conversación.
  if (a.pasoActual === 0) {
    if (!a.senalVenceEn || a.senalVenceEn <= ctx.ahora) return F.sinSenal();
  }

  // ── Candado 3 · interruptores ──
  if (!ctx.motorEncendido) return F.motorApagado();
  if (a.campanaEstado !== "activa") return F.campanaInactiva(a.campanaEstado);
  if (a.campanaSimulada) return F.simulado();

  // ── Candado 4 · cuota, ventana y salud del emisor ──
  if (!a.emisorId) return F.sinEmisor();
  const e = ctx.emisores.get(a.emisorId);
  if (!e) return F.sinEmisor();

  if (e.estado === "pausado" || e.estado === "restringido") return F.emisorPausado(e.estado);
  if (typeof e.tasaAceptacion7d === "number" && e.tasaAceptacion7d < PISO_ACEPTACION) {
    return F.emisorFrenado(e.tasaAceptacion7d);
  }
  if (!e.dentroDeVentana) return F.fueraDeVentana({ inicio: e.ventanaInicio, fin: e.ventanaFin });
  if (e.usadosHoy >= e.cuotaDiaria) return F.sinCupo(e.usadosHoy, e.cuotaDiaria);

  return null;
}

/**
 * Reconstruye el freno a partir del `tipo` guardado, para pintar la banda C sin
 * volver a evaluar nada. Los textos con cifras adentro —cuota, aceptación— se
 * guardan completos en la columna `motivo`, así que acá solo se necesita el
 * resto de la ficha.
 */
export function fichaDeFreno(tipo: string): Pick<Freno, "candado" | "desbloquea" | "reintenta"> {
  const muestras: Record<string, Freno> = {
    sin_aprobar: F.sinAprobar(),
    opt_out: F.optOut(null),
    ya_respondio: F.yaRespondio(),
    tope_toques: F.topeToques(),
    inscripcion_cerrada: F.inscripcionCerrada("—"),
    sin_senal: F.sinSenal(),
    motor_apagado: F.motorApagado(),
    campana_inactiva: F.campanaInactiva("—"),
    simulado: F.simulado(),
    sin_emisor: F.sinEmisor(),
    emisor_pausado: F.emisorPausado("—"),
    emisor_frenado: F.emisorFrenado(0),
    sin_cupo: F.sinCupo(0, 0),
    fuera_ventana: F.fueraDeVentana({ inicio: 9, fin: 18 }),
  };
  const f = muestras[tipo];
  return f
    ? { candado: f.candado, desbloquea: f.desbloquea, reintenta: f.reintenta }
    : { candado: null, desbloquea: "—", reintenta: "manual" };
}
