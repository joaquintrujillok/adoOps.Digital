// Pipeline y KPIs — las tres vistas de `/crm/pipeline`.
//
// Es la pantalla de revisión semanal: qué entró, cómo viene la semana contra las
// anteriores, y de qué depende el pipeline si algo se cae. Las otras pantallas
// responden "qué hago ahora"; esta responde "cómo vamos".
//
// **Toda suma de dinero va en `::float8`.** Los tickets de alta gama llegan a
// decenas de millones y una suma trimestral desborda el integer de Postgres
// (tope 2.147.483.647): la consulta muere con *integer out of range*. Los
// contadores siguen en `::int`.

import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmActivities,
  crmContacts,
  crmDealItems,
  crmDeals,
  crmProducts,
  crmUsers,
} from "@/db/crm";
import { ETAPAS, ETAPAS_ABIERTAS_IDS, nombreEtapa } from "./etapas";

// ─── Periodo ─────────────────────────────────────────────────────────────────

export const PERIODOS = [
  { id: "7d", nombre: "1 semana", dias: 7 },
  { id: "15d", nombre: "15 días", dias: 15 },
  { id: "1m", nombre: "1 mes", dias: 30 },
  { id: "3m", nombre: "3 meses", dias: 90 },
] as const;

export type PeriodoId = (typeof PERIODOS)[number]["id"];

/**
 * El periodo abre en 3 meses.
 *
 * Un pipeline de alta gama se mueve en semanas, no en días: con la ventana de
 * una semana la pantalla arranca casi vacía y parece que no hay negocio, cuando
 * lo que pasa es que en este rubro no entran cinco oportunidades por día.
 */
export const PERIODO_POR_DEFECTO: PeriodoId = "3m";

/**
 * Traduce los filtros a un rango concreto.
 *
 * El rango explícito le gana al periodo: si alguien escribió las dos fechas es
 * porque quiere justo eso, y dejar que el botón de periodo lo pise convierte el
 * formulario en algo que no obedece.
 */
export function rangoDe(
  periodo: PeriodoId,
  desde?: string,
  hasta?: string,
  ahora = new Date(),
): { desde: Date; hasta: Date; aMedida: boolean } {
  const d = desde ? new Date(`${desde}T00:00:00`) : null;
  const h = hasta ? new Date(`${hasta}T23:59:59`) : null;

  if (d && h && !Number.isNaN(d.getTime()) && !Number.isNaN(h.getTime()) && d <= h) {
    return { desde: d, hasta: h, aMedida: true };
  }

  const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? 90;
  return {
    desde: new Date(ahora.getTime() - dias * 86_400_000),
    hasta: ahora,
    aMedida: false,
  };
}

// ─── Categoría efectiva ──────────────────────────────────────────────────────

/**
 * La categoría de cada oportunidad según sus piezas: la de mayor subtotal.
 *
 * Por subtotal y no por cantidad de piezas: una venta de un cronómetro de
 * $24.9M con un estuche de $640.000 es una venta de alta relojería, y contando
 * unidades las dos piezas pesan lo mismo.
 */
async function categoriaDeLasPiezas(): Promise<Map<number, string>> {
  const filas = await db
    .select({
      dealId: crmDealItems.dealId,
      categoria: crmProducts.categoria,
      monto: sql<number>`sum(crm_deal_items.cantidad * crm_deal_items.precio_unitario)::float8`,
    })
    .from(crmDealItems)
    .innerJoin(crmProducts, eq(crmProducts.id, crmDealItems.productId))
    .groupBy(crmDealItems.dealId, crmProducts.categoria);

  const mejor = new Map<number, { categoria: string; monto: number }>();
  for (const f of filas) {
    if (!f.categoria) continue;
    const actual = mejor.get(f.dealId);
    if (!actual || Number(f.monto) > actual.monto) {
      mejor.set(f.dealId, { categoria: f.categoria, monto: Number(f.monto) });
    }
  }
  return new Map([...mejor].map(([id, v]) => [id, v.categoria]));
}

export async function categoriasDisponibles(): Promise<string[]> {
  const filas = await db
    .selectDistinct({ categoria: crmProducts.categoria })
    .from(crmProducts)
    .orderBy(crmProducts.categoria);
  return filas.map((f) => f.categoria).filter((c): c is string => Boolean(c));
}

// ─── Vista 1 · Oportunidades del periodo ─────────────────────────────────────

export interface FilaOportunidad {
  id: number;
  titulo: string;
  contactId: number | null;
  cliente: string;
  etapa: string;
  etapaNombre: string;
  monto: number;
  probabilidad: number;
  ponderado: number;
  /** La que manda: la corrección si existe, si no la de las piezas. */
  categoria: string;
  /**
   * La que sale de las piezas, corregida o no.
   *
   * Va aparte de `categoria` porque la interfaz necesita las dos a la vez: hay
   * que ofrecer "volver a la heredada" diciendo cuál es, y con una corrección
   * puesta la heredada ya no se puede deducir de la efectiva.
   */
  categoriaHeredada: string;
  /** `true` si alguien la corrigió a mano; `false` si viene de las piezas. */
  categoriaCorregida: boolean;
  owner: string | null;
  abiertoEn: Date;
}

export interface ResumenEtapa {
  etapa: string;
  nombre: string;
  probabilidad: number;
  cantidad: number;
  monto: number;
  ponderado: number;
}

export async function oportunidadesDelPeriodo(filtros: {
  desde: Date;
  hasta: Date;
  etapa?: string;
  categoria?: string;
}): Promise<{ filas: FilaOportunidad[]; resumen: ResumenEtapa[] }> {
  const condiciones = [
    gte(crmDeals.abiertoEn, filtros.desde),
    lte(crmDeals.abiertoEn, filtros.hasta),
  ];
  // Sin filtro de etapa la vista muestra el embudo abierto. Incluir ganadas y
  // perdidas por defecto mezclaría el pipeline con el histórico y el total de
  // arriba dejaría de ser "lo que hay por cerrar".
  if (filtros.etapa) condiciones.push(eq(crmDeals.etapa, filtros.etapa));
  else condiciones.push(inArray(crmDeals.etapa, ETAPAS_ABIERTAS_IDS));

  const [crudas, porPiezas] = await Promise.all([
    db
      .select({
        d: crmDeals,
        cliente: crmContacts.nombre,
        owner: crmUsers.nombre,
      })
      .from(crmDeals)
      .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
      .leftJoin(crmUsers, eq(crmUsers.id, crmDeals.ownerId))
      .where(and(...condiciones))
      .orderBy(desc(crmDeals.monto))
      .limit(500),
    categoriaDeLasPiezas(),
  ]);

  const filas: FilaOportunidad[] = crudas
    .map((f) => ({
      id: f.d.id,
      titulo: f.d.titulo,
      contactId: f.d.contactId,
      cliente: f.cliente ?? "Sin cliente",
      etapa: f.d.etapa,
      etapaNombre: nombreEtapa(f.d.etapa),
      monto: f.d.monto,
      probabilidad: f.d.probabilidad,
      ponderado: Math.round((f.d.monto * f.d.probabilidad) / 100),
      categoria: f.d.categoria ?? porPiezas.get(f.d.id) ?? "Sin categoría",
      categoriaHeredada: porPiezas.get(f.d.id) ?? "Sin categoría",
      categoriaCorregida: f.d.categoria !== null,
      owner: f.owner,
      abiertoEn: f.d.abiertoEn,
    }))
    .filter((f) => !filtros.categoria || f.categoria === filtros.categoria);

  const resumen: ResumenEtapa[] = ETAPAS.filter(
    (e) => ETAPAS_ABIERTAS_IDS.includes(e.id) || filtros.etapa === e.id,
  ).map((e) => {
    const propias = filas.filter((f) => f.etapa === e.id);
    return {
      etapa: e.id,
      nombre: e.nombre,
      probabilidad: e.probabilidad,
      cantidad: propias.length,
      monto: propias.reduce((s, f) => s + f.monto, 0),
      ponderado: propias.reduce((s, f) => s + f.ponderado, 0),
    };
  });

  return { filas, resumen };
}

// ─── Vista 2 · KPIs semanales ────────────────────────────────────────────────

export interface Metrica {
  clave: string;
  nombre: string;
  /** Cómo se lee la cifra. El total de un promedio no se suma. */
  formato: "clp" | "num";
  valores: number[];
  total: number;
}

export interface KpisSemanales {
  semanas: { inicio: Date; etiqueta: string }[];
  metricas: Metrica[];
}

/**
 * Las últimas N semanas, una columna por semana.
 *
 * Las semanas se arman en JS a partir del lunes y las consultas agrupan con
 * `date_trunc('week')`, que en Postgres también empieza el lunes. Armar la
 * grilla acá y no en SQL es lo que garantiza que una semana sin ningún
 * movimiento igual aparezca con sus ceros: si las columnas salieran de las
 * filas devueltas, las semanas muertas desaparecerían y la tabla mentiría por
 * omisión justo sobre lo que hay que mirar.
 */
export async function kpisSemanales(semanas = 8, ahora = new Date()): Promise<KpisSemanales> {
  const lunesDe = (d: Date) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // getDay(): 0 = domingo. El lunes de la semana del domingo es 6 días antes.
    const desplazamiento = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - desplazamiento);
    return x;
  };

  const lunesActual = lunesDe(ahora);
  const inicios: Date[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    inicios.push(new Date(lunesActual.getTime() - i * 7 * 86_400_000));
  }
  const desde = inicios[0];
  const etiqueta = new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" });

  const indiceDe = (fecha: Date | string): number => {
    const t = lunesDe(new Date(fecha)).getTime();
    return inicios.findIndex((i) => i.getTime() === t);
  };

  const [abiertas, cerradas, actividades] = await Promise.all([
    db
      .select({
        semana: sql<string>`date_trunc('week', ${crmDeals.abiertoEn})`,
        n: sql<number>`count(*)::int`,
        monto: sql<number>`sum(${crmDeals.monto})::float8`,
      })
      .from(crmDeals)
      .where(gte(crmDeals.abiertoEn, desde))
      .groupBy(sql`date_trunc('week', ${crmDeals.abiertoEn})`),
    db
      .select({
        semana: sql<string>`date_trunc('week', ${crmDeals.cerradoEn})`,
        etapa: crmDeals.etapa,
        n: sql<number>`count(*)::int`,
        monto: sql<number>`sum(${crmDeals.monto})::float8`,
      })
      .from(crmDeals)
      .where(and(gte(crmDeals.cerradoEn, desde), inArray(crmDeals.etapa, ["ganado", "perdido"])))
      .groupBy(sql`date_trunc('week', ${crmDeals.cerradoEn})`, crmDeals.etapa),
    db
      .select({
        semana: sql<string>`date_trunc('week', ${crmActivities.ocurridoEn})`,
        n: sql<number>`count(*)::int`,
      })
      .from(crmActivities)
      .where(gte(crmActivities.ocurridoEn, desde))
      .groupBy(sql`date_trunc('week', ${crmActivities.ocurridoEn})`),
  ]);

  const vacio = () => new Array(semanas).fill(0);
  const nAbiertas = vacio();
  const montoAbierto = vacio();
  const nGanadas = vacio();
  const montoGanado = vacio();
  const nPerdidas = vacio();
  const nActividades = vacio();

  for (const f of abiertas) {
    const i = indiceDe(f.semana);
    if (i < 0) continue;
    nAbiertas[i] = f.n;
    montoAbierto[i] = Number(f.monto ?? 0);
  }
  for (const f of cerradas) {
    const i = indiceDe(f.semana);
    if (i < 0) continue;
    if (f.etapa === "ganado") {
      nGanadas[i] = f.n;
      montoGanado[i] = Number(f.monto ?? 0);
    } else {
      nPerdidas[i] = f.n;
    }
  }
  for (const f of actividades) {
    const i = indiceDe(f.semana);
    if (i >= 0) nActividades[i] = f.n;
  }

  const suma = (v: number[]) => v.reduce((s, n) => s + n, 0);

  return {
    semanas: inicios.map((inicio) => ({ inicio, etiqueta: etiqueta.format(inicio) })),
    metricas: [
      { clave: "abiertas", nombre: "Oportunidades abiertas", formato: "num", valores: nAbiertas, total: suma(nAbiertas) },
      { clave: "montoAbierto", nombre: "Monto que entró", formato: "clp", valores: montoAbierto, total: suma(montoAbierto) },
      { clave: "ganadas", nombre: "Ganadas", formato: "num", valores: nGanadas, total: suma(nGanadas) },
      { clave: "montoGanado", nombre: "Monto ganado", formato: "clp", valores: montoGanado, total: suma(montoGanado) },
      { clave: "perdidas", nombre: "Perdidas", formato: "num", valores: nPerdidas, total: suma(nPerdidas) },
      { clave: "actividades", nombre: "Actividades registradas", formato: "num", valores: nActividades, total: suma(nActividades) },
    ],
  };
}

// ─── Vista 3 · Mix de categoría ──────────────────────────────────────────────

export interface CategoriaDelMix {
  categoria: string;
  monto: number;
  cantidad: number;
  /** Su parte del pipeline abierto, en porcentaje. */
  participacion: number;
  /**
   * Concentración de clientes dentro de la categoría, 0–10.000.
   *
   * Es el HHI: la suma de los cuadrados de la participación de cada cliente.
   * Un cliente solo da 10.000; diez clientes parejos dan 1.000. Sirve para lo
   * que un promedio esconde: dos categorías con el mismo monto y el mismo
   * número de clientes pueden tener riesgos opuestos.
   */
  hhi: number;
  /** El cliente más pesado de la categoría, con su parte. */
  mayor: { contactId: number | null; cliente: string; monto: number; parte: number } | null;
}

export interface Concentracion {
  categoria: string;
  contactId: number | null;
  cliente: string;
  monto: number;
  parte: number;
}

/** Sobre este porcentaje, un solo cliente ES la categoría. */
export const UMBRAL_CONCENTRACION = 50;

export async function mixDeCategoria(): Promise<{
  categorias: CategoriaDelMix[];
  riesgos: Concentracion[];
  totalPipeline: number;
}> {
  const [crudas, porPiezas] = await Promise.all([
    db
      .select({
        id: crmDeals.id,
        categoriaPropia: crmDeals.categoria,
        monto: crmDeals.monto,
        contactId: crmDeals.contactId,
        cliente: crmContacts.nombre,
      })
      .from(crmDeals)
      .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
      .where(inArray(crmDeals.etapa, ETAPAS_ABIERTAS_IDS)),
    categoriaDeLasPiezas(),
  ]);

  const deals = crudas.map((d) => ({
    ...d,
    cliente: d.cliente ?? "Sin cliente",
    categoria: d.categoriaPropia ?? porPiezas.get(d.id) ?? "Sin categoría",
  }));

  const totalPipeline = deals.reduce((s, d) => s + d.monto, 0);
  const nombres = [...new Set(deals.map((d) => d.categoria))];

  const riesgos: Concentracion[] = [];

  const categorias: CategoriaDelMix[] = nombres
    .map((categoria) => {
      const propias = deals.filter((d) => d.categoria === categoria);
      const monto = propias.reduce((s, d) => s + d.monto, 0);

      // Se agrupa por cliente y no por oportunidad: dos negocios abiertos con
      // el mismo coleccionista son un solo riesgo, no dos.
      const porCliente = new Map<string, { contactId: number | null; monto: number }>();
      for (const d of propias) {
        const actual = porCliente.get(d.cliente) ?? { contactId: d.contactId, monto: 0 };
        actual.monto += d.monto;
        porCliente.set(d.cliente, actual);
      }

      const partes = [...porCliente.entries()]
        .map(([cliente, v]) => ({
          categoria,
          contactId: v.contactId,
          cliente,
          monto: v.monto,
          parte: monto > 0 ? (v.monto / monto) * 100 : 0,
        }))
        .sort((a, b) => b.monto - a.monto);

      for (const p of partes) {
        if (p.parte > UMBRAL_CONCENTRACION) riesgos.push(p);
      }

      return {
        categoria,
        monto,
        cantidad: propias.length,
        participacion: totalPipeline > 0 ? (monto / totalPipeline) * 100 : 0,
        hhi: Math.round(partes.reduce((s, p) => s + p.parte * p.parte, 0)),
        mayor: partes[0] ?? null,
      };
    })
    .sort((a, b) => b.monto - a.monto);

  riesgos.sort((a, b) => b.monto - a.monto);

  return { categorias, riesgos, totalPipeline };
}
