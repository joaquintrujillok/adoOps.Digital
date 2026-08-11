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
  crmContacts,
  crmOrderItems,
  crmOrders,
  crmProducts,
  crmSegments,
} from "@/db/crm";
import { cicloRecompra } from "./contactos";
import { scoresDeClientes } from "./scoring";

// ─── Definición declarativa ──────────────────────────────────────────────────

export interface DefinicionSegmento {
  estado?: string[];
  ciudad?: string[];
  etiquetas?: string[];
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

export interface ClienteSegmentado {
  contactId: number;
  nombre: string;
  estado: string;
  ciudad: string | null;
  etiquetas: string[];
  score: number;
  facturado: number;
  compras: number;
  diasSinComprar: number | null;
  cicloRecompraDias: number | null;
  productos: number[];
  telefonoWhatsapp: string | null;
}

/**
 * Universo de cuentas con todo lo que un segmento puede filtrar.
 *
 * Se arma completo en memoria y se filtra después. Con carteras de decenas de
 * miles habría que bajar los filtros a SQL; para lo que un CRM comercial mueve
 * (cientos a pocos miles), una consulta y un filtro en JavaScript es más simple
 * de leer y de auditar que un armador dinámico de WHERE.
 */
export async function universo(): Promise<ClienteSegmentado[]> {
  const [contactos, scores, compras, items] = await Promise.all([
    db.select().from(crmContacts),
    scoresDeClientes(),
    db
      .select({
        contactId: crmOrders.contactId,
        fecha: crmOrders.fecha,
        total: crmOrders.total,
      })
      .from(crmOrders),
    db
      .select({
        contactId: crmOrders.contactId,
        productId: crmOrderItems.productId,
      })
      .from(crmOrderItems)
      .innerJoin(crmOrders, eq(crmOrders.id, crmOrderItems.orderId)),
  ]);

  const porCliente = new Map(scores.map((s) => [s.contactId, s]));

  return contactos.map((c) => {
    const suyas = compras.filter((o) => o.contactId === c.id);
    const fechas = suyas.map((o) => o.fecha);
    const ultima = fechas.length
      ? Math.max(...fechas.map((f) => new Date(f).getTime()))
      : null;

    return {
      contactId: c.id,
      nombre: c.nombre,
      estado: c.estado,
      ciudad: c.ciudad,
      etiquetas: c.etiquetas ?? [],
      score: porCliente.get(c.id)?.score ?? 0,
      facturado: suyas.reduce((s, o) => s + o.total, 0),
      compras: suyas.length,
      diasSinComprar: ultima ? Math.floor((Date.now() - ultima) / 86_400_000) : null,
      cicloRecompraDias: cicloRecompra(fechas),
      productos: [
        ...new Set(items.filter((i) => i.contactId === c.id).map((i) => i.productId)),
      ],
      telefonoWhatsapp: c.optInWhatsapp ? c.telefono : null,
    };
  });
}

export function aplicar(
  clientes: ClienteSegmentado[],
  def: DefinicionSegmento,
): ClienteSegmentado[] {
  return clientes.filter((c) => {
    if (def.estado?.length && !def.estado.includes(c.estado)) return false;
    if (def.ciudad?.length && !def.ciudad.includes(c.ciudad ?? "")) return false;
    if (def.etiquetas?.length && !def.etiquetas.some((e) => c.etiquetas.includes(e))) return false;
    if (def.scoreMin != null && c.score < def.scoreMin) return false;
    if (def.scoreMax != null && c.score > def.scoreMax) return false;
    if (def.facturadoMin != null && c.facturado < def.facturadoMin) return false;
    if (def.comprasMin != null && c.compras < def.comprasMin) return false;
    // Quien nunca compró no entra en un filtro de "días sin comprar": no es que
    // lleve mucho tiempo sin comprar, es que nunca estuvo adentro.
    if (def.sinComprarMin != null && (c.diasSinComprar ?? -1) < def.sinComprarMin) return false;
    if (def.sinComprarMax != null && (c.diasSinComprar ?? Infinity) > def.sinComprarMax) return false;
    if (def.compro?.length && !def.compro.some((p) => c.productos.includes(p))) return false;
    if (def.noCompro?.length && def.noCompro.some((p) => c.productos.includes(p))) return false;
    if (def.conWhatsapp && !c.telefonoWhatsapp) return false;
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
  cliente: ClienteSegmentado;
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
  const [clientes, ordenes, items] = await Promise.all([
    universo(),
    db
      .select({ contactId: crmOrders.contactId, total: crmOrders.total })
      .from(crmOrders),
    db
      .select({
        contactId: crmOrders.contactId,
        nombre: crmProducts.nombre,
        cantidad: crmOrderItems.cantidad,
      })
      .from(crmOrderItems)
      .innerJoin(crmOrders, eq(crmOrders.id, crmOrderItems.orderId))
      .innerJoin(crmProducts, eq(crmProducts.id, crmOrderItems.productId)),
  ]);

  const resultado: Recompra[] = [];

  for (const c of clientes) {
    if (!c.cicloRecompraDias || c.diasSinComprar === null) continue;
    const limite = c.cicloRecompraDias * tolerancia;
    if (c.diasSinComprar <= limite) continue;

    const suyas = ordenes.filter((o) => o.contactId === c.contactId);
    const productos = items.filter((i) => i.contactId === c.contactId);
    const conteo = new Map<string, number>();
    for (const p of productos) {
      conteo.set(p.nombre, (conteo.get(p.nombre) ?? 0) + p.cantidad);
    }
    const habitual = [...conteo.entries()].sort((a, b) => b[1] - a[1])[0];

    resultado.push({
      cliente: c,
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
  /** Clientes que compraron A. */
  conA: number;
  /** De quienes compraron A, qué porcentaje compró también B. */
  confianza: number;
  /** Cuentas que compraron A y todavía no B: la lista accionable. */
  oportunidades: { contactId: number; nombre: string; score: number }[];
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
  const [clientes, productos] = await Promise.all([
    universo(),
    db.select({ id: crmProducts.id, nombre: crmProducts.nombre }).from(crmProducts),
  ]);

  const nombre = new Map(productos.map((p) => [p.id, p.nombre]));
  const compradores = new Map<number, ClienteSegmentado[]>();
  for (const c of clientes) {
    for (const p of c.productos) {
      compradores.set(p, [...(compradores.get(p) ?? []), c]);
    }
  }

  const pares: ParProductos[] = [];

  for (const [a, clientesA] of compradores) {
    for (const [b, clientesB] of compradores) {
      if (a === b) continue;
      const idsB = new Set(clientesB.map((c) => c.contactId));
      const juntas = clientesA.filter((c) => idsB.has(c.contactId)).length;
      if (juntas < minimoJuntas) continue;

      const faltantes = clientesA
        .filter((c) => !idsB.has(c.contactId))
        .sort((x, y) => y.score - x.score);
      if (faltantes.length === 0) continue;

      pares.push({
        productoA: { id: a, nombre: nombre.get(a) ?? `#${a}` },
        productoB: { id: b, nombre: nombre.get(b) ?? `#${b}` },
        juntas,
        conA: clientesA.length,
        confianza: (juntas / clientesA.length) * 100,
        oportunidades: faltantes.map((c) => ({
          contactId: c.contactId,
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
