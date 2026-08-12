// La audición: dejar escrito lo que pasó en la sala.
//
// De la lámina 7: *"lo más valioso que pasa en el negocio —una audición de dos
// horas en la Sala Reference— hoy no queda escrito en ninguna parte"*.
//
// El diseño entero de este módulo obedece a una sola restricción: **tiene que
// tomar menos de un minuto**. Un formulario de veinte campos al final de una
// atención de dos horas no se llena nunca, y un registro que no se llena es
// peor que no tenerlo, porque además da la falsa sensación de que existe.
//
// De ahí tres decisiones:
//
//   · **Todo es opcional salvo la sala.** Media audición registrada vale
//     infinitamente más que ninguna. El sistema pide, no exige.
//   · **Las preguntas las elige el motor**, tres como máximo, y son distintas
//     para cada persona. El vendedor no decide qué preguntar: ya lo sabe.
//   · **"Qué dijo" es texto libre y va primero.** Es el campo más valioso y el
//     único irremplazable: en seis meses, la frase textual del cliente es el
//     argumento para volver a llamarlo.

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { crmAudiciones, crmContacts, crmSalas, crmUsers } from "@/db/crm";

export interface Sala {
  id: number;
  nombre: string;
  descripcion: string | null;
  capacidadMin: number;
  capacidadMax: number;
  nivel: number;
}

export async function salas(): Promise<Sala[]> {
  const filas = await db
    .select()
    .from(crmSalas)
    .where(eq(crmSalas.activa, true))
    .orderBy(crmSalas.orden);
  return filas.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    capacidadMin: s.capacidadMin,
    capacidadMax: s.capacidadMax,
    nivel: s.nivel,
  }));
}

export interface AudicionListada {
  id: number;
  contactId: number | null;
  cliente: string | null;
  sala: string | null;
  conCita: boolean;
  fecha: Date;
  duracionMinutos: number | null;
  queDijo: string | null;
  leGusto: string | null;
  descarto: string | null;
  presupuestoMencionado: number | null;
  atendidoPor: string | null;
  proximoPaso: string | null;
  proximoPasoEn: Date | null;
  /** Días desde la audición. Una de hace dos semanas ya se está enfriando. */
  diasDesde: number;
}

export async function listarAudiciones(limite = 60): Promise<AudicionListada[]> {
  const filas = await db
    .select({ a: crmAudiciones, cliente: crmContacts.nombre, sala: crmSalas.nombre, quien: crmUsers.nombre })
    .from(crmAudiciones)
    .leftJoin(crmContacts, eq(crmContacts.id, crmAudiciones.contactId))
    .leftJoin(crmSalas, eq(crmSalas.id, crmAudiciones.salaId))
    .leftJoin(crmUsers, eq(crmUsers.id, crmAudiciones.atendidoPor))
    .orderBy(desc(crmAudiciones.fecha))
    .limit(limite);

  return filas.map((f) => ({
    id: f.a.id,
    contactId: f.a.contactId,
    cliente: f.cliente,
    sala: f.sala,
    conCita: f.a.conCita,
    fecha: f.a.fecha,
    duracionMinutos: f.a.duracionMinutos,
    queDijo: f.a.queDijo,
    leGusto: f.a.leGusto,
    descarto: f.a.descarto,
    presupuestoMencionado: f.a.presupuestoMencionado,
    atendidoPor: f.quien,
    proximoPaso: f.a.proximoPaso,
    proximoPasoEn: f.a.proximoPasoEn,
    diasDesde: Math.floor((Date.now() - new Date(f.a.fecha).getTime()) / 86_400_000),
  }));
}

export interface ResumenAudiciones {
  total30d: number;
  conCita30d: number;
  /** Cuántas terminaron con un próximo paso escrito. */
  conProximoPaso: number;
  /** Cuántas quedaron sin nada anotado más que la sala. Es el indicador a vigilar. */
  sinContenido: number;
  /** Cuántas audiciones por venta. La proporción que ordena todo el argumento. */
  porVenta: number;
  porSala: { sala: string; audiciones: number; nivel: number }[];
}

export async function resumenAudiciones(): Promise<ResumenAudiciones> {
  const [totales, porSala, ventas] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE con_cita)::int AS con_cita,
             COUNT(*) FILTER (WHERE proximo_paso IS NOT NULL)::int AS con_proximo,
             COUNT(*) FILTER (WHERE que_dijo IS NULL AND le_gusto IS NULL)::int AS sin_contenido
      FROM crm_audiciones
      WHERE fecha >= NOW() - INTERVAL '30 days'
    `),
    db.execute(sql`
      SELECT s.nombre AS sala, s.nivel, COUNT(a.id)::int AS audiciones
      FROM crm_salas s
      LEFT JOIN crm_audiciones a ON a.sala_id = s.id AND a.fecha >= NOW() - INTERVAL '90 days'
      WHERE s.activa
      GROUP BY s.id, s.nombre, s.nivel, s.orden
      ORDER BY s.orden
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS ventas FROM crm_orders
      WHERE fecha >= NOW() - INTERVAL '30 days'
    `),
  ]);

  const t = totales.rows[0] as unknown as Record<string, number>;
  const v = Number((ventas.rows[0] as unknown as { ventas: number }).ventas);

  return {
    total30d: Number(t.total),
    conCita30d: Number(t.con_cita),
    conProximoPaso: Number(t.con_proximo),
    sinContenido: Number(t.sin_contenido),
    porVenta: v > 0 ? Number(t.total) / v : 0,
    porSala: porSala.rows as unknown as { sala: string; audiciones: number; nivel: number }[],
  };
}

export interface DatosAudicion {
  contactId: number | null;
  visitaId?: number | null;
  salaId: number;
  conCita: boolean;
  duracionMinutos?: number | null;
  acompanantes?: number;
  queDijo?: string | null;
  leGusto?: string | null;
  descarto?: string | null;
  presupuestoMencionado?: number | null;
  proximoPaso?: string | null;
  proximoPasoEn?: Date | null;
  atendidoPor: number;
}

export async function registrarAudicion(d: DatosAudicion): Promise<number> {
  const [creada] = await db
    .insert(crmAudiciones)
    .values({
      contactId: d.contactId,
      visitaId: d.visitaId ?? null,
      salaId: d.salaId,
      conCita: d.conCita,
      duracionMinutos: d.duracionMinutos ?? null,
      acompanantes: d.acompanantes ?? 0,
      queDijo: d.queDijo ?? null,
      leGusto: d.leGusto ?? null,
      descarto: d.descarto ?? null,
      presupuestoMencionado: d.presupuestoMencionado ?? null,
      proximoPaso: d.proximoPaso ?? null,
      proximoPasoEn: d.proximoPasoEn ?? null,
      atendidoPor: d.atendidoPor,
    })
    .returning({ id: crmAudiciones.id });

  return creada.id;
}

/** Los contactos para el selector, con lo que se sabe de cada uno. */
export async function contactosParaAudicion(): Promise<
  { id: number; nombre: string; telefono: string | null }[]
> {
  const filas = await db
    .select({ id: crmContacts.id, nombre: crmContacts.nombre, telefono: crmContacts.telefono })
    .from(crmContacts)
    .orderBy(crmContacts.nombre)
    .limit(400);
  return filas;
}
