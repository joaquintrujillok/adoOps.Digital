// El instrumento de Pulso IA: preguntas, puntaje y cuadrantes.
//
// Puro (sin base ni servidor) porque lo usan las tres pantallas: el celular de
// quien responde, la pantalla proyectada y el panel. Cambiar una opción acá la
// cambia en todas.
//
// Las preguntas salen del AI Adoption Framework de la web (/framework): lo que
// aparece en el mapa tiene que poder conversarse con lo que Nelson cuenta
// después. El tono es blando a propósito: es una sala, no un formulario de venta.

export type Cuadrante = "observador" | "curioso" | "practico" | "impulsor";

export interface Opcion {
  valor: string;
  texto: string;
}

export const USO: Opcion[] = [
  { valor: "0", texto: "Todavía no la uso" },
  { valor: "1", texto: "La he probado alguna vez" },
  { valor: "2", texto: "Varias veces por semana" },
  { valor: "3", texto: "Todos los días" },
];

export const FRENOS: Opcion[] = [
  { valor: "por_donde", texto: "No sé por dónde partir" },
  { valor: "tiempo", texto: "No tengo tiempo para aprender" },
  { valor: "permiso", texto: "No sé si está permitido" },
  { valor: "confianza", texto: "No confío en lo que responde" },
  { valor: "nada", texto: "Nada, ya la uso a diario" },
];

export const ROLES: Opcion[] = [
  { valor: "gerencia", texto: "Gerencia" },
  { valor: "jefatura", texto: "Jefatura" },
  { valor: "profesional", texto: "Equipo profesional" },
  { valor: "operacion", texto: "Operación" },
];

/** Escala de la expectativa: 1 a 5. */
export const EXPECTATIVA = [
  { valor: 1, texto: "Casi nada" },
  { valor: 2, texto: "Poco" },
  { valor: 3, texto: "Algo" },
  { valor: 4, texto: "Bastante" },
  { valor: 5, texto: "Lo va a transformar" },
];

export const PREGUNTAS_INICIO = [
  { clave: "uso", titulo: "¿Con qué frecuencia usas IA en tu trabajo?" },
  { clave: "tarea", titulo: "¿Qué tarea de tu semana te gustaría no volver a hacer a mano?" },
  { clave: "freno", titulo: "¿Qué es lo que más te frena hoy?" },
  { clave: "expectativa", titulo: "¿Cuánto va a cambiar tu trabajo la IA en los próximos 12 meses?" },
  { clave: "rol", titulo: "¿Desde dónde lo miras?" },
] as const;

export const PREGUNTAS_CIERRE = [
  { clave: "expectativaCierre", titulo: "Después de esta charla: ¿cuánto va a cambiar tu trabajo la IA en 12 meses?" },
  { clave: "frenoCierre", titulo: "Y ahora, ¿qué es lo que más te frena?" },
] as const;

export const CUADRANTES: Record<
  Cuadrante,
  { nombre: string; lema: string; lectura: string; siguiente: string }
> = {
  observador: {
    nombre: "Observador",
    lema: "Mira con calma antes de moverse",
    lectura:
      "Todavía no ves la IA en tu día a día y no esperas un gran cambio. Es un punto de partida muy común, y el más fácil de mover con un primer caso cercano.",
    siguiente:
      "Elige una tarea repetitiva de tu semana —un resumen, un correo tipo— y pruébala una sola vez con un asistente. El objetivo no es adoptar: es tener una opinión propia.",
  },
  curioso: {
    nombre: "Curioso",
    lema: "Ve el cambio venir y quiere entrar",
    lectura:
      "Esperas que la IA cambie bastante tu trabajo, pero aún no la usas con frecuencia. La distancia entre lo que imaginas y lo que haces es tu mayor oportunidad.",
    siguiente:
      "Convierte la tarea que nombraste en un experimento de una semana: misma tarea, con y sin IA, y anota cuánto tiempo te ahorró.",
  },
  practico: {
    nombre: "Práctico",
    lema: "Ya la usa, sin ruido",
    lectura:
      "Usas IA con frecuencia, pero no esperas que transforme tu trabajo. Probablemente la tienes como una herramienta más: útil, acotada y bajo control.",
    siguiente:
      "El siguiente salto no es usarla más, es usarla en equipo: documenta lo que te funciona para que otros lo repitan.",
  },
  impulsor: {
    nombre: "Impulsor",
    lema: "La usa y empuja a otros",
    lectura:
      "Usas IA a menudo y esperas que cambie mucho tu trabajo. En tu organización eres de las personas que pueden mover a los demás.",
    siguiente:
      "Busca un proceso completo —no una tarea suelta— donde la IA pueda medirse en horas o en errores evitados. Ese es el caso que convence a una gerencia.",
  },
};

/** Uso 0–3 → 0–100. Eje X del mapa. */
export function ejeUso(uso: number): number {
  return Math.round((Math.max(0, Math.min(3, uso)) / 3) * 100);
}

/** Expectativa 1–5 → 0–100. Eje Y del mapa. */
export function ejeExpectativa(e: number): number {
  return Math.round(((Math.max(1, Math.min(5, e)) - 1) / 4) * 100);
}

/**
 * El corte va al medio de cada eje: uso desde "varias veces por semana" y
 * expectativa desde "bastante". "Algo" (3) cae abajo: quien responde algo no
 * está esperando un cambio, está siendo cortés.
 */
export function cuadranteDe(uso: number, expectativa: number): Cuadrante {
  const usa = uso >= 2;
  const espera = expectativa >= 4;
  if (usa && espera) return "impulsor";
  if (usa) return "practico";
  if (espera) return "curioso";
  return "observador";
}

export function textoDe(opciones: Opcion[], valor: string | null | undefined): string {
  return opciones.find((o) => o.valor === valor)?.texto ?? "—";
}

/**
 * Las respuestas son discretas (4 niveles de uso × 5 de expectativa), así que
 * cada combinación es una celda con su centro fijo, y quienes caen en la misma
 * celda se reparten en espiral (ángulo áureo) alrededor de él. Nadie tapa a
 * nadie y el tamaño del grupo se lee a simple vista. El corte entre cuadrantes
 * queda en 50 en ambos ejes, igual que `cuadranteDe()`.
 */
const CENTRO_X = [12, 34, 66, 88];
const CENTRO_Y = [9, 23, 37, 66, 88];

export function posicion(uso: number, expectativa: number, k: number): { x: number; y: number } {
  const cx = CENTRO_X[Math.max(0, Math.min(3, uso))];
  const cy = CENTRO_Y[Math.max(1, Math.min(5, expectativa)) - 1];
  if (k === 0) return { x: cx, y: cy };
  const r = 2.6 * Math.sqrt(k);
  const t = k * 2.39996;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // No cruza la línea del cuadrante: el punto siempre se lee del lado correcto.
  const x = cx < 50 ? clamp(cx + r * Math.cos(t), 2, 48) : clamp(cx + r * Math.cos(t), 52, 98);
  const y = cy < 50 ? clamp(cy + r * Math.sin(t), 2, 48) : clamp(cy + r * Math.sin(t), 52, 98);
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// ─── Lo que viaja a las pantallas públicas ───────────────────────────────────

/** Un punto del mapa. Sin nombre ni contacto: la pantalla nunca muestra quién es quién. */
export interface PuntoMapa {
  id: number;
  x: number;
  y: number;
  rol: string;
  cuadrante: Cuadrante;
  /** Si ya respondió el cierre: dónde quedó su expectativa. */
  yCierre: number | null;
}

export interface EstadoSala {
  codigo: string;
  titulo: string;
  organizacion: string;
  relator: string;
  fase: "inicio" | "cierre" | "cerrada";
  total: number;
  conCierre: number;
  puntos: PuntoMapa[];
  cuadrantes: Record<Cuadrante, number>;
  frenos: { valor: string; texto: string; inicio: number; cierre: number }[];
  expectativaInicio: number | null;
  expectativaCierre: number | null;
  /** Las palabras que más se repiten en "qué tarea no volverías a hacer a mano". */
  palabras: { palabra: string; n: number }[];
  /** Las últimas tareas tal como las escribieron, para el ticker. */
  tareas: string[];
}

// ─── Palabras de las tareas ──────────────────────────────────────────────────

const VACIAS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes aqui asi aun cada como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa esas ese eso esos esta estan estas este esto estos fue ha hace hacer hacen hay la las le les lo los mas me mi mis mucho muy no nos nosotros o otra otras otro otros para pero poco por porque que se ser si sin sobre son su sus tambien tan tanto te tener tengo todo todos tu un una uno unos y ya yo mano manos semana tarea tareas cosas cosa hago hacerlo todas dia dias trabajo"
  ).split(" "),
);

function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Frecuencia de palabras con contenido. Sin IA: corre en cada lectura y no cuesta nada. */
export function palabrasFrecuentes(textos: string[], max = 18): { palabra: string; n: number }[] {
  const cuenta = new Map<string, { palabra: string; n: number }>();
  for (const t of textos) {
    const vistas = new Set<string>();
    for (const cruda of t.toLowerCase().split(/[^a-záéíóúñü0-9]+/i)) {
      if (cruda.length < 4) continue;
      const clave = sinTildes(cruda).replace(/(es|s)$/, "");
      if (VACIAS.has(sinTildes(cruda)) || vistas.has(clave)) continue;
      vistas.add(clave);
      const actual = cuenta.get(clave);
      if (actual) actual.n++;
      else cuenta.set(clave, { palabra: cruda, n: 1 });
    }
  }
  return [...cuenta.values()].sort((a, b) => b.n - a.n).slice(0, max);
}

// ─── Casos por perfil ────────────────────────────────────────────────────────

/**
 * Los dos casos que recibe cada perfil en su correo. Los define Nelson: tienen
 * que ser contenido (qué se hizo y qué cambió), no producto, y sin marcas de
 * clientes. Mientras un perfil no tenga casos, el correo simplemente no muestra
 * esa sección: nunca se rellena con un caso inventado.
 */
export interface CasoPulso {
  titulo: string;
  resumen: string;
  /** PDF o página con el caso completo. */
  url?: string;
}

export const CASOS: Record<Cuadrante, CasoPulso[]> = {
  observador: [],
  curioso: [],
  practico: [],
  impulsor: [],
};
