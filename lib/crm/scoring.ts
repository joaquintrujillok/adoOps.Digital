// Puntaje de potencial — explicable, determinístico y con pesos editables.
//
// La pregunta que responde es "¿a quién le dedico las próximas dos horas?".
// Para que la respuesta sirva, tiene que poder discutirse: cada puntaje viene
// con el desglose de sus factores y una frase que dice por qué. Un número que
// sale de una caja negra no cambia el comportamiento de un vendedor, porque no
// le da nada que contarle a su jefe.
//
// Los pesos viven en BD (lib/crm/settings.ts, clave `scoring.pesos`) y se
// editan desde /crm/configuracion. Ajustar el modelo no requiere un deploy.

import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmAccounts,
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
  frecuencia: 20,
  monto: 25,
  engagement: 15,
  potencial: 15,
};

export const DESCRIPCION_FACTORES: Record<keyof PesosScoring, string> = {
  recencia: "Qué tan reciente es la última compra o interacción",
  frecuencia: "Cuántas veces compró en los últimos 12 meses",
  monto: "Cuánto facturó en los últimos 12 meses, comparado con el resto",
  engagement: "Cuánto interactúa con marketing (aperturas, clics, formularios)",
  potencial: "Tamaño de la empresa y oportunidades abiertas hoy",
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

export interface ScoreCuenta {
  accountId: number;
  nombre: string;
  score: number;
  factores: Factor[];
  /** Lectura de una línea del puntaje. */
  resumen: string;
  facturado12m: number;
  compras12m: number;
  diasSinComprar: number | null;
  montoAbierto: number;
}

// ─── Curvas ──────────────────────────────────────────────────────────────────

/** Recencia: 100 el mismo día, cae a 0 a los 365 días. */
function puntosRecencia(dias: number | null): number {
  if (dias === null) return 0;
  if (dias <= 30) return 100;
  if (dias >= 365) return 0;
  return Math.round(100 * (1 - (dias - 30) / 335));
}

/** Frecuencia: 6 compras al año o más ya es el techo. */
function puntosFrecuencia(compras: number): number {
  return Math.min(100, Math.round((compras / 6) * 100));
}

/**
 * Monto: percentil dentro de la cartera, no valor absoluto.
 *
 * Comparar contra el máximo haría que una sola cuenta enorme aplaste a todas
 * las demás a puntajes de un dígito, y el ranking dejaría de discriminar justo
 * donde importa: entre las del medio.
 */
function puntosMonto(monto: number, ordenados: number[]): number {
  if (monto <= 0 || ordenados.length === 0) return 0;
  const menores = ordenados.filter((m) => m < monto).length;
  return Math.round((menores / ordenados.length) * 100);
}

/** Engagement: 12 interacciones en 90 días es el techo. */
function puntosEngagement(touch90d: number): number {
  return Math.min(100, Math.round((touch90d / 12) * 100));
}

/** Potencial: tamaño de la empresa + lo que hay abierto hoy. */
function puntosPotencial(tamano: string | null, montoAbierto: number): number {
  const porTamano: Record<string, number> = {
    grande: 50,
    mediana: 38,
    pyme: 25,
    micro: 12,
  };
  const base = porTamano[tamano ?? ""] ?? 20;
  const porAbierto = montoAbierto > 0 ? Math.min(50, Math.round(montoAbierto / 400_000)) : 0;
  return Math.min(100, base + porAbierto);
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export async function pesosActuales(): Promise<PesosScoring> {
  const guardados = await leerJson<Partial<PesosScoring>>(CLAVES.scoringPesos, {});
  return { ...PESOS_POR_DEFECTO, ...guardados };
}

/**
 * Puntúa todas las cuentas de una vez.
 *
 * Es una sola pasada a propósito: el factor de monto es relativo a la cartera,
 * así que puntuar una cuenta aislada exigiría igual traer el resto.
 */
export async function scoresDeCuentas(): Promise<ScoreCuenta[]> {
  const pesos = await pesosActuales();
  const hace12m = new Date(Date.now() - 365 * 86_400_000);
  const hace90d = new Date(Date.now() - 90 * 86_400_000);

  // Cuatro agregados con GROUP BY y un cruce en memoria, en vez de subconsultas
  // correlacionadas dentro del select.
  //
  // No es preferencia de estilo: cuando la consulta no tiene joins, Drizzle
  // escribe la columna externa SIN calificar la tabla ("id" en vez de
  // "crm_accounts"."id"), y adentro de la subconsulta ese "id" se resuelve
  // contra la tabla de la subconsulta. La consulta corre sin error y devuelve
  // cifras equivocadas — el peor tipo de bug. Con agregados no hay correlación
  // que romper.
  const [cuentas, ventas, actividades, toques, abiertos] = await Promise.all([
    db
      .select({
        id: crmAccounts.id,
        nombre: crmAccounts.nombre,
        tamano: crmAccounts.tamano,
        estado: crmAccounts.estado,
      })
      .from(crmAccounts),
    db
      .select({
        accountId: crmOrders.accountId,
        facturado12m: sql<number>`coalesce(sum(${crmOrders.total}) filter (where ${crmOrders.fecha} >= ${hace12m}),0)::int`,
        compras12m: sql<number>`count(*) filter (where ${crmOrders.fecha} >= ${hace12m})::int`,
        ultimaCompra: sql<string | null>`max(${crmOrders.fecha})`,
      })
      .from(crmOrders)
      .groupBy(crmOrders.accountId),
    db
      .select({
        accountId: crmActivities.accountId,
        ultima: sql<string | null>`max(${crmActivities.ocurridoEn})`,
      })
      .from(crmActivities)
      .groupBy(crmActivities.accountId),
    db
      .select({
        accountId: crmTouchpoints.accountId,
        n: sql<number>`count(*)::int`,
      })
      .from(crmTouchpoints)
      .where(gte(crmTouchpoints.ocurridoEn, hace90d))
      .groupBy(crmTouchpoints.accountId),
    db
      .select({
        accountId: crmDeals.accountId,
        monto: sql<number>`coalesce(sum(${crmDeals.monto}),0)::int`,
      })
      .from(crmDeals)
      .where(sql`${crmDeals.etapa} not in ('ganado','perdido')`)
      .groupBy(crmDeals.accountId),
  ]);

  const porVentas = new Map(ventas.map((v) => [v.accountId, v]));
  const porActividad = new Map(actividades.map((a) => [a.accountId, a.ultima]));
  const porToques = new Map(toques.map((t) => [t.accountId, t.n]));
  const porAbiertos = new Map(abiertos.map((a) => [a.accountId, a.monto]));

  const filas = cuentas.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tamano: c.tamano,
    estado: c.estado,
    facturado12m: porVentas.get(c.id)?.facturado12m ?? 0,
    compras12m: porVentas.get(c.id)?.compras12m ?? 0,
    ultimaCompra: porVentas.get(c.id)?.ultimaCompra ?? null,
    ultimaInteraccion: porActividad.get(c.id) ?? null,
    touch90d: porToques.get(c.id) ?? 0,
    montoAbierto: porAbiertos.get(c.id) ?? 0,
  }));

  const montosOrdenados = filas.map((f) => f.facturado12m).sort((a, b) => a - b);
  const totalPeso =
    pesos.recencia + pesos.frecuencia + pesos.monto + pesos.engagement + pesos.potencial ||
    1;

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
          puntos: puntosFrecuencia(f.compras12m),
          peso: pesos.frecuencia,
          evidencia: `${f.compras12m} compra${f.compras12m === 1 ? "" : "s"} en 12 meses`,
        },
        {
          clave: "monto",
          etiqueta: "Monto",
          puntos: puntosMonto(f.facturado12m, montosOrdenados),
          peso: pesos.monto,
          evidencia: `$${f.facturado12m.toLocaleString("es-CL")} facturados en 12 meses`,
        },
        {
          clave: "engagement",
          etiqueta: "Engagement",
          puntos: puntosEngagement(f.touch90d),
          peso: pesos.engagement,
          evidencia: `${f.touch90d} interacciones de marketing en 90 días`,
        },
        {
          clave: "potencial",
          etiqueta: "Potencial",
          puntos: puntosPotencial(f.tamano, f.montoAbierto),
          peso: pesos.potencial,
          evidencia:
            f.montoAbierto > 0
              ? `Empresa ${f.tamano ?? "sin clasificar"} · $${f.montoAbierto.toLocaleString("es-CL")} abiertos`
              : `Empresa ${f.tamano ?? "sin clasificar"} · sin oportunidades abiertas`,
        },
      ];

      const score = Math.round(
        factores.reduce((s, x) => s + x.puntos * x.peso, 0) / totalPeso,
      );

      return {
        accountId: f.id,
        nombre: f.nombre,
        score,
        factores,
        resumen: resumirScore(score, factores),
        facturado12m: f.facturado12m,
        compras12m: f.compras12m,
        diasSinComprar,
        montoAbierto: f.montoAbierto,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function resumirScore(score: number, factores: Factor[]): string {
  const ordenados = [...factores].sort(
    (a, b) => b.puntos * b.peso - a.puntos * a.peso,
  );
  const fuerte = ordenados[0];
  const debil = ordenados[ordenados.length - 1];
  const nivel = score >= 70 ? "alto" : score >= 40 ? "medio" : "bajo";
  return `Potencial ${nivel}. Lo sostiene ${fuerte.etiqueta.toLowerCase()} (${fuerte.evidencia.toLowerCase()}); lo frena ${debil.etiqueta.toLowerCase()} (${debil.evidencia.toLowerCase()}).`;
}

export async function scoreDeCuenta(accountId: number): Promise<ScoreCuenta | null> {
  const todos = await scoresDeCuentas();
  return todos.find((s) => s.accountId === accountId) ?? null;
}

// ─── Puntaje de oportunidad ──────────────────────────────────────────────────

export interface ScoreDeal {
  dealId: number;
  score: number;
  factores: { etiqueta: string; puntos: number; evidencia: string }[];
  resumen: string;
}

/**
 * Salud de una oportunidad abierta. No es la probabilidad de la etapa —esa la
 * pone el vendedor— sino qué tan bien se está tratando el negocio.
 */
export async function scoresDeDeals(): Promise<Map<number, ScoreDeal>> {
  const [deals, scoresCuenta] = await Promise.all([
    db
      .select({
        id: crmDeals.id,
        accountId: crmDeals.accountId,
        etapa: crmDeals.etapa,
        monto: crmDeals.monto,
        abiertoEn: crmDeals.abiertoEn,
        ultimaActividadEn: crmDeals.ultimaActividadEn,
        contactId: crmDeals.contactId,
        cierreEstimado: crmDeals.cierreEstimado,
      })
      .from(crmDeals)
      .where(sql`${crmDeals.etapa} not in ('ganado','perdido')`),
    scoresDeCuentas(),
  ]);

  const porCuenta = new Map(scoresCuenta.map((s) => [s.accountId, s]));
  const decisores = await db
    .select({ id: crmContacts.id, esDecisor: crmContacts.esDecisor })
    .from(crmContacts);
  const esDecisor = new Map(decisores.map((d) => [d.id, d.esDecisor]));

  const resultado = new Map<number, ScoreDeal>();

  for (const d of deals) {
    const cuenta = porCuenta.get(d.accountId);
    const dias = Math.floor(
      (Date.now() - new Date(d.ultimaActividadEn ?? d.abiertoEn).getTime()) / 86_400_000,
    );

    // Estancamiento: sin actividad en 30 días el negocio ya está enfriándose.
    const puntosActividad = dias <= 3 ? 100 : dias >= 30 ? 0 : Math.round(100 * (1 - (dias - 3) / 27));
    const puntosEtapa =
      { nuevo: 20, calificado: 45, propuesta: 70, negociacion: 90 }[d.etapa] ?? 20;
    const puntosCuenta = cuenta?.score ?? 40;
    const puntosDecisor = d.contactId && esDecisor.get(d.contactId) ? 100 : 35;

    const factores = [
      {
        etiqueta: "Seguimiento",
        puntos: puntosActividad,
        evidencia: `${dias} días desde la última actividad`,
      },
      {
        etiqueta: "Avance",
        puntos: puntosEtapa,
        evidencia: `Etapa ${d.etapa}`,
      },
      {
        etiqueta: "Cuenta",
        puntos: puntosCuenta,
        evidencia: `Potencial de la cuenta: ${puntosCuenta}/100`,
      },
      {
        etiqueta: "Interlocutor",
        puntos: puntosDecisor,
        evidencia:
          d.contactId && esDecisor.get(d.contactId)
            ? "Hablando con quien decide"
            : "Sin decisor identificado",
      },
    ];

    const score = Math.round(
      (puntosActividad * 0.3 + puntosEtapa * 0.25 + puntosCuenta * 0.25 + puntosDecisor * 0.2),
    );

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
