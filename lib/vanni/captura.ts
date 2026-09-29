// Captura en tienda: QR en la sucursal → RUT → descuento → teléfono → WhatsApp.
//
// **Qué se muestra y qué no.** El formulario es público: cualquiera puede
// escribir un RUT ajeno. Por eso solo se muestra el primer nombre y el teléfono
// enmascarado (+56 9 ••••4321), nunca el número completo ni la razón social, y
// los intentos por origen tienen un límite: sin él, el formulario sería una
// forma de recorrer la base de clientes de Vanni probando RUTs.

import { createHash, randomBytes } from "crypto";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  vanniCapturas,
  vanniClientesMaestra,
  vanniContactos,
  vanniPromociones,
  type VanniCaptura,
} from "@/db/vanni";
import { emitirCupon, qrSvg, urlCupon } from "./cupones";
import { normalizarRut } from "./rut";
import { normalizarTelefono } from "./telefono";

/** Intentos por origen en 10 minutos. Una familia en la caja no llega a esto; un script sí. */
const LIMITE_INTENTOS = 15;

export function hashOrigen(ip: string | null): string {
  return createHash("sha256").update(`vanni:${ip ?? "desconocido"}`).digest("hex");
}

function codigoNuevo(): string {
  // Sin 0/O ni 1/I: se dicta y se lee en una pantalla chica.
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (b) => abc[b % abc.length]).join("");
}

export function enmascarar(telefono: string): string {
  return /^569\d{8}$/.test(telefono) ? `+56 9 ••••${telefono.slice(-4)}` : `••••${telefono.slice(-4)}`;
}

function primerNombre(n: string | null | undefined): string | null {
  const p = (n ?? "").trim().split(/\s+/)[0];
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : null;
}

export interface ResultadoRut {
  ok: boolean;
  error?: string;
  codigo?: string;
  encontrado?: boolean;
  nombre?: string | null;
  descuento?: string | null;
  telefonoMascarado?: string | null;
}

export async function buscarRut(rutEntrada: string, sucursal: string | null, origen: string): Promise<ResultadoRut> {
  const rut = normalizarRut(rutEntrada);
  if (!rut) return { ok: false, error: "Ese RUT no es válido. Revisa los números y el dígito verificador." };

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(vanniCapturas)
    .where(and(eq(vanniCapturas.origenHash, origen), gte(vanniCapturas.createdAt, new Date(Date.now() - 10 * 60_000))));
  if (n >= LIMITE_INTENTOS) {
    return { ok: false, error: "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar." };
  }

  const [cliente] = await db.select().from(vanniClientesMaestra).where(eq(vanniClientesMaestra.rut, rut)).limit(1);
  const codigo = codigoNuevo();
  await db.insert(vanniCapturas).values({
    codigo,
    rut,
    clienteId: cliente?.id ?? null,
    encontrado: Boolean(cliente),
    sucursal: sucursal?.slice(0, 80) || null,
    origenHash: origen,
  });

  return {
    ok: true,
    codigo,
    encontrado: Boolean(cliente),
    nombre: primerNombre(cliente?.nombre ?? cliente?.razonSocial),
    descuento: cliente?.descuento ?? null,
    telefonoMascarado: cliente?.telefono ? enmascarar(cliente.telefono) : null,
  };
}

export interface CuponEmitido {
  token: string;
  codigo: string;
  descuento: string;
  vence: string;
  url: string;
  qrSvg: string;
}

export interface ResultadoCaptura {
  ok: boolean;
  error?: string;
  cupon?: CuponEmitido;
  /** Para recibir el cupón por WhatsApp. `null` si falta VANNI_WHATSAPP_NUMERO. */
  whatsappUrl?: string | null;
}

export function mensajeWhatsApp(codigo: string): string {
  return `Hola, quiero mi cupón de descuento 🎁 (código ${codigo})`;
}

export function urlWhatsApp(codigo: string): string | null {
  const numero = process.env.VANNI_WHATSAPP_NUMERO?.replace(/\D/g, "");
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsApp(codigo))}`;
}

/**
 * Cierra la captura: fija el teléfono (el de la base confirmado, uno nuevo o
 * uno corregido), registra el consentimiento y deja al cliente como contacto,
 * para que el bot lo reconozca cuando escriba.
 */
export async function completarCaptura(d: {
  codigo: string;
  confirmaTelefono: boolean;
  telefono?: string | null;
  consentimiento: boolean;
}): Promise<ResultadoCaptura> {
  const [cap] = await db.select().from(vanniCapturas).where(eq(vanniCapturas.codigo, d.codigo)).limit(1);
  if (!cap) return { ok: false, error: "La sesión expiró. Vuelve a ingresar tu RUT." };
  if (Date.now() - cap.createdAt.getTime() > 60 * 60_000) {
    return { ok: false, error: "La sesión expiró. Vuelve a ingresar tu RUT." };
  }
  const [cliente] = cap.clienteId
    ? await db.select().from(vanniClientesMaestra).where(eq(vanniClientesMaestra.id, cap.clienteId))
    : [null];

  let telefono: string | null;
  let origenTelefono: "confirmado" | "nuevo" | "corregido";
  if (d.confirmaTelefono && cliente?.telefono) {
    telefono = cliente.telefono;
    origenTelefono = "confirmado";
  } else {
    telefono = normalizarTelefono(d.telefono);
    if (!telefono) return { ok: false, error: "Ese teléfono no es válido. Escríbelo como +56 9 1234 5678." };
    origenTelefono = cliente?.telefono ? "corregido" : "nuevo";
  }

  await db
    .update(vanniCapturas)
    .set({ telefono, origenTelefono, consentimiento: d.consentimiento, completadaAt: new Date() })
    .where(eq(vanniCapturas.id, cap.id));

  // Si la base no tenía el teléfono, o tenía otro, ahora lo tiene: es el dato
  // que la captura en tienda viene a completar.
  if (cliente && cliente.telefono !== telefono) {
    await db
      .update(vanniClientesMaestra)
      .set({ telefono, updatedAt: new Date() })
      .where(eq(vanniClientesMaestra.id, cliente.id));
  }

  const datos = {
    rut: cap.rut,
    nombre: cliente?.nombre ?? null,
    razonSocial: cliente?.razonSocial ?? null,
    email: cliente?.email ?? null,
    sucursal: cap.sucursal ?? cliente?.sucursal ?? null,
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

  // Fase 1: el cierre es un cupón que se canjea en caja. El descuento es el de
  // su RUT; si no estaba en la base, el primer descuento vigente de la sala.
  const [promo] = await promocionesActivas();
  const cupon = await emitirCupon({
    rut: cap.rut,
    telefono,
    nombre: cliente?.nombre ?? null,
    descuento: cliente?.descuento || promo?.titulo || "Descuento de bienvenida",
    capturaId: cap.id,
  });
  if (cupon.estado === "canjeado") {
    const cuando = cupon.canjeadoAt?.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
    return {
      ok: false,
      error: `Ya usaste tu descuento “${cupon.descuento}”${cuando ? ` el ${cuando}` : ""}${cupon.sucursalCanje ? ` en ${cupon.sucursalCanje}` : ""}. Te avisaremos cuando tengas uno nuevo.`,
    };
  }
  return {
    ok: true,
    cupon: {
      token: cupon.token,
      codigo: cupon.codigo,
      descuento: cupon.descuento,
      vence: cupon.venceAt.toISOString(),
      url: urlCupon(cupon.token),
      qrSvg: await qrSvg(urlCupon(cupon.token)),
    },
    whatsappUrl: urlWhatsApp(cupon.codigo),
  };
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
