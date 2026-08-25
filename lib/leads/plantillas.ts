// Render de las plantillas de la secuencia.
//
// Las plantillas viven en `lead_secuencias.plantilla`, o sea en la base: se
// editan sin desplegar. Acá solo se reemplazan las variables y se aplican dos
// resguardos que se aprendieron caro en el CRM de CDC.
//
// ── Resguardo 1 · el nombre puede ser basura ─────────────────────────────────
//
// En CDC el saludo decía "Hola {nombre}" y el campo era libre: había
// cotizaciones a nombre de "mama rn nacido", "Boleta Sin Datos Del Paciente" y
// "Cotizacion", con teléfono real. Cada forma nueva exigía otra regla, y la que
// faltaba se descubría cuando el paciente ya había recibido el mensaje.
//
// Acá el nombre viene de un perfil de LinkedIn, así que la calidad es mucho
// mejor — pero el enriquecimiento por cascada también devuelve cosas como
// "Gerente Comercial" o "Contacto" en el campo nombre. El saludo cae a una
// forma genérica cuando el nombre no parece un nombre, en vez de salir absurdo.
//
// ── Resguardo 2 · la nota de invitación se corta en 300 ──────────────────────
//
// LinkedIn trunca sin avisar. Un mensaje cortado a media frase se lee peor que
// uno corto, así que acá falla al construirlo y no en la red.

import { TOPE_NOTA_INVITACION } from "./escalera";

export interface Variables {
  nombre: string | null;
  empresa: string | null;
  senal: string | null;
  cargo: string | null;
}

/** Palabras que aparecen en el campo nombre cuando lo que hay no es una persona. */
const NO_ES_NOMBRE =
  /\b(contacto|gerente|jefe|jefa|encargad|administraci|ventas|informacion|información|soporte|sin datos|desconocid|n\/?a|test|prueba)\b/i;

export function esNombreUsable(n: string | null | undefined): boolean {
  if (!n) return false;
  const limpio = n.trim();
  if (limpio.length < 2 || limpio.length > 60) return false;
  if (/^\d+$/.test(limpio)) return false;
  if (/[@/\\]|https?:/i.test(limpio)) return false;
  if (NO_ES_NOMBRE.test(limpio)) return false;
  return true;
}

/** El primer nombre, capitalizado. "JUAN PABLO PÉREZ" → "Juan". */
export function primerNombre(n: string | null | undefined): string | null {
  if (!esNombreUsable(n)) return null;
  const primero = n!.trim().split(/\s+/)[0];
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

export class PlantillaInvalida extends Error {}

/**
 * Reemplaza `{{nombre}}`, `{{empresa}}`, `{{senal}}` y `{{cargo}}`.
 *
 * Una variable sin dato deja el texto **sin la frase**, no con un hueco: es
 * preferible una oración menos a un mensaje que diga "vi que undefined ganó una
 * licitación". Por eso el reemplazo de `{{empresa}}` y `{{senal}}` colapsa la
 * oración completa cuando falta el dato.
 */
export function renderizar(plantilla: string, v: Variables): string {
  const nombre = primerNombre(v.nombre);

  let texto = plantilla;

  // Sin nombre usable, el saludo se vuelve genérico en vez de fallar.
  texto = texto.replace(/\{\{nombre\}\}/g, nombre ?? "");
  texto = texto.replace(/Hola\s*,/g, "Hola,");
  texto = texto.replace(/^Hola\s+,/gm, "Hola,");

  texto = texto.replace(/\{\{empresa\}\}/g, v.empresa ?? "tu equipo");
  texto = texto.replace(/\{\{cargo\}\}/g, v.cargo ?? "");
  texto = texto.replace(/\{\{senal\}\}/g, v.senal ?? "");

  // Una variable vacía deja dobles espacios y comas colgando.
  texto = texto
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/,\s*\./g, ".")
    .trim();

  return texto;
}

/**
 * Valida el largo según el tipo de acción y devuelve el texto listo.
 * Lanza en vez de truncar: el truncado silencioso es el problema.
 */
export function renderizarPaso(
  tipo: string,
  plantilla: string,
  v: Variables,
): string {
  const texto = renderizar(plantilla, v);

  if (tipo === "invitacion" && texto.length > TOPE_NOTA_INVITACION) {
    throw new PlantillaInvalida(
      `La nota de invitación quedó en ${texto.length} caracteres y el tope de LinkedIn es ${TOPE_NOTA_INVITACION}. ` +
        `Acortá la plantilla del paso 1 — con la señal adentro, el texto crece con cada prospecto.`,
    );
  }

  if (!texto) {
    throw new PlantillaInvalida("La plantilla quedó vacía después de reemplazar las variables");
  }

  return texto;
}
