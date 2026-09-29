// Cupones de descuento de la captura en tienda (fase 1).
//
// El cliente se lleva un QR; la caja lo escanea y lo canjea. No hay pago en
// línea de por medio: el descuento se aplica en la caja, como cualquier otro.

import { randomBytes } from "crypto";
import QRCode from "qrcode";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniCupones, type VanniCupon } from "@/db/vanni";
import { SITE_URL } from "@/lib/site";
import { guardarMensaje } from "./motor/conversacion";
import { enviarTexto } from "./wa";

/** Días de vigencia desde que se emite. */
export const DIAS_VIGENCIA = Number(process.env.VANNI_CUPON_DIAS || 30);

export function urlCupon(token: string): string {
  return `${SITE_URL}/vanni/cupon/${token}`;
}

export function urlQrCupon(token: string): string {
  return `${SITE_URL}/api/vanni/cupon/${token}/qr`;
}

function codigoCorto(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "VN-" + Array.from(randomBytes(5), (b) => abc[b % abc.length]).join("");
}

export function estadoEfectivo(c: VanniCupon): "vigente" | "canjeado" | "anulado" | "vencido" {
  if (c.estado === "canjeado" || c.estado === "anulado") return c.estado;
  return c.venceAt.getTime() < Date.now() ? "vencido" : "vigente";
}

/**
 * El cupón vigente de este RUT, o uno nuevo. Volver a escanear el QR de la sala
 * no multiplica descuentos: devuelve el que ya tiene, o el que ya canjeó.
 */
export async function emitirCupon(d: {
  rut: string;
  telefono: string | null;
  nombre: string | null;
  descuento: string;
  capturaId: number | null;
}): Promise<VanniCupon> {
  const [vigente] = await db
    .select()
    .from(vanniCupones)
    .where(and(eq(vanniCupones.rut, d.rut), eq(vanniCupones.estado, "vigente"), gt(vanniCupones.venceAt, new Date())))
    .orderBy(desc(vanniCupones.createdAt))
    .limit(1);
  // Un descuento se usa una vez. Si este RUT ya canjeó este mismo descuento,
  // escanear de nuevo no lo renueva; uno distinto (otra campaña) sí se emite.
  const [usado] = await db
    .select()
    .from(vanniCupones)
    .where(and(eq(vanniCupones.rut, d.rut), eq(vanniCupones.estado, "canjeado"), eq(vanniCupones.descuento, d.descuento)))
    .orderBy(desc(vanniCupones.canjeadoAt))
    .limit(1);

  if (vigente) {
    // Si confirmó otro teléfono, el cupón le llega a ese.
    if (d.telefono && d.telefono !== vigente.telefono) {
      await db.update(vanniCupones).set({ telefono: d.telefono }).where(eq(vanniCupones.id, vigente.id));
      return { ...vigente, telefono: d.telefono };
    }
    return vigente;
  }
  if (usado) return usado;

  for (let intento = 0; intento < 5; intento++) {
    try {
      const [c] = await db
        .insert(vanniCupones)
        .values({
          token: randomBytes(18).toString("base64url"),
          codigo: codigoCorto(),
          capturaId: d.capturaId,
          rut: d.rut,
          telefono: d.telefono,
          nombre: d.nombre,
          descuento: d.descuento,
          venceAt: new Date(Date.now() + DIAS_VIGENCIA * 86_400_000),
        })
        .returning();
      return c;
    } catch (err) {
      if (!String(err).includes("vanni_cupones_codigo_idx")) throw err;
    }
  }
  throw new Error("No se pudo generar el código del cupón");
}

export async function cuponPorToken(token: string): Promise<VanniCupon | null> {
  const [c] = await db.select().from(vanniCupones).where(eq(vanniCupones.token, token)).limit(1);
  return c ?? null;
}

export async function cuponPorCodigo(codigo: string): Promise<VanniCupon | null> {
  const limpio = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normal = limpio.startsWith("VN") ? `VN-${limpio.slice(2)}` : `VN-${limpio}`;
  const [c] = await db.select().from(vanniCupones).where(eq(vanniCupones.codigo, normal)).limit(1);
  return c ?? null;
}

export async function cuponDeCaptura(capturaId: number): Promise<VanniCupon | null> {
  const [c] = await db.select().from(vanniCupones).where(eq(vanniCupones.capturaId, capturaId)).orderBy(desc(vanniCupones.createdAt)).limit(1);
  return c ?? null;
}

export type ResultadoCanje =
  | { ok: true; cupon: VanniCupon }
  | { ok: false; error: string; cupon?: VanniCupon };

/**
 * Marca el cupón canjeado. Es atómico: el UPDATE solo pasa si sigue vigente, así
 * dos cajas que escanean el mismo cupón a la vez no lo canjean dos veces.
 */
export async function canjearCupon(d: {
  token: string;
  usuarioId: number;
  sucursal: string | null;
  boleta: string | null;
  monto: number | null;
}): Promise<ResultadoCanje> {
  const actual = await cuponPorToken(d.token);
  if (!actual) return { ok: false, error: "El cupón no existe." };
  const estado = estadoEfectivo(actual);
  if (estado !== "vigente") {
    const motivo = { canjeado: "ya fue canjeado", anulado: "fue anulado", vencido: "está vencido" }[estado];
    return { ok: false, error: `Este cupón ${motivo}.`, cupon: actual };
  }
  const [c] = await db
    .update(vanniCupones)
    .set({
      estado: "canjeado",
      canjeadoAt: new Date(),
      canjeadoPor: d.usuarioId,
      sucursalCanje: d.sucursal,
      boleta: d.boleta,
      montoCompra: d.monto,
    })
    .where(and(eq(vanniCupones.id, actual.id), eq(vanniCupones.estado, "vigente")))
    .returning();
  if (!c) return { ok: false, error: "Este cupón acaba de ser canjeado en otra caja.", cupon: actual };

  if (c.telefono) {
    const texto = `✅ Tu descuento *${c.descuento}* quedó aplicado${c.sucursalCanje ? ` en Vanni ${c.sucursalCanje}` : ""}. ¡Gracias por tu compra!`;
    const r = c.telefono.startsWith("569000")
      ? { ok: true, simulado: true, msgId: undefined as string | undefined }
      : await enviarTexto(c.telefono, texto);
    await guardarMensaje({ telefono: c.telefono, flujo: "sistema", direccion: "out", texto, simulado: r.simulado, waMsgId: r.msgId ?? null });
  }
  return { ok: true, cupon: c };
}

export async function qrSvg(texto: string, ancho = 220): Promise<string> {
  return QRCode.toString(texto, { type: "svg", margin: 1, width: ancho, color: { dark: "#1b2a2f", light: "#ffffff" } });
}

export async function qrPng(texto: string): Promise<Buffer> {
  return QRCode.toBuffer(texto, { type: "png", margin: 2, width: 600, color: { dark: "#1b2a2f", light: "#ffffff" } });
}

// ─── Métricas ────────────────────────────────────────────────────────────────

export interface EmbudoCupones {
  emitidos: number;
  vigentes: number;
  canjeados: number;
  vencidos: number;
  montoCanjeado: number;
}

export async function embudoCupones(): Promise<EmbudoCupones> {
  const r = await db.execute(sql`
    select count(*)::int as emitidos,
      count(*) filter (where estado = 'vigente' and vence_at > now())::int as vigentes,
      count(*) filter (where estado = 'canjeado')::int as canjeados,
      count(*) filter (where estado = 'vigente' and vence_at <= now())::int as vencidos,
      coalesce(sum(monto_compra) filter (where estado = 'canjeado'), 0)::bigint as "montoCanjeado"
    from vanni_cupones`);
  const x = r.rows[0] as Record<string, number | string>;
  return {
    emitidos: Number(x.emitidos ?? 0),
    vigentes: Number(x.vigentes ?? 0),
    canjeados: Number(x.canjeados ?? 0),
    vencidos: Number(x.vencidos ?? 0),
    montoCanjeado: Number(x.montoCanjeado ?? 0),
  };
}
