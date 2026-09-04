// Registro de módulos.
//
// **Por qué esto es código y no un documento.** Un `docs/modulos.md` que diga
// "el CRM es un demo" se desactualiza el día que el CRM deje de serlo, y nadie
// se entera hasta que alguien confía en él. Acá el estado lo lee la propia
// pantalla del módulo: si la fila dice `demo`, el chip aparece. La única forma
// de que la etiqueta mienta es cambiar esta tabla, que es exactamente el
// momento en que uno quiere pensarlo dos veces.
//
// **El problema que resuelve.** Toda la web vive en una sola base de datos
// —hay un solo `DATABASE_URL`, ver `db/index.ts`— separada por prefijos de
// tabla, no por ambiente. No existe una base de demo de la que las fichas de
// prueba no puedan salir. En el CRM de CDC eso terminó con fichas de prueba
// dentro del sistema de un cliente, para siempre, porque nada en la pantalla
// decía a qué ambiente se estaba escribiendo. La lección que se copia acá es
// la de `pre_quotes.salucloud_env`: **el estado se muestra donde está la
// persona que se puede confundir**, no en un README que no va a leer.
//
// Lo que este registro NO hace: no impide escribir datos reales en un demo.
// Eso lo tiene que impedir el código de cada módulo. Esto declara la intención
// y la hace visible, que es el paso que faltaba.

/**
 * Qué implica cada estado. Están definidos por sus consecuencias, no por cómo
 * suenan: la pregunta que decide es siempre "¿puede tener adentro datos de una
 * persona real?".
 */
export type EstadoModulo =
  /** Personas reales adentro. No se rompe sin avisar. Se despliega con cuidado. */
  | "produccion"
  /** **Nunca** personas reales. Se puede romper avisando. Se llega solo por link. */
  | "demo"
  /** Puede tener datos reales, pero solo lo mira el equipo. Exige sesión. */
  | "interno"
  /** Quedó de un ciclo anterior. Sigue sirviéndose, nadie lo mantiene. */
  | "archivado";

/**
 * De dónde salen los datos que se ven en pantalla. Es distinto del estado: un
 * módulo puede ser `demo` y aun así recibir un mensaje real de WhatsApp durante
 * una reunión. `mixtos` es justamente ese caso, y es el que hay que mirar.
 */
export type OrigenDatos =
  /** De personas reales que interactuaron con el sitio. */
  | "reales"
  /** De un script de `scripts/`. Se puede borrar y volver a sembrar. */
  | "sembrados"
  /** Sembrado de base, pero acepta entradas reales en vivo. */
  | "mixtos"
  /** No guarda nada sobre las personas que lo usan. */
  | "ninguno";

export interface Modulo {
  /** Identificador estable. No cambia aunque cambie la ruta. */
  id: string;
  nombre: string;
  /** Prefijo de ruta. `moduloDe()` toma el más largo que calce. */
  ruta: string;
  estado: EstadoModulo;
  datos: OrigenDatos;
  /** Quién mira esta pantalla. En singular y concreto: sirve para decidir. */
  audiencia: string;
  /** Prefijos de tabla que toca. Vacío si no persiste. */
  tablas: string[];
  /** Por qué está clasificado así. Una línea. Si no cabe, la clasificación está mal. */
  nota: string;
}

/**
 * El orden importa: `moduloDe()` desempata por ruta más larga, pero mantenerlo
 * de lo más específico a lo más general hace la tabla legible.
 */
export const MODULOS: Modulo[] = [
  {
    id: "motor",
    nombre: "Motor de prospección",
    ruta: "/dashboard360/motor",
    estado: "produccion",
    datos: "reales",
    audiencia: "el equipo de adOps",
    tablas: ["lead_"],
    nota: "Prospecta personas reales con un cron cada 15 minutos, de lunes a viernes.",
  },
  {
    id: "reuniones",
    nombre: "Reuniones",
    ruta: "/dashboard360/reuniones",
    // `interno` y no `demo`, y la diferencia no es de matiz: adentro hay la
    // transcripción literal de una reunión de trabajo, con el nombre de cada
    // persona al lado de lo que dijo. Es el módulo con el material más sensible
    // del repo después de los tokens de contenido, y no se muestra en ninguna
    // reunión de venta.
    estado: "interno",
    datos: "reales",
    audiencia: "el equipo de adOps",
    tablas: ["reunion_"],
    nota: "Transcripciones literales de reuniones del equipo. Cada línea tiene el nombre de quien la dijo.",
  },
  {
    id: "dashboard360",
    nombre: "Dashboard 360",
    ruta: "/dashboard360",
    estado: "interno",
    datos: "mixtos",
    audiencia: "el equipo de adOps",
    tablas: ["d360_"],
    nota: "Sembrado para la demo, pero Google Ads sincroniza cifras reales todos los días.",
  },
  {
    id: "torrecontrol",
    nombre: "TorreControl",
    ruta: "/torrecontrol",
    estado: "demo",
    datos: "mixtos",
    audiencia: "un prospecto en una reunión",
    tablas: ["field_reports", "acta_reports", "incidencias", "ordenes_trabajo", "work_sheets", "compromisos"],
    nota: "Sembrado, pero durante una demostración entran mensajes de WhatsApp de verdad.",
  },
  {
    id: "crm",
    nombre: "CRM Highend",
    ruta: "/crm",
    estado: "demo",
    datos: "sembrados",
    audiencia: "un prospecto en una reunión",
    tablas: ["crm_"],
    nota: "156 ventas y 76 clientes inventados a la medida del negocio real. Ningún cliente de Highend adentro.",
  },
  {
    id: "tuniche",
    nombre: "Sistema Tuniche",
    ruta: "/tuniche",
    estado: "produccion",
    // `mixtos` y no `reales` desde que existe `scripts/tuniche-demo.mjs`: la
    // maestra son 34 agricultores que existen, y junto a ellos conviven fichas
    // inventadas para mostrar el sistema. Acá el eje no alcanza solo: la marca
    // que evita la confusión es la columna `demo` de cada fila, que la pantalla
    // pinta con `<Demo />`. Esta fila declara que la mezcla existe.
    datos: "mixtos",
    audiencia: "un zonal de Semillas Tuniche en terreno",
    tablas: ["tuniche_"],
    // Se firmó como prueba de concepto y aun así entra como `produccion`. La
    // pregunta que decide el estado es "¿puede haber adentro datos de una
    // persona real?", y la respuesta es sí desde el primer día: agricultores
    // con nombre y teléfono, y trabajadores de Tuniche con contraseña. La etapa
    // comercial no cambia lo que hay en la base.
    nota: "Sistema interno de otra empresa alojado acá: agricultores reales y cuentas con contraseña desde el día uno.",
  },
  {
    id: "showroom",
    nombre: "Captura de showroom",
    ruta: "/showroom",
    estado: "demo",
    datos: "sembrados",
    audiencia: "quien escanee el QR del mostrador",
    tablas: ["crm_showroom_visitas"],
    nota: "Página pública sin sesión. El día que un QR real esté en una boutique, esto pasa a producción.",
  },
  {
    id: "mix",
    nombre: "TV Mix",
    ruta: "/mix",
    estado: "demo",
    datos: "ninguno",
    audiencia: "quien tenga el código de la sala",
    tablas: ["mix_rooms"],
    nota: "`mix_rooms` guarda el código de la sala y la cola de videos. Nada sobre quien la abre.",
  },
  {
    id: "tv",
    nombre: "TV Mix · pantalla",
    ruta: "/tv",
    estado: "demo",
    datos: "ninguno",
    audiencia: "el televisor de la sala",
    tablas: ["mix_rooms"],
    nota: "La otra mitad de TV Mix: lo que se proyecta. Lee la misma sala, no escribe nada nuevo.",
  },
  {
    id: "cafecito",
    nombre: "Cafecito IA",
    ruta: "/cafecito-ia",
    estado: "produccion",
    datos: "reales",
    audiencia: "cualquier visitante",
    tablas: ["cafecito_"],
    // Sin chip, como el resto de la web pública: `llevaChip` lo omite en
    // `produccion`. Aquí nadie se confunde de ambiente — la confusión que este
    // registro previene es la del equipo mirando un tablero sembrado.
    nota: "Guarda el correo de personas reales con doble opt-in y les manda el boletín; la baja no borra la fila, la marca.",
  },
  {
    id: "framework",
    nombre: "AI Adoption Framework",
    ruta: "/framework",
    estado: "produccion",
    datos: "ninguno",
    audiencia: "cualquier visitante",
    tablas: [],
    nota: "La otra página de la web corporativa. Es contenido: no guarda nada ni pide nada.",
  },
  {
    id: "web",
    nombre: "Web corporativa",
    ruta: "/",
    estado: "produccion",
    datos: "reales",
    audiencia: "cualquier visitante",
    tablas: ["leads"],
    // La única fila que calza por igualdad exacta: si "/" calzara por prefijo se
    // tragaría todas las rutas no registradas y les pondría la cara de la web
    // corporativa. Por eso /framework necesita su propia fila.
    nota: "El formulario de contacto guarda nombre, email y empresa de personas reales, y manda un correo.",
  },
];

/**
 * El módulo al que pertenece una ruta, o `undefined` si no está registrado.
 *
 * Desempata por prefijo **más largo**: `/dashboard360/motor` tiene que ganarle
 * a `/dashboard360`, y `/` calza con todo, así que solo puede ganar cuando no
 * hay nada mejor. Esto es lo mismo que hace `proxy.ts` con sus áreas, pero acá
 * el orden del arreglo no puede ser la regla: la tabla se edita a mano y una
 * fila mal puesta cambiaría silenciosamente lo que dice una pantalla.
 */
export function moduloDe(pathname: string): Modulo | undefined {
  let mejor: Modulo | undefined;
  for (const m of MODULOS) {
    const calza = m.ruta === "/" ? pathname === "/" : pathname.startsWith(m.ruta);
    if (calza && (!mejor || m.ruta.length > mejor.ruta.length)) mejor = m;
  }
  return mejor;
}

export function moduloPorId(id: string): Modulo | undefined {
  return MODULOS.find((m) => m.id === id);
}

/**
 * Si el módulo se marca a sí mismo en pantalla.
 *
 * Dos exclusiones, y las dos son deliberadas.
 *
 * **Producción no lleva chip.** Si todo lleva etiqueta, ninguna se lee, y la
 * ausencia pasa a significar "esto es de verdad". Esa es la señal que interesa.
 *
 * **Un módulo que no guarda datos de personas tampoco.** La confusión que este
 * registro existe para evitar es una sola: mirar una ficha y no saber si detrás
 * hay alguien de verdad. TV Mix guarda el código de una sala y una cola de
 * videos; no hay ficha que confundir, y un aviso sobre un video proyectado en
 * un televisor es una marca de agua, no una advertencia.
 */
export function llevaChip(m: Modulo): boolean {
  return m.estado !== "produccion" && m.datos !== "ninguno";
}
