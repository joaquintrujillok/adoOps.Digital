// Segmentación, ventana de recompra y cross-selling.
//
// Los tres salen del mismo lugar —qué compró cada cuenta y cuándo— y por eso
// viven juntos: son tres preguntas sobre la misma tabla.
//
// Un segmento guarda la REGLA, no la lista. Guardar la lista congelaría el
// segmento el día que se creó, que es justo lo contrario de para qué sirve.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmAccounts,
  crmContacts,
  crmOrderItems,
  crmOrders,
  crmProducts,
  crmSegments,
} from "@/db/crm";
import { cicloRecompra } from "./cuentas";
import { scoresDeCuentas, type ScoreCuenta } from "./scoring";

// ─── Definición declarativa ──────────────────────────────────────────────────

export interface DefinicionSegmento {
  estado?: string[];
  industria?: string[];
  tamano?: string[];
  scoreMin?: number;
  scoreMax?: number;
  facturadoMin?: number;
  /** Días desde la última compra, mínimo y máximo. */
  sinComprarMin?: number;
  sinComprarMax?: number;
  comprasMin?: number;
  /** Compró alguno de estos productos alguna vez. */
  compro?: number[];
  /** Y no compró ninguno de estos. La combinación es la base del cross-sell. */
  noCompro?: number[];
  /** Solo cuentas con al menos un contacto con WhatsApp autorizado. */
  conWhatsapp?: boolean;
}

export interface CuentaSegmentada {
  accountId: number;
  nombre: string;
  estado: string;
  industria: string | null;
  tamano: string | null;
  score: number;
  facturado: number;
  compras: number;
  diasSinComprar: number | null;
  cicloRecompraDias: number | null;
  productos: number[];
  contactoWhatsapp: { id: number; nombre: string; telefono: string } | null;
}

/**
 * Universo de cuentas con todo lo que un segmento puede filtrar.
 *
 * Se arma completo en memoria y se filtra después. Con carteras de decenas de
 * miles habría que bajar los filtros a SQL; para lo que un CRM comercial mueve
 * (cientos a pocos miles), una consulta y un filtro en JavaScript es más simple
 * de leer y de auditar que un armador dinámico de WHERE.
 */
export async function universo(): Promise<CuentaSegmentada[]> {
  const [cuentas, scores, compras, items, contactos] = await Promise.all([
    db.select().from(crmAccounts),
    scoresDeCuentas(),
    db
      .select({
        accountId: crmOrders.accountId,
        fecha: crmOrders.fecha,
        total: crmOrders.total,
      })
      .from(crmOrders),
    db
      .select({
        accountId: crmOrders.accountId,
        productId: crmOrderItems.productId,
      })
      .from(crmOrderItems)
      .innerJoin(crmOrders, eq(crmOrders.id, crmOrderItems.orderId)),
    db
      .select({
        id: crmContacts.id,
        accountId: crmContacts.accountId,
        nombre: crmContacts.nombre,
        telefono: crmContacts.telefono,
        optIn: crmContacts.optInWhatsapp,
      })
      .from(crmContacts),
  ]);

  const porCuenta = new Map(scores.map((s) => [s.accountId, s]));

  return cuentas.map((c) => {
    const suyas = compras.filter((o) => o.accountId === c.id);
    const fechas = suyas.map((o) => o.fecha);
    const ultima = fechas.length
      ? Math.max(...fechas.map((f) => new Date(f).getTime()))
      : null;
    const wa = contactos.find(
      (k) => k.accountId === c.id && k.optIn && k.telefono,
    );

    return {
      accountId: c.id,
      nombre: c.nombre,
      estado: c.estado,
      industria: c.industria,
      tamano: c.tamano,
      score: porCuenta.get(c.id)?.score ?? 0,
      facturado: suyas.reduce((s, o) => s + o.total, 0),
      compras: suyas.length,
      diasSinComprar: ultima
        ? Math.floor((Date.now() - ultima) / 86_400_000)
        : null,
      cicloRecompraDias: cicloRecompra(fechas),
      productos: [
        ...new Set(items.filter((i) => i.accountId === c.id).map((i) => i.productId)),
      ],
      contactoWhatsapp: wa
        ? { id: wa.id, nombre: wa.nombre, telefono: wa.telefono! }
        : null,
    };
  });
}

export function aplicar(
  cuentas: CuentaSegmentada[],
  def: DefinicionSegmento,
): CuentaSegmentada[] {
  return cuentas.filter((c) => {
    if (def.estado?.length && !def.estado.includes(c.estado)) return false;
    if (def.industria?.length && !def.industria.includes(c.industria ?? "")) return false;
    if (def.tamano?.length && !def.tamano.includes(c.tamano ?? "")) return false;
    if (def.scoreMin != null && c.score < def.scoreMin) return false;
    if (def.scoreMax != null && c.score > def.scoreMax) return false;
    if (def.facturadoMin != null && c.facturado < def.facturadoMin) return false;
    if (def.comprasMin != null && c.compras < def.comprasMin) return false;
    // Una cuenta que nunca compró no entra en un filtro de "días sin comprar":
    // no es que lleve mucho tiempo sin comprar, es que nunca estuvo adentro.
    if (def.sinComprarMin != null && (c.diasSinComprar ?? -1) < def.sinComprarMin) return false;
    if (def.sinComprarMax != null && (c.diasSinComprar ?? Infinity) > def.sinComprarMax) return false;
    if (def.compro?.length && !def.compro.some((p) => c.productos.includes(p))) return false;
    if (def.noCompro?.length && def.noCompro.some((p) => c.productos.includes(p))) return false;
    if (def.conWhatsapp && !c.contactoWhatsapp) return false;
    return true;
  });
}

export async function listarSegmentos() {
  return db.select().from(crmSegments).orderBy(desc(crmSegments.createdAt));
}

export async function evaluarSegmento(segmentId: number) {
  const [seg] = await db
    .select()
    .from(crmSegments)
    .where(eq(crmSegments.id, segmentId))
    .limit(1);
  if (!seg) return null;
  const todas = await universo();
  return {
    segmento: seg,
    cuentas: aplicar(todas, seg.definicion as DefinicionSegmento),
  };
}

// ─── Ventana de recompra ─────────────────────────────────────────────────────

export interface Recompra {
  cuenta: CuentaSegmentada;
  /** Días que lleva de atraso respecto de su propio ciclo. */
  atraso: number;
  /** Cuánto vale, en promedio, una compra suya. */
  ticketPromedio: number;
  productoHabitual: string | null;
}

/**
 * Cuentas que ya deberían haber vuelto a comprar y no volvieron.
 *
 * El ciclo se calcula por cuenta, no con un promedio global: un cliente que
 * compra cada 30 días y otro que compra cada 180 no se atrasan al mismo tiempo,
 * y mandarles el mismo recordatorio el mismo día es exactamente el ruido que
 * hace que la gente silencie a una marca.
 *
 * `tolerancia` 1.2 = se considera atrasada cuando pasó un 20% más que su ciclo.
 */
export async function ventanaRecompra(tolerancia = 1.2): Promise<Recompra[]> {
  const [cuentas, ordenes, items] = await Promise.all([
    universo(),
    db
      .select({ accountId: crmOrders.accountId, total: crmOrders.total })
      .from(crmOrders),
    db
      .select({
        accountId: crmOrders.accountId,
        nombre: crmProducts.nombre,
        cantidad: crmOrderItems.cantidad,
      })
      .from(crmOrderItems)
      .innerJoin(crmOrders, eq(crmOrders.id, crmOrderItems.orderId))
      .innerJoin(crmProducts, eq(crmProducts.id, crmOrderItems.productId)),
  ]);

  const resultado: Recompra[] = [];

  for (const c of cuentas) {
    if (!c.cicloRecompraDias || c.diasSinComprar === null) continue;
    const limite = c.cicloRecompraDias * tolerancia;
    if (c.diasSinComprar <= limite) continue;

    const suyas = ordenes.filter((o) => o.accountId === c.accountId);
    const productos = items.filter((i) => i.accountId === c.accountId);
    const conteo = new Map<string, number>();
    for (const p of productos) {
      conteo.set(p.nombre, (conteo.get(p.nombre) ?? 0) + p.cantidad);
    }
    const habitual = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];

    resultado.push({
      cuenta: c,
      atraso: Math.round(c.diasSinComprar - c.cicloRecompraDias),
      ticketPromedio: suyas.length
        ? Math.round(suyas.reduce((s, o) => s + o.total, 0) / suyas.length)
        : 0,
      productoHabitual: habitual?.[0] ?? null,
    });
  }

  return resultado.sort((a, b) => b.ticketPromedio - a.ticketPromedio);
}

// ─── Cross-selling ───────────────────────────────────────────────────────────

export interface ParProductos {
  productoA: { id: number; nombre: string };
  productoB: { id: number; nombre: string };
  /** Cuentas que compraron ambos. */
  juntas: number;
  /** Cuentas que compraron A. */
  conA: number;
  /** De quienes compraron A, qué porcentaje compró también B. */
  confianza: number;
  /** Cuentas que compraron A y todavía no B: la lista accionable. */
  oportunidades: { accountId: number; nombre: string; score: number }[];
}

/**
 * Análisis de canasta simple: qué se compra junto con qué.
 *
 * Sin algoritmo de reglas de asociación (Apriori y compañía): con un catálogo
 * de decenas de productos, contar pares directamente es exacto, rápido y —lo
 * que más importa acá— explicable frente a un cliente. "De los 14 que compraron
 * A, 9 compraron también B" se entiende sin notas al pie.
 *
 * `minimoJuntas` evita recomendar sobre coincidencias de una o dos cuentas, que
 * es donde este tipo de análisis empieza a inventar patrones.
 */
export async function paresCrossSell(
  minimoJuntas = 3,
  limite = 12,
): Promise<ParProductos[]> {
  const [cuentas, productos] = await Promise.all([
    universo(),
    db.select({ id: crmProducts.id, nombre: crmProducts.nombre }).from(crmProducts),
  ]);

  const nombre = new Map(productos.map((p) => [p.id, p.nombre]));
  const compradores = new Map<number, CuentaSegmentada[]>();
  for (const c of cuentas) {
    for (const p of c.productos) {
      compradores.set(p, [...(compradores.get(p) ?? []), c]);
    }
  }

  const pares: ParProductos[] = [];

  for (const [a, cuentasA] of compradores) {
    for (const [b, cuentasB] of compradores) {
      if (a === b) continue;
      const idsB = new Set(cuentasB.map((c) => c.accountId));
      const juntas = cuentasA.filter((c) => idsB.has(c.accountId)).length;
      if (juntas < minimoJuntas) continue;

      const faltantes = cuentasA
        .filter((c) => !idsB.has(c.accountId))
        .sort((x, y) => y.score - x.score);
      if (faltantes.length === 0) continue;

      pares.push({
        productoA: { id: a, nombre: nombre.get(a) ?? `#${a}` },
        productoB: { id: b, nombre: nombre.get(b) ?? `#${b}` },
        juntas,
        conA: cuentasA.length,
        confianza: (juntas / cuentasA.length) * 100,
        oportunidades: faltantes.map((c) => ({
          accountId: c.accountId,
          nombre: c.nombre,
          score: c.score,
        })),
      });
    }
  }

  return pares
    .sort((x, y) => y.confianza * y.oportunidades.length - x.confianza * x.oportunidades.length)
    .slice(0, limite);
}

// ─── Segmentos sugeridos de fábrica ──────────────────────────────────────────

/**
 * Los cuatro segmentos que todo equipo comercial termina construyendo a mano.
 * Vienen listos para que el cliente vea el patrón y arme los suyos encima.
 */
export const SEGMENTOS_SUGERIDOS: {
  nombre: string;
  descripcion: string;
  definicion: DefinicionSegmento;
}[] = [
  {
    nombre: "Mejores clientes",
    descripcion: "Puntaje alto y compras recientes. Los que hay que cuidar.",
    definicion: { estado: ["cliente"], scoreMin: 70 },
  },
  {
    nombre: "En riesgo de fuga",
    descripcion: "Compraron varias veces y llevan más de 120 días sin volver.",
    definicion: { estado: ["cliente"], comprasMin: 2, sinComprarMin: 120 },
  },
  {
    nombre: "Prospectos calientes",
    descripcion: "Todavía no compran, pero interactúan y tienen buen puntaje.",
    definicion: { estado: ["prospecto"], scoreMin: 50 },
  },
  {
    nombre: "Contactables por WhatsApp",
    descripcion: "Cuentas con al menos un contacto que autorizó WhatsApp.",
    definicion: { conWhatsapp: true },
  },
];
