// Motor de alertas e insights — reglas explícitas sobre los datos del CRM.
//
// Cada regla responde a una pregunta que un gerente comercial hace igual, con o
// sin software: qué se está enfriando, quién dejó de comprar, qué vendimos sin
// tener stock, dónde estoy gastando sin retorno.
//
// Dos decisiones de diseño que sostienen todo lo demás:
//
//   1. **Las reglas son determinísticas.** El cálculo no lo hace un modelo. Un
//      insight que no se puede reproducir no se puede defender frente al cliente
//      —y cuando el cliente lo revisa y no le cuadra, se cae la confianza en
//      todo el sistema, no solo en ese número. El lenguaje natural lo pone
//      después el narrador (lib/crm/narrador.ts), sobre cifras ya calculadas.
//
//   2. **Toda alerta trae acción.** Si no hay nada que hacer con un hallazgo, no
//      es un insight: es una estadística. `accionSugerida` es lo que convierte
//      la bandeja en trabajo.
//
// Los umbrales viven en BD y se editan desde /crm/configuracion.

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmActivities,
  crmAlerts,
  crmCampaigns,
  crmContacts,
  crmDeals,
  crmOrders,
} from "@/db/crm";
import { CLAVES, leerJson } from "./settings";
import { listarProductos, riesgosDeStock } from "./productos";
import { rendimientoCampanas } from "./marketing";
import { paresCrossSell, ventanaRecompra } from "./segmentos";
import { scoresDeClientes } from "./scoring";

export interface Umbrales {
  /** Días sin actividad para considerar estancada una oportunidad. */
  diasEstancado: number;
  /** Monto desde el cual una oportunidad estancada es alerta alta. */
  montoAlto: number;
  /** Caída porcentual de facturación que dispara alerta de cuenta. */
  caidaPorcentaje: number;
  /** Confianza mínima de un par de cross-sell para recomendarlo. */
  confianzaCrossSell: number;
  /** Puntaje desde el cual una cuenta sin oportunidad abierta es alerta. */
  scoreDesatendido: number;
}

export const UMBRALES_POR_DEFECTO: Umbrales = {
  diasEstancado: 14,
  montoAlto: 3_000_000,
  caidaPorcentaje: 40,
  confianzaCrossSell: 50,
  scoreDesatendido: 70,
};

export const DESCRIPCION_UMBRALES: Record<keyof Umbrales, string> = {
  diasEstancado: "Días sin actividad para marcar una oportunidad como estancada",
  montoAlto: "Monto (CLP) desde el cual una oportunidad estancada es alerta alta",
  caidaPorcentaje: "Caída % de facturación de una cuenta que gatilla alerta",
  confianzaCrossSell: "Confianza mínima (%) para recomendar un cross-sell",
  scoreDesatendido: "Puntaje desde el cual una cuenta sin oportunidad abierta alerta",
};

export async function umbralesActuales(): Promise<Umbrales> {
  const guardados = await leerJson<Partial<Umbrales>>(CLAVES.alertasUmbrales, {});
  return { ...UMBRALES_POR_DEFECTO, ...guardados };
}

// ─── Forma de una alerta antes de guardarse ──────────────────────────────────

export type AccionSugerida =
  | { accion: "abrir_deal"; etiqueta: string; dealId: number }
  | { accion: "abrir_cliente"; etiqueta: string; contactId: number }
  | { accion: "abrir_producto"; etiqueta: string; productId: number }
  | { accion: "abrir_campana"; etiqueta: string; campaignId: number }
  | {
      accion: "whatsapp";
      etiqueta: string;
      contactIds: number[];
      plantilla: string;
    };

export interface AlertaCalculada {
  clave: string;
  tipo: string;
  severidad: "alta" | "media" | "baja";
  titulo: string;
  detalle: string;
  entidadTipo: string | null;
  entidadId: number | null;
  accionSugerida: AccionSugerida | null;
}

const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;

// ─── Las reglas ──────────────────────────────────────────────────────────────

async function reglaOportunidadesEstancadas(u: Umbrales): Promise<AlertaCalculada[]> {
  const limite = new Date(Date.now() - u.diasEstancado * 86_400_000);

  const filas = await db
    .select({
      id: crmDeals.id,
      titulo: crmDeals.titulo,
      monto: crmDeals.monto,
      etapa: crmDeals.etapa,
      cliente: crmContacts.nombre,
      referencia: sql<string>`coalesce(${crmDeals.ultimaActividadEn}, ${crmDeals.abiertoEn})`,
    })
    .from(crmDeals)
    .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .where(
      and(
        inArray(crmDeals.etapa, ["nuevo", "calificado", "propuesta", "negociacion"]),
        lt(sql`coalesce(${crmDeals.ultimaActividadEn}, ${crmDeals.abiertoEn})`, limite),
      ),
    );

  return filas.map((f) => {
    const dias = Math.floor(
      (Date.now() - new Date(f.referencia).getTime()) / 86_400_000,
    );
    return {
      // La clave incluye la semana: la alerta se renueva si sigue estancada la
      // semana siguiente, en vez de quedar como una notificación vieja que ya
      // nadie mira.
      clave: `estancado:${f.id}:${Math.floor(dias / 7)}`,
      tipo: "deal_estancado",
      severidad: (f.monto >= u.montoAlto ? "alta" : "media") as "alta" | "media",
      titulo: `${f.cliente}: "${f.titulo}" lleva ${dias} días sin movimiento`,
      detalle: `${clp(f.monto)} en etapa ${f.etapa}. Sin actividad registrada desde hace ${dias} días.`,
      entidadTipo: "deal",
      entidadId: f.id,
      accionSugerida: {
        accion: "abrir_deal",
        etiqueta: "Ver la oportunidad",
        dealId: f.id,
      },
    };
  });
}

async function reglaCierresVencidos(): Promise<AlertaCalculada[]> {
  const filas = await db
    .select({
      id: crmDeals.id,
      titulo: crmDeals.titulo,
      monto: crmDeals.monto,
      cierreEstimado: crmDeals.cierreEstimado,
      cliente: crmContacts.nombre,
    })
    .from(crmDeals)
    .leftJoin(crmContacts, eq(crmContacts.id, crmDeals.contactId))
    .where(
      and(
        inArray(crmDeals.etapa, ["nuevo", "calificado", "propuesta", "negociacion"]),
        lt(crmDeals.cierreEstimado, new Date()),
      ),
    );

  return filas.map((f) => {
    const dias = Math.floor(
      (Date.now() - new Date(f.cierreEstimado!).getTime()) / 86_400_000,
    );
    return {
      clave: `cierre_vencido:${f.id}:${Math.floor(dias / 7)}`,
      tipo: "cierre_vencido",
      severidad: "media" as const,
      titulo: `${f.cliente}: la fecha de cierre se pasó hace ${dias} días`,
      detalle: `"${f.titulo}" por ${clp(f.monto)} sigue abierta. O se recalendariza, o se cierra.`,
      entidadTipo: "deal",
      entidadId: f.id,
      accionSugerida: {
        accion: "abrir_deal",
        etiqueta: "Actualizar la fecha",
        dealId: f.id,
      },
    };
  });
}

async function reglaCaidaDeCuenta(u: Umbrales): Promise<AlertaCalculada[]> {
  const hace90 = new Date(Date.now() - 90 * 86_400_000);
  const hace180 = new Date(Date.now() - 180 * 86_400_000);

  const filas = await db
    .select({
      contactId: crmOrders.contactId,
      cliente: crmContacts.nombre,
      reciente: sql<number>`coalesce(sum(${crmOrders.total}) filter (where ${crmOrders.fecha} >= ${hace90}),0)::float8`,
      previo: sql<number>`coalesce(sum(${crmOrders.total}) filter (where ${crmOrders.fecha} >= ${hace180} and ${crmOrders.fecha} < ${hace90}),0)::float8`,
    })
    .from(crmOrders)
    .innerJoin(crmContacts, eq(crmContacts.id, crmOrders.contactId))
    .where(gte(crmOrders.fecha, hace180))
    .groupBy(crmOrders.contactId, crmContacts.nombre);

  return filas
    .filter((f) => f.previo > 0 && f.reciente < f.previo * (1 - u.caidaPorcentaje / 100))
    .map((f) => {
      const caida = ((f.previo - f.reciente) / f.previo) * 100;
      return {
        clave: `caida:${f.contactId}:${new Date().toISOString().slice(0, 7)}`,
        tipo: "cuenta_en_caida",
        severidad: (caida >= 70 ? "alta" : "media") as "alta" | "media",
        titulo: `${f.cliente} compró ${caida.toFixed(0)}% menos este trimestre`,
        detalle: `Pasó de ${clp(f.previo)} a ${clp(f.reciente)} entre los dos últimos trimestres.`,
        entidadTipo: "cliente",
        entidadId: f.contactId,
        accionSugerida: {
          accion: "abrir_cliente",
          etiqueta: "Revisar el cliente",
          contactId: f.contactId!,
        },
      };
    });
}

async function reglaRecompra(): Promise<AlertaCalculada[]> {
  const atrasadas = await ventanaRecompra();
  if (atrasadas.length === 0) return [];

  // Una sola alerta con el grupo entero, no una por cuenta: 40 notificaciones
  // idénticas no se leen, y lo accionable acá es la campaña, no cada caso.
  const contactables = atrasadas.filter((r) => r.cliente.telefonoWhatsapp);
  const potencial = atrasadas.reduce((s, r) => s + r.ticketPromedio, 0);

  const alertas: AlertaCalculada[] = [
    {
      clave: `recompra:${new Date().toISOString().slice(0, 10)}`,
      tipo: "recompra",
      severidad: "media",
      titulo: `${atrasadas.length} clientes pasaron su ventana de recompra`,
      detalle: `Suman ${clp(potencial)} en tickets promedio. ${contactables.length} tienen WhatsApp autorizado.`,
      entidadTipo: null,
      entidadId: null,
      accionSugerida: contactables.length
        ? {
            accion: "whatsapp",
            etiqueta: `Preparar mensaje para ${contactables.length} clientes`,
            contactIds: contactables.map((r) => r.cliente.contactId),
            plantilla: "recompra",
          }
        : null,
    },
  ];

  // Las tres de mayor ticket se destacan aparte: son las que ameritan llamada,
  // no mensaje masivo.
  for (const r of atrasadas.slice(0, 3)) {
    alertas.push({
      clave: `recompra_top:${r.cliente.contactId}:${Math.floor(r.atraso / 15)}`,
      tipo: "recompra",
      severidad: "alta",
      titulo: `${r.cliente.nombre} lleva ${r.atraso} días de atraso en su recompra`,
      detalle: `Compra cada ${r.cliente.cicloRecompraDias} días en promedio, ticket de ${clp(r.ticketPromedio)}${r.productoHabitual ? `, habitualmente ${r.productoHabitual}` : ""}.`,
      entidadTipo: "cliente",
      entidadId: r.cliente.contactId,
      accionSugerida: {
        accion: "abrir_cliente",
        etiqueta: "Ver el cliente",
        contactId: r.cliente.contactId,
      },
    });
  }

  return alertas;
}

async function reglaInventario(): Promise<AlertaCalculada[]> {
  const [riesgos, productos] = await Promise.all([riesgosDeStock(), listarProductos()]);
  const alertas: AlertaCalculada[] = [];

  for (const r of riesgos) {
    const monto = r.deals.reduce((s, d) => s + d.monto, 0);
    alertas.push({
      clave: `stock_comprometido:${r.productId}:${new Date().toISOString().slice(0, 10)}`,
      tipo: "stock_comprometido",
      severidad: "alta",
      titulo: `${r.nombre}: comprometido en ${r.deals.length} oportunidades y faltan ${r.faltante} unidades`,
      detalle: `Hay ${r.stock} en bodega y ${r.comprometido} comprometidas en oportunidades abiertas. Son ${clp(monto)} en riesgo y la reposición demora ${r.leadTimeDias} días.`,
      entidadTipo: "producto",
      entidadId: r.productId,
      accionSugerida: {
        accion: "abrir_producto",
        etiqueta: "Ver stock y sustitutos",
        productId: r.productId,
      },
    });
  }

  for (const p of productos) {
    if (p.disponibilidad !== "ajustado") continue;
    // Solo si además se está vendiendo: un producto quieto bajo el punto de
    // reposición no es urgencia comercial.
    if (riesgos.some((r) => r.productId === p.id)) continue;
    alertas.push({
      clave: `bajo_stock:${p.id}:${new Date().toISOString().slice(0, 10)}`,
      tipo: "bajo_stock",
      severidad: "baja",
      titulo: `${p.nombre} está bajo el punto de reposición`,
      detalle: `Quedan ${p.disponible} disponibles y el punto de reposición es ${p.puntoReposicion}. Reponer demora ${p.leadTimeDias} días.`,
      entidadTipo: "producto",
      entidadId: p.id,
      accionSugerida: {
        accion: "abrir_producto",
        etiqueta: "Ver el producto",
        productId: p.id,
      },
    });
  }

  return alertas;
}

async function reglaCuentasDesatendidas(u: Umbrales): Promise<AlertaCalculada[]> {
  const scores = await scoresDeClientes();
  return scores
    .filter((s) => s.score >= u.scoreDesatendido && s.montoAbierto === 0)
    .slice(0, 8)
    .map((s) => ({
      clave: `desatendida:${s.contactId}:${new Date().toISOString().slice(0, 7)}`,
      tipo: "cuenta_desatendida",
      severidad: "media" as const,
      titulo: `${s.nombre} puntúa ${s.score}/100 y no tiene ninguna oportunidad abierta`,
      detalle: s.resumen,
      entidadTipo: "cliente",
      entidadId: s.contactId,
      accionSugerida: {
        accion: "abrir_cliente",
        etiqueta: "Abrir oportunidad",
        contactId: s.contactId,
      },
    }));
}

async function reglaCrossSell(u: Umbrales): Promise<AlertaCalculada[]> {
  const pares = await paresCrossSell();
  return pares
    .filter((p) => p.confianza >= u.confianzaCrossSell && p.oportunidades.length >= 2)
    .slice(0, 4)
    .map((p) => ({
      clave: `crosssell:${p.productoA.id}:${p.productoB.id}:${new Date().toISOString().slice(0, 7)}`,
      tipo: "cross_sell",
      severidad: "baja" as const,
      titulo: `${p.oportunidades.length} clientes de ${p.productoA.nombre} aún no compran ${p.productoB.nombre}`,
      detalle: `De los ${p.conA} que compraron ${p.productoA.nombre}, ${p.juntas} compraron también ${p.productoB.nombre} (${p.confianza.toFixed(0)}%).`,
      entidadTipo: "producto",
      entidadId: p.productoB.id,
      accionSugerida: {
        accion: "whatsapp",
        etiqueta: `Ofrecer a ${p.oportunidades.length} clientes`,
        contactIds: p.oportunidades.map((o) => o.contactId),
        plantilla: "cross_sell",
      },
    }));
}

async function reglaCampanasSinRetorno(): Promise<AlertaCalculada[]> {
  const campanas = await rendimientoCampanas();
  const hace30 = Date.now() - 30 * 86_400_000;

  return campanas
    .filter(
      (c) =>
        c.costo > 0 &&
        new Date(c.campana.inicio).getTime() < hace30 &&
        (c.roi ?? -1) < 0,
    )
    .map((c) => ({
      clave: `campana_sin_retorno:${c.campana.id}:${new Date().toISOString().slice(0, 7)}`,
      tipo: "campana_sin_retorno",
      severidad: "media" as const,
      titulo: `${c.campana.nombre} va con retorno negativo`,
      detalle: `${clp(c.costo)} invertidos, ${clp(c.ingresosPrimerToque)} atribuidos por primer toque, ${c.dealsPrimerToque} oportunidades generadas.`,
      entidadTipo: "campana",
      entidadId: c.campana.id,
      accionSugerida: {
        accion: "abrir_campana",
        etiqueta: "Ver la campaña",
        campaignId: c.campana.id,
      },
    }));
}

async function reglaTareasVencidas(): Promise<AlertaCalculada[]> {
  const filas = await db
    .select({
      id: crmActivities.id,
      titulo: crmActivities.titulo,
      venceEn: crmActivities.venceEn,
      contactId: crmActivities.contactId,
      cliente: crmContacts.nombre,
    })
    .from(crmActivities)
    .leftJoin(crmContacts, eq(crmContacts.id, crmActivities.contactId))
    .where(
      and(
        eq(crmActivities.tipo, "tarea"),
        eq(crmActivities.completada, false),
        lt(crmActivities.venceEn, new Date()),
      ),
    )
    .limit(10);

  return filas.map((f) => ({
    clave: `tarea_vencida:${f.id}`,
    tipo: "tarea_vencida",
    severidad: "baja" as const,
    titulo: `Tarea vencida · ${f.cliente}: ${f.titulo}`,
    detalle: `Vencía el ${new Date(f.venceEn!).toLocaleDateString("es-CL")}.`,
    entidadTipo: "cliente",
    entidadId: f.contactId,
    accionSugerida: {
      accion: "abrir_cliente",
      etiqueta: "Ver el cliente",
      contactId: f.contactId!,
    },
  }));
}

// ─── Ejecución ───────────────────────────────────────────────────────────────

/**
 * Corre todas las reglas y persiste lo nuevo.
 *
 * Idempotente por `clave`: volver a correrlo no duplica nada. Las alertas ya
 * atendidas o descartadas tampoco reviven, porque el conflicto sobre la clave
 * no toca el estado.
 */
export async function recalcularAlertas(): Promise<{
  generadas: number;
  nuevas: number;
}> {
  const u = await umbralesActuales();

  const grupos = await Promise.all([
    reglaOportunidadesEstancadas(u),
    reglaCierresVencidos(),
    reglaCaidaDeCuenta(u),
    reglaRecompra(),
    reglaInventario(),
    reglaCuentasDesatendidas(u),
    reglaCrossSell(u),
    reglaCampanasSinRetorno(),
    reglaTareasVencidas(),
  ]);

  const todas = grupos.flat();
  if (todas.length === 0) return { generadas: 0, nuevas: 0 };

  const existentes = await db
    .select({ clave: crmAlerts.clave })
    .from(crmAlerts)
    .where(inArray(crmAlerts.clave, todas.map((a) => a.clave)));
  const yaEstaban = new Set(existentes.map((e) => e.clave));

  const nuevas = todas.filter((a) => !yaEstaban.has(a.clave));
  if (nuevas.length > 0) {
    await db
      .insert(crmAlerts)
      .values(
        nuevas.map((a) => ({
          clave: a.clave,
          tipo: a.tipo,
          severidad: a.severidad,
          titulo: a.titulo,
          detalle: a.detalle,
          entidadTipo: a.entidadTipo,
          entidadId: a.entidadId,
          accionSugerida: a.accionSugerida,
        })),
      )
      .onConflictDoNothing({ target: crmAlerts.clave });
  }

  return { generadas: todas.length, nuevas: nuevas.length };
}

export async function listarAlertas(estado: string = "abierta") {
  return db
    .select()
    .from(crmAlerts)
    .where(eq(crmAlerts.estado, estado))
    .orderBy(
      sql`case ${crmAlerts.severidad} when 'alta' then 0 when 'media' then 1 else 2 end`,
      sql`${crmAlerts.generadaEn} desc`,
    )
    .limit(100);
}

export async function cambiarEstadoAlerta(
  id: number,
  estado: "atendida" | "descartada",
): Promise<void> {
  await db
    .update(crmAlerts)
    .set({ estado, resueltaEn: new Date() })
    .where(eq(crmAlerts.id, id));
}
