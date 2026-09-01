// Registro de cuentas.
//
// Una **cuenta** es un contexto de trabajo: quién eres cuando entras al tablero.
// No es un permiso ni un cliente ni un ambiente. Es la respuesta a "¿esto que
// estoy mirando, de qué parte de mi vida es?".
//
// ── Por qué esto existe ──────────────────────────────────────────────────────
//
// Dashboard360 nació como un producto —prospección, canales, informe al
// directorio— y después se le fueron colgando cosas que no son eso: el motor,
// la máquina de contenido, las reuniones. Funciona, pero la pantalla empezó a
// mezclar mundos: el CRM de prospección de adoOps al lado de una reunión
// personal, con el mismo menú y la misma cara.
//
// El síntoma que lo hizo evidente fue la base de conocimiento del copiloto de
// reuniones: lo que ofrece adoOps no tiene nada que ver con lo que se conversa
// en Soho, y una sola base sirviendo a las dos le daría al copiloto vocabulario
// de un mundo para preguntar en el otro.
//
// ── Es el mismo eje que el `ambito` de las reuniones ─────────────────────────
//
// Las reuniones ya traían un `ambito` —`soho`, `personal`— que sale del token
// del webhook. **Es exactamente este concepto**, y por eso se unifica en vez de
// convivir: dos ejes que dicen casi lo mismo terminan con uno de los dos
// mintiendo, y nadie sabe cuál. Los valores de `ambito` son ids de cuenta.
//
// ── Qué NO es una cuenta ─────────────────────────────────────────────────────
//
// **No es aislamiento de datos.** Sigue habiendo una sola base —ver
// `lib/modulos.ts`— y una cuenta no impide que una consulta mal escrita lea
// filas de otra. Declara intención y decide qué se pinta; no es una frontera de
// seguridad. Si algún día lo tiene que ser, hay que decirlo en voz alta y
// hacerlo de verdad, no asumir que esta tabla ya lo hacía.
//
// **No es un rol.** El rol dice qué puedes hacer (`puedePublicar`); la cuenta
// dice en qué mundo estás parado. Son ortogonales: alguien puede ser gerente en
// adoOps y no tener acceso a Soho.

/** Las secciones del tablero que una cuenta puede tener encendidas. */
export type ModuloCuenta =
  | "panel"
  | "canales"
  | "mercado"
  | "motor"
  | "informe"
  | "fuentes"
  | "contenido"
  | "reuniones"
  | "crm";

export type CuentaId = "demo" | "adoops" | "soho" | "personal";

export interface Cuenta {
  id: CuentaId;
  /** Cómo se llama en el selector. Corto: va en una barra lateral angosta. */
  nombre: string;
  /** Una línea sobre en qué mundo te para. Se lee al cambiar de cuenta. */
  descripcion: string;
  /** Qué secciones se pintan. El orden no importa; el menú tiene el suyo. */
  modulos: ModuloCuenta[];
  /**
   * Color del punto en el selector. Es lo único que se ve de reojo cuando ya no
   * se lee el nombre, y esa es justamente la situación en que uno se confunde
   * de cuenta.
   */
  color: string;
}

export const CUENTAS: Cuenta[] = [
  {
    id: "adoops",
    nombre: "adoOps",
    descripcion: "El negocio propio: prospección, contenido y las reuniones del equipo.",
    // El motor prospecta y el CRM administra lo que el motor consigue. Son dos
    // mitades del mismo trabajo: uno le escribe a desconocidos, el otro lleva la
    // relación desde que alguien contesta. `/crm` no está en esta lista y nunca
    // va a estar: ese es el sistema de un cliente montado como demo.
    modulos: ["panel", "crm", "mercado", "motor", "fuentes", "contenido", "reuniones"],
    color: "#2fa36b",
  },
  {
    id: "soho",
    nombre: "Soho",
    descripcion: "El trabajo actual. Por ahora solo las reuniones.",
    modulos: ["reuniones"],
    color: "#4a8fd4",
  },
  {
    id: "personal",
    nombre: "Personal",
    descripcion: "Reuniones que no son de ningún trabajo.",
    modulos: ["reuniones"],
    color: "#9b7fd4",
  },
  {
    id: "demo",
    // Va última y con todo encendido a propósito: es la cuenta que se muestra en
    // una reunión de venta, y ahí hay que poder llegar a cualquier pantalla sin
    // explicar por qué falta una.
    nombre: "Demo",
    descripcion: "Todo encendido, para mostrar el producto completo.",
    modulos: [
      "panel",
      "canales",
      "mercado",
      "motor",
      "informe",
      "fuentes",
      "contenido",
      "reuniones",
      "crm",
    ],
    color: "#c9a227",
  },
];

export const CUENTA_POR_DEFECTO: CuentaId = "adoops";

export function cuentaPorId(id: string | null | undefined): Cuenta | undefined {
  return CUENTAS.find((c) => c.id === id);
}

/**
 * Si una cuenta tiene encendida una sección.
 *
 * Se pregunta por el registro y no por la ruta: una sección puede mudarse de
 * URL sin que cambie a qué cuentas pertenece.
 */
export function tieneModulo(cuenta: Cuenta | undefined, modulo: ModuloCuenta): boolean {
  return Boolean(cuenta?.modulos.includes(modulo));
}

/**
 * Resuelve la cuenta activa a partir de lo que trae la sesión.
 *
 * Tolerante a propósito: una sesión emitida antes de que existieran las cuentas
 * no tiene ninguna, y una cuenta que se saque del registro deja sesiones
 * apuntando a la nada. En los dos casos se cae a la primera permitida antes que
 * dejar a alguien mirando un tablero vacío sin saber por qué.
 */
export function resolverCuenta(
  activa: string | null | undefined,
  permitidas: string[] | null | undefined,
): Cuenta {
  const lista = (permitidas ?? []).map(cuentaPorId).filter(Boolean) as Cuenta[];
  const disponibles = lista.length > 0 ? lista : CUENTAS;

  return (
    disponibles.find((c) => c.id === activa) ??
    disponibles.find((c) => c.id === CUENTA_POR_DEFECTO) ??
    disponibles[0]
  );
}
