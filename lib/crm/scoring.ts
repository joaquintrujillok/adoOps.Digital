// Puntaje de potencial del cliente — explicable, determinístico y con pesos
// editables.
//
// La pregunta que responde es "¿a quién llamo primero esta semana?". Para que
// la respuesta sirva tiene que poder discutirse: cada puntaje viene con el
// desglose de sus factores y una frase que dice por qué. Un número que sale de
// una caja negra no cambia el comportamiento de un vendedor, porque no le da
// nada que contarle a su jefe.
//
// **La ventana es de 24 meses, no de 12.** En alta gama el ciclo de recompra se
// mide en años: con una ventana de 12 meses, un coleccionista que compró hace
// catorce meses puntúa igual que alguien que nunca compró, y es exactamente el
// cliente al que hay que llamar.
//
// Los pesos viven en BD (clave `scoring.pesos`) y se editan desde
// /crm/configuracion. Ajustar el modelo no requiere un deploy.

import { gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmActivities,
  crmContacts,
  crmDeals,
  crmOrders,
  crmTouchpoints,
} from "@/db/crm";
import { CLAVES, leerJson } from "./settings";

export interface PesosScoring {
  recencia: number;
  frecuencia: number;
  monto: number;
  engagement: number;
  potencial: number;
}

export const PESOS_POR_DEFECTO: PesosScoring = {
  recencia: 25,
  frecuencia: 15,
  monto: 30,
  engagement: 15,
  potencial: 15,
};

export const DESCRIPCION_FACTORES: Record<keyof PesosScoring, string> = {
  recencia: "Qué tan reciente es la última compra o interacción",
  frecuencia: "Cuántas veces compró en los últimos 24 meses",
  monto: "Cuánto compró en 24 meses, comparado con el resto de la cartera",
  engagement: "Cuánto interactúa con las campañas (aperturas, clics, visitas)",
  potencial: "Su pieza más cara comprada y lo que tiene abierto hoy",
};

export interface Factor {
  clave: keyof PesosScoring;
  etiqueta: string;
  /** 0-100 antes de ponderar. */
  puntos: number;
  peso: number;
  /** Qué dato produjo ese puntaje, en palabras. */
  evidencia: string;
}

export interface ScoreCliente {
  contactId: number;
  nombre: string;
  score: number;
  factores: Factor[];
  resumen: string;
  facturado24m: number;
  compras24m: number;
  diasSinComprar: number | null;
  montoAbierto: number;
  piezaMasCara: number;
}

// ─── Curvas ──────────────────────────────────────────────────────────────────

/** Recencia: 100 hasta los 60 días, cae a 0 a los dos años. */
function puntosRecencia(dias: number | null): number {
  if (dias === null) return 0;
  if (dias <= 60) return 100;
  if (dias >= 730) return 0;
  return Math.round(100 * (1 - (dias - 60) / 670));
}

/** Frecuencia: 4 compras en dos años ya es el techo en este rubro. */
function puntosFrecuencia(compras: number): number {
  return Math.min(100, Math.round((compras / 4) * 100));
}

/**
 * Monto: percentil dentro de la cartera, no valor absoluto.
 *
 * Comparar contra el máximo haría que un solo coleccionista de noventa millones
 * aplaste a todos los demás a puntajes de un dígito, y el ranking dejaría de
 * discriminar justo donde importa: entre los del medio.
 */
function puntosMonto(monto: number, ordenados: number[]): number {
  if (monto <= 0 || ordenados.length === 0) return 0;
  const menores = ordenados.filter((m) => m < monto).length;
  return Math.round((menores / ordenados.length) * 100);
}

/** Engagement: 10 interacciones en 90 días es el techo. */
function puntosEngagement(touch90d: number): number {
  return Math.min(100, Math.round((touch90d / 10) * 100));
}

/**
 * Potencial: hasta dónde llega su bolsillo.
 *
 * La pieza más cara que ya compró es el mejor predictor disponible de lo que
 * puede volver a gastar — mucho mejor que el total acumulado, que confunde a
 * quien compró diez accesorios con quien compró un reloj.
 */
function puntosPotencial(piezaMasCara: number, montoAbierto: number, coleccionista: boolean): number {
  const porPieza = Math.min(60, Math.round(piezaMasCara / 500_000));
  const porAbierto = montoAbierto > 0 ? Math.min(25, Math.round(montoAbierto / 1_000_000)) : 0;
  return Math.min(100, porPieza + porAbierto + (coleccionista ? 15 : 0));
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export async function pesosActuales(): Promise<PesosScoring> {
  const guardados = await leerJson<Partial<PesosScoring>>(CLAVES.scoringPesos, {});
  return { ...PESOS_POR_DEFECTO, ...guardados };
}

/**
 * Puntúa a todos los clientes de una vez.
 *
 * Agregados con GROUP BY y cruce en memoria, nunca subconsultas correlacionadas
 * dentro del select: sin joins, Drizzle escribe la columna externa sin calificar
 * la tabla y adentro de la subconsulta se resuelve contra la tabla equivocada.
 * La consulta corre sin error y devuelve cifras falsas.
 */
export async function scoresDeClientes(): Promise<ScoreCliente[]> {
  const pesos = await pesosActuales();
  const hace24m = new Date(Date.now() - 730 * 86_400_000);
  const hace90d = new Date(Date.now() - 90 * 86_400_000);

  const [contactos, ventas, actividades, toques, abiertos, piezas] = await Promise.all([
    db
      .select({
        id: crmContacts.id,
        nombre: crmContacts.nombre,
        estado: crmContacts.estado,
        etiquetas: crmContacts.etiquetas,
      })
      .from(crmContacts),
    db
      .select({
        contactId: crmOrders.contactId,
        facturado24m: sql<number>`coalesce(sum(${crmOrders.total}) filter (where ${crmOrders.fecha} >= ${hace24m}),0)::float8`,
        compras24m: sql<number>`count(*) filter (where ${crmOrders.fecha} >= ${hace24m})::int`,
        ultimaCompra: sql<string | null>`max(${crmOrders.fecha})`,
        ordenMasCara: sql<number>`coalesce(max(${crmOrders.total}),0)::float8`,
      })
      .from(crmOrders)
      .groupBy(crmOrders.contactId),
    db
      .select({
        contactId: crmActivities.contactId,
        ultima: sql<string | null>`max(${crmActivities.ocurridoEn})`,
      })
      .from(crmActivities)
      .groupBy(crmActivities.contactId),
    db
      .select({ contactId: crmTouchpoints.contactId, n: sql<number>`count(*)::int` })
      .from(crmTouchpoints)
      .where(gte(crmTouchpoints.ocurridoEn, hace90d))
      .groupBy(crmTouchpoints.contactId),
    db
      .select({
        contactId: crmDeals.contactId,
        monto: sql<number>`coalesce(sum(${crmDeals.monto}),0)::float8`,
      })
      .from(crmDeals)
      .where(sql`${crmDeals.etapa} not in ('ganado','perdido')`)
      .groupBy(crmDeals.contactId),
    db
      .select({
        contactId: crmOrders.contactId,
        masCara: sql<number>`coalesce(max(oi.precio_unitario), 0)::float8`,
      })
      .from(crmOrders)
      .innerJoin(sql`crm_order_items oi`, sql`oi.order_id = ${crmOrders.id}`)
      .groupBy(crmOrders.contactId),
  ]);

  const porVentas = new Map(ventas.map((v) => [v.contactId, v]));
  const porActividad = new Map(actividades.map((a) => [a.contactId, a.ultima]));
  const porToques = new Map(toques.map((t) => [t.contactId, t.n]));
  const porAbiertos = new Map(abiertos.map((a) => [a.contactId, a.monto]));
  const porPieza = new Map(piezas.map((p) => [p.contactId, p.masCara]));

  const filas = contactos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    coleccionista: (c.etiquetas ?? []).includes("coleccionista"),
    facturado24m: porVentas.get(c.id)?.facturado24m ?? 0,
    compras24m: porVentas.get(c.id)?.compras24m ?? 0,
    ultimaCompra: porVentas.get(c.id)?.ultimaCompra ?? null,
    ultimaInteraccion: porActividad.get(c.id) ?? null,
    touch90d: porToques.get(c.id) ?? 0,
    montoAbierto: porAbiertos.get(c.id) ?? 0,
    piezaMasCara: porPieza.get(c.id) ?? 0,
  }));

  const montosOrdenados = filas.map((f) => f.facturado24m).sort((a, b) => a - b);
  const totalPeso =
    pesos.recencia + pesos.frecuencia + pesos.monto + pesos.engagement + pesos.potencial || 1;

  const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

  return filas
    .map((f) => {
      const referencia = [f.ultimaCompra, f.ultimaInteraccion]
        .filter(Boolean)
        .map((d) => new Date(d as string).getTime())
        .sort((a, b) => b - a)[0];
      const diasDesdeToque = referencia
        ? Math.floor((Date.now() - referencia) / 86_400_000)
        : null;
      const diasSinComprar = f.ultimaCompra
        ? Math.floor((Date.now() - new Date(f.ultimaCompra).getTime()) / 86_400_000)
        : null;

      const factores: Factor[] = [
        {
          clave: "recencia",
          etiqueta: "Recencia",
          puntos: puntosRecencia(diasDesdeToque),
          peso: pesos.recencia,
          evidencia:
            diasDesdeToque === null
              ? "Sin contacto registrado"
              : `Último contacto hace ${diasDesdeToque} días`,
        },
        {
          clave: "frecuencia",
          etiqueta: "Frecuencia",
          puntos: puntosFrecuencia(f.compras24m),
          peso: pesos.frecuencia,
          evidencia: `${f.compras24m} compra${f.compras24m === 1 ? "" : "s"} en 24 meses`,
        },
        {
          clave: "monto",
          etiqueta: "Monto",
          puntos: puntosMonto(f.facturado24m, montosOrdenados),
          peso: pesos.monto,
          evidencia: `${clp(f.facturado24m)} en 24 meses`,
        },
        {
          clave: "engagement",
          etiqueta: "Engagement",
          puntos: puntosEngagement(f.touch90d),
          peso: pesos.engagement,
          evidencia: `${f.touch90d} interacciones con campañas en 90 días`,
        },
        {
          clave: "potencial",
          etiqueta: "Potencial",
          puntos: puntosPotencial(f.piezaMasCara, f.montoAbierto, f.coleccionista),
          peso: pesos.potencial,
          evidencia:
            f.piezaMasCara > 0
              ? `Su pieza más cara: ${clp(f.piezaMasCara)}${f.montoAbierto > 0 ? ` · ${clp(f.montoAbierto)} abiertos` : ""}`
              : f.montoAbierto > 0
                ? `${clp(f.montoAbierto)} abiertos, sin compras aún`
                : "Sin compras ni oportunidades abiertas",
        },
      ];

      const score = Math.round(
        factores.reduce((s, x) => s + x.puntos * x.peso, 0) / totalPeso,
      );

      return {
        contactId: f.id,
        nombre: f.nombre,
        score,
        factores,
        resumen: resumirScore(score, factores),
        facturado24m: f.facturado24m,
        compras24m: f.compras24m,
        diasSinComprar,
        montoAbierto: f.montoAbierto,
        piezaMasCara: f.piezaMasCara,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function resumirScore(score: number, factores: Factor[]): string {
  const ordenados = [...factores].sort((a, b) => b.puntos * b.peso - a.puntos * a.peso);
  const fuerte = ordenados[0];
  const debil = ordenados[ordenados.length - 1];
  const nivel = score >= 70 ? "alto" : score >= 40 ? "medio" : "bajo";
  return `Potencial ${nivel}. Lo sostiene ${fuerte.etiqueta.toLowerCase()} (${fuerte.evidencia.toLowerCase()}); lo frena ${debil.etiqueta.toLowerCase()} (${debil.evidencia.toLowerCase()}).`;
}

export async function scoreDeCliente(contactId: number): Promise<ScoreCliente | null> {
  const todos = await scoresDeClientes();
  return todos.find((s) => s.contactId === contactId) ?? null;
}

// ─── Salud de la oportunidad ─────────────────────────────────────────────────

export interface ScoreDeal {
  dealId: number;
  score: number;
  factores: { etiqueta: string; puntos: number; evidencia: string }[];
  resumen: string;
}

/**
 * Qué tan bien se está tratando un negocio abierto. No es la probabilidad de la
 * etapa —esa la pone quien vende— sino la calidad del seguimiento.
 */
export async function scoresDeDeals(): Promise<Map<number, ScoreDeal>> {
  const [deals, scoresCliente] = await Promise.all([
    db
      .select({
        id: crmDeals.id,
        contactId: crmDeals.contactId,
        etapa: crmDeals.etapa,
        monto: crmDeals.monto,
        abiertoEn: crmDeals.abiertoEn,
        ultimaActividadEn: crmDeals.ultimaActividadEn,
      })
      .from(crmDeals)
      .where(sql`${crmDeals.etapa} not in ('ganado','perdido')`),
    scoresDeClientes(),
  ]);

  const porCliente = new Map(scoresCliente.map((s) => [s.contactId, s]));
  const resultado = new Map<number, ScoreDeal>();

  for (const d of deals) {
    const cliente = d.contactId ? porCliente.get(d.contactId) : undefined;
    const dias = Math.floor(
      (Date.now() - new Date(d.ultimaActividadEn ?? d.abiertoEn).getTime()) / 86_400_000,
    );

    // Sin actividad en 30 días el negocio ya se enfrió.
    const puntosActividad = dias <= 3 ? 100 : dias >= 30 ? 0 : Math.round(100 * (1 - (dias - 3) / 27));
    const puntosEtapa =
      { nuevo: 20, calificado: 45, propuesta: 70, negociacion: 90 }[d.etapa] ?? 20;
    const puntosCliente = cliente?.score ?? 40;

    const factores = [
      { etiqueta: "Seguimiento", puntos: puntosActividad, evidencia: `${dias} días desde la última actividad` },
      { etiqueta: "Avance", puntos: puntosEtapa, evidencia: `Etapa ${d.etapa}` },
      { etiqueta: "Cliente", puntos: puntosCliente, evidencia: `Potencial del cliente: ${puntosCliente}/100` },
    ];

    const score = Math.round(puntosActividad * 0.4 + puntosEtapa * 0.3 + puntosCliente * 0.3);
    const peor = [...factores].sort((a, b) => a.puntos - b.puntos)[0];

    resultado.set(d.id, {
      dealId: d.id,
      score,
      factores,
      resumen:
        score >= 70
          ? "Va bien encaminada."
          : `Lo más débil es ${peor.etiqueta.toLowerCase()}: ${peor.evidencia.toLowerCase()}.`,
    });
  }

  return resultado;
}
