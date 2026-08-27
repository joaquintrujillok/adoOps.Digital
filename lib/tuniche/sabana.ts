// La sábana consolidada, con los datos adentro.
//
// **Qué es esta pantalla y por qué hacía falta aparte del historial.** El
// historial por lote responde "¿qué pasó en este campo?". La sábana responde la
// otra pregunta, que es la que ellos se hacen todos los días: "¿cómo va la
// temporada completa?". René y Francisco piensan en filas —una por lote, con
// todo al lado— y no en fichas. Darles solo fichas es pedirles que abandonen la
// forma en que miran su trabajo.
//
// **Las columnas dependen del área, y eso no se puede unificar.** MN mide en
// etapas fenológicas del maíz y Altué en momentos de la producción de semilla
// híbrida. Una tabla con las columnas de los dos tendría, para cualquier fila,
// treinta celdas vacías que no significan "falta el dato" sino "no aplica" — y
// esas dos cosas se ven igual en una planilla. Por eso se elige el área.

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  tunicheAgricultores,
  tunicheInformes,
  tunicheLotes,
  tunicheVisitas,
} from "@/db/tuniche";
import type { AreaId } from "./areas";
import { etapasDe } from "./plantillas";
import type { Alcance } from "./session";

export interface Columna {
  id: string;
  etiqueta: string;
  /** `identificacion` viene precargada · `estado` lo aporta el sistema · `hito` es la capa 3. */
  grupo: "identificacion" | "estado" | "hito";
  /** Alinea a la derecha y se exporta sin comillas. */
  numerica?: boolean;
  /** La etapa a la que pertenece, si es un hito. Ordena las cabeceras. */
  etapa?: string;
}

/**
 * Fila de la sábana: un lote, con todo al lado.
 *
 * Las celdas van en su propio objeto y no mezcladas con `loteId`/`demo`: son
 * datos de la tabla y los otros dos son de la aplicación —el enlace a la ficha
 * y la marca de demostración—. Mezclarlos obligaría a filtrar claves con guión
 * bajo en cada recorrido, incluida la exportación a CSV, donde una columna
 * `_demo` en la planilla del cliente sería exactamente lo que no queremos.
 */
export interface Fila {
  loteId: number;
  demo: boolean;
  celdas: Record<string, string | number | null>;
}

/**
 * Las columnas de identificación. Salen de la maestra, no de la plantilla, y por
 * eso están acá y no en `plantillas.ts`: son el esquema de `tuniche_lotes`.
 *
 * Las que no aplican a un área se omiten en vez de mostrarse vacías. Una columna
 * `RELACION (H:M)` vacía en todas las filas de Mercado Nacional no informa nada
 * y hace scrollear.
 */
function columnasIdentificacion(area: AreaId): Columna[] {
  const comunes: Columna[] = [
    { id: "codigo", etiqueta: "Lote", grupo: "identificacion" },
    { id: "agricultor", etiqueta: "Agricultor", grupo: "identificacion" },
    { id: "localidad", etiqueta: "Localidad", grupo: "identificacion" },
    { id: "zonal", etiqueta: "Zonal", grupo: "identificacion" },
    { id: "temporada", etiqueta: "Temporada", grupo: "identificacion" },
    { id: "cultivo", etiqueta: "Cultivo", grupo: "identificacion" },
    { id: "variedad", etiqueta: "Variedad", grupo: "identificacion" },
    { id: "hectareas", etiqueta: "Hectáreas", grupo: "identificacion", numerica: true },
    { id: "objetivo", etiqueta: "Objetivo", grupo: "identificacion" },
  ];
  const propias: Record<AreaId, Columna[]> = {
    altue: [
      { id: "relacionHm", etiqueta: "Relación H:M", grupo: "identificacion" },
      { id: "idase", etiqueta: "N° IDASE", grupo: "identificacion" },
      { id: "clienteFinal", etiqueta: "Cliente", grupo: "identificacion" },
    ],
    mn: [
      { id: "tipoSemilla", etiqueta: "Tipo de semilla", grupo: "identificacion" },
      { id: "clienteFinal", etiqueta: "Distribuidor", grupo: "identificacion" },
    ],
  };
  return [...comunes, ...propias[area]];
}

/**
 * Lo que el sistema aporta y el Excel no tenía: el estado al día de hoy.
 *
 * Es la mitad del argumento de esta pantalla. La sábana de René dice qué se
 * plantó; esto dice **cómo va**, y se actualiza solo cada vez que entra un audio.
 */
const COLUMNAS_ESTADO: Columna[] = [
  { id: "etapaActual", etiqueta: "Etapa actual", grupo: "estado" },
  { id: "visitas", etiqueta: "Visitas", grupo: "estado", numerica: true },
  { id: "ultimaVisita", etiqueta: "Última visita", grupo: "estado" },
  { id: "nota", etiqueta: "Nota agronómica", grupo: "estado", numerica: true },
  { id: "riego", etiqueta: "Riego", grupo: "estado" },
  { id: "malezas", etiqueta: "Malezas", grupo: "estado" },
  { id: "sanidad", etiqueta: "Sanidad", grupo: "estado" },
  { id: "informes", etiqueta: "Informes", grupo: "estado", numerica: true },
];

/** Las columnas de hitos del área: la capa 3, etapa por etapa. */
function columnasHitos(area: AreaId): Columna[] {
  return etapasDe(area).flatMap((e) =>
    e.campos.map<Columna>((c) => ({
      id: `hito.${c.id}`,
      etiqueta: c.etiqueta,
      grupo: "hito",
      etapa: e.nombre,
      numerica: c.tipo === "numero" || c.tipo === "porcentaje",
    })),
  );
}

export type Vista = "resumen" | "completa";

/**
 * `resumen` deja fuera los hitos. Son 24 columnas en Altué y 30 en MN, y quien
 * abre la sábana para saber cómo va la temporada no las necesita: las mira
 * cuando va a llenar una etapa. `completa` es la sábana entera, tal como el
 * Excel, y es la que se exporta.
 */
export function columnasDe(area: AreaId, vista: Vista): Columna[] {
  const base = [...columnasIdentificacion(area), ...COLUMNAS_ESTADO];
  return vista === "completa" ? [...base, ...columnasHitos(area)] : base;
}

function fecha(d: Date | null): string | null {
  if (!d) return null;
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/**
 * Las filas de un área, ya filtradas por alcance.
 *
 * El filtro por alcance va sobre el agricultor y no sobre el lote, por la misma
 * razón que en el resto del módulo: un zonal ve los agricultores que tiene
 * asignados, no los que visitó. Si filtrara por visitas, un zonal recién llegado
 * abriría la sábana vacía y no tendría por dónde empezar.
 */
export async function filasDe(area: AreaId, a: Alcance): Promise<Fila[]> {
  const condiciones = [eq(tunicheLotes.area, area)];
  if (!a.todo && a.soloUsuarioId != null) {
    condiciones.push(eq(tunicheAgricultores.zonalId, a.soloUsuarioId));
  }

  const lotes = await db
    .select({ lote: tunicheLotes, agricultor: tunicheAgricultores })
    .from(tunicheLotes)
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .where(and(...condiciones))
    .orderBy(tunicheAgricultores.razonSocial, tunicheLotes.codigo);

  if (lotes.length === 0) return [];
  const ids = lotes.map((l) => l.lote.id);

  // Última visita validada por lote. Se traen todas y se elige en memoria: son
  // decenas de lotes por área y por temporada, y un DISTINCT ON por lote en
  // Drizzle costaría más de leer que lo que ahorra en la base.
  const visitas = await db
    .select()
    .from(tunicheVisitas)
    .where(
      and(
        inArray(tunicheVisitas.loteId, ids),
        inArray(tunicheVisitas.estado, ["validada", "corregida"]),
      ),
    )
    .orderBy(desc(tunicheVisitas.fecha));

  const informes = await db
    .select({ loteId: tunicheInformes.loteId, n: sql<number>`count(*)::int` })
    .from(tunicheInformes)
    .where(inArray(tunicheInformes.loteId, ids))
    .groupBy(tunicheInformes.loteId);

  return lotes.map(({ lote, agricultor }) => {
    const suyas = visitas.filter((v) => v.loteId === lote.id);
    const ultima = suyas[0];
    const datos = (ultima?.datos ?? {}) as Record<string, unknown>;
    const hitos = (lote.hitos ?? {}) as Record<string, unknown>;

    const celdas: Record<string, string | number | null> = {
      codigo: lote.codigo,
      agricultor: agricultor.razonSocial,
      localidad: agricultor.localidad,
      zonal: agricultor.zonalNombre,
      temporada: lote.temporada,
      cultivo: lote.cultivo,
      variedad: lote.variedad,
      hectareas: lote.hectareas,
      objetivo: lote.objetivo,
      relacionHm: lote.relacionHm,
      idase: lote.idase,
      clienteFinal: lote.clienteFinal,
      tipoSemilla: lote.tipoSemilla,
      etapaActual: ultima?.etapa ?? lote.etapaActual,
      visitas: suyas.length,
      ultimaVisita: fecha(ultima?.fecha ?? null),
      nota: ultima?.notaAgronomica ?? null,
      riego: (datos.riego as string) ?? null,
      malezas: (datos.malezas_presion as string) ?? null,
      sanidad: (datos.sanidad as string) ?? null,
      informes: informes.find((i) => i.loteId === lote.id)?.n ?? 0,
    };

    for (const [k, v] of Object.entries(hitos)) {
      celdas[`hito.${k}`] = v == null ? null : String(v);
    }
    return { loteId: lote.id, demo: lote.demo, celdas };
  });
}

/**
 * La sábana en CSV, con la vista completa.
 *
 * **Existe porque no van a dejar Excel de un día para otro**, y pedirlo sería la
 * forma más rápida de que no usen esto. La salida es la misma tabla, así que
 * quien quiera seguir cruzando datos en una planilla puede, sin volver a
 * transcribir nada a mano — que es el trabajo que este módulo viene a borrar.
 *
 * Separador `;` y BOM: es lo que Excel en español abre sin preguntar nada. Con
 * coma, Excel en es-CL mete la fila entera en la primera celda.
 */
export function aCsv(columnas: Columna[], filas: Fila[]): string {
  const escapar = (v: string | number | null): string => {
    if (v == null) return "";
    const s = String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cabecera = columnas.map((c) => escapar(c.etiqueta)).join(";");
  const cuerpo = filas.map((f) => columnas.map((c) => escapar(f.celdas[c.id] ?? null)).join(";"));
  return `﻿${[cabecera, ...cuerpo].join("\r\n")}\r\n`;
}
