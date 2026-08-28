// Reportería de gestión.
//
// **No confundir con `informes.ts`.** Un informe es un documento que sale de
// Tuniche hacia un tercero —el agricultor, el cliente— y por eso se congela, se
// aprueba y se registra su envío. Esto es lo contrario: mira hacia adentro, no
// sale a ninguna parte, y se recalcula entero en cada carga porque su valor es
// justamente estar al día.
//
// **Qué pregunta responde.** No "¿qué pasó en este campo?" —eso es el historial—
// ni "¿cómo va la temporada?" —eso es la sábana—, sino la del que dirige el
// área: **¿qué se está quedando sin mirar?** Un sistema que solo muestra lo que
// se hizo deja invisible lo que no se hizo, y lo que no se hizo es lo que duele.

import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  tunicheAgricultores,
  tunicheInformes,
  tunicheLotes,
  tunicheUsuarios,
  tunicheVisitas,
} from "@/db/tuniche";
import type { AreaId } from "./areas";
import type { Alcance } from "./session";

export interface LoteEnReporte {
  id: number;
  codigo: string;
  agricultor: string;
  zonal: string | null;
  demo: boolean;
  visitas: number;
  ultima: Date | null;
  /** Días desde la última visita validada. `null` si nunca se visitó. */
  dias: number | null;
  nota: number | null;
  riego: string | null;
  malezas: string | null;
  sanidad: string | null;
}

export interface PorZonal {
  zonal: string;
  visitas: number;
  lotes: number;
  nota: number | null;
}

export interface Reporte {
  desde: Date;
  lotes: LoteEnReporte[];
  /** Lotes sin ninguna visita validada, nunca. */
  nuncaVisitados: LoteEnReporte[];
  /** Con visitas, pero ninguna dentro del periodo. Ordenados por antigüedad. */
  atrasados: LoteEnReporte[];
  alertas: LoteEnReporte[];
  porZonal: PorZonal[];
  visitasPeriodo: number;
  notaPromedio: number | null;
  informes: { generados: number; conVistoBueno: number; enviados: number };
  /** Visitas validadas del periodo que todavía no produjeron informe. */
  sinInforme: number;
}

/** Lo que se considera una señal de alerta en la última visita de un lote. */
const ALERTA = {
  riego: ["crítico", "a mejorar"],
  malezas: ["alta"],
  sanidad: ["con problema", "en observación"],
};

export async function armarReporte(
  area: AreaId,
  a: Alcance,
  dias: number,
): Promise<Reporte> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const condiciones = [eq(tunicheLotes.area, area), eq(tunicheLotes.activo, true)];
  if (!a.todo && a.soloUsuarioId != null) {
    condiciones.push(eq(tunicheAgricultores.zonalId, a.soloUsuarioId));
  }

  const lotes = await db
    .select({
      id: tunicheLotes.id,
      codigo: tunicheLotes.codigo,
      demo: tunicheLotes.demo,
      agricultor: tunicheAgricultores.razonSocial,
      zonal: tunicheAgricultores.zonalNombre,
    })
    .from(tunicheLotes)
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .where(and(...condiciones))
    .orderBy(tunicheLotes.codigo);

  const ids = lotes.map((l) => l.id);

  // Todas las visitas validadas de esos lotes, más recientes primero. Se
  // resuelve en memoria: son decenas de lotes y unos cientos de visitas por
  // temporada, y un DISTINCT ON por lote costaría más de leer que lo que ahorra.
  const visitas = ids.length
    ? await db
        .select()
        .from(tunicheVisitas)
        .where(
          and(
            inArray(tunicheVisitas.loteId, ids),
            inArray(tunicheVisitas.estado, ["validada", "corregida"]),
          ),
        )
        .orderBy(desc(tunicheVisitas.fecha))
    : [];

  const ahora = Date.now();
  const enriquecidos: LoteEnReporte[] = lotes.map((l) => {
    const suyas = visitas.filter((v) => v.loteId === l.id);
    const ultima = suyas[0]?.fecha ?? null;
    const datos = (suyas[0]?.datos ?? {}) as Record<string, unknown>;
    return {
      ...l,
      visitas: suyas.length,
      ultima,
      dias: ultima ? Math.floor((ahora - ultima.getTime()) / 86_400_000) : null,
      nota: suyas[0]?.notaAgronomica ?? null,
      riego: (datos.riego as string) ?? null,
      malezas: (datos.malezas_presion as string) ?? null,
      sanidad: (datos.sanidad as string) ?? null,
    };
  });

  const nuncaVisitados = enriquecidos.filter((l) => l.visitas === 0);
  const atrasados = enriquecidos
    .filter((l) => l.ultima != null && l.ultima < desde)
    .sort((x, y) => (y.dias ?? 0) - (x.dias ?? 0));

  // Alerta = la ÚLTIMA visita dejó una señal. No se acumulan las históricas: un
  // riego que estuvo crítico en marzo y se arregló en abril no es un problema
  // abierto, y mostrarlo como tal enseña a ignorar la lista.
  const alertas = enriquecidos.filter(
    (l) =>
      (l.riego && ALERTA.riego.includes(l.riego)) ||
      (l.malezas && ALERTA.malezas.includes(l.malezas)) ||
      (l.sanidad && ALERTA.sanidad.includes(l.sanidad)),
  );

  const delPeriodo = visitas.filter((v) => v.fecha >= desde);
  const notas = delPeriodo
    .map((v) => v.notaAgronomica)
    .filter((n): n is number => n != null);

  // Por zonal: el nombre viene de la maestra, no de la cuenta que cargó la
  // visita. Es a quien le corresponde el campo, que es la pregunta de gestión —
  // distinta de quién apretó el micrófono ese día.
  const zonales = new Map<string, { visitas: number; lotes: Set<number>; notas: number[] }>();
  for (const l of enriquecidos) {
    const nombre = l.zonal ?? "Sin zonal asignado";
    if (!zonales.has(nombre)) zonales.set(nombre, { visitas: 0, lotes: new Set(), notas: [] });
    const z = zonales.get(nombre)!;
    z.lotes.add(l.id);
    for (const v of delPeriodo.filter((v) => v.loteId === l.id)) {
      z.visitas++;
      if (v.notaAgronomica != null) z.notas.push(v.notaAgronomica);
    }
  }

  const [inf] = ids.length
    ? await db
        .select({
          generados: sql<number>`count(*)::int`,
          conVistoBueno: sql<number>`count(*) filter (where ${tunicheInformes.aprobadoEn} is not null)::int`,
          enviados: sql<number>`count(*) filter (where ${tunicheInformes.estado} = 'enviado')::int`,
        })
        .from(tunicheInformes)
        .where(and(eq(tunicheInformes.area, area), isNotNull(tunicheInformes.visitaId)))
    : [{ generados: 0, conVistoBueno: 0, enviados: 0 }];

  const conInforme = ids.length
    ? await db
        .select({ visitaId: tunicheInformes.visitaId })
        .from(tunicheInformes)
        .where(and(eq(tunicheInformes.area, area), isNotNull(tunicheInformes.visitaId)))
    : [];
  const setInforme = new Set(conInforme.map((x) => x.visitaId));

  return {
    desde,
    lotes: enriquecidos,
    nuncaVisitados,
    atrasados,
    alertas,
    porZonal: [...zonales.entries()]
      .map(([zonal, z]) => ({
        zonal,
        visitas: z.visitas,
        lotes: z.lotes.size,
        nota: z.notas.length
          ? Math.round(z.notas.reduce((p, c) => p + c, 0) / z.notas.length)
          : null,
      }))
      .sort((x, y) => y.visitas - x.visitas),
    visitasPeriodo: delPeriodo.length,
    notaPromedio: notas.length
      ? Math.round(notas.reduce((p, c) => p + c, 0) / notas.length)
      : null,
    informes: inf ?? { generados: 0, conVistoBueno: 0, enviados: 0 },
    sinInforme: delPeriodo.filter((v) => v.loteId && !setInforme.has(v.id)).length,
  };
}

/** Cuántos zonales del área todavía no tienen cuenta con teléfono registrado. */
export async function zonalesSinCuenta(area: AreaId): Promise<string[]> {
  const nombres = await db
    .selectDistinct({ zonal: tunicheAgricultores.zonalNombre })
    .from(tunicheAgricultores)
    .where(and(eq(tunicheAgricultores.area, area), isNotNull(tunicheAgricultores.zonalNombre)));

  const cuentas = await db
    .select({ nombre: tunicheUsuarios.nombre, telefono: tunicheUsuarios.telefono })
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.activo, true));

  const conTelefono = new Set(
    cuentas.filter((c) => c.telefono).map((c) => c.nombre.trim().toLowerCase()),
  );
  return nombres
    .map((n) => n.zonal)
    .filter((n): n is string => Boolean(n))
    .filter((n) => !conTelefono.has(n.trim().toLowerCase()));
}
