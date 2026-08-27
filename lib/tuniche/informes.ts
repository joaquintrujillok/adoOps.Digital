// El repositorio de informes: generación, snapshot y consulta.
//
// **Lo que hace distinto a un informe de una visita.** La visita es lo que pasó
// en el campo; el informe es lo que se le *comunicó a alguien*. Por eso el
// informe congela su contenido al generarse: si corregir una visita en octubre
// cambiara lo que dice el informe enviado en marzo, el repositorio dejaría de
// servir para lo único que importa —poder mostrar qué se dijo y cuándo—.
//
// Dos tipos y un solo repositorio: el de `visita`, que es lo que Francisco hoy
// manda por WhatsApp después de cada recorrido, y el `mensual`, que es lo que
// René arma a mano pegando fotos de Drive en un PowerPoint para el cliente en el
// extranjero. Distinto destinatario, mismo acto: comunicar hacia afuera.

import { and, asc, desc, eq, gte, inArray, isNotNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  tunicheAgricultores,
  tunicheFotos,
  tunicheInformes,
  tunicheLotes,
  tunicheUsuarios,
  tunicheVisitas,
  type ContenidoMensual,
  type ContenidoVisita,
  type TunicheInforme,
} from "@/db/tuniche";
import type { AreaId } from "./areas";
import { VISITA } from "./plantillas";
import type { Alcance } from "./session";

export async function disponible(): Promise<boolean> {
  try {
    await db.select({ id: tunicheInformes.id }).from(tunicheInformes).limit(1);
    return true;
  } catch {
    return false;
  }
}

function iso(d: Date): string {
  return d.toISOString();
}

/** Los campos de la capa 2 con etiqueta legible, saltando los vacíos. */
function camposLegibles(datos: Record<string, unknown>): { etiqueta: string; valor: string }[] {
  const out: { etiqueta: string; valor: string }[] = [];
  for (const c of VISITA) {
    if (c.id === "etapa" || c.tipo === "fotos" || c.id === "nota_agronomica") continue;
    const v = datos[c.id];
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      out.push({ etiqueta: c.etiqueta, valor: v.join("; ") });
    } else if (String(v).trim()) {
      out.push({ etiqueta: c.etiqueta, valor: String(v) });
    }
  }
  return out;
}

// ─── Generación ──────────────────────────────────────────────────────────────

/**
 * Genera el informe de una visita validada.
 *
 * Devuelve el id del informe existente si ya había uno: una visita produce **un**
 * informe y solo uno. Dos constancias del mismo hecho, con contenidos que pueden
 * diferir, es peor que ninguna.
 *
 * La transcripción del audio **no entra al snapshot**. Es material interno para
 * poder contrastar lo que la IA entendió; al agricultor se le manda el informe,
 * no la grabación de alguien hablando desde una camioneta.
 */
export async function generarDeVisita(
  visitaId: number,
  usuarioId: number,
): Promise<{ id: number; yaExistia: boolean }> {
  const [ya] = await db
    .select({ id: tunicheInformes.id })
    .from(tunicheInformes)
    .where(eq(tunicheInformes.visitaId, visitaId))
    .limit(1);
  if (ya) return { id: ya.id, yaExistia: true };

  const [fila] = await db
    .select({
      visita: tunicheVisitas,
      lote: tunicheLotes,
      agricultor: tunicheAgricultores,
      zonal: tunicheUsuarios.nombre,
    })
    .from(tunicheVisitas)
    .innerJoin(tunicheLotes, eq(tunicheVisitas.loteId, tunicheLotes.id))
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .innerJoin(tunicheUsuarios, eq(tunicheVisitas.usuarioId, tunicheUsuarios.id))
    .where(eq(tunicheVisitas.id, visitaId))
    .limit(1);

  if (!fila) {
    // Sin lote no hay agricultor, y sin agricultor un informe no tiene a quién
    // referirse. Es el caso que la extracción declara en vez de adivinar.
    throw new Error("Esta visita no tiene lote asignado. Asígnalo antes de generar el informe.");
  }
  if (fila.visita.estado === "pendiente") {
    throw new Error("El zonal todavía no valida esta visita. No hay qué informar.");
  }

  const fotos = await db
    .select({ url: tunicheFotos.url, tipo: tunicheFotos.tipo })
    .from(tunicheFotos)
    .where(eq(tunicheFotos.visitaId, visitaId))
    .orderBy(asc(tunicheFotos.id));

  const contenido: ContenidoVisita = {
    agricultor: fila.agricultor.razonSocial,
    contacto: fila.agricultor.nombreContacto,
    localidad: fila.agricultor.localidad,
    lote: fila.lote.codigo,
    cultivo: fila.lote.cultivo,
    variedad: fila.lote.variedad,
    hectareas: fila.lote.hectareas,
    zonal: fila.zonal,
    fecha: iso(fila.visita.fecha),
    etapa: fila.visita.etapa,
    campos: camposLegibles((fila.visita.datos ?? {}) as Record<string, unknown>),
    notaAgronomica: fila.visita.notaAgronomica,
    resumen: fila.visita.resumen ?? "",
    fotos,
  };

  const fechaCorta = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fila.visita.fecha);

  const [creado] = await db
    .insert(tunicheInformes)
    .values({
      tipo: "visita",
      area: fila.visita.area,
      titulo: `Visita ${fila.lote.codigo} · ${fechaCorta}`,
      estado: "borrador",
      visitaId,
      loteId: fila.lote.id,
      agricultorId: fila.agricultor.id,
      contenido: contenido as unknown as Record<string, unknown>,
      generadoPor: usuarioId,
    })
    .returning({ id: tunicheInformes.id });

  return { id: creado.id, yaExistia: false };
}

/** Los clientes que tienen lotes en un área. Es por quién se agrupa el mensual. */
export async function clientesDe(area: AreaId): Promise<string[]> {
  const filas = await db
    .selectDistinct({ cliente: tunicheLotes.clienteFinal })
    .from(tunicheLotes)
    .where(and(eq(tunicheLotes.area, area), isNotNull(tunicheLotes.clienteFinal)))
    .orderBy(asc(tunicheLotes.clienteFinal));
  return filas.map((f) => f.cliente).filter((c): c is string => Boolean(c));
}

/**
 * Genera el informe mensual de un cliente: sus lotes, con las visitas del
 * periodo y sus fotos. Es el reemplazo del PowerPoint que René arma a mano.
 *
 * Solo entran visitas **validadas**. Una visita pendiente es lo que la IA
 * entendió y nadie confirmó; mandarla a un cliente en el extranjero sería la
 * peor forma de estrenar esto.
 */
export async function generarMensual(p: {
  cliente: string;
  area: AreaId;
  desde: Date;
  hasta: Date;
  usuarioId: number;
}): Promise<number> {
  const lotes = await db
    .select({ lote: tunicheLotes, agricultor: tunicheAgricultores })
    .from(tunicheLotes)
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .where(and(eq(tunicheLotes.area, p.area), eq(tunicheLotes.clienteFinal, p.cliente)))
    .orderBy(asc(tunicheLotes.codigo));

  if (lotes.length === 0) {
    throw new Error(`No hay lotes de «${p.cliente}» en esta área.`);
  }

  const idsLote = lotes.map((l) => l.lote.id);
  const visitas = await db
    .select({ visita: tunicheVisitas, zonal: tunicheUsuarios.nombre })
    .from(tunicheVisitas)
    .innerJoin(tunicheUsuarios, eq(tunicheVisitas.usuarioId, tunicheUsuarios.id))
    .where(
      and(
        inArray(tunicheVisitas.loteId, idsLote),
        inArray(tunicheVisitas.estado, ["validada", "corregida"]),
        gte(tunicheVisitas.fecha, p.desde),
        lte(tunicheVisitas.fecha, p.hasta),
      ),
    )
    .orderBy(asc(tunicheVisitas.fecha));

  const fotos = visitas.length
    ? await db
        .select({ visitaId: tunicheFotos.visitaId, url: tunicheFotos.url, tipo: tunicheFotos.tipo })
        .from(tunicheFotos)
        .where(
          inArray(
            tunicheFotos.visitaId,
            visitas.map((v) => v.visita.id),
          ),
        )
        .orderBy(asc(tunicheFotos.id))
    : [];

  const contenido: ContenidoMensual = {
    cliente: p.cliente,
    desde: iso(p.desde),
    hasta: iso(p.hasta),
    lotes: lotes.map(({ lote, agricultor }) => {
      const suyas = visitas.filter((v) => v.visita.loteId === lote.id);
      const notas = suyas
        .map((v) => v.visita.notaAgronomica)
        .filter((n): n is number => n != null);
      return {
        codigo: lote.codigo,
        agricultor: agricultor.razonSocial,
        localidad: agricultor.localidad,
        cultivo: lote.cultivo,
        variedad: lote.variedad,
        hectareas: lote.hectareas,
        objetivo: lote.objetivo,
        notaPromedio: notas.length
          ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)
          : null,
        visitas: suyas.map(({ visita, zonal }) => ({
          fecha: iso(visita.fecha),
          zonal,
          etapa: visita.etapa,
          notaAgronomica: visita.notaAgronomica,
          resumen: visita.resumen ?? "",
          fotos: fotos
            .filter((f) => f.visitaId === visita.id)
            .map((f) => ({ url: f.url, tipo: f.tipo })),
        })),
      };
    }),
  };

  const mes = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(p.desde);

  const [creado] = await db
    .insert(tunicheInformes)
    .values({
      tipo: "mensual",
      area: p.area,
      titulo: `${p.cliente} · ${mes}`,
      estado: "borrador",
      cliente: p.cliente,
      periodoDesde: p.desde,
      periodoHasta: p.hasta,
      contenido: contenido as unknown as Record<string, unknown>,
      generadoPor: p.usuarioId,
    })
    .returning({ id: tunicheInformes.id });

  return creado.id;
}

// ─── Consulta ────────────────────────────────────────────────────────────────

/**
 * El filtro de alcance sobre el repositorio.
 *
 * Un `zonal` ve **solo sus informes de visita**. El mensual queda fuera de su
 * alcance a propósito: agrega los lotes de un cliente completo, incluidos los de
 * otros zonales, y darle acceso sería abrirle por la puerta de atrás lo que la
 * pantalla de agricultores le cierra por la de adelante.
 */
function filtroInforme(a: Alcance): SQL | undefined {
  if (a.todo) return undefined;
  const partes: SQL[] = [eq(tunicheInformes.area, a.area ?? "")];
  if (a.soloUsuarioId != null) partes.push(eq(tunicheInformes.tipo, "visita"));
  return and(...partes);
}

export interface FiltrosInforme {
  tipo?: "visita" | "mensual";
  estado?: "borrador" | "aprobado" | "enviado";
  agricultorId?: number;
  texto?: string;
}

export interface InformeEnLista extends TunicheInforme {
  generadoPorNombre: string | null;
  aprobadoPorNombre: string | null;
}

export async function listarInformes(
  a: Alcance,
  f: FiltrosInforme = {},
): Promise<InformeEnLista[]> {
  const partes: SQL[] = [];
  const base = filtroInforme(a);
  if (base) partes.push(base);
  if (f.tipo) partes.push(eq(tunicheInformes.tipo, f.tipo));
  if (f.estado) partes.push(eq(tunicheInformes.estado, f.estado));
  if (f.agricultorId) partes.push(eq(tunicheInformes.agricultorId, f.agricultorId));

  let filas = await db
    .select()
    .from(tunicheInformes)
    .where(partes.length ? and(...partes) : undefined)
    .orderBy(desc(tunicheInformes.generadoEn))
    .limit(300);

  // El filtro de texto se aplica en memoria y sobre el título: son a lo más
  // trescientas filas por área y por temporada. Un índice de texto completo en
  // Postgres para eso sería una pieza más que mantener sin que nadie la note.
  if (f.texto?.trim()) {
    const t = f.texto.trim().toLowerCase();
    filas = filas.filter(
      (x) =>
        x.titulo.toLowerCase().includes(t) ||
        (x.cliente ?? "").toLowerCase().includes(t) ||
        JSON.stringify(x.contenido).toLowerCase().includes(t),
    );
  }

  const ids = [
    ...new Set(
      filas.flatMap((x) => [x.generadoPor, x.aprobadoPor]).filter((n): n is number => n != null),
    ),
  ];
  const personas = ids.length
    ? await db
        .select({ id: tunicheUsuarios.id, nombre: tunicheUsuarios.nombre })
        .from(tunicheUsuarios)
        .where(inArray(tunicheUsuarios.id, ids))
    : [];

  return filas.map((x) => ({
    ...x,
    generadoPorNombre: personas.find((p) => p.id === x.generadoPor)?.nombre ?? null,
    aprobadoPorNombre: personas.find((p) => p.id === x.aprobadoPor)?.nombre ?? null,
  }));
}

export async function informePorId(id: number, a: Alcance): Promise<InformeEnLista | null> {
  const partes: SQL[] = [eq(tunicheInformes.id, id)];
  const base = filtroInforme(a);
  if (base) partes.push(base);

  const [x] = await db
    .select()
    .from(tunicheInformes)
    .where(and(...partes))
    .limit(1);
  if (!x) return null;

  const ids = [x.generadoPor, x.aprobadoPor].filter((n): n is number => n != null);
  const personas = await db
    .select({ id: tunicheUsuarios.id, nombre: tunicheUsuarios.nombre })
    .from(tunicheUsuarios)
    .where(inArray(tunicheUsuarios.id, ids));

  return {
    ...x,
    generadoPorNombre: personas.find((p) => p.id === x.generadoPor)?.nombre ?? null,
    aprobadoPorNombre: personas.find((p) => p.id === x.aprobadoPor)?.nombre ?? null,
  };
}

/** Informes de un lote, para colgar del historial. */
export async function informesDeLote(loteId: number): Promise<TunicheInforme[]> {
  return db
    .select()
    .from(tunicheInformes)
    .where(eq(tunicheInformes.loteId, loteId))
    .orderBy(desc(tunicheInformes.generadoEn));
}

// ─── El texto que sale por WhatsApp ──────────────────────────────────────────

/**
 * La versión en texto del informe de visita.
 *
 * Vive acá y no en la pantalla, por la misma razón que el CRM separó el texto de
 * su cotización: la vista previa y el mensaje que realmente sale tienen que
 * usar la misma función. Si la pantalla reconstruyera el texto por su cuenta, el
 * día que alguien cambie una línea estaría dando el visto bueno a algo distinto
 * de lo que se envía.
 */
export function textoWhatsApp(c: ContenidoVisita): string {
  const fecha = new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(c.fecha));

  const L: string[] = [];
  L.push(`*Semillas Tuniche · Visita a campo*`);
  L.push(`${fecha}`);
  L.push("");
  L.push(`*Lote:* ${c.lote}${c.cultivo ? ` · ${c.cultivo}` : ""}${c.variedad ? ` ${c.variedad}` : ""}`);
  if (c.hectareas) L.push(`*Superficie:* ${c.hectareas} ha`);
  if (c.etapa) L.push(`*Etapa:* ${c.etapa}`);
  L.push("");
  if (c.resumen) {
    L.push(c.resumen);
    L.push("");
  }
  for (const campo of c.campos) L.push(`• ${campo.etiqueta}: ${campo.valor}`);
  if (c.notaAgronomica != null) L.push(`• Nota agronómica: ${c.notaAgronomica}%`);
  if (c.fotos.length) {
    L.push("");
    L.push(`Se adjuntan ${c.fotos.length} ${c.fotos.length === 1 ? "foto" : "fotos"}.`);
  }
  L.push("");
  L.push(`Visita realizada por ${c.zonal}.`);
  return L.join("\n");
}
