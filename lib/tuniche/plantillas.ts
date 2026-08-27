// La sábana consolidada, en código.
//
// **De dónde sale.** De cruzar los tres archivos que mandaron Francisco y René
// (`docs/sistema_funcional/`). Ellos quedaron de consolidarlos entre los dos y
// no alcanzaron, así que la propuesta la hacemos nosotros y la confirman ellos.
// Cada campo declara `origen`: de qué columna de qué planilla viene. Un campo
// sin `origen` es un agregado nuestro, y son pocos a propósito — proponer
// columnas que nadie pidió es la forma más rápida de que una planilla no se use.
//
// **La separación que ordena todo.** Las dos planillas mezclan dos cosas que no
// se comportan igual:
//
//   · Hitos    — se llenan UNA VEZ, en su momento del ciclo. Fecha de
//                trasplante, población a 30 DDT, número de máquina de trilla.
//                En Altué esto ya vive en el SIA.
//   · Visita   — se llena CADA VEZ que alguien pisa el campo.
//
// René ya había hecho esa separación solo, al escribir su lista aparte al pie
// de la planilla ("En Todas las Visitas a campo"). Francisco no la escribió,
// pero su checklist por etapa es lo mismo con otro vocabulario.
//
// **El audio captura la visita, no los hitos.** Ese corte es el producto. Un
// audio que intentara llenar 37 columnas produciría 37 campos inventados.

import type { AreaId } from "./areas";

export type TipoCampo =
  | "texto"
  | "numero"
  | "porcentaje"
  | "fecha"
  | "opcion"
  | "opciones"
  | "fotos"
  | "lista";

export interface Campo {
  /** Identificador estable. Es la clave con la que se guarda la respuesta. */
  id: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Para `opcion` y `opciones`. El primer valor es el estado normal. */
  valores?: string[];
  /** Qué se le pide a la transcripción. Va literal al esquema de extracción. */
  ayuda?: string;
  /**
   * De qué columna de la planilla original viene. Es la trazabilidad de la
   * propuesta: sin esto, "consolidar" es indistinguible de "inventar".
   */
  origen?: { altue?: string; mn?: string };
}

// ─── Capa 2 · La visita ──────────────────────────────────────────────────────

/**
 * Lo que se llena **cada vez**, igual para las dos áreas.
 *
 * Es la lista que escribió René al pie de su sábana, más los dos matices que
 * Francisco pide en su etapa V2 (tipo de maleza) y en R5 (qué enfermedad).
 *
 * **La nota agronómica en % es el mejor aporte de las dos planillas** y por eso
 * se adopta para MN también, aunque Francisco no la tenga. Es el único campo que
 * permite comparar: la misma visita entre dos zonales distintos, y el mismo lote
 * entre marzo y julio. Sin un número, un historial es una pila de párrafos.
 */
export const VISITA: Campo[] = [
  {
    id: "etapa",
    etiqueta: "Etapa del cultivo",
    tipo: "opcion",
    ayuda: "En qué momento del ciclo está el lote. Los valores dependen del área.",
    origen: { altue: "(Época: Trasplante / Floración / Cosecha-Trilla)", mn: "Estado del cutivo" },
  },
  {
    id: "riego",
    etiqueta: "Estado del riego",
    tipo: "opcion",
    valores: ["bien", "a mejorar", "crítico", "no aplica (secano)"],
    ayuda: "Cómo está el riego. 'Crítico' si el cultivo está sufriendo por agua.",
    origen: { altue: "Estado Del Riego", mn: "Revisión riegos · Corte de riego según suelo" },
  },
  {
    id: "malezas_presion",
    etiqueta: "Presión de malezas",
    tipo: "opcion",
    valores: ["sin presión", "baja", "media", "alta"],
    origen: { altue: "Estado de Malezas", mn: "Presión de maleza" },
  },
  {
    id: "malezas_tipo",
    etiqueta: "Tipo de maleza",
    tipo: "opciones",
    valores: ["hoja ancha", "hoja angosta"],
    ayuda: "Solo si hay presión. Puede ser una, las dos, o ninguna si no se menciona.",
    origen: { mn: "Tipo de maleza (Hoja ancha o hoja angosta)" },
  },
  {
    id: "sanidad",
    etiqueta: "Sanidad del campo",
    tipo: "opcion",
    valores: ["sano", "en observación", "con problema"],
    origen: { altue: "Sanidad de Campo", mn: "Sanidad cultivo (fusarium, carbón)" },
  },
  {
    id: "sanidad_detalle",
    etiqueta: "Qué se observó",
    tipo: "texto",
    ayuda: "Plaga, enfermedad o daño concreto. Vacío si el campo está sano.",
    origen: { mn: "Presencia de insectos · Sanidad cultivo (fusarium, carbón)" },
  },
  {
    id: "nota_agronomica",
    etiqueta: "Nota agronómica",
    tipo: "porcentaje",
    ayuda: "De 0 a 100. Es la nota global del lote en esta visita.",
    origen: { altue: "Nota Agronómica en %", mn: "(se adopta de Altué)" },
  },
  {
    id: "fotos",
    etiqueta: "Fotos",
    tipo: "fotos",
    ayuda: "Altué pide general, de hembra y de macho. MN, las del recorrido o del dron.",
    origen: { altue: "Foto General, de Hembra y de Macho", mn: "Vuelo por drone" },
  },
  {
    id: "comentario",
    etiqueta: "Comentario",
    tipo: "texto",
    ayuda: "Lo que el zonal dijo y no cabe en ningún campo. Se guarda tal cual.",
    origen: { altue: "COMENTARIOS TRANSPLANTE / FLORACIÓN" },
  },
  {
    id: "proximas_acciones",
    etiqueta: "Próximas acciones",
    tipo: "lista",
    // No es un agregado gratuito: media checklist de Francisco son decisiones,
    // no observaciones ("definición control de maleza", "fecha estimada de
    // aporca", "estimación fecha de ensilaje para coordinar máquinas"). Sin un
    // lugar donde caigan, se pierden en el comentario libre.
    ayuda: "Lo que hay que hacer o decidir. Una línea por acción.",
    origen: {
      mn: "Definición control de maleza · Fecha estimada de aporca · Estimación fecha Ensilaje",
    },
  },
];

// ─── Capa 3 · Hitos por etapa ────────────────────────────────────────────────

export interface Etapa {
  id: string;
  nombre: string;
  /** Orden en el ciclo. Es lo que ordena el historial de un lote. */
  orden: number;
  /** Los hitos de esta etapa. Vacío si la etapa solo recibe visitas. */
  campos: Campo[];
}

/**
 * Las etapas **no se unifican entre áreas, y eso es deliberado.**
 *
 * MN mide en etapas fenológicas del maíz (V2, V4, R1…) y Altué en momentos de la
 * producción de semilla híbrida (trasplante, floración, trilla). Forzar una
 * tabla de equivalencias entre las dos produciría un mapeo que ningún agrónomo
 * de las dos áreas reconocería como suyo.
 *
 * Lo que **sí** se unifica es el nombre del campo —`etapa`— y su papel: decide
 * qué hitos se preguntan. Es exactamente lo que pidió Joaquín en la reunión:
 * mismo nombre para lo común, y que cada área sume los suyos.
 */
export const ETAPAS: Record<AreaId, Etapa[]> = {
  altue: [
    {
      id: "trasplante",
      nombre: "Trasplante",
      orden: 1,
      campos: [
        { id: "fecha_plantacion_hembra", etiqueta: "Fecha plantación hembra", tipo: "fecha", origen: { altue: "HEMBRA FECHA DE PLANTACION" } },
        { id: "fecha_plantacion_macho_1", etiqueta: "Fecha plantación macho 1", tipo: "fecha", origen: { altue: "MACHO 1 FECHA DE PLANTACION" } },
        { id: "fecha_plantacion_macho_2", etiqueta: "Fecha plantación macho 2", tipo: "fecha", origen: { altue: "MACHO 2 FECHA DE PLANTACION" } },
        { id: "establecimiento_hembra", etiqueta: "Establecimiento hembra 30 DDT (pl/ha)", tipo: "numero", origen: { altue: "ESTABLECIMIENTO HEMBRA (30 DDT) PL/HA" } },
        { id: "establecimiento_macho_1", etiqueta: "Establecimiento macho 1 30 DDT (pl/ha)", tipo: "numero", origen: { altue: "ESTABLECIMIENTO MACHO 1 (30 DDT) PL/HA" } },
        { id: "establecimiento_macho_2", etiqueta: "Establecimiento macho 2 30 DDT (pl/ha)", tipo: "numero", origen: { altue: "ESTABLECIMIENTO MACHO 2 (30 DDT) PL/HA" } },
      ],
    },
    {
      id: "floracion",
      nombre: "Floración",
      orden: 2,
      campos: [
        { id: "fecha_postura_abejas", etiqueta: "Fecha postura de abejas", tipo: "fecha", origen: { altue: "FECHA POSTURA ABEJAS" } },
        { id: "hembra_5", etiqueta: "Hembra 5% floración", tipo: "fecha", origen: { altue: "HEMBRA 5% FLORACION" } },
        { id: "hembra_50", etiqueta: "Hembra 50% floración", tipo: "fecha", origen: { altue: "HEMBRA 50% FLORACION" } },
        { id: "hembra_100", etiqueta: "Hembra 100% floración", tipo: "fecha", origen: { altue: "HEMBRA 100% FLORACION" } },
        { id: "macho_1_5", etiqueta: "Macho 1 5% floración", tipo: "fecha", origen: { altue: "MACHO 1 5% FLORACION" } },
        { id: "macho_1_50", etiqueta: "Macho 1 50% floración", tipo: "fecha", origen: { altue: "MACHO 1 50% FLORACION" } },
        { id: "macho_1_100", etiqueta: "Macho 1 100% floración", tipo: "fecha", origen: { altue: "MACHO 1 100% FLORACION" } },
        { id: "poblacion_hembra", etiqueta: "Población hembra (pl/ha)", tipo: "numero", origen: { altue: "POBLACION HEMBRA (PL/HA)" } },
        { id: "evaluacion_floracion", etiqueta: "Evaluación agronómica floración", tipo: "porcentaje", origen: { altue: "EVALUACION AGRONOMICA FLORACION (%)" } },
        { id: "nicking", etiqueta: "Evaluación de nicking", tipo: "texto", ayuda: "Sincronía entre la floración de hembra y macho.", origen: { altue: "EVALUACION NICKING" } },
      ],
    },
    {
      id: "cosecha_trilla",
      nombre: "Cosecha y trilla",
      orden: 3,
      campos: [
        { id: "poblacion_final", etiqueta: "Población final a cosecha", tipo: "numero", origen: { altue: "POBLACION FINAL A COSECHA" } },
        { id: "fecha_eliminacion_macho", etiqueta: "Fecha eliminación de macho", tipo: "fecha", origen: { altue: "FECHA ELIMINACION MACHO" } },
        { id: "fecha_inicio_cosecha", etiqueta: "Fecha inicio cosecha", tipo: "fecha", origen: { altue: "FECHA INICIO COSECHA" } },
        { id: "fecha_inicio_trilla", etiqueta: "Fecha inicio trilla", tipo: "fecha", origen: { altue: "FECHA INICIO TRILLA" } },
        { id: "numero_maquina", etiqueta: "Número de máquina", tipo: "texto", origen: { altue: "NUMERO DE MAQUINA" } },
        { id: "bolting_hembra", etiqueta: "Bolting hembra", tipo: "texto", origen: { altue: "HEMBRA BOLTING" } },
        { id: "bolting_macho", etiqueta: "Bolting macho", tipo: "texto", origen: { altue: "MACHO BOLTING" } },
        { id: "fecha_bolting", etiqueta: "Fecha de bolting", tipo: "fecha", origen: { altue: "FECHA BOLTING" } },
      ],
    },
  ],

  mn: [
    {
      id: "presiembra",
      nombre: "Presiembra",
      orden: 1,
      campos: [
        { id: "nota_preparacion_suelo", etiqueta: "Nota preparación de suelo", tipo: "porcentaje", origen: { mn: "Nota preparación suelo" } },
        { id: "compactacion_perfil", etiqueta: "Compactación del perfil de suelo", tipo: "texto", origen: { mn: "Compactación perfil del suelo" } },
        { id: "herbicida_presiembra", etiqueta: "Herbicida de presiembra definido", tipo: "texto", origen: { mn: "Definción herbicida presiembra" } },
        { id: "humedad_suelo", etiqueta: "Humedad de suelo", tipo: "texto", origen: { mn: "Humedad de suelo" } },
      ],
    },
    {
      id: "siembra",
      nombre: "Siembra",
      orden: 2,
      campos: [
        { id: "distancia_hileras", etiqueta: "Distancia entre hileras", tipo: "texto", origen: { mn: "1) Distancia entre hileras" } },
        { id: "distancia_pasadas", etiqueta: "Distancia entre pasadas (pega)", tipo: "texto", origen: { mn: "2) Distancia entre pasadas (Pega)" } },
        { id: "distancia_semilla_fertilizante", etiqueta: "Distancia semilla-fertilizante", tipo: "texto", origen: { mn: "3) Distancia semilla fertilizante" } },
        { id: "profundidad_semilla", etiqueta: "Profundidad de semilla", tipo: "texto", origen: { mn: "4) Profundidad semilla" } },
        { id: "poblacion_siembra", etiqueta: "Población", tipo: "numero", origen: { mn: "5) Población" } },
        { id: "dosis_fertilizante", etiqueta: "Dosis fertilizante/ha", tipo: "texto", origen: { mn: "6) Chequeo dosis fertilizante/ha" } },
      ],
    },
    {
      id: "emergencia",
      nombre: "Emergencia",
      orden: 3,
      campos: [
        { id: "dias_siembra_emergencia", etiqueta: "Días de siembra a emergencia", tipo: "numero", origen: { mn: "Días de siembra emergencia" } },
        { id: "color_plantas", etiqueta: "Color de plantas emergidas", tipo: "texto", origen: { mn: "Color plantas emergidas" } },
        { id: "plantas_emergidas", etiqueta: "N° de plantas emergidas", tipo: "numero", origen: { mn: "N de plantas emergidas" } },
      ],
    },
    {
      id: "v2",
      nombre: "V2",
      orden: 4,
      campos: [
        { id: "control_maleza_definido", etiqueta: "Control de maleza definido", tipo: "texto", ayuda: "Herbicidas post-emergentes a usar.", origen: { mn: "Definición control de maleza (Hercidas post emergentes a usar)" } },
      ],
    },
    {
      id: "v4",
      nombre: "V4",
      orden: 5,
      campos: [
        { id: "fecha_estimada_aporca", etiqueta: "Fecha estimada de aporca", tipo: "fecha", origen: { mn: "Fecha estimada de aporca" } },
        { id: "plantas_antes_aporca", etiqueta: "N° de plantas antes de la aporca", tipo: "numero", origen: { mn: "N Plantas antes de la aporta" } },
        { id: "altura_aporca", etiqueta: "Altura de aporca ideal", tipo: "texto", origen: { mn: "Altura de aporca ideal" } },
        { id: "desempeno_control_malezas", etiqueta: "Desempeño del control de malezas", tipo: "texto", origen: { mn: "Desempeño del control de malezas" } },
      ],
    },
    {
      id: "v6",
      nombre: "V6",
      orden: 6,
      campos: [
        { id: "plantas_post_aporca", etiqueta: "N° de plantas post aporca", tipo: "numero", origen: { mn: "Evaluación numero de plantas post aporca" } },
        { id: "primer_riego_post_aporca", etiqueta: "Primer riego post aporca", tipo: "texto", origen: { mn: "Evaluación primer riego post aporca" } },
      ],
    },
    {
      id: "v8",
      nombre: "V8",
      orden: 7,
      campos: [
        { id: "estimacion_floracion", etiqueta: "Fecha estimada de floración", tipo: "fecha", origen: { mn: "Estimación fecha de floración" } },
        { id: "mm_a_regar", etiqueta: "Milímetros a regar según pivote", tipo: "numero", origen: { mn: "Milímetros a regar según pivote" } },
      ],
    },
    {
      id: "r1",
      nombre: "R1",
      orden: 8,
      campos: [
        { id: "revision_ceda", etiqueta: "Revisión de ceda", tipo: "texto", origen: { mn: "Revisión ceda" } },
        { id: "mazorcas_potenciales", etiqueta: "Mazorcas potenciales", tipo: "texto", origen: { mn: "Revisión mazorcas potenciales" } },
        { id: "vuelo_drone", etiqueta: "Vuelo por dron realizado", tipo: "opcion", valores: ["no", "sí"], origen: { mn: "Vuelo por drone" } },
      ],
    },
    {
      id: "r5",
      nombre: "R5",
      orden: 9,
      campos: [
        { id: "corte_riego", etiqueta: "Corte de riego según suelo", tipo: "texto", origen: { mn: "Corte de riego según suelo" } },
        { id: "estimacion_ensilaje", etiqueta: "Fecha estimada de ensilaje", tipo: "fecha", ayuda: "Es la que sirve para coordinar máquinas.", origen: { mn: "Estimación fecha Ensilaje para coordinar máquinas" } },
        { id: "estimacion_cosecha_grano", etiqueta: "Fecha estimada de cosecha de grano", tipo: "fecha", origen: { mn: "Estimación fecha de cosecha de grano" } },
        { id: "altura_plantas", etiqueta: "Altura de plantas", tipo: "texto", origen: { mn: "Medición altura de plantas" } },
        { id: "humedad_grano", etiqueta: "Humedad de grano", tipo: "texto", origen: { mn: "Toma de humedad de grano" } },
        { id: "llenado_grano", etiqueta: "Llenado de grano", tipo: "texto", origen: { mn: "Revisión llenado de grano" } },
      ],
    },
  ],
};

export function etapasDe(area: AreaId): Etapa[] {
  return ETAPAS[area] ?? [];
}

export function etapaPorId(area: AreaId, id: string): Etapa | undefined {
  return etapasDe(area).find((e) => e.id === id);
}

/** Los valores que puede tomar `etapa` en un área. Alimenta el selector y la IA. */
export function valoresDeEtapa(area: AreaId): string[] {
  return etapasDe(area).map((e) => e.nombre);
}
