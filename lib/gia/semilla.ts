// Valle Sur Alimentos: la empresa demo del levantamiento.
//
// **Ficticia y sembrada en código, no en la base.** Es el "caso de referencia"
// que se muestra en una reunión: 3 gerencias, 412 personas invitadas, 356
// entrevistas. Vive acá y no en tablas porque no cambia, no hay nada que
// borrar después de una demo, y así ninguna fila inventada puede mezclarse con
// las entrevistas reales que entran en vivo (esas sí están en `gia_*`).
//
// Las cifras son coherentes entre pantallas: la matriz suma 356, las rutas de
// formación suman 356, y los totales por nivel calzan con los de la matriz. Si
// cambias un número, revisa los que dependen de él.

import type { AnalisisGia, ArquetipoId } from "./modelo";

export const EMPRESA = {
  nombre: "Valle Sur Alimentos",
  rubro: "Lácteos y alimentos",
  cierre: "14-oct",
  invitados: 412,
  entrevistas: 356,
};

/** Arquetipo → personas por nivel de madurez (1 a 5). Suma 356. */
export const MATRIZ: Record<ArquetipoId, [number, number, number, number, number]> = {
  practico: [38, 52, 30, 8, 0],
  automatizador: [0, 3, 8, 12, 8],
  puente: [6, 14, 16, 7, 1],
  referente: [2, 6, 9, 8, 4],
  estratega: [4, 9, 8, 4, 1],
  guardian: [44, 30, 16, 6, 2],
};

export const KPIS = {
  tareas: 2913,
  repetitivas: 1204,
  horasRepetitivas: 7980,
  horasAutomatizables: 3150,
  casos: 47,
  quickWins: 9,
  madurezLineamientos: "1,6/5",
};

export const COBERTURA = [
  { gerencia: "Operaciones", entrevistas: 171, invitados: 190 },
  { gerencia: "Comercial", entrevistas: 104, invitados: 128 },
  { gerencia: "Administración y Finanzas", entrevistas: 81, invitados: 94 },
];

export const USO_IA = [
  { nombre: "Usa alguna IA en su trabajo", pct: 61, tono: "verde" },
  { nombre: "Usa Gemini con su cuenta de la empresa", pct: 29, tono: "azul" },
  { nombre: "Usa herramientas no autorizadas", pct: 38, tono: "ambar" },
  { nombre: "Ha ingresado datos sensibles a IA pública", pct: 22, tono: "rojo" },
] as const;

export const CULTURA = [
  { v: "72%", t: "pide reglas claras sobre qué se puede hacer con IA", q: "“Nadie nos ha dicho qué está permitido.”", tono: "verde" },
  { v: "64%", t: "no sabe dónde guardar ni cómo nombrar documentos compartidos", q: "“Cada uno tiene sus carpetas.”", tono: "azul" },
  { v: "44%", t: "ve la IA como una oportunidad para su trabajo", q: "“Me ahorraría la mañana del lunes.”", tono: "gris" },
  { v: "31%", t: "teme que la IA reemplace parte de su puesto", q: "“¿Y después para qué me van a necesitar?”", tono: "ambar" },
] as const;

export const HALLAZGOS = [
  { tag: "Valor", tono: "verde", texto: "El 40% de las horas repetitivas se concentra en 6 procesos: conciliación de facturas, informe de recepción, consultas de productores, órdenes de mantenimiento, reportes de sell-out y minutas de turno." },
  { tag: "Riesgo", tono: "rojo", texto: "78 personas declaran pegar datos de clientes, productores o remuneraciones en IA pública desde dispositivos personales." },
  { tag: "Gemini", tono: "azul", texto: "Gemini viene incluido en Workspace para todos, pero solo el 29% lo usa cada semana. El uso se concentra en Gmail y en notas de Meet." },
  { tag: "Personas", tono: "ambar", texto: "61 personas ya usan IA de forma avanzada o construyen por su cuenta: son los candidatos naturales a champions del CoE." },
  { tag: "Gobierno", tono: "morado", texto: "No hay política de uso aceptable, clasificación de datos para IA ni un canal para proponer casos de uso." },
] as const;

export type SolucionSemilla = "gemini" | "gem" | "agente_proceso" | "agente_datos";

/**
 * Los 8 procesos con más horas repetitivas. `ahorro` es lo que se estima
 * recuperar con la solución propuesta, en h/mes: suma 1.280 de las 3.150
 * automatizables de toda la empresa.
 */
export const PROCESOS: { p: string; u: string; g: string; n: number; h: number; ahorro: number; s: SolucionSemilla }[] = [
  { p: "Conciliación de facturas de proveedores", u: "Contabilidad", g: "Administración y Finanzas", n: 14, h: 420, ahorro: 290, s: "agente_proceso" },
  { p: "Informe diario de recepción y calidad", u: "Recepción", g: "Operaciones", n: 9, h: 310, ahorro: 220, s: "gem" },
  { p: "Consultas de productores (volúmenes y pagos)", u: "Relación con productores", g: "Operaciones", n: 11, h: 280, ahorro: 170, s: "agente_proceso" },
  { p: "Reportes de sell-out para trade", u: "Trade marketing", g: "Comercial", n: 8, h: 260, ahorro: 190, s: "agente_datos" },
  { p: "Órdenes de mantenimiento desde reportes de terreno", u: "Mantenimiento", g: "Operaciones", n: 17, h: 240, ahorro: 120, s: "agente_proceso" },
  { p: "Minutas y seguimiento de reuniones de turno", u: "Planta", g: "Operaciones", n: 42, h: 190, ahorro: 110, s: "gemini" },
  { p: "Respuesta a reclamos de clientes", u: "Servicio al cliente", g: "Comercial", n: 12, h: 170, ahorro: 90, s: "gem" },
  { p: "Validación de rendiciones de gastos", u: "Contabilidad", g: "Administración y Finanzas", n: 6, h: 130, ahorro: 90, s: "agente_proceso" },
];

/**
 * Las capas de agentización, de la más simple a la más integrada. Es el orden
 * en que se aborda: la capa 1 no necesita a TI; la 3 y la 4 sí.
 */
export const CAPAS: { s: SolucionSemilla; n: number; t: string; d: string; quien: string; tono: string }[] = [
  { s: "gemini", n: 1, t: "Gemini en Workspace", d: "Cada persona con el Gemini que ya tiene: correo, documentos, minutas.", quien: "La propia persona", tono: "azul" },
  { s: "gem", n: 2, t: "Gem de equipo", d: "Un asistente del área sobre sus documentos en Drive.", quien: "El área, registrado en el CoE", tono: "morado" },
  { s: "agente_proceso", n: 3, t: "Agente de proceso", d: "Cruza sistemas y ejecuta pasos: lee, digita, concilia.", quien: "CoE + TI y Seguridad", tono: "verde" },
  { s: "agente_datos", n: 4, t: "Agente de datos", d: "Consolida varias fuentes y arma el informe solo.", quien: "CoE + TI", tono: "ambar" },
];

// ─── Lo que se repite entre unidades ──────────────────────────────────────────
//
// Esto es lo que el levantamiento entrega además del perfil de cada persona: la
// misma tarea, hecha por separado en áreas que no se hablan. Cada una es un
// solo caso de uso que sirve a varias unidades a la vez.

export type CompartidaId = "consolidar" | "consultas" | "doble" | "minutas";

export const COMPARTIDAS: {
  id: CompartidaId;
  t: string;
  d: string;
  /** Horas al mes que cada unidad dedica a esta tarea. Suma `h`. */
  reparto: Record<string, number>;
  personas: number;
  h: number;
  solucion: SolucionSemilla;
  propuesta: string;
}[] = [
  { id: "consolidar", t: "Consolidar planillas de otras áreas en un informe", d: "Bajar archivos, copiarlos a Excel, cruzarlos y mandarlos por correo.", reparto: { Recepción: 310, "Laboratorio de calidad": 120, "Trade marketing": 260, "Gerencia comercial": 300 }, personas: 31, h: 990, solucion: "agente_datos", propuesta: "Un agente de datos común que lee las fuentes y arma cada informe." },
  { id: "doble", t: "Digitar dos veces lo mismo", d: "Lo que llega por WhatsApp, PDF o romana se vuelve a escribir en el ERP.", reparto: { Recepción: 140, Mantenimiento: 240, Abastecimiento: 90, Contabilidad: 290 }, personas: 37, h: 760, solucion: "agente_proceso", propuesta: "Un agente de proceso que toma el dato en su origen y lo registra una vez." },
  { id: "consultas", t: "Responder la misma consulta una y otra vez", d: "Volúmenes, pagos, estado de pedidos, liquidaciones: por WhatsApp y correo.", reparto: { "Relación con productores": 280, "Servicio al cliente": 170, Remuneraciones: 70 }, personas: 29, h: 520, solucion: "gem", propuesta: "Un asistente de consultas por área, con la misma base de conocimiento." },
  { id: "minutas", t: "Minutas y seguimiento de compromisos", d: "Escribir la minuta al final del día y perseguir los compromisos.", reparto: { Planta: 190, Mantenimiento: 60, Ventas: 60 }, personas: 64, h: 310, solucion: "gemini", propuesta: "Gemini en Meet con una plantilla de minuta común." },
];

/** A qué gerencia pertenece cada unidad del mapa de conexiones. */
export const GERENCIA_DE: Record<string, string> = {
  Recepción: "Operaciones",
  "Laboratorio de calidad": "Operaciones",
  Planta: "Operaciones",
  Mantenimiento: "Operaciones",
  Abastecimiento: "Operaciones",
  "Relación con productores": "Operaciones",
  Ventas: "Comercial",
  "Servicio al cliente": "Comercial",
  "Trade marketing": "Comercial",
  "Gerencia comercial": "Comercial",
  Contabilidad: "Administración y Finanzas",
  Remuneraciones: "Personas",
};

// ─── El flujo entre unidades ──────────────────────────────────────────────────
//
// Como el flujo del levantamiento del JPL: cómo se mueve el trabajo hoy, según
// lo contaron las personas. Cada paso dice quién lo hace y qué entrega al
// siguiente; en rojo, lo que hoy se resuelve a mano, con la cita de quien lo
// dijo. Las etiquetas de `compartidas` son las que se iluminan al elegir una
// tarea repetida: así se ve que la misma tarea cruza unidades que no se hablan.

export interface PasoFlujo {
  unidad: string;
  gerencia: string;
  externa?: boolean;
  personas?: number;
  hace: string;
  manual?: { texto: string; cita?: string; quien: string };
  compartidas: CompartidaId[];
  /** Lo que este paso le entrega al siguiente. */
  entrega?: string;
}

export const FLUJOS: { id: string; t: string; d: string; pasos: PasoFlujo[] }[] = [
  {
    id: "leche",
    t: "La leche: de la recepción al pago",
    d: "Del camión en la romana a la liquidación del productor.",
    pasos: [
      { unidad: "Productores", gerencia: "Externo", externa: true, hace: "Entregan la leche dos veces al día.", manual: { texto: "Preguntan por WhatsApp cuánto entregaron y cuándo se les paga.", quien: "Relación con productores, P1" }, compartidas: ["consultas"], entrega: "leche en la romana" },
      { unidad: "Recepción", gerencia: "Operaciones", personas: 9, hace: "Pesa, toma muestras y arma el informe diario.", manual: { texto: "Cruza la romana con las planillas del laboratorio en Excel: 1,5 h diarias.", cita: "Las cruzo a mano en Excel, como una hora y media diaria.", quien: "Carolina M., P2" }, compartidas: ["consolidar", "doble"], entrega: "muestras y planilla por correo" },
      { unidad: "Laboratorio de calidad", gerencia: "Operaciones", personas: 7, hace: "Analiza grasa, proteína y recuento.", manual: { texto: "Los resultados viven en una planilla que se reenvía por correo.", cita: "Lo mando por correo y cada uno lo copia a su Excel.", quien: "Analista de laboratorio, P2" }, compartidas: ["consolidar"], entrega: "resultados de calidad" },
      { unidad: "Relación con productores", gerencia: "Operaciones", personas: 11, hace: "Calcula la liquidación por volumen y calidad.", manual: { texto: "Responde una a una las consultas de volumen y pago: 280 h/mes.", quien: "Ejecutiva de productores, P2" }, compartidas: ["consultas"], entrega: "liquidación para pago" },
      { unidad: "Contabilidad", gerencia: "Administración y Finanzas", personas: 14, hace: "Paga a los productores y registra en el ERP.", manual: { texto: "Digita en el ERP lo que llega en PDF y lo concilia a mano.", quien: "Analista contable, P2" }, compartidas: ["doble"] },
    ],
  },
  {
    id: "venta",
    t: "La venta: del pedido al reporte",
    d: "De la orden de compra de la cadena a la decisión comercial.",
    pasos: [
      { unidad: "Cadenas y distribuidores", gerencia: "Externo", externa: true, hace: "Envían órdenes de compra y publican el sell-out en sus portales.", compartidas: [], entrega: "órdenes de compra" },
      { unidad: "Ventas", gerencia: "Comercial", personas: 22, hace: "Toma los pedidos y coordina el despacho.", manual: { texto: "La reunión semanal de pedidos se documenta a mano, cuando se documenta.", quien: "Ejecutivo de ventas, P1" }, compartidas: ["minutas"], entrega: "pedidos y quiebres" },
      { unidad: "Servicio al cliente", gerencia: "Comercial", personas: 12, hace: "Atiende reclamos y el estado de los pedidos.", manual: { texto: "Responde por correo las mismas consultas, una a una.", quien: "Analista de servicio, P2" }, compartidas: ["consultas"], entrega: "reclamos y quiebres" },
      { unidad: "Trade marketing", gerencia: "Comercial", personas: 8, hace: "Mide el sell-out por cadena.", manual: { texto: "Baja los archivos de cada cadena y los consolida: 6 h cada lunes.", cita: "Cada lunes bajo los archivos de cada cadena y los consolido, son como seis horas.", quien: "Rodrigo P., P2" }, compartidas: ["consolidar"], entrega: "reporte semanal" },
      { unidad: "Gerencia comercial", gerencia: "Comercial", personas: 3, hace: "Decide precios y promociones.", manual: { texto: "Recibe cuatro reportes en formatos distintos y los vuelve a juntar.", quien: "Subgerente comercial, P2" }, compartidas: ["consolidar"] },
    ],
  },
  {
    id: "mantencion",
    t: "Mantenimiento: de la falla a la factura",
    d: "Del aviso en la línea al pago del repuesto.",
    pasos: [
      { unidad: "Planta", gerencia: "Operaciones", personas: 42, hace: "Opera las líneas y avisa las fallas.", manual: { texto: "Avisa por WhatsApp; la minuta del turno se escribe al final del día.", cita: "La minuta del turno la escribo yo al final del día.", quien: "Jefe de turno, P1" }, compartidas: ["minutas"], entrega: "falla por WhatsApp" },
      { unidad: "Mantenimiento", gerencia: "Operaciones", personas: 17, hace: "Diagnostica y repara.", manual: { texto: "Transcribe el WhatsApp a una orden de trabajo en el sistema.", quien: "Supervisor de mantenimiento, P2" }, compartidas: ["doble", "minutas"], entrega: "solicitud de repuesto" },
      { unidad: "Abastecimiento", gerencia: "Operaciones", personas: 6, hace: "Compra los repuestos.", manual: { texto: "Arma la orden de compra copiando los datos de la OT.", quien: "Comprador, P2" }, compartidas: ["doble"], entrega: "factura del proveedor" },
      { unidad: "Contabilidad", gerencia: "Administración y Finanzas", personas: 14, hace: "Concilia la factura con la orden de compra.", manual: { texto: "Concilia a mano facturas contra órdenes de compra: 420 h/mes.", quien: "Analista contable, P2" }, compartidas: ["doble"] },
    ],
  },
];

/** Rutas de formación por nivel. 208 + 87 + 61 = 356, y calzan con la matriz. */
export const RUTAS_FORMACION = [
  { t: "Constructores y champions", niveles: [4, 5], d: "Gems y diseño de agentes con el CoE. Lideran los quick wins de su unidad." },
  { t: "Usuarios de productividad", niveles: [3], d: "Gemini con buenas prácticas por rol: correo, informes, minutas. Talleres cortos de 2 horas." },
  { t: "Primeros pasos", niveles: [1, 2], d: "Reglas de uso seguro, un caso de su propia área y acompañamiento de un champion." },
];

export const DOCUMENTOS: { n: string; estado: "listo" | "revision" | "pendiente" }[] = [
  { n: "Directriz de uso aceptable de IA y Workspace", estado: "listo" },
  { n: "Protocolo de orden de carpetas y documentos compartidos", estado: "listo" },
  { n: "Clasificación de datos para IA", estado: "revision" },
  { n: "Protocolo para proponer ideas y casos de uso", estado: "revision" },
  { n: "Propuesta de comité de IA y roles", estado: "revision" },
  { n: "Recomendación inicial de gobierno de datos e IA", estado: "pendiente" },
];

export const NIVELES_AUTONOMIA = [
  { k: "Nivel 1 · Autoservicio", t: "Asistente personal", d: "Gemini en Workspace con datos propios, sin integraciones ni datos personales de terceros.", a: "la propia jefatura", tono: "verde" },
  { k: "Nivel 2 · Registro", t: "Agente de equipo", d: "Gem o agente con documentos internos del área en Drive. Se registra en el catálogo del CoE.", a: "CoE (revisión de datos)", tono: "azul" },
  { k: "Nivel 3 · Revisión", t: "Agente de proceso", d: "Se integra con ERP u otros sistemas, o usa datos personales de clientes, productores o trabajadores.", a: "TI (arquitectura) + Seguridad", tono: "ambar" },
  { k: "Nivel 4 · Comité", t: "Agente con decisión o externo", d: "Ejecuta acciones automáticas o conversa con clientes y productores fuera de la empresa.", a: "Comité de IA + Legal", tono: "rojo" },
] as const;

// ─── CoE as a Service ─────────────────────────────────────────────────────────

export const CONSULTAS_COE: {
  corta: string;
  pregunta: string;
  /** Palabras que, si aparecen en lo que alguien escribe, llevan a esta respuesta. */
  claves: string[];
  veredicto: string;
  nivel: string;
  tono: string;
  intro: string;
  pasos: string[];
  fuentes: string[];
  escala: string;
}[] = [
  {
    corta: "Quiero hacer un agente", pregunta: "Quiero un agente que lea las guías de despacho y me arme el informe semanal para los clientes.",
    claves: ["agente", "despacho", "informe", "automatizar"],
    veredicto: "Sí, se puede, con revisión.", nivel: "Nivel 3 · Agente de proceso", tono: "ambar",
    intro: "Usa datos de clientes y se conecta al sistema de despacho, así que pasa por TI y Seguridad antes de ir a producción.",
    pasos: ["Registra el caso en el catálogo con la plantilla de agente (10 min).", "Clasifica los datos: guías de despacho = interno; datos de clientes = confidencial.", "Construye un prototipo con datos de prueba en el entorno del CoE.", "Pide revisión de TI y Seguridad antes de conectarlo al sistema real."],
    fuentes: ["Estándar de niveles de autonomía", "Plantilla de ficha de agente"],
    escala: "TI (arquitectura) y Seguridad · respuesta en 5 días hábiles",
  },
  {
    corta: "¿Puedo usar ChatGPT?", pregunta: "¿Puedo usar ChatGPT con planillas de producción?",
    claves: ["chatgpt", "planilla", "datos", "personal", "puedo usar"],
    veredicto: "No con tu cuenta personal. Sí con Gemini.", nivel: "Política de uso aceptable", tono: "rojo",
    intro: "Las planillas de producción son datos internos. Usa Gemini con tu cuenta de la empresa: los datos quedan dentro de Workspace.",
    pasos: ["Datos públicos: cualquier herramienta autorizada.", "Datos internos: solo Gemini u herramientas aprobadas por el CoE.", "Datos confidenciales o personales: solo agentes aprobados de nivel 3."],
    fuentes: ["Directriz de uso aceptable de IA y Workspace", "Clasificación de datos para IA"],
    escala: "no requiere",
  },
  {
    corta: "Mejorar mis minutas", pregunta: "¿Cómo hago que Gemini me arme la minuta de la reunión de turno?",
    claves: ["minuta", "reunión", "meet", "gemini", "acta"],
    veredicto: "Sí, hoy mismo y sin pedir permiso.", nivel: "Nivel 1 · Autoservicio", tono: "verde",
    intro: "Es uso personal de Gemini con tus propias reuniones: no necesita aprobación.",
    pasos: ["Activa la toma de notas de Gemini en la reunión de Meet.", "Usa la plantilla de prompt “Minuta de turno” del repositorio.", "Revisa los compromisos antes de enviarla."],
    fuentes: ["Video: Cómo armar la minuta del turno con Gemini en Meet"],
    escala: "no requiere",
  },
];

export const REPOSITORIO = [
  { t: "Política de uso aceptable", k: "Política" },
  { t: "Clasificación de datos para IA", k: "Política" },
  { t: "Cómo escribir un buen prompt", k: "Guía" },
  { t: "Cómo crear un Gem paso a paso", k: "Guía" },
  { t: "Plantilla de ficha de agente", k: "Plantilla" },
];

/**
 * Los videos paso a paso del repositorio. En la demo son una vista previa: se
 * graban con el cliente en la etapa 2. `pasos` son los capítulos, con su
 * duración en segundos.
 */
export const VIDEOS: { id: string; t: string; capa: string; pasos: { t: string; seg: number }[] }[] = [
  {
    id: "minuta", t: "Cómo armar la minuta del turno con Gemini en Meet", capa: "Capa 1",
    pasos: [
      { t: "Activa “Tomar notas con Gemini” al entrar a la reunión", seg: 35 },
      { t: "Pega la plantilla de prompt “Minuta de turno”", seg: 50 },
      { t: "Revisa compromisos, responsables y plazos", seg: 60 },
      { t: "Guarda la minuta en la carpeta del turno y compártela", seg: 40 },
    ],
  },
  {
    id: "gem", t: "Crear un Gem para el informe de recepción, paso a paso", capa: "Capa 2",
    pasos: [
      { t: "Qué es un Gem y cuándo conviene", seg: 45 },
      { t: "Escribe las instrucciones del Gem", seg: 90 },
      { t: "Conecta la carpeta de Drive con las planillas", seg: 70 },
      { t: "Pruébalo con el informe de ayer y compáralo", seg: 80 },
      { t: "Regístralo en el catálogo del CoE", seg: 40 },
    ],
  },
  {
    id: "datos", t: "Qué datos puedo usar con IA y cuáles no", capa: "Estándar",
    pasos: [
      { t: "Los cuatro tipos de datos", seg: 60 },
      { t: "Ejemplos de Valle Sur por tipo", seg: 80 },
      { t: "Qué herramienta para cada tipo", seg: 60 },
    ],
  },
  {
    id: "caso", t: "Cómo proponer un caso de uso al CoE", capa: "Estándar",
    pasos: [
      { t: "Describe el problema con una cifra", seg: 40 },
      { t: "Llena la ficha en el banco de ideas", seg: 50 },
      { t: "Qué pasa después: evaluación y respuesta", seg: 30 },
    ],
  },
];

export const IDEAS = [
  { t: "Gem que responda las preguntas frecuentes de productores sobre liquidaciones", area: "Relación con productores", votos: 23, estado: "En evaluación" },
  { t: "Resumen automático del informe de calidad para el turno siguiente", area: "Planta", votos: 17, estado: "Aprobada" },
  { t: "Plantilla de correo para cotizaciones a distribuidores", area: "Comercial", votos: 9, estado: "Nueva" },
];

// ─── Fichas de ejemplo ────────────────────────────────────────────────────────
//
// Tres personas inventadas con su ficha completa, para que la pantalla de
// detalle se pueda mostrar antes de que nadie se entreviste en vivo.

export interface FichaSemilla {
  id: string;
  nombre: string;
  cargo: string;
  gerencia: string;
  analisis: AnalisisGia;
}

export const FICHAS: FichaSemilla[] = [
  {
    id: "carolina",
    nombre: "Carolina M.",
    cargo: "Jefa de Recepción de Materia Prima",
    gerencia: "Operaciones",
    analisis: {
      resumen: "Lidera un equipo de 6 personas en la recepción de leche. Arma a mano el informe diario cruzando la romana con las planillas de laboratorio, y ya usa IA por su cuenta para resumirlo, desde su celular personal.",
      tareas: [
        { tarea: "Informe diario de recepción y calidad", frecuencia: "diaria", horasMes: 30, sistemas: ["Sistema de romana", "Excel", "Correo"], solucion: "gem", cita: "Las cruzo a mano en Excel, como una hora y media diaria, y después lo mando por correo a planta y a calidad." },
        { tarea: "Respuesta a consultas de productores por volúmenes", frecuencia: "varias veces por semana", horasMes: 12, sistemas: ["WhatsApp", "Sistema de romana"], solucion: "agente_proceso", cita: "Los productores me escriben por WhatsApp preguntando cuánto entregaron y tengo que ir a buscarlo." },
        { tarea: "Minuta de reunión de turno", frecuencia: "semanal", horasMes: 6, sistemas: ["Meet", "Docs"], solucion: "gemini", cita: "La minuta del turno la escribo yo al final del día." },
      ],
      usoIa: { herramientas: ["ChatGPT"], frecuencia: "algunas veces por semana", cuentaCorporativa: false, verificacion: "Revisa que los totales calcen con la planilla antes de enviar." },
      alertas: [{ tipo: "datos", texto: "Datos operacionales y de productores pegados en una IA pública desde un dispositivo personal.", cita: "A veces le pego la tabla a ChatGPT en mi celular para que me haga el resumen." }],
      cambio: { postura: "abierta", preocupaciones: ["No saber qué está permitido"], ideas: ["Que el informe de recepción salga solo cada mañana"], cita: "Si alguien me dice qué puedo usar, lo uso al tiro." },
      perfil: {
        puntos: { practico: 24, automatizador: 8, puente: 14, referente: 4, estratega: 4, guardian: 6 },
        principal: "practico",
        potencial: "puente",
        madurez: 2,
        porQueMadurez: "Usa IA algunas veces por semana, pero con una herramienta no autorizada y sin un método estable.",
        evidencias: [
          { arquetipo: "practico", tema: "ia", cita: "A veces le pego la tabla a ChatGPT en mi celular para que me haga el resumen.", lectura: "Usa IA para resolver una tarea concreta de su día." },
          { arquetipo: "puente", tema: "repite", cita: "Como una hora y media diaria, y después lo mando por correo a planta y a calidad.", lectura: "Dimensiona el dolor con tiempo y lo conecta con otras áreas." },
          { arquetipo: "guardian", tema: "ia", cita: "Reviso que los totales calcen antes de mandarlo.", lectura: "Verifica el resultado antes de usarlo." },
        ],
      },
      ruta: "Gemini con cuenta corporativa + taller de prompts para informes (2 h) + piloto del Gem de informe de recepción.",
    },
  },
  {
    id: "rodrigo",
    nombre: "Rodrigo P.",
    cargo: "Analista de Trade Marketing",
    gerencia: "Comercial",
    analisis: {
      resumen: "Prepara los reportes de sell-out para los ejecutivos. Armó macros y un Gem propio para ordenar los archivos de las cadenas, y le enseña a su equipo cómo usarlo.",
      tareas: [
        { tarea: "Reporte semanal de sell-out por cadena", frecuencia: "semanal", horasMes: 24, sistemas: ["Portales de cadenas", "Excel", "Looker Studio"], solucion: "agente_datos", cita: "Cada lunes bajo los archivos de cada cadena y los consolido, son como seis horas." },
      ],
      usoIa: { herramientas: ["Gemini", "Gems"], frecuencia: "a diario", cuentaCorporativa: true, verificacion: "Compara los totales del Gem contra el portal de la cadena." },
      alertas: [],
      cambio: { postura: "entusiasta", preocupaciones: ["Que cada uno arme su Gem sin orden"], ideas: ["Un repositorio común de Gems del área"], cita: "Ya les mostré a los chiquillos cómo usarlo, pero cada uno tiene su versión." },
      perfil: {
        puntos: { practico: 8, automatizador: 22, puente: 6, referente: 14, estratega: 6, guardian: 4 },
        principal: "automatizador",
        potencial: "referente",
        madurez: 5,
        porQueMadurez: "Armó un Gem que usa su equipo y verifica los resultados contra la fuente.",
        evidencias: [
          { arquetipo: "automatizador", tema: "ia", cita: "Me armé un Gem que me ordena los archivos de las cadenas.", lectura: "Convierte una tarea repetitiva en un asistente reutilizable." },
          { arquetipo: "referente", tema: "cambio", cita: "Ya les mostré a los chiquillos cómo usarlo.", lectura: "Enseña y contagia el uso en su equipo." },
        ],
      },
      ruta: "Champion de Comercial: diseño de agentes con el CoE y registro de su Gem en el catálogo.",
    },
  },
  {
    id: "ximena",
    nombre: "Ximena R.",
    cargo: "Jefa de Remuneraciones",
    gerencia: "Administración y Finanzas",
    analisis: {
      resumen: "Responsable del cálculo de remuneraciones. No usa IA y le preocupa que se filtren datos de los trabajadores. Pide reglas claras antes de partir.",
      tareas: [
        { tarea: "Validación de rendiciones de gastos", frecuencia: "mensual", horasMes: 16, sistemas: ["ERP", "Excel"], solucion: "agente_proceso", cita: "A fin de mes reviso una por una las rendiciones contra las boletas." },
      ],
      usoIa: { herramientas: [], frecuencia: "nunca", cuentaCorporativa: null, verificacion: "" },
      alertas: [],
      cambio: { postura: "cauta", preocupaciones: ["Filtración de datos personales de trabajadores", "Errores en cálculos"], ideas: ["Que alguien valide qué herramientas son seguras"], cita: "Acá manejamos sueldos; si eso se filtra es gravísimo." },
      perfil: {
        puntos: { practico: 6, automatizador: 2, puente: 8, referente: 2, estratega: 10, guardian: 32 },
        principal: "guardian",
        potencial: "estratega",
        madurez: 1,
        porQueMadurez: "No usa IA en su trabajo.",
        evidencias: [
          { arquetipo: "guardian", tema: "cambio", cita: "Acá manejamos sueldos; si eso se filtra es gravísimo.", lectura: "Cuida la confidencialidad de los datos de las personas." },
          { arquetipo: "estratega", tema: "repite", cita: "Esto no debería revisarse a mano, debería venir validado del sistema.", lectura: "Cuestiona el proceso, no solo la tarea." },
        ],
      },
      ruta: "Integrar a la mesa de lineamientos (clasificación de datos) + primeros pasos con Gemini sobre datos no sensibles.",
    },
  },
];

// ─── Invitados a la entrevista ────────────────────────────────────────────────
//
// En el producto real cada colaborador recibe su propio link y la entrevista
// ya sabe quién es: no se le pide nombre, cargo ni gerencia, igual que en el
// levantamiento del JPL. Para la demo los invitados son personas inventadas de
// la empresa demo, y el servidor toma sus datos de acá, no del navegador: nadie
// puede entrevistarse con un nombre que no esté en la lista.

export interface Invitado {
  codigo: string;
  nombre: string;
  cargo: string;
  gerencia: string;
}

export const INVITADOS: Invitado[] = [
  { codigo: "camila-r7k2", nombre: "Camila Rojas", cargo: "Jefa de Abastecimiento", gerencia: "Operaciones" },
  { codigo: "matias-f3p9", nombre: "Matías Fuentes", cargo: "Ejecutivo de Ventas Canal Tradicional", gerencia: "Comercial" },
  { codigo: "valentina-s8m4", nombre: "Valentina Soto", cargo: "Analista de Remuneraciones", gerencia: "Personas" },
];

export function invitadoPorCodigo(codigo: string): Invitado | undefined {
  return INVITADOS.find((i) => i.codigo === codigo);
}
