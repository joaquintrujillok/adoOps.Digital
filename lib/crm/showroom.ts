// Captura de visitantes del showroom.
//
// El dashboard de clientes vive de una sola cosa: que la venta tenga una
// persona detrás. Hoy no la tiene en más de la mitad de los casos, y eso no se
// arregla con un algoritmo sino con un hábito en el mostrador. Este módulo
// existe para que ese hábito tome diez segundos: el visitante escanea un QR,
// deja tres datos y acepta que le escriban.
//
// **El consentimiento es un campo con fecha, no una casilla.** Sin él, el dato
// sirve para el registro de visitas y para nada más: no se le escribe. La ley
// 19.628 y el sentido común coinciden acá.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { crmContacts, crmShowroomVisitas, crmUsers } from "@/db/crm";
import { normalizarTelefono } from "./telefono";

export interface VisitaListada {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  interes: string | null;
  detalle: string | null;
  boutique: string | null;
  medio: string;
  evento: string | null;
  consentimiento: boolean;
  estado: string;
  contactId: number | null;
  atendidoPor: string | null;
  createdAt: Date;
  /** Días desde que dejó sus datos. Una visita de hace una semana ya se enfrió. */
  diasEsperando: number;
}

export async function listarVisitas(opciones?: {
  estado?: string;
  desdeDias?: number;
}): Promise<VisitaListada[]> {
  const condiciones = [];
  if (opciones?.estado) condiciones.push(eq(crmShowroomVisitas.estado, opciones.estado));
  if (opciones?.desdeDias) {
    condiciones.push(
      gte(crmShowroomVisitas.createdAt, new Date(Date.now() - opciones.desdeDias * 86_400_000)),
    );
  }

  const filas = await db
    .select({ v: crmShowroomVisitas, atendidoPor: crmUsers.nombre })
    .from(crmShowroomVisitas)
    .leftJoin(crmUsers, eq(crmUsers.id, crmShowroomVisitas.atendidoPor))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(crmShowroomVisitas.createdAt))
    .limit(300);

  return filas.map((f) => ({
    id: f.v.id,
    nombre: f.v.nombre,
    telefono: f.v.telefono,
    email: f.v.email,
    interes: f.v.interes,
    detalle: f.v.detalle,
    boutique: f.v.boutique,
    medio: f.v.medio,
    evento: f.v.evento,
    consentimiento: f.v.consentimiento,
    estado: f.v.estado,
    contactId: f.v.contactId,
    atendidoPor: f.atendidoPor,
    createdAt: f.v.createdAt,
    diasEsperando: Math.floor((Date.now() - new Date(f.v.createdAt).getTime()) / 86_400_000),
  }));
}

export interface ResumenShowroom {
  total30d: number;
  pendientes: number;
  contactados: number;
  convertidos: number;
  descartados: number;
  /** De los que dejaron datos, cuántos autorizaron que les escriban. */
  conConsentimiento: number;
  tasaConsentimiento: number;
  /** De los atendidos, cuántos terminaron comprando. */
  tasaConversion: number;
  porMedio: { medio: string; visitas: number }[];
  porInteres: { interes: string; visitas: number }[];
  porBoutique: { boutique: string; visitas: number }[];
  /** Visitas por semana de las últimas ocho. */
  porSemana: { etiqueta: string; visitas: number }[];
}

export async function resumenShowroom(): Promise<ResumenShowroom> {
  const [totales, medios, intereses, boutiques, semanas] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes,
             COUNT(*) FILTER (WHERE estado = 'contactado')::int AS contactados,
             COUNT(*) FILTER (WHERE estado = 'convertido')::int AS convertidos,
             COUNT(*) FILTER (WHERE estado = 'descartado')::int AS descartados,
             COUNT(*) FILTER (WHERE consentimiento)::int AS con_consentimiento
      FROM crm_showroom_visitas
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
    db.execute(sql`
      SELECT medio, COUNT(*)::int AS visitas FROM crm_showroom_visitas
      GROUP BY medio ORDER BY visitas DESC
    `),
    db.execute(sql`
      SELECT COALESCE(interes, 'Sin indicar') AS interes, COUNT(*)::int AS visitas
      FROM crm_showroom_visitas GROUP BY 1 ORDER BY visitas DESC LIMIT 8
    `),
    db.execute(sql`
      SELECT COALESCE(boutique, 'Sin indicar') AS boutique, COUNT(*)::int AS visitas
      FROM crm_showroom_visitas GROUP BY 1 ORDER BY visitas DESC
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('week', created_at), 'DD-MM') AS etiqueta,
             COUNT(*)::int AS visitas
      FROM crm_showroom_visitas
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY date_trunc('week', created_at)
      ORDER BY date_trunc('week', created_at)
    `),
  ]);

  const t = totales.rows[0] as unknown as Record<string, number>;
  const atendidos = Number(t.contactados) + Number(t.convertidos) + Number(t.descartados);

  return {
    total30d: Number(t.total),
    pendientes: Number(t.pendientes),
    contactados: Number(t.contactados),
    convertidos: Number(t.convertidos),
    descartados: Number(t.descartados),
    conConsentimiento: Number(t.con_consentimiento),
    tasaConsentimiento: Number(t.total) > 0 ? (Number(t.con_consentimiento) / Number(t.total)) * 100 : 0,
    // Sobre los atendidos, no sobre el total: una visita de ayer que todavía
    // nadie llamó no puede contar como oportunidad perdida.
    tasaConversion: atendidos > 0 ? (Number(t.convertidos) / atendidos) * 100 : 0,
    porMedio: medios.rows as unknown as { medio: string; visitas: number }[],
    porInteres: intereses.rows as unknown as { interes: string; visitas: number }[],
    porBoutique: boutiques.rows as unknown as { boutique: string; visitas: number }[],
    porSemana: semanas.rows as unknown as { etiqueta: string; visitas: number }[],
  };
}

export type ResultadoCaptura =
  | { ok: true; id: number; yaExistia: boolean }
  | { ok: false; error: string };

/**
 * Registra una visita desde el formulario público.
 *
 * Se ejecuta sin sesión: lo llena el visitante en su propio teléfono. Por eso
 * valida todo del lado del servidor y no confía en nada que venga del
 * formulario.
 */
export async function registrarVisita(datos: {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  interes?: string | null;
  detalle?: string | null;
  boutique?: string | null;
  medio?: string;
  evento?: string | null;
  consentimiento: boolean;
}): Promise<ResultadoCaptura> {
  const nombre = datos.nombre.trim();
  if (nombre.length < 3) return { ok: false, error: "Escribe tu nombre" };

  const telefono = datos.telefono ? normalizarTelefono(datos.telefono) : null;
  const email = datos.email?.trim().toLowerCase() || null;

  // Sin al menos una forma de contacto la visita no sirve para nada: sería un
  // registro de que alguien entró, que es justo lo que ya se sabía.
  if (!telefono && !email) {
    return { ok: false, error: "Déjanos un teléfono o un correo para poder responderte" };
  }
  if (datos.telefono && !telefono) {
    return { ok: false, error: "Ese teléfono no parece válido. Revisa el número." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ese correo no parece válido" };
  }

  // Si ya es cliente, la visita se enlaza con su ficha en vez de crear un
  // duplicado. Un cliente que vuelve al showroom no es un lead nuevo.
  let contactId: number | null = null;
  let yaExistia = false;
  if (telefono) {
    const [existente] = await db
      .select({ id: crmContacts.id })
      .from(crmContacts)
      .where(eq(crmContacts.telefono, telefono))
      .limit(1);
    if (existente) {
      contactId = existente.id;
      yaExistia = true;
    }
  }

  const ahora = new Date();
  const [creada] = await db
    .insert(crmShowroomVisitas)
    .values({
      nombre,
      telefono,
      email,
      interes: datos.interes?.trim() || null,
      detalle: datos.detalle?.trim() || null,
      boutique: datos.boutique?.trim() || null,
      medio: datos.medio ?? "qr",
      evento: datos.evento?.trim() || null,
      consentimiento: datos.consentimiento,
      consentimientoEn: datos.consentimiento ? ahora : null,
      contactId,
      estado: "pendiente",
    })
    .returning({ id: crmShowroomVisitas.id });

  return { ok: true, id: creada.id, yaExistia };
}

/**
 * Convierte una visita en contacto del CRM.
 *
 * Hasta acá la visita vivía aparte: entra gente que no compró y que puede no
 * volver nunca, y mezclarlos con la cartera desde el minuto cero ensucia todos
 * los promedios. Se cruza recién cuando alguien decide trabajarla.
 */
export async function convertirVisita(
  visitaId: number,
  ownerId: number,
): Promise<{ ok: boolean; contactId?: number; error?: string }> {
  const [v] = await db
    .select()
    .from(crmShowroomVisitas)
    .where(eq(crmShowroomVisitas.id, visitaId))
    .limit(1);

  if (!v) return { ok: false, error: "La visita no existe" };
  if (v.contactId) return { ok: true, contactId: v.contactId };

  const [creado] = await db
    .insert(crmContacts)
    .values({
      nombre: v.nombre,
      telefono: v.telefono,
      email: v.email,
      ciudad: null,
      estado: "prospecto",
      fuente: v.evento ? `Evento · ${v.evento}` : "Showroom",
      ownerId,
      consentimiento: v.consentimiento,
      consentimientoEn: v.consentimientoEn,
      // El opt-in de WhatsApp hereda el consentimiento, pero solo si además
      // dejó teléfono: autorizar por correo no autoriza por WhatsApp.
      optInWhatsapp: v.consentimiento && Boolean(v.telefono),
      preferencias: v.interes ? `Vino al showroom preguntando por ${v.interes}.` : null,
      notas: v.detalle,
    })
    .returning({ id: crmContacts.id });

  await db
    .update(crmShowroomVisitas)
    .set({ contactId: creado.id, estado: "convertido" })
    .where(eq(crmShowroomVisitas.id, visitaId));

  return { ok: true, contactId: creado.id };
}

export async function cambiarEstadoVisita(
  visitaId: number,
  estado: "pendiente" | "contactado" | "convertido" | "descartado",
): Promise<void> {
  await db
    .update(crmShowroomVisitas)
    .set({ estado })
    .where(eq(crmShowroomVisitas.id, visitaId));
}

/** Los intereses que ofrece el formulario. Se leen del catálogo real. */
export async function interesesDisponibles(): Promise<string[]> {
  const filas = await db.execute(sql`
    SELECT DISTINCT categoria FROM crm_products
    WHERE activo AND categoria IS NOT NULL ORDER BY categoria
  `);
  const categorias = (filas.rows as unknown as { categoria: string }[]).map((f) => f.categoria);
  // "Un regalo" no es una categoría del catálogo pero es la mitad de las
  // consultas de una joyería, y saberlo cambia cómo se atiende la visita.
  return [...categorias, "Un regalo", "Todavía no lo sé"];
}
