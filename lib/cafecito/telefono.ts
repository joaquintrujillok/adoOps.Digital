// Normalización de teléfonos a E.164.
//
// ── Por qué se guarda en E.164 y no como lo escribió la persona ──────────────
//
// E.164 es el formato canónico: `+` seguido del código de país y el número
// nacional, sin espacios, guiones ni paréntesis, con un máximo de 15 dígitos.
// `+56912345678`. Es lo que esperan WhatsApp, Twilio y cualquier API de envío,
// y es lo único que hace comparables dos filas: `+56 9 1234 5678`,
// `09-1234-5678` y `(9) 12345678` son la misma persona y tres strings distintos.
// Guardar lo que la persona tipeó garantiza duplicados que nadie va a detectar.
//
// Se guarda canónico y se muestra agrupado. Son dos cosas distintas y conviene
// no confundirlas: la base necesita comparar, la pantalla necesita leerse.
//
// ── Alcance, dicho de frente ─────────────────────────────────────────────────
//
// Esto NO es libphonenumber. Valida el largo del número nacional contra un
// rango por país y poco más: no sabe qué prefijos móviles existen en Perú ni
// distingue un fijo de un celular en Brasil. Alcanza para lo que hace este
// formulario —evitar basura y guardar algo marcable— y no pretende más.
//
// Si algún día hace falta rigor de verdad (validar por operador, formatear
// según convención local, cubrir los 250 países), la respuesta es
// `libphonenumber-js`, no crecer este archivo. Se dejó fuera a propósito: son
// ~30KB comprimidos en una página pública para un campo opcional.

/** Un país que la lista ofrece. `largo` es el rango del número nacional. */
export interface Pais {
  iso: string;
  nombre: string;
  /** Código de país, sin el `+`. */
  codigo: string;
  largo: [min: number, max: number];
  /** Cómo se ve un número de ahí. Va de placeholder. */
  ejemplo: string;
}

/**
 * Ordenada alfabéticamente por nombre de país, que es como la gente busca.
 * Chile primero no: se busca por nombre, y el valor por defecto se elige aparte.
 *
 * La lista es la de la audiencia real del boletín —Latinoamérica, España y
 * Norteamérica—, no un catálogo mundial. Un `select` de 250 países es peor de
 * usar y ninguno de los que faltan se ha visto en la lista. Agregar uno es
 * agregar una fila.
 */
export const PAISES: Pais[] = [
  { iso: "DE", nombre: "Alemania", codigo: "49", largo: [10, 11], ejemplo: "1512 3456789" },
  { iso: "AR", nombre: "Argentina", codigo: "54", largo: [10, 11], ejemplo: "9 11 2345 6789" },
  { iso: "BO", nombre: "Bolivia", codigo: "591", largo: [8, 8], ejemplo: "7123 4567" },
  { iso: "BR", nombre: "Brasil", codigo: "55", largo: [10, 11], ejemplo: "11 91234 5678" },
  { iso: "CA", nombre: "Canadá", codigo: "1", largo: [10, 10], ejemplo: "416 555 0123" },
  { iso: "CL", nombre: "Chile", codigo: "56", largo: [9, 9], ejemplo: "9 1234 5678" },
  { iso: "CO", nombre: "Colombia", codigo: "57", largo: [10, 10], ejemplo: "301 234 5678" },
  { iso: "CR", nombre: "Costa Rica", codigo: "506", largo: [8, 8], ejemplo: "8312 3456" },
  { iso: "EC", nombre: "Ecuador", codigo: "593", largo: [9, 9], ejemplo: "99 123 4567" },
  { iso: "SV", nombre: "El Salvador", codigo: "503", largo: [8, 8], ejemplo: "7123 4567" },
  { iso: "ES", nombre: "España", codigo: "34", largo: [9, 9], ejemplo: "612 345 678" },
  { iso: "US", nombre: "Estados Unidos", codigo: "1", largo: [10, 10], ejemplo: "415 555 0123" },
  { iso: "FR", nombre: "Francia", codigo: "33", largo: [9, 9], ejemplo: "6 12 34 56 78" },
  { iso: "GT", nombre: "Guatemala", codigo: "502", largo: [8, 8], ejemplo: "5123 4567" },
  { iso: "HN", nombre: "Honduras", codigo: "504", largo: [8, 8], ejemplo: "9123 4567" },
  { iso: "IT", nombre: "Italia", codigo: "39", largo: [9, 10], ejemplo: "312 345 6789" },
  { iso: "MX", nombre: "México", codigo: "52", largo: [10, 10], ejemplo: "55 1234 5678" },
  { iso: "NI", nombre: "Nicaragua", codigo: "505", largo: [8, 8], ejemplo: "8123 4567" },
  { iso: "PA", nombre: "Panamá", codigo: "507", largo: [8, 8], ejemplo: "6123 4567" },
  { iso: "PY", nombre: "Paraguay", codigo: "595", largo: [9, 9], ejemplo: "981 234 567" },
  { iso: "PE", nombre: "Perú", codigo: "51", largo: [9, 9], ejemplo: "912 345 678" },
  { iso: "PT", nombre: "Portugal", codigo: "351", largo: [9, 9], ejemplo: "912 345 678" },
  { iso: "GB", nombre: "Reino Unido", codigo: "44", largo: [10, 10], ejemplo: "7400 123456" },
  { iso: "DO", nombre: "República Dominicana", codigo: "1", largo: [10, 10], ejemplo: "809 234 5678" },
  { iso: "UY", nombre: "Uruguay", codigo: "598", largo: [8, 9], ejemplo: "94 123 456" },
  { iso: "VE", nombre: "Venezuela", codigo: "58", largo: [10, 10], ejemplo: "412 123 4567" },
];

/** El país que viene elegido. La audiencia del boletín es mayoritariamente de acá. */
export const PAIS_POR_DEFECTO = "CL";

export const paisPorIso = (iso: string) => PAISES.find((p) => p.iso === iso);

export type ResultadoTelefono =
  | { ok: true; e164: string }
  /** Vacío no es un error: el campo es opcional. */
  | { ok: true; e164: null }
  | { ok: false; motivo: string };

/**
 * Convierte lo que se escribió en E.164, o explica por qué no se puede.
 *
 * Tolera lo que la gente escribe de verdad: espacios, guiones, paréntesis, el
 * código de país repetido —porque el `select` ya lo dice y aun así se tipea—, y
 * el 0 de tránsito que en media Latinoamérica se marca antes del número.
 *
 * Si el número no es válido se devuelve el motivo, no un `null` silencioso.
 * Guardar un teléfono roto es peor que no guardarlo: se descubre el día que se
 * intenta escribir a esa persona.
 */
export function normalizarTelefono(iso: string, entrada: string | null | undefined): ResultadoTelefono {
  const crudo = (entrada ?? "").trim();
  if (!crudo) return { ok: true, e164: null };

  const pais = paisPorIso(iso);
  if (!pais) return { ok: false, motivo: "Elige el país del número." };

  let digitos = crudo.replace(/\D/g, "");
  if (!digitos) return { ok: false, motivo: "El teléfono no tiene números." };

  // El código de país escrito a mano además del que dice el `select`. Solo se
  // quita si lo que queda sigue teniendo un largo plausible: si no, "56" bien
  // puede ser el principio del número y quitarlo lo rompería.
  if (digitos.startsWith(pais.codigo)) {
    const sinCodigo = digitos.slice(pais.codigo.length);
    if (sinCodigo.length >= pais.largo[0]) digitos = sinCodigo;
  }

  // 0 de tránsito nacional. No existe en E.164.
  digitos = digitos.replace(/^0+/, "");

  const [min, max] = pais.largo;
  if (digitos.length < min || digitos.length > max) {
    const esperado = min === max ? `${min} dígitos` : `entre ${min} y ${max} dígitos`;
    return {
      ok: false,
      motivo: `Un número de ${pais.nombre} tiene ${esperado}, y escribiste ${digitos.length}.`,
    };
  }

  const e164 = `+${pais.codigo}${digitos}`;
  // El techo del estándar. Con los rangos de arriba no se alcanza, pero si
  // alguien agrega un país mal cargado, esto lo ataja antes de la base.
  if (e164.length > 16) return { ok: false, motivo: "El número es demasiado largo." };

  return { ok: true, e164 };
}

/**
 * `+56912345678` → `+56 9 1234 5678`. Para mostrar, nunca para guardar.
 *
 * La agrupación sale del `ejemplo` de cada país en vez de una heurística: cada
 * país agrupa distinto —Chile 1-4-4, México 2-4-4, España 3-3-3— y adivinarlo
 * por el largo daba `+52 5 5123 45678`, que es el número correcto escrito de una
 * forma que un mexicano no reconoce. El ejemplo ya tenía el dato; no hacía falta
 * un campo nuevo que mantener en sincronía con él.
 */
export function mostrarTelefono(e164: string | null): string {
  if (!e164) return "";
  // El más largo primero: +1 es prefijo de nada, pero +59 lo es de +591 y +598.
  const pais = [...PAISES]
    .sort((a, b) => b.codigo.length - a.codigo.length)
    .find((p) => e164.startsWith(`+${p.codigo}`));
  if (!pais) return e164;

  const nacional = e164.slice(pais.codigo.length + 1);
  const tamanos = pais.ejemplo.split(" ").map((g) => g.length);

  const grupos: string[] = [];
  let i = 0;
  for (const t of tamanos) {
    if (i >= nacional.length) break;
    grupos.push(nacional.slice(i, i + t));
    i += t;
  }
  // Lo que sobre —un país con rango de largo variable— va al final antes que
  // perderse.
  if (i < nacional.length) grupos.push(nacional.slice(i));

  return `+${pais.codigo} ${grupos.join(" ")}`;
}
