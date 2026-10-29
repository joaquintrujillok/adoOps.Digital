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

export const PROCESOS: { p: string; u: string; g: string; n: number; h: number; s: SolucionSemilla }[] = [
  { p: "Conciliación de facturas de proveedores", u: "Adm. y Finanzas", g: "Administración y Finanzas", n: 14, h: 420, s: "agente_proceso" },
  { p: "Informe diario de recepción y calidad", u: "Recepción", g: "Operaciones", n: 9, h: 310, s: "gem" },
  { p: "Consultas de productores (volúmenes y pagos)", u: "Relación con productores", g: "Operaciones", n: 11, h: 280, s: "agente_proceso" },
  { p: "Reportes de sell-out para trade", u: "Trade marketing", g: "Comercial", n: 8, h: 260, s: "agente_datos" },
  { p: "Órdenes de mantenimiento desde reportes de terreno", u: "Mantenimiento", g: "Operaciones", n: 17, h: 240, s: "agente_proceso" },
  { p: "Minutas y seguimiento de reuniones de turno", u: "Planta", g: "Operaciones", n: 42, h: 190, s: "gemini" },
  { p: "Respuesta a reclamos de clientes", u: "Servicio al cliente", g: "Comercial", n: 12, h: 170, s: "gem" },
  { p: "Validación de rendiciones de gastos", u: "Adm. y Finanzas", g: "Administración y Finanzas", n: 6, h: 130, s: "agente_proceso" },
];

export const CUADRANTES = [
  { titulo: "Quick wins · alto impacto, bajo esfuerzo", tono: "verde", items: ["Informe diario de recepción y calidad", "Minutas de turno con Gemini en Meet", "Respuestas tipo a reclamos"] },
  { titulo: "Proyectos · alto impacto, más esfuerzo", tono: "azul", items: ["Conciliación de facturas", "Consultas de productores", "Órdenes de mantenimiento"] },
  { titulo: "Autoservicio · bajo impacto, bajo esfuerzo", tono: "gris", items: ["Plantillas de correo comercial", "Resúmenes de documentos"] },
  { titulo: "Evaluar después", tono: "ambar", items: ["Pronóstico de demanda con IA", "Visión computacional en línea"] },
] as const;

/** Rutas de formación por nivel. 208 + 87 + 61 = 356, y calzan con la matriz. */
export const RUTAS_FORMACION = [
  { t: "Constructores y champions", niveles: [4, 5], d: "Gems y diseño de agentes con el CoE. Lideran los quick wins de su unidad." },
  { t: "Usuarios de productividad", niveles: [3], d: "Gemini con buenas prácticas por rol: correo, informes, minutas. Talleres cortos de 2 horas." },
  { t: "Primeros pasos", niveles: [1, 2], d: "Reglas de uso seguro, un caso de su propia área y acompañamiento de un champion." },
];

// ─── Lineamientos ─────────────────────────────────────────────────────────────

export const DIMENSIONES = [
  { n: "Estrategia y patrocinio", s: 2.1 },
  { n: "Plataforma e infraestructura", s: 2.0 },
  { n: "Seguridad y riesgo", s: 1.8 },
  { n: "Datos y clasificación", s: 1.5 },
  { n: "Personas y capacidades", s: 1.4 },
  { n: "Políticas y uso aceptable", s: 1.2 },
  { n: "Gestión de casos y valor", s: 1.0 },
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

// ─── Gemini y agentes ─────────────────────────────────────────────────────────

export const OPCIONES_GEMINI = [
  {
    tag: "Opción A", t: "Adoptar bien Gemini", d: "Lineamientos, buenas prácticas por rol y champions sobre el Gemini que ya viene en Workspace.",
    h: "1.290 h/mes · 41%", v: "UF 6.970", c: "UF 1.100", r: "UF 5.870",
    det: ["Resuelve bien correo, documentos, planillas, minutas de Meet y resúmenes.", "Sin costo de licencia adicional: el costo es formación y acompañamiento.", "No resuelve procesos que cruzan sistemas: facturas, consultas de productores, mantenimiento.", "Es el mejor punto de partida: el retorno más rápido."],
  },
  {
    tag: "Opción B", t: "Gemini + Gems y agentes de equipo", d: "Lo anterior más Gems y agentes de equipo con licencias empresariales para quienes construyen.",
    h: "1.800 h/mes · 57%", v: "UF 9.720", c: "UF 4.300", r: "UF 5.420",
    det: ["Suma asistentes de equipo sobre documentos de Drive: informes, respuestas tipo.", "Licencias empresariales adicionales para los usuarios que construyen agentes.", "Integraciones con ERP limitadas sin desarrollo.", "Requiere igualmente un CoE para aprobar y mantener agentes."],
  },
  {
    tag: "Recomendada", t: "Híbrido gobernado", d: "Gemini para todos, más 6 agentes de proceso gobernados por el CoE.",
    h: "2.270 h/mes · 72%", v: "UF 12.260", c: "UF 6.200", r: "UF 6.060",
    det: ["Parte por la opción A y suma agentes donde Gemini no llega.", "Seis agentes de proceso integrados (facturas, productores, mantenimiento, sell-out, recepción, rendiciones).", "Modelo elegido por caso según costo y calidad, con trazabilidad y control de datos.", "Incluye el CoE: catálogo, aprobaciones, banco de ideas y métricas."],
  },
];

// ─── CoE as a Service ─────────────────────────────────────────────────────────

export const CONSULTAS_COE = [
  {
    corta: "Quiero hacer un agente", pregunta: "Quiero un agente que lea las guías de despacho y me arme el informe semanal para los clientes.",
    nivel: "Nivel 3 · Agente de proceso", tono: "ambar",
    intro: "Se puede, pero usa datos de clientes y se conecta al sistema de despacho, así que pasa por revisión.",
    pasos: ["Registra el caso en el catálogo con la plantilla de agente (10 min).", "Clasifica los datos: guías de despacho = interno; datos de clientes = confidencial.", "Construye un prototipo con datos de prueba en el entorno del CoE.", "Pide revisión de TI y Seguridad antes de conectarlo al sistema real."],
    escala: "TI (arquitectura) y Seguridad · respuesta en 5 días hábiles",
  },
  {
    corta: "¿Puedo usar ChatGPT?", pregunta: "¿Puedo usar ChatGPT con planillas de producción?",
    nivel: "Política de uso aceptable", tono: "rojo",
    intro: "No con datos internos en cuentas personales. Usa Gemini con tu cuenta de la empresa: los datos quedan dentro de Workspace.",
    pasos: ["Datos públicos: cualquier herramienta autorizada.", "Datos internos: solo Gemini u herramientas aprobadas por el CoE.", "Datos confidenciales o personales: solo agentes aprobados de nivel 3."],
    escala: "no requiere; consulta la política completa en el repositorio",
  },
  {
    corta: "Mejorar mis minutas", pregunta: "¿Cómo hago que Gemini me arme la minuta de la reunión de turno?",
    nivel: "Nivel 1 · Autoservicio", tono: "verde",
    intro: "Lo puedes hacer hoy mismo sin pedir permiso.",
    pasos: ["Activa la toma de notas de Gemini en la reunión de Meet.", "Usa la plantilla de prompt “Minuta de turno” del repositorio.", "Revisa los compromisos antes de enviarla."],
    escala: "no requiere",
  },
] as const;

export const REPOSITORIO = [
  { t: "Política de uso aceptable", k: "Política" },
  { t: "Clasificación de datos para IA", k: "Política" },
  { t: "Cómo escribir un buen prompt", k: "Guía" },
  { t: "Cómo crear un Gem paso a paso", k: "Guía" },
  { t: "Plantilla de ficha de agente", k: "Plantilla" },
];

export const IDEAS = [
  { t: "Gem que responda las preguntas frecuentes de productores sobre liquidaciones", area: "Relación con productores", votos: 23, estado: "En evaluación" },
  { t: "Resumen automático del informe de calidad para el turno siguiente", area: "Planta", votos: 17, estado: "Aprobada" },
  { t: "Plantilla de correo para cotizaciones a distribuidores", area: "Comercial", votos: 9, estado: "Nueva" },
];

// ─── Hoja de ruta ─────────────────────────────────────────────────────────────

export const ROADMAP = [
  { q: "Meses 0 a 3 · Quick win", t: "Levantamiento inicial", items: ["Entrevistas por voz a la unidad", "Diagnóstico cultural y de uso de IA", "Directrices y protocolos iniciales", "Recomendación inicial de gobierno de datos e IA"], h: "presentación al comité ejecutivo o directorio", estilo: "verde" },
  { q: "Meses 3 a 12", t: "Primera gobernanza", items: ["Comité de IA constituido", "Portal CoE y banco de ideas activos", "Champions formados por unidad", "Primeros 3 a 5 agentes y automatizaciones"], h: "primer sistema de gobernanza en marcha", estilo: "blanco" },
  { q: "Meses 12 a 24", t: "Escala", items: ["Levantamiento al resto de la organización", "Upskilling diferenciado por arquetipo", "Agentes de proceso integrados a sistemas", "Tablero de valor trimestral"], h: "IA en los procesos productivos clave", estilo: "blanco" },
  { q: "Meses 24 a 36", t: "Autonomía", items: ["Las unidades construyen dentro de las reglas", "Ideas de los colaboradores como fuente principal", "Transferencia del CoE a un equipo interno", "Revisión anual de lineamientos"], h: "cultura de mejora continua con IA", estilo: "oscuro" },
] as const;

export const ESCENARIOS = [
  {
    k: "Etapa 1", tag: "Partimos aquí", t: "Levantamiento inicial", d: "Tres meses para entender cómo trabaja y cómo vive el cambio la unidad, y dejar las primeras reglas del juego.",
    p: "UF 1.200", pn: "Precio cerrado · 3 meses", estilo: "blanco",
    inc: ["Entrevistas por agente de voz y back office de resultados", "Diagnóstico cultural, de procesos y de uso de IA", "Directrices, protocolos y orden de documentos", "Recomendación inicial de gobierno y plan para el comité"],
    no: "Si continúan a la etapa 2 dentro de 60 días, el 50% se abona al primer trimestre.",
  },
  {
    k: "Etapa 2 · Modalidad A", tag: "Acompañamiento", t: "Gobernanza y CoE", d: "Implementar lo aprobado: comité, portal CoE, champions y quick wins trimestrales.",
    p: "UF 450 / mes", pn: "Contrato anual", estilo: "verde",
    inc: ["Secretaría técnica del comité de IA", "CoE as a Service: portal, asesor y banco de ideas", "Formación de champions", "1 a 2 quick wins por trimestre"],
    no: "Los agentes de proceso integrados a sistemas se cotizan aparte.",
  },
  {
    k: "Etapa 2 · Modalidad B", tag: "Transformación", t: "CoE + fábrica de agentes", d: "Todo lo anterior más construcción continua de agentes y upskilling para toda la organización.",
    p: "UF 650 / mes", pn: "Contrato anual", estilo: "oscuro",
    inc: ["Toda la modalidad A", "Fábrica de agentes: backlog priorizado y entrega continua", "Upskilling diferenciado por arquetipo", "Levantamiento al resto de la organización"],
    no: "Licencias y consumo de modelos aparte, según uso.",
  },
] as const;

/** Etapa 1 + 9 meses de etapa 2 el primer año; 12 meses el segundo; el tercero con abono. */
export const ANIOS = [
  { m: "Etapa 1 + modalidad A", a: "UF 5.250", b: "UF 5.400", c: "UF 4.200" },
  { m: "Etapa 1 + modalidad B", a: "UF 7.050", b: "UF 7.800", c: "UF 5.400" },
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
