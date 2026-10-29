// El instrumento del levantamiento: los temas de la entrevista, los arquetipos
// de adopción y los niveles de madurez. Es la metodología de adoOps escrita una
// sola vez; la entrevista, el análisis y el back office la leen de acá.
//
// ── Los dos principios que la ordenan ────────────────────────────────────────
//
// 1. **Se pregunta qué haces, con qué frecuencia y sobre qué tareas.** No se le
//    pide a nadie que se autoevalúe ("¿cuánto sabes de IA?"): la gente se
//    sobrestima o se castiga, y ninguna de las dos sirve para decidir.
// 2. **Se clasifica por contenido, nunca por cómo suena la voz.** El tono, la
//    velocidad o el acento no entran al análisis. La Ley 21.719 regula los
//    perfiles y las decisiones automatizadas, y una clasificación que la
//    persona no puede leer ni discutir no se sostiene. Por eso cada arquetipo
//    viene con la cita textual que lo justifica, y la persona confirma su ficha.
//
// ── Por qué no hay arquetipo "Resistente" ────────────────────────────────────
//
// Los mockups lo tenían. Se sacó: quien desconfía de la IA suele estar cuidando
// algo —la calidad, un dato sensible, su equipo— y ese es el Guardián, un rol
// que el CoE necesita. La falta de uso ya la mide la madurez; ponerle además una
// etiqueta negativa a la persona solo sirve para que no conteste con honestidad.

// ── Cuatro temas y no seis ───────────────────────────────────────────────────
//
// La primera versión tenía seis (rol, día, lo que se repite, sistemas, IA,
// cambio) y en una demo se hacía larga: unos 10 minutos con repreguntas. Se
// fundieron de a pares los que se pisaban —el día normal ya cuenta el rol, y
// los sistemas salen solos al hablar de las tareas— y quedan cuatro, unos 5
// minutos. Lo que cada tema `busca` conserva lo de los dos originales, así que
// la repregunta y el análisis siguen pidiendo lo mismo.

export type TemaId = "rol" | "repite" | "ia" | "cambio";

export interface Tema {
  id: TemaId;
  titulo: string;
  /** Lo que el agente dice en voz alta. Corto: se escucha, no se lee. */
  pregunta: string;
  /** Ejemplos para destrabar a quien no sabe por dónde partir. Una línea. */
  ayuda: string;
  /** Qué tiene que quedar dicho. Guía la repregunta: si falta, se pregunta. */
  busca: string;
}

export const TEMAS: Tema[] = [
  {
    id: "rol",
    titulo: "Tu trabajo",
    pregunta: "Para partir, cuéntame cuál es tu cargo y cómo es una semana normal para ti: qué haces y qué es lo que más tiempo te quita.",
    ayuda: "Piensa en el lunes pasado.",
    busca: "cargo, área, si tiene personas a cargo, actividades concretas y cuál le consume más tiempo",
  },
  {
    id: "repite",
    titulo: "Lo que se repite",
    pregunta: "¿Qué tareas se repiten en tu semana, como informes, planillas o correos? ¿Cuánto tiempo te toman y en qué sistemas las haces?",
    ayuda: "Sirve una estimación: una hora al día, medio día a fin de mes.",
    busca: "tareas repetitivas con su frecuencia y tiempo, y los sistemas, planillas o herramientas que usa para hacerlas",
  },
  {
    id: "ia",
    titulo: "La IA hoy",
    pregunta: "¿Cuándo fue la última vez que usaste inteligencia artificial en tu trabajo? Cuéntame para qué, con qué herramienta y qué hiciste con el resultado.",
    ayuda: "Vale todo, incluso ChatGPT en el celular. Si no la usas, también es una respuesta.",
    busca: "herramienta concreta, frecuencia de uso, si es cuenta de la empresa o personal, qué datos le pasó y cómo revisó el resultado",
  },
  {
    id: "cambio",
    titulo: "El cambio",
    pregunta: "Por último, ¿cómo ves la llegada de la IA a tu trabajo? ¿Qué te entusiasma, qué te preocupa y qué ayuda pedirías para tu equipo?",
    ayuda: "Lo que preocupa es tan útil como lo que entusiasma.",
    busca: "postura frente al cambio, preocupaciones concretas y al menos una idea o pedido",
  },
];

export function temaPorId(id: string): Tema | undefined {
  return TEMAS.find((t) => t.id === id);
}

// ─── Arquetipos ───────────────────────────────────────────────────────────────

export type CampoId = "hacer" | "conectar" | "decidir";

export interface Campo {
  id: CampoId;
  nombre: string;
  /** La ruta de formación que le corresponde, y qué entrega. */
  ruta: string;
  entregable: string;
}

export const CAMPOS: Campo[] = [
  { id: "hacer", nombre: "Hacer", ruta: "Productividad personal", entregable: "Kit de casos propios con el tiempo ahorrado medido" },
  { id: "conectar", nombre: "Conectar", ruta: "Casos y comunidad", entregable: "Cartera de casos del área y un piloto" },
  { id: "decidir", nombre: "Decidir", ruta: "Criterio y gobierno", entregable: "Caso de negocio y reglas de uso del área" },
];

export type ArquetipoId = "practico" | "automatizador" | "puente" | "referente" | "estratega" | "guardian";

export interface Arquetipo {
  id: ArquetipoId;
  nombre: string;
  campo: CampoId;
  /** Una línea: lo que la persona hace. */
  descripcion: string;
  /** Qué escuchar en la entrevista. Es la rúbrica que lee el modelo. */
  senales: string;
  /** Qué le aporta al CoE. */
  aporta: string;
}

export const ARQUETIPOS: Arquetipo[] = [
  {
    id: "practico",
    nombre: "Práctico",
    campo: "hacer",
    descripcion: "Usa la IA en tareas concretas de su día a día",
    senales: "Describe tareas puntuales donde usa o usaría IA (redactar, resumir, ordenar datos). Habla de su propio trabajo más que del proceso.",
    aporta: "Volumen de adopción y casos reales para los talleres.",
  },
  {
    id: "automatizador",
    nombre: "Automatizador",
    campo: "hacer",
    descripcion: "Convierte lo que repite en plantillas, flujos o asistentes",
    senales: "Menciona macros, fórmulas, plantillas, prompts guardados, Gems o automatizaciones que armó. Mide tiempos y busca no repetir.",
    aporta: "Constructores naturales de Gems y agentes de equipo.",
  },
  {
    id: "puente",
    nombre: "Puente",
    campo: "conectar",
    descripcion: "Traduce un problema de su área en un caso concreto",
    senales: "Describe un dolor con datos (horas, errores, volumen) y propone qué cambiar. Conecta su área con otras.",
    aporta: "Alimenta la cartera de casos con problemas bien formulados.",
  },
  {
    id: "referente",
    nombre: "Referente",
    campo: "conectar",
    descripcion: "Enseña a otros y contagia el uso",
    senales: "Cuenta que le muestra a su equipo, que le preguntan, que comparte lo que aprende o que pide formación para otros.",
    aporta: "Champions del CoE en su unidad.",
  },
  {
    id: "estratega",
    nombre: "Estratega",
    campo: "decidir",
    descripcion: "Piensa en rediseñar el proceso, no solo la tarea",
    senales: "Cuestiona por qué el proceso es así, propone eliminar pasos o cambiar quién hace qué. Mira el resultado del área, no su tarea.",
    aporta: "Patrocina casos de proceso y prioriza con criterio de negocio.",
  },
  {
    id: "guardian",
    nombre: "Guardián",
    campo: "decidir",
    descripcion: "Cuida la calidad, los datos, el riesgo y la norma",
    senales: "Le preocupa la confidencialidad, los errores de la IA, el cumplimiento o el impacto en su equipo. Pide reglas claras. Es un rol legítimo, no resistencia.",
    aporta: "Valida lineamientos y controles; evita que un caso escale mal.",
  },
];

export function arquetipoPorId(id: string): Arquetipo | undefined {
  return ARQUETIPOS.find((a) => a.id === id);
}

export function campoDe(a: ArquetipoId): Campo {
  const c = ARQUETIPOS.find((x) => x.id === a)!.campo;
  return CAMPOS.find((x) => x.id === c)!;
}

/** Los puntos que se reparten entre los arquetipos. Lo que importa es la proporción. */
export const PUNTOS_TOTALES = 60;

// ─── Madurez ──────────────────────────────────────────────────────────────────

export interface Nivel {
  n: 1 | 2 | 3 | 4 | 5;
  nombre: string;
  /** El criterio, observable: frecuencia y método, nunca autoevaluación. */
  criterio: string;
}

export const NIVELES: Nivel[] = [
  { n: 1, nombre: "Sin uso", criterio: "No usa IA en su trabajo, o la probó una vez." },
  { n: 2, nombre: "Exploración", criterio: "La usa de vez en cuando, sin método ni herramienta autorizada." },
  { n: 3, nombre: "Uso habitual", criterio: "La usa cada semana en tareas concretas y revisa lo que entrega." },
  { n: 4, nombre: "Uso avanzado", criterio: "La tiene integrada: prompts o plantillas propias y verificación con método." },
  { n: 5, nombre: "Construye", criterio: "Arma Gems, agentes o automatizaciones que usan otras personas." },
];

// ─── Lo que produce el análisis ──────────────────────────────────────────────

export type Solucion = "gemini" | "gem" | "agente_proceso" | "agente_datos" | "ninguna";

export const SOLUCIONES: Record<Solucion, string> = {
  gemini: "Gemini en Workspace",
  gem: "Gem de equipo",
  agente_proceso: "Agente de proceso",
  agente_datos: "Agente de datos",
  ninguna: "Sin solución de IA clara",
};

export interface TareaGia {
  tarea: string;
  frecuencia: string;
  /** Horas al mes. `null` si la persona no dio cómo estimarlo: no se inventa. */
  horasMes: number | null;
  sistemas: string[];
  solucion: Solucion;
  cita: string;
}

export interface EvidenciaGia {
  arquetipo: ArquetipoId;
  tema: TemaId;
  /** Lo que la persona dijo, textual. */
  cita: string;
  /** Por qué esa cita apunta a ese arquetipo. Una línea. */
  lectura: string;
}

export interface AnalisisGia {
  resumen: string;
  tareas: TareaGia[];
  usoIa: {
    herramientas: string[];
    frecuencia: string;
    /** true: cuenta de la empresa; false: personal; null: no lo dijo. */
    cuentaCorporativa: boolean | null;
    verificacion: string;
  };
  alertas: { tipo: "datos" | "herramienta" | "documentos" | "otro"; texto: string; cita: string }[];
  cambio: {
    postura: "entusiasta" | "abierta" | "cauta" | "preocupada";
    preocupaciones: string[];
    ideas: string[];
    cita: string;
  };
  perfil: {
    puntos: Record<ArquetipoId, number>;
    principal: ArquetipoId;
    potencial: ArquetipoId;
    madurez: 1 | 2 | 3 | 4 | 5;
    porQueMadurez: string;
    evidencias: EvidenciaGia[];
  };
  ruta: string;
}

/**
 * Normaliza el reparto a `PUNTOS_TOTALES` y elige principal y potencial.
 *
 * Se calcula acá y no se le cree al modelo: el modelo reparte puntos, pero el
 * principal es por definición el de más puntos. Si el modelo declarara otro, la
 * ficha diría una cosa y el gráfico otra.
 */
export function cerrarPerfil(crudos: Partial<Record<string, unknown>>): {
  puntos: Record<ArquetipoId, number>;
  principal: ArquetipoId;
  potencial: ArquetipoId;
} {
  const base = ARQUETIPOS.map((a) => {
    const v = Number(crudos[a.id]);
    return [a.id, Number.isFinite(v) && v > 0 ? v : 0] as const;
  });
  const suma = base.reduce((s, [, v]) => s + v, 0);
  const puntos = {} as Record<ArquetipoId, number>;
  if (suma === 0) {
    // Sin señales: reparto parejo. Mejor una ficha plana que una inventada.
    for (const a of ARQUETIPOS) puntos[a.id] = PUNTOS_TOTALES / ARQUETIPOS.length;
  } else {
    // Resto mayor: se redondea hacia abajo y los puntos que faltan van a las
    // fracciones más grandes. Redondear cada uno por su lado puede sumar 59 o
    // 61, y dejarle el resto al último le daría puntos a un arquetipo sin
    // ninguna señal.
    const exactos = base.map(([id, v]) => ({ id, x: (v / suma) * PUNTOS_TOTALES }));
    for (const e of exactos) puntos[e.id] = Math.floor(e.x);
    let falta = PUNTOS_TOTALES - exactos.reduce((s, e) => s + Math.floor(e.x), 0);
    for (const e of [...exactos].sort((a, b) => (b.x % 1) - (a.x % 1))) {
      if (falta <= 0) break;
      puntos[e.id] += 1;
      falta -= 1;
    }
  }
  const orden = [...ARQUETIPOS].sort((a, b) => puntos[b.id] - puntos[a.id]);
  return { puntos, principal: orden[0].id, potencial: orden[1].id };
}

export const GERENCIAS = ["Operaciones", "Comercial", "Administración y Finanzas", "Personas"] as const;
