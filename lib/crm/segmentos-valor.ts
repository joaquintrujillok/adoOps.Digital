// Los cuatro segmentos de la cartera, por lo que vale cada cliente.
//
// Reemplazan al RFM de once segmentos, y el cambio es a favor.
//
// **Por qué el RFM sobraba acá.** Once segmentos con nombres de manual
// —campeones, leales, hibernando, no los puedo perder— sobre setenta y seis
// personas dejan siete clientes por casilla. Nadie en el negocio piensa en esos
// términos, y para saber a quién llamar hay que traducir mentalmente cada
// etiqueta. Peor: dos clientes podían caer en "campeones" habiendo invertido
// tres millones y ciento setenta, que en este rubro son dos negocios distintos.
//
// **Por qué cuatro tramos de plata sí funcionan.** Con tres ventas al mes, el
// gerente no necesita saber quién está "por dormirse": necesita saber quiénes
// son los cinco que ya pusieron sobre cien millones, porque de esos vive el año.
// Los cortes los dio el negocio, no una fórmula, y esa es exactamente la razón
// por la que se pueden repetir en una reunión.
//
// Los nombres salen de sus propias salas de audición —Reference, Highend,
// Hi-Fi— para que el segmento de un cliente y la sala donde se le atiende
// hablen el mismo idioma.

import { sql } from "drizzle-orm";
import { db } from "@/db";

export type ClaveSegmento = "reference" | "highend" | "entusiasta" | "entrada";

export interface DefinicionSegmento {
  clave: ClaveSegmento;
  nombre: string;
  /** El corte inferior, en pesos. Inclusivo. */
  desde: number;
  /** El corte superior. `null` = sin techo. */
  hasta: number | null;
  rango: string;
  descripcion: string;
  /** Qué corresponde hacer con este grupo. Sin esto un segmento es decoración. */
  accion: string;
  tono: string;
}

/**
 * Los cortes, tal como los definió el negocio.
 *
 * Son absolutos y en pesos, no percentiles. Ya está discutido en el módulo de
 * analítica por qué acá los percentiles mienten: con setenta y seis clientes,
 * el "20% superior" son quince personas por definición, hayan puesto cien
 * millones o cinco.
 */
export const SEGMENTOS: DefinicionSegmento[] = [
  {
    clave: "reference",
    nombre: "Reference",
    desde: 100_000_000,
    hasta: null,
    rango: "Sobre $100 millones",
    descripcion: "Tienen un sistema de referencia armado. Son el año del negocio.",
    accion:
      "Trato nominal, uno por uno. Audición privada cuando llega producto nuevo, antes que nadie. Nunca campaña masiva.",
    tono: "var(--crm-brand)",
  },
  {
    clave: "highend",
    nombre: "Highend",
    desde: 50_000_000,
    hasta: 100_000_000,
    rango: "$50 a $100 millones",
    descripcion: "Sistema serio y en construcción. El escalón que alimenta al de arriba.",
    accion:
      "El eslabón que les falta o el que desentona. Acá es donde el mapa del sistema paga solo.",
    tono: "var(--series-1)",
  },
  {
    clave: "entusiasta",
    nombre: "Entusiasta",
    desde: 10_000_000,
    hasta: 50_000_000,
    rango: "$10 a $50 millones",
    descripcion: "Ya se comprometieron con el rubro. Es el grupo con más recorrido por delante.",
    accion:
      "Ruta de upgrade y audiciones. El salto de este grupo al siguiente es la palanca de crecimiento más grande que hay.",
    tono: "var(--series-3)",
  },
  {
    clave: "entrada",
    nombre: "Entrada",
    desde: 0,
    hasta: 10_000_000,
    rango: "Bajo $10 millones",
    descripcion: "Entraron por una pieza o un accesorio. Promedio en torno a $5 millones.",
    accion:
      "Contenido y una invitación a escuchar. La sala convierte mejor que cualquier oferta: acá se decide si suben o se quedan.",
    tono: "var(--series-4)",
  },
];

export function segmentoDe(valorCliente: number): ClaveSegmento {
  for (const s of SEGMENTOS) {
    if (valorCliente >= s.desde && (s.hasta === null || valorCliente < s.hasta)) return s.clave;
  }
  return "entrada";
}

export function definicionDe(clave: ClaveSegmento): DefinicionSegmento {
  return SEGMENTOS.find((s) => s.clave === clave) ?? SEGMENTOS[3];
}

// ─── La cartera repartida ─────────────────────────────────────────────────────

export interface ClienteDelSegmento {
  contactId: number;
  nombre: string;
  telefono: string | null;
  /** Lo que ha invertido en total. Es lo que define su segmento. */
  valor: number;
  compras: number;
  ultimaCompra: Date | null;
  diasSinComprar: number | null;
  segmento: ClaveSegmento;
}

export interface ResumenSegmento extends DefinicionSegmento {
  clientes: number;
  /** Cuánto pesa el segmento en la facturación total. */
  monto: number;
  porcentajeMonto: number;
  /** Lo que vale un cliente promedio del grupo. */
  valorPromedio: number;
  /** Cuántos siguen activos: compraron en los últimos dos años. */
  activos: number;
  /** Las personas. A este volumen se listan, no se resumen. */
  miembros: ClienteDelSegmento[];
}

/**
 * Reparte toda la cartera en los cuatro tramos.
 *
 * Trae **los nombres**, no solo los conteos. Con setenta y seis clientes en
 * total, un panel que diga "Reference: 5" y no diga quiénes son obliga a hacer
 * otra consulta para poder trabajar, y esa segunda consulta no la hace nadie.
 */
export async function carteraPorSegmento(): Promise<ResumenSegmento[]> {
  const filas = await db.execute(sql`
    SELECT c.id AS "contactId", c.nombre, c.telefono,
           COALESCE(SUM(o.total), 0)::float8 AS valor,
           COUNT(o.id)::int AS compras,
           MAX(o.fecha) AS "ultimaCompra"
    FROM crm_contacts c
    JOIN crm_orders o ON o.contact_id = c.id
    GROUP BY c.id, c.nombre, c.telefono
    ORDER BY valor DESC
  `);

  type Fila = {
    contactId: number; nombre: string; telefono: string | null;
    valor: number; compras: number; ultimaCompra: string | null;
  };

  const clientes: ClienteDelSegmento[] = (filas.rows as unknown as Fila[]).map((f) => {
    const ultima = f.ultimaCompra ? new Date(f.ultimaCompra) : null;
    return {
      contactId: f.contactId,
      nombre: f.nombre,
      telefono: f.telefono,
      valor: Number(f.valor),
      compras: Number(f.compras),
      ultimaCompra: ultima,
      diasSinComprar: ultima ? Math.floor((Date.now() - ultima.getTime()) / 86_400_000) : null,
      segmento: segmentoDe(Number(f.valor)),
    };
  });

  const total = clientes.reduce((s, c) => s + c.valor, 0);

  return SEGMENTOS.map((def) => {
    const miembros = clientes.filter((c) => c.segmento === def.clave);
    const monto = miembros.reduce((s, c) => s + c.valor, 0);
    return {
      ...def,
      clientes: miembros.length,
      monto,
      porcentajeMonto: total > 0 ? (monto / total) * 100 : 0,
      valorPromedio: miembros.length ? Math.round(monto / miembros.length) : 0,
      // Dos años y no uno: el ciclo de este rubro es largo y alguien que compró
      // hace dieciocho meses sigue siendo un cliente vivo, no uno perdido.
      activos: miembros.filter((c) => (c.diasSinComprar ?? 9999) <= 730).length,
      miembros,
    };
  });
}

// ─── Movimiento entre tramos ──────────────────────────────────────────────────

export interface Ascenso {
  contactId: number;
  nombre: string;
  desde: ClaveSegmento;
  hacia: ClaveSegmento;
  valorAntes: number;
  valorAhora: number;
  cuando: Date;
}

/**
 * Quiénes cambiaron de tramo en los últimos doce meses.
 *
 * Es la métrica de crecimiento que este negocio sí puede leer. "La facturación
 * subió un 12%" sobre cuarenta ventas al año es ruido; **"tres clientes pasaron
 * de Entusiasta a Highend este año, y estos son"** es un hecho que se puede
 * contar en una reunión y sobre el que se puede actuar.
 */
export async function ascensosDelAnio(): Promise<Ascenso[]> {
  const filas = await db.execute(sql`
    SELECT c.id AS "contactId", c.nombre,
           COALESCE(SUM(o.total), 0)::float8 AS "valorAhora",
           COALESCE(SUM(o.total) FILTER (
             WHERE o.fecha < NOW() - INTERVAL '12 months'
           ), 0)::float8 AS "valorAntes",
           MAX(o.fecha) FILTER (
             WHERE o.fecha >= NOW() - INTERVAL '12 months'
           ) AS cuando
    FROM crm_contacts c
    JOIN crm_orders o ON o.contact_id = c.id
    GROUP BY c.id, c.nombre
  `);

  type Fila = {
    contactId: number; nombre: string;
    valorAhora: number; valorAntes: number; cuando: string | null;
  };

  const ascensos: Ascenso[] = [];
  for (const f of filas.rows as unknown as Fila[]) {
    if (!f.cuando) continue;
    const antes = segmentoDe(Number(f.valorAntes));
    const ahora = segmentoDe(Number(f.valorAhora));
    if (antes === ahora) continue;

    ascensos.push({
      contactId: f.contactId,
      nombre: f.nombre,
      desde: antes,
      hacia: ahora,
      valorAntes: Number(f.valorAntes),
      valorAhora: Number(f.valorAhora),
      cuando: new Date(f.cuando),
    });
  }

  // Los que más subieron primero.
  return ascensos.sort((a, b) => b.valorAhora - b.valorAntes - (a.valorAhora - a.valorAntes));
}

/** Cuánto falta para que cada cliente llegue al tramo siguiente. */
export interface AlBorde {
  contactId: number;
  nombre: string;
  segmento: ClaveSegmento;
  siguiente: ClaveSegmento;
  valor: number;
  /** Lo que falta para cruzar. */
  falta: number;
}

/**
 * Quiénes están cerca de saltar de tramo.
 *
 * Convierte la segmentación en algo que se puede trabajar hoy: alguien con
 * noventa y cuatro millones está a seis de entrar a Reference, y eso es una
 * conversación concreta que no existiría sin los cortes.
 *
 * El umbral es el 25% del ancho del tramo siguiente: lo bastante cerca para que
 * una sola compra lo cruce.
 */
export async function alBordeDelSalto(limite = 10): Promise<AlBorde[]> {
  const cartera = await carteraPorSegmento();
  const todos = cartera.flatMap((s) => s.miembros);

  const resultado: AlBorde[] = [];
  for (const c of todos) {
    const i = SEGMENTOS.findIndex((s) => s.clave === c.segmento);
    // El tramo de más arriba no tiene siguiente.
    if (i <= 0) continue;
    const superior = SEGMENTOS[i - 1];
    const falta = superior.desde - c.valor;
    const anchoDelSalto = superior.desde - SEGMENTOS[i].desde;
    if (falta <= 0 || falta > anchoDelSalto * 0.25) continue;

    resultado.push({
      contactId: c.contactId,
      nombre: c.nombre,
      segmento: c.segmento,
      siguiente: superior.clave,
      valor: c.valor,
      falta,
    });
  }

  return resultado.sort((a, b) => a.falta - b.falta).slice(0, limite);
}
