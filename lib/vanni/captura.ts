// Captura en tienda: QR en la sucursal → WhatsApp → opt-in → RUT → cupón.
//
// **El QR abre WhatsApp, no un formulario.** El cliente inicia la conversación
// con un mensaje ya escrito ("Quiero mi descuento Vanni (sala Centro)"), así
// que su número llega solo y verificado: es el del teléfono que escribe. El
// bot le pide el permiso para ofertas y el RUT (ver `motor/captura.ts`).
//
// **Qué se muestra y qué no.** Cualquiera puede escribir un RUT ajeno. Por eso
// solo se muestra el primer nombre, y un teléfono distinto al de la base no lo
// reemplaza: se registra en la captura y en el contacto, pero el de la base
// sigue siendo el de la base hasta que alguien de Vanni lo confirme.

import { randomBytes } from "crypto";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniCapturas,
  vanniClientesMaestra,
  vanniContactos,
  vanniPromociones,
  type VanniCaptura,
  type VanniCupon,
} from "@/db/vanni";
import { emitirCupon } from "./cupones";
import { normalizarRut } from "./rut";
import { normalizarTelefono } from "./telefono";

/** RUT distintos que un mismo teléfono puede probar en 10 minutos. */
const LIMITE_RUTS = 5;

function codigoNuevo(): string {
  // Sin 0/O ni 1/I: se dicta y se lee en una pantalla chica.
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => abc[b % abc.length]).join("");
}

function primerNombre(n: string | null | undefined): string | null {
  const p = (n ?? "").trim().split(/\s+/)[0];
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : null;
}

/** El mensaje que el QR de la sala deja escrito en WhatsApp. El bot lo reconoce. */
export function mensajeSala(sucursal: string | null): string {
  return `Hola 👋 Quiero mi descuento Vanni${sucursal ? ` (sala ${sucursal})` : ""}`;
}

/** A dónde lleva el QR de la sala. `null` si falta VANNI_WHATSAPP_NUMERO. */
export function urlWhatsAppSala(sucursal: string | null): string | null {
  const numero = process.env.VANNI_WHATSAPP_NUMERO?.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeSala(sucursal))}`;
}

export type ResultadoCapturaWhatsApp =
  | { ok: true; cupon: VanniCupon; nombre: string | null; encontrado: boolean }
  | { ok: false; error: string };

/**
 * Registra la captura hecha por WhatsApp y emite el cupón. El teléfono es el
 * del chat: no se pregunta ni se confirma.
 */
export async function capturarPorWhatsApp(d: {
  telefono: string;
  rut: string;
  sucursal: string | null;
  consentimiento: boolean;
  nombrePush: string | null;
}): Promise<ResultadoCapturaWhatsApp> {
  const rut = normalizarRut(d.rut);
  if (!rut) return { ok: false, error: "rut" };
  const telefono = normalizarTelefono(d.telefono);
  if (!telefono) return { ok: false, error: "telefono" };

  const [{ n }] = await db
    .select({ n: sql<number>`count(distinct ${vanniCapturas.rut})::int` })
    .from(vanniCapturas)
    .where(and(eq(vanniCapturas.telefono, telefono), gte(vanniCapturas.createdAt, new Date(Date.now() - 10 * 60_000))));
  if (n >= LIMITE_RUTS) return { ok: false, error: "limite" };

  const [cliente] = await db.select().from(vanniClientesMaestra).where(eq(vanniClientesMaestra.rut, rut)).limit(1);
  const origenTelefono = !cliente?.telefono ? "nuevo" : cliente.telefono === telefono ? "confirmado" : "corregido";
  const [cap] = await db
    .insert(vanniCapturas)
    .values({
      codigo: codigoNuevo(),
      rut,
      clienteId: cliente?.id ?? null,
      encontrado: Boolean(cliente),
      sucursal: d.sucursal?.slice(0, 80) || null,
      telefono,
      origenTelefono,
      consentimiento: d.consentimiento,
      completadaAt: new Date(),
      whatsappAt: new Date(),
    })
    .returning();

  // La base gana el teléfono que no tenía. Uno distinto no se pisa: podría ser
  // alguien escribiendo un RUT ajeno.
  if (cliente && !cliente.telefono) {
    await db.update(vanniClientesMaestra).set({ telefono, updatedAt: new Date() }).where(eq(vanniClientesMaestra.id, cliente.id));
  }

  const nombre = cliente?.nombre ?? d.nombrePush ?? null;
  const datos = {
    rut,
    nombre,
    razonSocial: cliente?.razonSocial ?? null,
    email: cliente?.email ?? null,
    sucursal: d.sucursal ?? cliente?.sucursal ?? null,
    consentimiento: d.consentimiento,
    consentimientoAt: new Date(),
    updatedAt: new Date(),
  };
  const [existe] = await db.select({ id: vanniContactos.id }).from(vanniContactos).where(eq(vanniContactos.telefono, telefono)).limit(1);
  if (existe) {
    await db
      .update(vanniContactos)
      .set(Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== null)))
      .where(eq(vanniContactos.id, existe.id));
  } else {
    await db.insert(vanniContactos).values({ telefono, ...datos, origen: "qr", ejemplo: telefono.startsWith("569000") });
  }

  // El descuento es el de su RUT; si no estaba en la base, la primera promoción
  // vigente de la sala.
  const [promo] = await promocionesActivas();
  const cupon = await emitirCupon({
    rut,
    telefono,
    nombre: cliente?.nombre ?? d.nombrePush ?? null,
    descuento: cliente?.descuento || promo?.titulo || "Descuento de bienvenida",
    capturaId: cap.id,
  });
  return { ok: true, cupon, nombre: primerNombre(cliente?.nombre ?? cliente?.razonSocial ?? d.nombrePush), encontrado: Boolean(cliente) };
}

// ─── Lado del bot ────────────────────────────────────────────────────────────

export async function capturaPorCodigo(codigo: string): Promise<VanniCaptura | null> {
  const [c] = await db.select().from(vanniCapturas).where(eq(vanniCapturas.codigo, codigo.toUpperCase())).limit(1);
  return c ?? null;
}

/** La captura más reciente de este teléfono, si el mensaje llegó sin código. */
export async function capturaPorTelefono(telefono: string): Promise<VanniCaptura | null> {
  const [c] = await db
    .select()
    .from(vanniCapturas)
    .where(eq(vanniCapturas.telefono, telefono))
    .orderBy(desc(vanniCapturas.createdAt))
    .limit(1);
  return c ?? null;
}

export async function marcarWhatsApp(capturaId: number): Promise<void> {
  await db
    .update(vanniCapturas)
    .set({ whatsappAt: sql`coalesce(${vanniCapturas.whatsappAt}, now())` })
    .where(eq(vanniCapturas.id, capturaId));
}

export async function promocionesActivas() {
  return db
    .select()
    .from(vanniPromociones)
    .where(eq(vanniPromociones.activa, true))
    .orderBy(asc(vanniPromociones.orden), asc(vanniPromociones.id));
}

export async function nombreDeCaptura(c: VanniCaptura): Promise<string | null> {
  if (!c.clienteId) return null;
  const [cl] = await db.select().from(vanniClientesMaestra).where(eq(vanniClientesMaestra.id, c.clienteId));
  return primerNombre(cl?.nombre ?? cl?.razonSocial);
}

// ─── Base maestra ────────────────────────────────────────────────────────────

const ALIAS: Record<string, string[]> = {
  rut: ["rut", "rut cliente", "run"],
  nombre: ["nombre", "nombre cliente", "cliente", "contacto"],
  razonSocial: ["razon social", "empresa"],
  telefono: ["telefono", "celular", "movil", "fono", "whatsapp"],
  email: ["email", "correo", "mail"],
  sucursal: ["sucursal", "tienda", "local"],
  descuento: ["descuento", "promocion", "beneficio", "oferta", "tipo descuento", "tipo de descuento"],
};

function limpio(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_.]/g, " ").replace(/\s+/g, " ").trim();
}

export interface ResultadoBase {
  nuevos: number;
  actualizados: number;
  rechazadas: { fila: number; motivo: string }[];
}

export async function cargarBaseMaestra(filas: unknown[][]): Promise<ResultadoBase> {
  const r: ResultadoBase = { nuevos: 0, actualizados: 0, rechazadas: [] };
  if (filas.length < 2) {
    r.rechazadas.push({ fila: 1, motivo: "La planilla no tiene filas de datos" });
    return r;
  }
  const col: Record<string, number> = {};
  filas[0].forEach((h, i) => {
    const e = limpio(h);
    for (const [campo, alias] of Object.entries(ALIAS)) {
      if (col[campo] === undefined && alias.some((a) => limpio(a) === e)) col[campo] = i;
    }
  });
  if (col.rut === undefined) {
    r.rechazadas.push({ fila: 1, motivo: "No encontré una columna RUT" });
    return r;
  }
  const v = (f: unknown[], k: string) => {
    const x = col[k] === undefined ? null : f[col[k]];
    const s = String(x ?? "").trim();
    return s || null;
  };
  const vistos = new Set<string>();
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    const rut = normalizarRut(v(f, "rut"));
    if (!rut) {
      r.rechazadas.push({ fila: i + 1, motivo: `RUT no válido: "${v(f, "rut") ?? ""}"` });
      continue;
    }
    if (vistos.has(rut)) {
      r.rechazadas.push({ fila: i + 1, motivo: `RUT repetido en la planilla (${rut})` });
      continue;
    }
    vistos.add(rut);
    const telCrudo = v(f, "telefono");
    const telefono = telCrudo ? normalizarTelefono(telCrudo) : null;
    if (telCrudo && !telefono) r.rechazadas.push({ fila: i + 1, motivo: `Teléfono no válido (se carga el cliente sin él): "${telCrudo}"` });
    const datos = {
      nombre: v(f, "nombre"),
      razonSocial: v(f, "razonSocial"),
      telefono,
      email: v(f, "email"),
      sucursal: v(f, "sucursal"),
      descuento: v(f, "descuento"),
    };
    const [existe] = await db.select({ id: vanniClientesMaestra.id }).from(vanniClientesMaestra).where(eq(vanniClientesMaestra.rut, rut)).limit(1);
    if (existe) {
      await db
        .update(vanniClientesMaestra)
        .set({ ...Object.fromEntries(Object.entries(datos).filter(([, x]) => x !== null)), updatedAt: new Date() })
        .where(eq(vanniClientesMaestra.id, existe.id));
      r.actualizados++;
    } else {
      await db.insert(vanniClientesMaestra).values({ rut, ...datos });
      r.nuevos++;
    }
  }
  return r;
}

// ─── Métricas ────────────────────────────────────────────────────────────────

export interface EmbudoCaptura {
  base: number;
  baseConTelefono: number;
  ingresos: number;
  encontrados: number;
  completadas: number;
  confirmados: number;
  nuevos: number;
  corregidos: number;
  consentimiento: number;
  whatsapp: number;
}

export async function embudoCaptura(): Promise<EmbudoCaptura> {
  const r = await db.execute(sql`
    select
      (select count(*) from vanni_clientes_maestra)::int as base,
      (select count(*) from vanni_clientes_maestra where telefono is not null)::int as "baseConTelefono",
      count(*)::int as ingresos,
      count(*) filter (where encontrado)::int as encontrados,
      count(*) filter (where completada_at is not null)::int as completadas,
      count(*) filter (where origen_telefono = 'confirmado')::int as confirmados,
      count(*) filter (where origen_telefono = 'nuevo')::int as nuevos,
      count(*) filter (where origen_telefono = 'corregido')::int as corregidos,
      count(*) filter (where consentimiento)::int as consentimiento,
      count(*) filter (where whatsapp_at is not null)::int as whatsapp
    from vanni_capturas`);
  return r.rows[0] as unknown as EmbudoCaptura;
}

export async function capturasPorSucursal(): Promise<{ sucursal: string; ingresos: number; completadas: number; whatsapp: number }[]> {
  const r = await db.execute(sql`
    select coalesce(sucursal, 'Sin sucursal') as sucursal, count(*)::int as ingresos,
      count(*) filter (where completada_at is not null)::int as completadas,
      count(*) filter (where whatsapp_at is not null)::int as whatsapp
    from vanni_capturas group by 1 order by 2 desc`);
  return r.rows as unknown as { sucursal: string; ingresos: number; completadas: number; whatsapp: number }[];
}

export async function sucursalesConocidas(): Promise<string[]> {
  const r = await db.execute(sql`
    select distinct s from (
      select sucursal as s from vanni_clientes_maestra
      union select sucursal from vanni_contactos where ejemplo = false
    ) x where s is not null order by s`);
  return (r.rows as { s: string }[]).map((x) => x.s);
}
