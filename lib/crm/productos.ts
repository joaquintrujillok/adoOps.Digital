// Catálogo e inventario.
//
// El inventario existe en el CRM porque vender lo que no hay es un problema
// comercial antes que logístico: la oportunidad se cierra, el cliente espera, y
// el costo se paga en la relación. Acá el stock viaja pegado al producto en
// cada pantalla donde se pueda comprometer.

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmDealItems,
  crmDeals,
  crmInventory,
  crmOrderItems,
  crmOrders,
  crmProducts,
} from "@/db/crm";

export type Disponibilidad = "disponible" | "ajustado" | "agotado" | "sin_datos";

export interface ProductoConStock {
  id: number;
  sku: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  costo: number;
  activo: boolean;
  stock: number;
  reservado: number;
  /** Lo que se puede comprometer hoy sin quedar debiendo. */
  disponible: number;
  puntoReposicion: number;
  leadTimeDias: number;
  disponibilidad: Disponibilidad;
  margen: number;
  /** Los servicios no se agotan: no tienen fila de inventario y no entran en
   *  los cálculos de stock ni en la valorización de bodega. */
  tieneInventario: boolean;
}

function clasificar(
  disponible: number,
  puntoReposicion: number,
  hayFila: boolean,
): Disponibilidad {
  if (!hayFila) return "sin_datos";
  if (disponible <= 0) return "agotado";
  // "Ajustado" = por debajo del punto de reposición: alcanza para hoy, no para
  // la semana. Es el estado que hay que ver ANTES de prometer una entrega.
  if (disponible <= puntoReposicion) return "ajustado";
  return "disponible";
}

export async function listarProductos(): Promise<ProductoConStock[]> {
  const filas = await db
    .select({
      p: crmProducts,
      inv: crmInventory,
    })
    .from(crmProducts)
    .leftJoin(crmInventory, eq(crmInventory.productId, crmProducts.id))
    .orderBy(asc(crmProducts.categoria), asc(crmProducts.nombre));

  return filas.map(({ p, inv }) => {
    const stock = inv?.stock ?? 0;
    const reservado = inv?.reservado ?? 0;
    const disponible = stock - reservado;
    return {
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      categoria: p.categoria,
      precio: p.precio,
      costo: p.costo,
      activo: p.activo,
      stock,
      reservado,
      disponible,
      puntoReposicion: inv?.puntoReposicion ?? 0,
      leadTimeDias: inv?.leadTimeDias ?? 0,
      disponibilidad: clasificar(disponible, inv?.puntoReposicion ?? 0, !!inv),
      margen: p.precio > 0 ? ((p.precio - p.costo) / p.precio) * 100 : 0,
      tieneInventario: !!inv,
    };
  });
}

export async function productosPorId(
  ids: number[],
): Promise<Map<number, ProductoConStock>> {
  if (ids.length === 0) return new Map();
  const todos = await listarProductos();
  return new Map(todos.filter((p) => ids.includes(p.id)).map((p) => [p.id, p]));
}

// ─── Riesgo de inventario sobre oportunidades abiertas ───────────────────────

export interface RiesgoStock {
  productId: number;
  sku: string;
  nombre: string;
  /** Unidades físicas en bodega. */
  stock: number;
  /** Unidades comprometidas en oportunidades abiertas. */
  comprometido: number;
  leadTimeDias: number;
  /** Oportunidades abiertas que incluyen este producto. */
  deals: { id: number; titulo: string; cantidad: number; monto: number }[];
  /** Cuántas unidades habría que reponer para cumplir con todo lo comprometido. */
  faltante: number;
}

/**
 * Productos comprometidos en oportunidades abiertas por más unidades de las que
 * hay disponibles.
 *
 * Es la respuesta concreta a "que el CRM se integre con inventario": no un
 * campo de stock decorativo, sino la lista de negocios que se van a caer —o van
 * a llegar tarde— si nadie repone.
 */
export async function riesgosDeStock(): Promise<RiesgoStock[]> {
  const filas = await db
    .select({
      productId: crmDealItems.productId,
      dealId: crmDeals.id,
      titulo: crmDeals.titulo,
      cantidad: crmDealItems.cantidad,
      precio: crmDealItems.precioUnitario,
      etapa: crmDeals.etapa,
    })
    .from(crmDealItems)
    .innerJoin(crmDeals, eq(crmDeals.id, crmDealItems.dealId))
    .where(inArray(crmDeals.etapa, ["nuevo", "calificado", "propuesta", "negociacion"]));

  if (filas.length === 0) return [];

  const productos = await productosPorId([...new Set(filas.map((f) => f.productId))]);
  const porProducto = new Map<number, RiesgoStock>();

  for (const f of filas) {
    const p = productos.get(f.productId);
    if (!p) continue;
    // Se compara contra el stock FÍSICO, no contra `disponible`: disponible ya
    // trae descontado lo comprometido, así que restarlo de nuevo contaría dos
    // veces el mismo compromiso y exageraría el faltante.
    // Los servicios no llevan inventario: no tiene sentido decir que falta
    // stock de una capacitación.
    if (!p.tieneInventario) continue;

    const actual = porProducto.get(f.productId) ?? {
      productId: p.id,
      sku: p.sku,
      nombre: p.nombre,
      stock: p.stock,
      comprometido: 0,
      leadTimeDias: p.leadTimeDias,
      deals: [],
      faltante: 0,
    };
    actual.comprometido += f.cantidad;

    // Una oportunidad puede traer el mismo producto en dos líneas: se suman en
    // una sola entrada, o la lista repetiría el mismo negocio dos veces.
    const yaEsta = actual.deals.find((d) => d.id === f.dealId);
    if (yaEsta) {
      yaEsta.cantidad += f.cantidad;
      yaEsta.monto += f.cantidad * f.precio;
    } else {
      actual.deals.push({
        id: f.dealId,
        titulo: f.titulo,
        cantidad: f.cantidad,
        monto: f.cantidad * f.precio,
      });
    }
    porProducto.set(f.productId, actual);
  }

  return [...porProducto.values()]
    .map((r) => ({ ...r, faltante: r.comprometido - r.stock }))
    .filter((r) => r.faltante > 0)
    .sort((a, b) => b.faltante - a.faltante);
}

// ─── Sustitutos ──────────────────────────────────────────────────────────────

/**
 * Alternativas para un producto sin stock: misma categoría, con disponibilidad,
 * ordenadas por cercanía de precio.
 *
 * Ordena por cercanía y no por margen a propósito: al cliente que esperaba un
 * producto de $80.000 no se le ofrece uno de $300.000 porque deje más.
 */
export async function sustitutos(
  productId: number,
  limite = 3,
): Promise<ProductoConStock[]> {
  const todos = await listarProductos();
  const base = todos.find((p) => p.id === productId);
  if (!base) return [];

  return todos
    .filter(
      (p) =>
        p.id !== productId &&
        p.activo &&
        p.categoria === base.categoria &&
        p.disponibilidad === "disponible",
    )
    .sort(
      (a, b) => Math.abs(a.precio - base.precio) - Math.abs(b.precio - base.precio),
    )
    .slice(0, limite);
}

// ─── Ventas por producto ─────────────────────────────────────────────────────

export interface VentaProducto {
  productId: number;
  sku: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  cuentas: number;
}

export async function ventasPorProducto(desde?: Date): Promise<VentaProducto[]> {
  const filas = await db
    .select({
      productId: crmOrderItems.productId,
      sku: crmProducts.sku,
      nombre: crmProducts.nombre,
      unidades: sql<number>`sum(${crmOrderItems.cantidad})::int`,
      ingresos: sql<number>`sum(${crmOrderItems.cantidad} * ${crmOrderItems.precioUnitario})::int`,
      cuentas: sql<number>`count(distinct ${crmOrders.accountId})::int`,
    })
    .from(crmOrderItems)
    .innerJoin(crmOrders, eq(crmOrders.id, crmOrderItems.orderId))
    .innerJoin(crmProducts, eq(crmProducts.id, crmOrderItems.productId))
    .where(desde ? sql`${crmOrders.fecha} >= ${desde}` : sql`true`)
    .groupBy(crmOrderItems.productId, crmProducts.sku, crmProducts.nombre)
    .orderBy(desc(sql`sum(${crmOrderItems.cantidad} * ${crmOrderItems.precioUnitario})`));

  return filas;
}
