// Carga de prospectos por CSV.
//
// Es la única puerta de entrada del MVP: la ingesta automática del SII y de
// ChileCompra viene después, y a propósito. Automatizar la fuente antes de
// saber si el motor convierte es construir una cañería hacia un estanque del
// que no sabemos si tiene fondo.
//
// El archivo que espera es el que produce `scripts/fase0_sii.py muestra`, pero
// el mapeo de columnas es tolerante: acepta `razon_social`, `Razón Social` o
// `RAZONSOCIAL` sin que nadie tenga que renombrar nada a mano.
//
// **Cada dato entra con su procedencia.** El email que viene de la columna
// `prospeo_email` se guarda con `email_origen = 'prospeo'`, no con el origen
// del archivo. Es la diferencia entre poder contestar "de dónde saqué esto" y
// tener una base entera con `origen = 'csv'`, que no dice nada.

import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { leadEmpresas, leadPersonas, type LeadOrigen } from "@/db/leads";
import {
  extraerMemberUrn,
  extraerPublicIdentifier,
  normalizarDominio,
  normalizarEmail,
  normalizarRegion,
  normalizarRut,
} from "./normalizar";

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Parser mínimo de CSV, con comillas y saltos de línea dentro de campo.
 *
 * No se agrega una dependencia por esto: son cuarenta líneas, el formato está
 * congelado desde 2005 y el único caso raro que importa es el BOM que escribe
 * nuestro propio script de Fase 0 (`utf-8-sig`), que sin quitarlo convierte la
 * primera cabecera en `﻿rut` y rompe el mapeo entero de forma invisible.
 */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];

    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += c;
      continue;
    }

    if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila); }

  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

/** Compara cabeceras ignorando tildes, espacios, guiones y mayúsculas. */
function clave(cabecera: string): string {
  return cabecera
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Nombres aceptados por campo. El primero es el que produce la Fase 0. */
const ALIAS: Record<string, string[]> = {
  rut: ["rut", "rutempresa", "rutcompleto"],
  razonSocial: ["razonsocial", "nombre", "empresa", "nombreempresa"],
  acteco: ["acteco", "codigoactividad", "actividad"],
  rubro: ["rubro", "rubroeconomico"],
  tramoVentas: ["tramoventas", "tramosegunventas", "tramo"],
  region: ["region"],
  comuna: ["comuna"],
  dominio: ["dominio", "sitioweb", "web", "url"],
  // `email` NO va acá: el archivo de Fase 0 trae DOS columnas de correo
  // (prospeo_email y fullenrich_email) y se resuelven aparte, en EMAILS.
  linkedin: ["linkedinurl", "linkedin", "perfillinkedin"],
  nombrePersona: ["nombrecontacto", "contacto", "nombrepersona"],
  cargo: ["cargo", "puesto", "titulo"],
};

/**
 * Las columnas de correo, todas. Es multi-columna a propósito y fue un error
 * real: con un solo índice ganaba `prospeo_email` y `fullenrich_email` quedaba
 * ignorada en silencio — o sea, se perdían justo los contactos por los que se
 * gastaron los créditos de FullEnrich, que son los que Prospeo no resolvió.
 */
const EMAILS = ["prospeoemail", "fullenrichemail", "email", "correo", "mail"];

function mapearEmails(cabeceras: string[]): number[] {
  const normalizadas = cabeceras.map(clave);
  return EMAILS.map((a) => normalizadas.indexOf(a)).filter((i) => i >= 0);
}

function mapear(cabeceras: string[]): Record<string, number> {
  const normalizadas = cabeceras.map(clave);
  const mapa: Record<string, number> = {};
  for (const [campo, alias] of Object.entries(ALIAS)) {
    for (const a of alias) {
      const i = normalizadas.indexOf(a);
      if (i >= 0) { mapa[campo] = i; break; }
    }
  }
  return mapa;
}

/**
 * De qué proveedor vino el email, leído de la columna en que venía.
 * `prospeo_email` y `fullenrich_email` no son lo mismo y no cuestan lo mismo.
 */
function origenDelEmail(cabecera: string, porDefecto: LeadOrigen): LeadOrigen {
  const k = clave(cabecera);
  if (k.includes("prospeo")) return "prospeo";
  if (k.includes("fullenrich")) return "fullenrich";
  return porDefecto;
}

// ─── Importación ─────────────────────────────────────────────────────────────

export interface ResultadoImportacion {
  filas: number;
  empresasNuevas: number;
  empresasActualizadas: number;
  personasNuevas: number;
  rechazadas: { fila: number; motivo: string }[];
  columnasReconocidas: string[];
  columnasIgnoradas: string[];
}

/**
 * Importa un CSV de empresas, y de paso las personas que traiga.
 *
 * Deduplica por RUT normalizado. En una empresa que ya existe **solo rellena
 * los campos vacíos**: si alguien cargó el dominio a mano y el archivo nuevo lo
 * trae en blanco, el dominio a mano se queda. Sobrescribir con vacío es la
 * forma más común de perder trabajo manual en una segunda carga.
 */
export async function importarEmpresas(
  texto: string,
  opciones: { origen: LeadOrigen; obtenidoEn?: Date },
): Promise<ResultadoImportacion> {
  const obtenidoEn = opciones.obtenidoEn ?? new Date();
  const filas = parsearCsv(texto);

  if (filas.length < 2) {
    return {
      filas: 0, empresasNuevas: 0, empresasActualizadas: 0, personasNuevas: 0,
      rechazadas: [{ fila: 0, motivo: "El archivo no tiene filas de datos" }],
      columnasReconocidas: [], columnasIgnoradas: [],
    };
  }

  const cabeceras = filas[0];
  const mapa = mapear(cabeceras);
  const columnasEmail = mapearEmails(cabeceras);
  if (mapa.rut === undefined) {
    return {
      filas: filas.length - 1, empresasNuevas: 0, empresasActualizadas: 0, personasNuevas: 0,
      rechazadas: [{ fila: 0, motivo: `No encontré la columna del RUT. Cabeceras: ${cabeceras.join(", ")}` }],
      columnasReconocidas: [], columnasIgnoradas: cabeceras,
    };
  }

  const usadas = new Set([...Object.values(mapa), ...columnasEmail]);
  const resultado: ResultadoImportacion = {
    filas: filas.length - 1,
    empresasNuevas: 0,
    empresasActualizadas: 0,
    personasNuevas: 0,
    rechazadas: [],
    columnasReconocidas: [...usadas].map((i) => cabeceras[i]),
    columnasIgnoradas: cabeceras.filter((_, i) => !usadas.has(i)),
  };

  const valor = (fila: string[], campo: string): string | null => {
    const i = mapa[campo];
    if (i === undefined) return null;
    const v = (fila[i] ?? "").trim();
    return v === "" ? null : v;
  };

  for (let n = 1; n < filas.length; n++) {
    const fila = filas[n];
    const rut = normalizarRut(valor(fila, "rut"));
    const razonSocial = valor(fila, "razonSocial");

    // El RUT con DV inválido se rechaza en vez de guardarse "por si acaso":
    // un RUT que no cuadra no cruza contra el SII ni contra ChileCompra, y
    // contamina la clave única que sostiene la deduplicación.
    if (!rut) {
      resultado.rechazadas.push({ fila: n + 1, motivo: `RUT inválido: ${valor(fila, "rut") ?? "(vacío)"}` });
      continue;
    }
    if (!razonSocial) {
      resultado.rechazadas.push({ fila: n + 1, motivo: "Sin razón social" });
      continue;
    }

    const dominio = normalizarDominio(valor(fila, "dominio"));
    const tramoTexto = valor(fila, "tramoVentas");
    const tramo = tramoTexto && /^\d+$/.test(tramoTexto) ? Number(tramoTexto) : null;

    const existente = await db
      .select({ id: leadEmpresas.id, dominio: leadEmpresas.dominio })
      .from(leadEmpresas)
      .where(eq(leadEmpresas.rut, rut))
      .limit(1);

    let empresaId: number;

    if (existente.length === 0) {
      const [creada] = await db
        .insert(leadEmpresas)
        .values({
          rut,
          razonSocial,
          acteco: valor(fila, "acteco"),
          rubro: valor(fila, "rubro"),
          tramoVentas: tramo,
          // El tramo del SII es del año comercial 2024; sin el año, el número
          // no se puede leer en 2027. Ver docs/layout-sii.md.
          tramoVentasAno: tramo !== null ? 2024 : null,
          region: normalizarRegion(valor(fila, "region")),
          comuna: valor(fila, "comuna"),
          dominio,
          dominioOrigen: dominio ? opciones.origen : null,
          dominioObtenidoEn: dominio ? obtenidoEn : null,
          origen: opciones.origen,
          obtenidoEn,
        })
        .returning({ id: leadEmpresas.id });
      empresaId = creada.id;
      resultado.empresasNuevas++;
    } else {
      empresaId = existente[0].id;
      // Solo rellena huecos. Nunca pisa un dato que ya estaba.
      if (dominio && !existente[0].dominio) {
        await db
          .update(leadEmpresas)
          .set({ dominio, dominioOrigen: opciones.origen, dominioObtenidoEn: obtenidoEn })
          .where(eq(leadEmpresas.id, empresaId));
      }
      resultado.empresasActualizadas++;
    }

    // ── La persona, si el archivo la trae ──
    // Se toma el primer correo no vacío en el orden de EMAILS: Prospeo primero
    // porque es el que se corre primero y renueva créditos todos los meses.
    let email: string | null = null;
    let columnaEmail: string | null = null;
    for (const i of columnasEmail) {
      const candidato = normalizarEmail((fila[i] ?? "").trim() || null);
      if (candidato) { email = candidato; columnaEmail = cabeceras[i]; break; }
    }
    const linkedin = valor(fila, "linkedin");
    const memberUrn = extraerMemberUrn(linkedin);
    const nombrePersona = valor(fila, "nombrePersona");

    if (!email && !memberUrn) continue;

    // Sin nombre no hay a quién escribirle, pero el contacto igual sirve como
    // dato de la empresa. Se guarda con un nombre provisorio explícito en vez
    // de inventar uno a partir del email.
    const nombre = nombrePersona ?? "(sin nombre)";

    const yaExiste = await db
      .select({ id: leadPersonas.id })
      .from(leadPersonas)
      .where(
        or(
          memberUrn ? eq(leadPersonas.memberUrn, memberUrn) : undefined,
          email ? and(eq(leadPersonas.empresaId, empresaId), eq(leadPersonas.email, email)) : undefined,
        ),
      )
      .limit(1);
    if (yaExiste.length > 0) continue;

    await db.insert(leadPersonas).values({
      empresaId,
      nombre,
      cargo: valor(fila, "cargo"),
      memberUrn,
      publicIdentifier: extraerPublicIdentifier(linkedin),
      linkedinOrigen: linkedin ? opciones.origen : null,
      linkedinObtenidoEn: linkedin ? obtenidoEn : null,
      email,
      // El origen sale de la columna, no del archivo: prospeo y fullenrich son
      // proveedores distintos, con costos y tasas de acierto distintos.
      emailOrigen: email && columnaEmail ? origenDelEmail(columnaEmail, opciones.origen) : null,
      emailObtenidoEn: email ? obtenidoEn : null,
    });
    resultado.personasNuevas++;
  }

  return resultado;
}

// ─── Consultas de la pantalla ────────────────────────────────────────────────

export async function contarEmpresas(): Promise<{
  empresas: number;
  conDominio: number;
  personas: number;
  conEmail: number;
}> {
  // Sin joins ni subconsultas correlacionadas a propósito: son cuatro conteos
  // sobre dos tablas y el volumen del MVP son cientos de filas, no millones.
  const [empresas, conDominio, personas, conEmail] = await Promise.all([
    db.select({ id: leadEmpresas.id }).from(leadEmpresas),
    db.select({ id: leadEmpresas.id }).from(leadEmpresas).where(isNull(leadEmpresas.dominio)),
    db.select({ id: leadPersonas.id }).from(leadPersonas),
    db.select({ id: leadPersonas.id }).from(leadPersonas).where(isNull(leadPersonas.email)),
  ]);
  return {
    empresas: empresas.length,
    conDominio: empresas.length - conDominio.length,
    personas: personas.length,
    conEmail: personas.length - conEmail.length,
  };
}
