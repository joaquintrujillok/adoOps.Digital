// Normalización de los datos que entran al motor.
//
// Todo lo de acá salió de mirar los archivos reales del SII, no de suponer.
// El detalle está en docs/layout-sii.md; lo que importa acá es que **cada
// fuente trae los mismos datos escritos distinto**, y si no se normalizan en la
// puerta de entrada terminan duplicándose adentro.
//
// Tres casos concretos que ya nos íbamos a comer:
//   · el RUT viene partido en dos columnas y sin ceros a la izquierda
//   · la región viene como "XIII REGION METROPOLITANA", no como 13
//   · las fechas vienen en tres formatos distintos según el archivo

// ─── RUT ─────────────────────────────────────────────────────────────────────

/**
 * Dígito verificador por módulo 11. Se calcula, no se confía.
 *
 * El SII entrega el DV en columna aparte, pero un CSV llenado a mano trae el
 * RUT completo, con puntos, sin guion, o con el DV equivocado. Recalcularlo es
 * la única forma de que `12.345.678-5` y `123456785` no terminen siendo dos
 * empresas distintas en la base.
 */
export function digitoVerificador(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * Deja el RUT en la forma canónica `12345678-9`: sin puntos, con guion, DV en
 * mayúscula y sin ceros a la izquierda.
 *
 * Devuelve `null` si el DV no cuadra. Eso es deliberado: un RUT con DV malo no
 * es un RUT con una errata, es un dato que no se puede cruzar con ChileCompra
 * ni con el SII. Guardarlo "por si acaso" contamina la deduplicación, que es
 * justo lo que la clave única de `lead_empresas` existe para evitar.
 */
export function normalizarRut(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const limpio = String(entrada).replace(/[.\s-]/g, "").toUpperCase();
  if (limpio.length < 2) return null;

  const cuerpo = limpio.slice(0, -1).replace(/^0+/, "");
  const dv = limpio.slice(-1);
  if (!/^\d+$/.test(cuerpo) || !/^[\dK]$/.test(dv)) return null;
  if (digitoVerificador(cuerpo) !== dv) return null;

  return `${cuerpo}-${dv}`;
}

/** Para las nóminas del SII, que traen cuerpo y DV en columnas separadas. */
export function rutDesdePartes(
  cuerpo: string | null | undefined,
  dv: string | null | undefined,
): string | null {
  if (!cuerpo || !dv) return null;
  return normalizarRut(`${cuerpo}${dv}`);
}

// ─── Región ──────────────────────────────────────────────────────────────────

/**
 * El SII escribe la región como texto con numeral romano. Guardamos el código
 * numérico porque el texto es de presentación y ya cambió antes: "VIII REGION
 * DEL BIO BIO" convive con "VIII REGION DEL BIOBÍO" según el archivo y el año.
 *
 * El mapa se dedujo de los 16 valores distintos que trae PUB_EMPRESAS_PJ_2024,
 * más "Sin Información", que resuelve a null.
 */
const ROMANOS: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16,
};

export function normalizarRegion(entrada: string | number | null | undefined): number | null {
  if (entrada === null || entrada === undefined || entrada === "") return null;

  // Ya viene como número (un CSV nuestro, o Sales Navigator).
  const comoNumero = Number(entrada);
  if (Number.isInteger(comoNumero) && comoNumero >= 1 && comoNumero <= 16) {
    return comoNumero;
  }

  // "XIII REGION METROPOLITANA" → 13. El romano es siempre la primera palabra.
  const primera = String(entrada).trim().toUpperCase().split(/\s+/)[0];
  return ROMANOS[primera] ?? null;
}

// ─── Fechas ──────────────────────────────────────────────────────────────────

/**
 * Tres formatos conviven y ninguno es ISO completo:
 *   · `dd-mm-aaaa`  PUB_NOMBRES_PJ, PUB_NOM_ACTECOS
 *   · `aaaa-mm-dd`  PUB_EMPRESAS_PJ, PUB_NOM_DOMICILIO
 *   · `ddmmaaaa`    API de Mercado Público
 *
 * El parseo va por formato explícito y no por `new Date(texto)`: `05-06-2026`
 * lo interpreta el motor de JS como 5 de junio o 6 de mayo según el runtime, y
 * ese error no se nota hasta que una señal vence un mes antes de tiempo.
 */
export function fechaSii(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  const t = String(texto).trim();

  let m = t.match(/^(\d{2})-(\d{2})-(\d{4})$/); // dd-mm-aaaa
  if (m) return utc(+m[3], +m[2], +m[1]);

  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/); // aaaa-mm-dd
  if (m) return utc(+m[1], +m[2], +m[3]);

  m = t.match(/^(\d{2})(\d{2})(\d{4})$/); // ddmmaaaa — Mercado Público
  if (m) return utc(+m[3], +m[2], +m[1]);

  return null;
}

function utc(ano: number, mes: number, dia: number): Date | null {
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Descarta 31-02: el constructor lo desborda al mes siguiente en silencio.
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

/** El formato `ddmmaaaa` que exige la API de Mercado Público. */
export function fechaMercadoPublico(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}${p(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
}

// ─── Texto ───────────────────────────────────────────────────────────────────

/** Quita tildes y normaliza espacios. Para comparar, nunca para mostrar. */
export function plano(texto: string | null | undefined): string {
  return String(texto ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/**
 * El dominio, sin protocolo, sin `www.` y sin ruta. Es la llave con la que
 * Prospeo y FullEnrich buscan: `https://www.empresa.cl/contacto` y `empresa.cl`
 * tienen que resolver al mismo string o el enriquecimiento se paga dos veces.
 */
export function normalizarDominio(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const limpio = String(entrada)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  if (!limpio || !limpio.includes(".")) return null;
  return limpio;
}

/** Email en minúsculas y validado de forma conservadora. */
export function normalizarEmail(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const limpio = String(entrada).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio) ? limpio : null;
}

// ─── LinkedIn ────────────────────────────────────────────────────────────────

/**
 * Saca el `memberUrn` (`ACoAA...`) de cualquiera de las formas en que aparece:
 * el URN pelado, una URL de Sales Navigator (`/sales/lead/ACoAA...,NAME,abc`) o
 * un `urn:li:member:` completo.
 *
 * Lo que NO hace es aceptar el slug de `/in/`. Es a propósito: ese identificador
 * lo cambia el usuario cuando quiere, y deduplicar por él significa mandarle la
 * secuencia entera de nuevo a alguien que solo editó su URL.
 */
export function extraerMemberUrn(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const m = String(entrada).match(/(ACoA[A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** El slug de `/in/`. Se guarda para armar la URL; jamás para comparar. */
export function extraerPublicIdentifier(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const m = String(entrada).match(/linkedin\.com\/in\/([^/?#\s]+)/i);
  return m ? m[1].toLowerCase() : null;
}
