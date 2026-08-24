// Importación de Google Ads desde el CSV que exporta la interfaz.
//
// **Por qué existe teniendo ya el cliente de la API.** Mientras el developer
// token esté esperando el acceso básico, la API no devuelve datos de cuentas de
// producción. Este camino no pasa por la API: es el mismo informe que cualquiera
// descarga desde la pantalla de campañas, y entra en la misma tabla que va a
// escribir el conector. El panel no distingue el origen.
//
// Sigue siendo útil después de la aprobación: es el respaldo cuando la API falla
// o Google rota una versión, y permite cargar historia más larga que la ventana
// de treinta días que consulta el cron.
//
// **La trampa del formato, que costaría cuatro veces la inversión real.** El
// export trae, además de una fila por campaña y día, filas de subtotal:
// «Total: Campañas», «Total: Cuenta» y «Total: Búsqueda». En el archivo de
// prueba eran 50 de 83 filas. Sumarlas todas daba CLP 460.135 cuando la
// inversión real era CLP 115.028 — exactamente cuatro veces. Se descarta toda
// fila cuyo estado empiece con «Total:».
//
// A diferencia de la API, **el costo del CSV ya viene en pesos**, no en
// millonésimas. Dividir acá por un millón dejaría todo en cero.

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Metricas } from "@/db/dashboard360";

const SLUG = "google_ads";

/** Encabezados que esperamos, para fallar temprano si Google cambia el export. */
const COLUMNAS = {
  dia: "Día",
  estado: "Estado de la campaña",
  campania: "Campaña",
  conversiones: "Conversiones",
  impresiones: "Impr.",
  clics: "Clics",
  costo: "Costo",
} as const;

/** Parser de CSV con comillas. Los nombres de campaña pueden traer comas. */
function parseCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') enComillas = true;
    else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

/** «1.234», « --», «11,54%» → número. Vacío y guiones cuentan como cero. */
function numero(s: string | undefined): number {
  const limpio = (s ?? "").trim().replace(/%/g, "").replace(/,/g, "").replace(/^--$/, "");
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

export interface ResultadoImportacion {
  filasEnArchivo: number;
  filasDeSubtotal: number;
  filasImportadas: number;
  desde: string;
  hasta: string;
  inversionClp: number;
  impresiones: number;
  clics: number;
  conversiones: number;
  campanias: string[];
}

export async function importarCsvGoogleAds(
  contenido: string,
  cuenta?: string,
): Promise<ResultadoImportacion> {
  const filas = parseCsv(contenido).filter((f) => f.some((c) => c.trim() !== ""));

  // El export abre con dos líneas de portada —título y rango— antes del
  // encabezado. Se busca la fila de encabezado en vez de asumir que es la
  // tercera: si Google agrega una línea, saltar un número fijo rompe callado.
  const iHdr = filas.findIndex((f) => f[0]?.trim() === COLUMNAS.dia);
  if (iHdr === -1) {
    throw new Error(
      `No se encontró la fila de encabezado (se esperaba una columna «${COLUMNAS.dia}»). ¿Es un informe de campaña segmentado por día?`,
    );
  }

  const hdr = filas[iHdr].map((h) => h.trim());
  const idx = Object.fromEntries(
    Object.entries(COLUMNAS).map(([k, etiqueta]) => {
      const i = hdr.indexOf(etiqueta);
      if (i === -1) throw new Error(`Falta la columna «${etiqueta}» en el CSV`);
      return [k, i];
    }),
  ) as Record<keyof typeof COLUMNAS, number>;

  const datos = filas.slice(iHdr + 1);
  const subtotales = datos.filter((f) => f[idx.estado]?.trim().startsWith("Total:"));
  const reales = datos.filter(
    (f) => !f[idx.estado]?.trim().startsWith("Total:") && f[idx.campania]?.trim(),
  );

  const registros = reales.map((f) => ({
    fecha: f[idx.dia].trim(),
    fuenteSlug: SLUG,
    tipo: "ads" as const,
    campania: f[idx.campania].trim(),
    impresiones: Math.round(numero(f[idx.impresiones])),
    clics: Math.round(numero(f[idx.clics])),
    // Ya viene en pesos: el CSV de la interfaz no usa micros.
    costoClp: Math.round(numero(f[idx.costo])),
    leads: Math.round(numero(f[idx.conversiones])),
  }));

  if (!registros.length) {
    throw new Error("El CSV no trae ninguna fila de campaña (solo subtotales o está vacío)");
  }

  const fechas = registros.map((r) => r.fecha).sort();
  const desde = fechas[0];
  const hasta = fechas[fechas.length - 1];

  // Se reemplaza la ventana completa, igual que hace el cron: si el mismo rango
  // se importa dos veces, no se duplica.
  await db
    .delete(d360Metricas)
    .where(
      and(
        eq(d360Metricas.fuenteSlug, SLUG),
        gte(d360Metricas.fecha, desde),
        lte(d360Metricas.fecha, hasta),
      ),
    );

  const LOTE = 200;
  for (let i = 0; i < registros.length; i += LOTE) {
    await db.insert(d360Metricas).values(registros.slice(i, i + LOTE));
  }

  await db
    .insert(d360Fuentes)
    .values({
      slug: SLUG,
      nombre: "Google Ads",
      tipo: "ads",
      estado: "conectada",
      cuenta: cuenta ?? null,
      ultimaSync: new Date(),
      frecuenciaMin: 1440,
      // Que el origen sea una carga manual no se esconde: la pantalla de fuentes
      // existe para que nadie confunda un dato viejo con uno fresco.
      ultimoError: null,
    })
    .onConflictDoUpdate({
      target: d360Fuentes.slug,
      set: {
        estado: "conectada",
        cuenta: cuenta ?? null,
        ultimaSync: new Date(),
        ultimoError: null,
      },
    });

  return {
    filasEnArchivo: datos.length,
    filasDeSubtotal: subtotales.length,
    filasImportadas: registros.length,
    desde,
    hasta,
    inversionClp: registros.reduce((s, r) => s + r.costoClp, 0),
    impresiones: registros.reduce((s, r) => s + r.impresiones, 0),
    clics: registros.reduce((s, r) => s + r.clics, 0),
    conversiones: registros.reduce((s, r) => s + r.leads, 0),
    campanias: [...new Set(registros.map((r) => r.campania))].sort(),
  };
}
