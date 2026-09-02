// Consultas y persistencia de agricultores, lotes y visitas.
//
// **Todo lo que lee filas pasa por `filtro(alcance)`.** No es una convención: es
// el único punto donde se hace cumplir que un zonal de Mercado Nacional no vea
// los agricultores de Altué. Una consulta que arme su propio `where` se salta el
// control sin que nada avise, y el síntoma aparece meses después en una reunión.

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  tunicheAgricultores,
  tunicheFotos,
  tunicheFotosPendientes,
  tunicheInformes,
  tunicheLotes,
  tunicheVisitas,
  type TunicheAgricultor,
  type TunicheLote,
  type TunicheVisita,
} from "@/db/tuniche";
import type { AreaId } from "./areas";
import type { Alcance } from "./session";
import type { LoteCandidato } from "./extraccion";

export async function disponible(): Promise<boolean> {
  try {
    await db.select({ id: tunicheLotes.id }).from(tunicheLotes).limit(1);
    return true;
  } catch {
    return false;
  }
}

/**
 * El `where` que corresponde a un alcance, sobre la tabla de agricultores.
 *
 * `admin` no filtra. `jefe` filtra por área. `zonal` filtra además por los
 * agricultores que tiene asignados — no por los que visitó, que es distinto: si
 * filtrara por visitas, un zonal nuevo no vería nada y no podría empezar.
 */
function filtroAgricultor(a: Alcance): SQL | undefined {
  if (a.todo) return undefined;
  const partes: SQL[] = [eq(tunicheAgricultores.area, a.area ?? "")];
  if (a.soloUsuarioId != null) {
    partes.push(eq(tunicheAgricultores.zonalId, a.soloUsuarioId));
  }
  return and(...partes);
}

export interface AgricultorConLotes extends TunicheAgricultor {
  lotes: TunicheLote[];
}

export async function listarAgricultores(a: Alcance): Promise<AgricultorConLotes[]> {
  const agricultores = await db
    .select()
    .from(tunicheAgricultores)
    .where(filtroAgricultor(a))
    .orderBy(tunicheAgricultores.area, tunicheAgricultores.razonSocial);

  if (agricultores.length === 0) return [];

  const lotes = await db
    .select()
    .from(tunicheLotes)
    .where(
      inArray(
        tunicheLotes.agricultorId,
        agricultores.map((x) => x.id),
      ),
    )
    .orderBy(tunicheLotes.codigo);

  return agricultores.map((ag) => ({
    ...ag,
    lotes: lotes.filter((l) => l.agricultorId === ag.id),
  }));
}

/** Un lote con el nombre de su agricultor, ya filtrado por alcance. */
export async function loteConAgricultor(
  id: number,
  a: Alcance,
): Promise<{ lote: TunicheLote; agricultor: TunicheAgricultor } | null> {
  const [fila] = await db
    .select({ lote: tunicheLotes, agricultor: tunicheAgricultores })
    .from(tunicheLotes)
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .where(and(eq(tunicheLotes.id, id), filtroAgricultor(a)))
    .limit(1);
  return fila ?? null;
}

/**
 * Los lotes que se le ofrecen al modelo para que elija uno.
 *
 * **El área no se deduce del alcance.** Para un jefe o un
 * zonal coinciden, pero un `admin` no tiene área: su alcance es "todo". Sin este
 * parámetro se le ofrecían al modelo los lotes de las dos áreas mientras las
 * etapas venían de una sola, así que un audio sobre maíz podía quedar pegado a
 * un lote de repollo. El área que manda es la de la plantilla contra la que se
 * está estructurando — la del usuario, o la que el admin declaró en su cuenta.
 *
 * Dentro del área se le pasan **todos** los lotes que la persona puede ver, no
 * un subconjunto: catorce lotes caben enteros en el mensaje, y recortarlos
 * obligaría a adivinar cuáles dejar fuera, que es justo el problema que esto
 * viene a evitar.
 */
export async function lotesCandidatos(a: Alcance, area?: AreaId): Promise<LoteCandidato[]> {
  const filas = await db
    .select({
      id: tunicheLotes.id,
      area: tunicheLotes.area,
      codigo: tunicheLotes.codigo,
      agricultorId: tunicheAgricultores.id,
      agricultor: tunicheAgricultores.razonSocial,
      localidad: tunicheAgricultores.localidad,
      cultivo: tunicheLotes.cultivo,
      variedad: tunicheLotes.variedad,
    })
    .from(tunicheLotes)
    .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
    .where(
      and(
        eq(tunicheLotes.activo, true),
        // Sin área se devuelve todo lo que la persona puede ver: es lo que
        // necesita la pantalla, que ofrece lotes para varias visitas a la vez y
        // filtra cada desplegable por el área de SU visita. El flujo de audio sí
        // la pasa siempre, porque ahí hay una sola plantilla en juego.
        area ? eq(tunicheLotes.area, area) : undefined,
        filtroAgricultor(a),
      ),
    )
    // Orden estable y por código, no solo por agricultor: cuando se le manda al
    // zonal una lista numerada por WhatsApp, el "2" tiene que significar siempre
    // el mismo lote. Un orden indefinido dentro de un agricultor haría que la
    // respuesta apunte a otro campo entre un mensaje y el siguiente.
    .orderBy(asc(tunicheAgricultores.razonSocial), asc(tunicheLotes.codigo));
  return filas;
}

// ─── Visitas ─────────────────────────────────────────────────────────────────

export interface VisitaConContexto extends TunicheVisita {
  loteCodigo: string | null;
  agricultorNombre: string | null;
  /** Sin esto no hay a quién enviarle el informe, y la pantalla tiene que decirlo. */
  agricultorTelefono: string | null;
  /** El informe generado de esta visita, si ya existe. Una visita, un informe. */
  informeId: number | null;
  informeEstado: string | null;
  /**
   * Las fotos, no su cantidad.
   *
   * Antes esto era un número y la bandeja mostraba «📷 3». Pero la bandeja es
   * donde alguien **valida**, y validar un reporte cuyas fotos no puedes ver es
   * una compuerta de mentira: se confirma el texto y las imágenes pasan sin que
   * nadie las mire, que son justo la mitad de lo que le importa al agricultor.
   */
  fotos: { url: string; tipo: string }[];
}

async function conContexto(visitas: TunicheVisita[]): Promise<VisitaConContexto[]> {
  if (visitas.length === 0) return [];

  const idsLote = [...new Set(visitas.map((v) => v.loteId).filter((x): x is number => x != null))];
  const lotes = idsLote.length
    ? await db
        .select({
          id: tunicheLotes.id,
          codigo: tunicheLotes.codigo,
          agricultor: tunicheAgricultores.razonSocial,
          telefono: tunicheAgricultores.telefono,
        })
        .from(tunicheLotes)
        .innerJoin(tunicheAgricultores, eq(tunicheLotes.agricultorId, tunicheAgricultores.id))
        .where(inArray(tunicheLotes.id, idsLote))
    : [];


  const fotos = await db
    .select({ visitaId: tunicheFotos.visitaId, url: tunicheFotos.url, tipo: tunicheFotos.tipo })
    .from(tunicheFotos)
    .where(
      inArray(
        tunicheFotos.visitaId,
        visitas.map((v) => v.id),
      ),
    )
    .orderBy(asc(tunicheFotos.id));

  const informes = await db
    .select({
      id: tunicheInformes.id,
      visitaId: tunicheInformes.visitaId,
      estado: tunicheInformes.estado,
    })
    .from(tunicheInformes)
    .where(
      inArray(
        tunicheInformes.visitaId,
        visitas.map((v) => v.id),
      ),
    );

  // El nombre del agricultor cuando la visita lo tiene pero no tiene lote: es
  // justo el caso que la pantalla necesita explicar ("se supo de quién, no cuál").
  const idsAg = [
    ...new Set(
      visitas.filter((v) => !v.loteId && v.agricultorId).map((v) => v.agricultorId as number),
    ),
  ];
  const sueltos = idsAg.length
    ? await db
        .select({ id: tunicheAgricultores.id, nombre: tunicheAgricultores.razonSocial })
        .from(tunicheAgricultores)
        .where(inArray(tunicheAgricultores.id, idsAg))
    : [];

  return visitas.map((v) => {
    const inf = informes.find((x) => x.visitaId === v.id);
    const l = lotes.find((x) => x.id === v.loteId);
    return {
      ...v,
      loteCodigo: l?.codigo ?? null,
      agricultorNombre:
        l?.agricultor ?? sueltos.find((a) => a.id === v.agricultorId)?.nombre ?? null,
      agricultorTelefono: l?.telefono ?? null,
      informeId: inf?.id ?? null,
      informeEstado: inf?.estado ?? null,
      fotos: fotos.filter((f) => f.visitaId === v.id).map((f) => ({ url: f.url, tipo: f.tipo })),
    };
  });
}

function filtroVisita(a: Alcance): SQL | undefined {
  if (a.todo) return undefined;
  const partes: SQL[] = [eq(tunicheVisitas.area, a.area ?? "")];
  if (a.soloUsuarioId != null) partes.push(eq(tunicheVisitas.usuarioId, a.soloUsuarioId));
  return and(...partes);
}

export async function visitasRecientes(a: Alcance, limite = 30): Promise<VisitaConContexto[]> {
  const filas = await db
    .select()
    .from(tunicheVisitas)
    .where(filtroVisita(a))
    .orderBy(desc(tunicheVisitas.fecha))
    .limit(limite);
  return conContexto(filas);
}

/**
 * El historial de un lote. **Solo visitas validadas.**
 *
 * Una visita pendiente es lo que la IA entendió y nadie confirmó todavía.
 * Mezclarla con el historial haría que el "mira, esta es la trazabilidad de tu
 * campo" incluyera frases que el zonal nunca dijo.
 */
export async function historialDeLote(loteId: number): Promise<VisitaConContexto[]> {
  const filas = await db
    .select()
    .from(tunicheVisitas)
    .where(
      and(
        eq(tunicheVisitas.loteId, loteId),
        inArray(tunicheVisitas.estado, ["validada", "corregida"]),
      ),
    )
    .orderBy(desc(tunicheVisitas.fecha));
  return conContexto(filas);
}

export async function pendientesDe(usuarioId: number): Promise<VisitaConContexto[]> {
  const filas = await db
    .select()
    .from(tunicheVisitas)
    .where(and(eq(tunicheVisitas.usuarioId, usuarioId), eq(tunicheVisitas.estado, "pendiente")))
    .orderBy(desc(tunicheVisitas.fecha));
  return conContexto(filas);
}

export async function fotosDe(visitaId: number) {
  return db.select().from(tunicheFotos).where(eq(tunicheFotos.visitaId, visitaId));
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export async function crearVisita(v: {
  loteId: number | null;
  agricultorId: number | null;
  area: AreaId;
  usuarioId: number;
  origen: "audio" | "texto" | "web";
  waMessageId?: string | null;
  audioUrl?: string | null;
  transcripcion?: string | null;
  etapa?: string | null;
  datos: Record<string, unknown>;
  notaAgronomica: number | null;
  resumen: string;
}): Promise<number> {
  const [fila] = await db
    .insert(tunicheVisitas)
    .values({
      loteId: v.loteId,
      agricultorId: v.agricultorId,
      area: v.area,
      usuarioId: v.usuarioId,
      origen: v.origen,
      waMessageId: v.waMessageId ?? null,
      audioUrl: v.audioUrl ?? null,
      transcripcion: v.transcripcion ?? null,
      etapa: v.etapa ?? null,
      datos: v.datos,
      notaAgronomica: v.notaAgronomica,
      resumen: v.resumen,
      estado: "pendiente",
    })
    .returning({ id: tunicheVisitas.id });
  return fila.id;
}

/**
 * La visita pendiente más reciente de un zonal, para engancharle fotos o para
 * validarla con un "OK" por WhatsApp.
 */
export async function ultimaPendiente(usuarioId: number): Promise<TunicheVisita | null> {
  const [v] = await db
    .select()
    .from(tunicheVisitas)
    .where(and(eq(tunicheVisitas.usuarioId, usuarioId), eq(tunicheVisitas.estado, "pendiente")))
    .orderBy(desc(tunicheVisitas.fecha))
    .limit(1);
  return v ?? null;
}

/** La última visita de un zonal, validada o no. Es a la que se pegan las fotos. */
/**
 * Horas hacia atrás en que una visita todavía cuenta como "la de ahora" para
 * pegarle una foto.
 *
 * Sin este límite, `ultimaVisita` devuelve la visita anterior aunque sea de la
 * semana pasada, y una foto mandada antes de que exista la de hoy termina
 * dentro del informe de otro campo sin que nadie se entere. Perder la foto es
 * malo; ponerla en el lote equivocado es peor, porque nadie la va a buscar.
 *
 * Seis horas cubre una jornada de terreno —se recorre en la mañana y se manda
 * la foto que faltaba después de almuerzo— sin llegar al día siguiente.
 */
const HORAS_VISITA_RECIENTE = 6;

export async function ultimaVisita(usuarioId: number): Promise<TunicheVisita | null> {
  const desde = new Date(Date.now() - HORAS_VISITA_RECIENTE * 60 * 60 * 1000);
  const [v] = await db
    .select()
    .from(tunicheVisitas)
    .where(and(eq(tunicheVisitas.usuarioId, usuarioId), gte(tunicheVisitas.fecha, desde)))
    .orderBy(desc(tunicheVisitas.fecha))
    .limit(1);
  return v ?? null;
}

/**
 * Minutos que una foto espera a su visita.
 *
 * Corto a propósito. Una foto pendiente se pega a la **próxima** visita que
 * cree esa persona, así que una ventana larga la haría aparecer en el campo
 * siguiente. Veinte minutos alcanzan de sobra: el audio y las fotos salen del
 * mismo gesto, con segundos de diferencia.
 */
const MINUTOS_FOTO_PENDIENTE = 20;

/** Guarda una foto que llegó antes que su visita. Ya viene copiada a Blob. */
export async function guardarFotoPendiente(f: {
  usuarioId: number;
  url: string;
  tipo?: string;
  waMessageId?: string | null;
}): Promise<void> {
  await db.insert(tunicheFotosPendientes).values({
    usuarioId: f.usuarioId,
    url: f.url,
    tipo: f.tipo ?? "general",
    waMessageId: f.waMessageId ?? null,
  });
}

/**
 * Pasa a la visita recién creada las fotos que su autor mandó justo antes.
 * Devuelve cuántas, para poder decírselo en la respuesta: una foto que se
 * guarda sin avisar es indistinguible de una que se perdió.
 */
export async function adjuntarPendientes(usuarioId: number, visitaId: number): Promise<number> {
  const desde = new Date(Date.now() - MINUTOS_FOTO_PENDIENTE * 60 * 1000);
  const pend = await db
    .select()
    .from(tunicheFotosPendientes)
    .where(and(eq(tunicheFotosPendientes.usuarioId, usuarioId), gte(tunicheFotosPendientes.createdAt, desde)))
    .orderBy(asc(tunicheFotosPendientes.id));
  if (!pend.length) return 0;

  await db.insert(tunicheFotos).values(
    pend.map((f) => ({ visitaId, url: f.url, tipo: f.tipo, waMessageId: f.waMessageId })),
  );
  // Se borran **todas** las de esa persona, no solo las que entraron: las que
  // quedaron fuera de la ventana ya no van a encontrar visita y dejarlas sería
  // sembrar fotos que aparecen en un campo ajeno la próxima semana.
  await db
    .delete(tunicheFotosPendientes)
    .where(eq(tunicheFotosPendientes.usuarioId, usuarioId));
  return pend.length;
}

/**
 * La pendiente más reciente que se quedó **sin lote pero con agricultor**: el
 * caso en que se supo de quién es el campo y no cuál de sus lotes. Es la que
 * puede resolver una respuesta de una palabra por WhatsApp.
 */
export async function ultimaPendienteSinLote(usuarioId: number): Promise<TunicheVisita | null> {
  const [v] = await db
    .select()
    .from(tunicheVisitas)
    .where(
      and(
        eq(tunicheVisitas.usuarioId, usuarioId),
        eq(tunicheVisitas.estado, "pendiente"),
        isNull(tunicheVisitas.loteId),
        isNotNull(tunicheVisitas.agricultorId),
      ),
    )
    .orderBy(desc(tunicheVisitas.fecha))
    .limit(1);
  return v ?? null;
}

/** Le pega el lote elegido a una visita. Desde WhatsApp o desde la pantalla. */
export async function asignarLote(visitaId: number, loteId: number): Promise<void> {
  const agricultorId = await agricultorDeLote(loteId);
  await db
    .update(tunicheVisitas)
    .set({ loteId, agricultorId })
    .where(eq(tunicheVisitas.id, visitaId));
}

/** Descarta desde WhatsApp. La fila sobrevive: ver `descartarVisitaAction`. */
export async function descartar(visitaId: number): Promise<void> {
  await db
    .update(tunicheVisitas)
    .set({ estado: "descartada" })
    .where(eq(tunicheVisitas.id, visitaId));
}

export async function validar(visitaId: number): Promise<void> {
  await db
    .update(tunicheVisitas)
    .set({ estado: "validada", validadaEn: new Date() })
    .where(eq(tunicheVisitas.id, visitaId));
}

export async function guardarFoto(f: {
  visitaId: number;
  url: string;
  tipo?: string;
  waMessageId?: string | null;
}): Promise<void> {
  await db.insert(tunicheFotos).values({
    visitaId: f.visitaId,
    url: f.url,
    tipo: f.tipo ?? "general",
    waMessageId: f.waMessageId ?? null,
  });
}

/** El agricultor dueño de un lote. Se necesita al persistir desde WhatsApp. */
export async function agricultorDeLote(loteId: number): Promise<number | null> {
  const [l] = await db
    .select({ agricultorId: tunicheLotes.agricultorId })
    .from(tunicheLotes)
    .where(eq(tunicheLotes.id, loteId))
    .limit(1);
  return l?.agricultorId ?? null;
}
