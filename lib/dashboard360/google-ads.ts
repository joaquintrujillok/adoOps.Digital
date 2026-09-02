// Ingesta de Google Ads hacia `d360_metricas_diarias`.
//
// Un cliente directo de la API en vez de Airbyte, y es deliberado: levantar una
// instancia self-hosted para un solo conector es una máquina que mantener a
// cambio de nada. Airbyte se justifica de cuatro o cinco fuentes en adelante.
//
// Todo lo de acá está verificado contra la API real, no deducido de la
// documentación:
//
//   · **La versión que responde es `v22`.** `v21` devuelve 404.
//   · **No se envía `login-customer-id`.** El acceso es de usuario directo: el
//     anunciante concede «Solo lectura» a nuestra cuenta desde su propia cuenta.
//     Mandar el MCC en esa cabecera cuando el MCC no administra la cuenta
//     produce `USER_PERMISSION_DENIED`, que despista porque parece un problema
//     de credenciales y es de topología.
//   · Mientras el developer token esté en nivel de prueba, la consulta responde
//     `DEVELOPER_TOKEN_NOT_APPROVED`. No es un error de configuración: es el
//     acceso básico pendiente de aprobación.

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Metricas } from "@/db/dashboard360";

const API = "https://googleads.googleapis.com/v22";
const SLUG = "google_ads";

/** Cuántos días se releen en cada corrida. */
const VENTANA_DIAS = 30;

interface Config {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  customerId: string;
  /** Solo cuando el acceso pasa por una cuenta de administrador. */
  loginCustomerId?: string;
}

function leerConfig(): Config {
  const req = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`Falta la variable de entorno ${k}`);
    return v;
  };
  return {
    clientId: req("GOOGLE_ADS_CLIENT_ID"),
    clientSecret: req("GOOGLE_ADS_CLIENT_SECRET"),
    refreshToken: req("GOOGLE_ADS_REFRESH_TOKEN"),
    developerToken: req("GOOGLE_ADS_DEVELOPER_TOKEN"),
    // Sin guiones: la API los rechaza.
    customerId: req("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, ""),
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, "") || undefined,
  };
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

async function accessToken(c: Config): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const d = (await r.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!d.access_token) {
    // `invalid_grant` acá casi siempre significa una de dos: el token fue
    // revocado, o la app OAuth quedó en estado «Testing», donde Google caduca
    // los refresh tokens a los siete días.
    throw new Error(`No se pudo refrescar el access token: ${d.error ?? "sin código"} · ${d.error_description ?? ""}`);
  }
  return d.access_token;
}

// ─── Consulta ────────────────────────────────────────────────────────────────

const GAQL = `
SELECT segments.date, campaign.id, campaign.name,
       metrics.impressions, metrics.clicks,
       metrics.cost_micros, metrics.conversions,
       metrics.search_impression_share,
       metrics.search_budget_lost_impression_share,
       metrics.search_rank_lost_impression_share
FROM campaign
WHERE segments.date DURING LAST_30_DAYS`;

/**
 * Qué acciones de conversión tiene configuradas la cuenta.
 *
 * No es una métrica: es un diagnóstico. Cuando los leads salen en cero, esto
 * distingue «el cliente no mide conversiones» de «mide y no está registrando»,
 * que son dos conversaciones completamente distintas y hoy se confunden mirando
 * la misma pantalla vacía.
 */
const GAQL_CONVERSIONES = `
SELECT conversion_action.name, conversion_action.status,
       conversion_action.type
FROM conversion_action
WHERE conversion_action.status = 'ENABLED'`;

interface FilaGoogle {
  segments?: { date?: string };
  campaign?: { id?: string; name?: string };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    costMicros?: string | number;
    conversions?: number;
    /** Decimales entre 0 y 1. Se guardan en puntos base. */
    searchImpressionShare?: number;
    searchBudgetLostImpressionShare?: number;
    searchRankLostImpressionShare?: number;
  };
}

/** 0,3456 → 3456 puntos base. `null` cuando Google no reporta el dato. */
function puntosBase(v: number | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10_000) : null;
}

/** Los enteros grandes vienen como string en JSON. */
const num = (v: string | number | undefined): number => (v == null ? 0 : Number(v));

function cabeceras(c: Config, token: string): Record<string, string> {
  const h: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "developer-token": c.developerToken,
    "content-type": "application/json",
  };
  if (c.loginCustomerId) h["login-customer-id"] = c.loginCustomerId;
  return h;
}

/**
 * Resume las acciones de conversión activas en una línea legible.
 *
 * Nunca lanza: es un diagnóstico opcional, y que falle no debe tumbar una
 * ingesta de métricas que sí funcionó.
 */
export async function diagnosticoConversiones(c: Config, token: string): Promise<string> {
  try {
    const r = await fetch(`${API}/customers/${c.customerId}/googleAds:searchStream`, {
      method: "POST",
      headers: cabeceras(c, token),
      body: JSON.stringify({ query: GAQL_CONVERSIONES.trim() }),
    });
    if (!r.ok) return `No se pudo leer las acciones de conversión (HTTP ${r.status})`;

    const bloques = (await r.json()) as { results?: { conversionAction?: { name?: string } }[] }[];
    const nombres = bloques
      .flatMap((b) => b.results ?? [])
      .map((f) => f.conversionAction?.name)
      .filter((n): n is string => !!n);

    if (!nombres.length) {
      return "La cuenta no tiene acciones de conversión activas. Sin eso no hay leads que medir y el costo por lead no se puede calcular: es una falla de medición del anunciante, no del tablero.";
    }
    return `${nombres.length} acción(es) de conversión activas: ${nombres.slice(0, 6).join(", ")}`;
  } catch {
    return "No se pudo leer las acciones de conversión";
  }
}

export async function consultarGoogleAds(c: Config, token: string): Promise<FilaGoogle[]> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "developer-token": c.developerToken,
    "content-type": "application/json",
  };
  if (c.loginCustomerId) headers["login-customer-id"] = c.loginCustomerId;

  const r = await fetch(`${API}/customers/${c.customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: GAQL.trim() }),
  });

  const texto = await r.text();
  if (!r.ok) {
    // El mensaje de Google se propaga tal cual: distinguir
    // DEVELOPER_TOKEN_NOT_APPROVED de USER_PERMISSION_DENIED es la mitad del
    // diagnóstico, y un «error interno» genérico obliga a ir a buscar los logs.
    throw new Error(`Google Ads respondió ${r.status}: ${texto.slice(0, 600)}`);
  }

  // searchStream devuelve un arreglo de bloques, cada uno con sus `results`.
  const bloques = JSON.parse(texto) as { results?: FilaGoogle[] }[];
  return bloques.flatMap((b) => b.results ?? []);
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export interface ResultadoIngesta {
  fuente: string;
  desde: string;
  hasta: string;
  filasLeidas: number;
  filasEscritas: number;
  inversionClp: number;
  nota: string;
}

export async function ingestarGoogleAds(): Promise<ResultadoIngesta> {
  const c = leerConfig();
  const token = await accessToken(c);
  const crudas = await consultarGoogleAds(c, token);
  const nota = await diagnosticoConversiones(c, token);

  const filas = crudas
    .filter((f) => f.segments?.date && f.campaign?.name)
    .map((f) => ({
      fecha: f.segments!.date!,
      fuenteSlug: SLUG,
      tipo: "ads" as const,
      campania: f.campaign!.name!,
      impresiones: num(f.metrics?.impressions),
      clics: num(f.metrics?.clicks),
      // cost_micros viene en millonésimas de la moneda de la cuenta. Sin esta
      // división el tablero muestra la inversión multiplicada por un millón, que
      // es el error clásico de esta integración.
      costoClp: Math.round(num(f.metrics?.costMicros) / 1_000_000),
      // `conversions` es decimal: Google reparte conversiones fraccionadas entre
      // campañas. Se redondea al guardar, y por eso la suma de campañas puede
      // diferir en una unidad del total que muestra la interfaz de Google Ads.
      leads: Math.round(f.metrics?.conversions ?? 0),
      cuotaImpresiones: puntosBase(f.metrics?.searchImpressionShare),
      cuotaPerdidaPresupuesto: puntosBase(f.metrics?.searchBudgetLostImpressionShare),
      cuotaPerdidaRanking: puntosBase(f.metrics?.searchRankLostImpressionShare),
    }));

  const fechas = filas.map((f) => f.fecha).sort();
  const desde = fechas[0] ?? "";
  const hasta = fechas[fechas.length - 1] ?? "";

  if (filas.length) {
    // Borrar y reinsertar la ventana completa en vez de insertar solo lo nuevo.
    // Google reexpresa métricas de días ya cerrados —conversiones que entran
    // tarde, clics invalidados— y un `INSERT` incremental deja congelada la
    // primera versión de cada día. Releer treinta días cuesta una consulta.
    await db
      .delete(d360Metricas)
      .where(
        and(
          eq(d360Metricas.fuenteSlug, SLUG),
          gte(d360Metricas.fecha, desde),
          lte(d360Metricas.fecha, hasta),
        ),
      );

    const LOTE = 200;
    for (let i = 0; i < filas.length; i += LOTE) {
      await db.insert(d360Metricas).values(filas.slice(i, i + LOTE));
    }
  }

  await db
    .insert(d360Fuentes)
    .values({
      slug: SLUG,
      nombre: "Google Ads",
      tipo: "ads",
      estado: "conectada",
      cuenta: c.customerId,
      ultimaSync: new Date(),
      frecuenciaMin: 1440,
      ultimoError: null,
      nota,
    })
    .onConflictDoUpdate({
      target: d360Fuentes.slug,
      set: {
        estado: "conectada",
        cuenta: c.customerId,
        ultimaSync: new Date(),
        ultimoError: null,
        nota,
      },
    });

  return {
    fuente: SLUG,
    desde,
    hasta,
    filasLeidas: crudas.length,
    filasEscritas: filas.length,
    inversionClp: filas.reduce((s, f) => s + f.costoClp, 0),
    nota,
  };
}

/**
 * Deja constancia del fallo en la propia tabla de fuentes.
 *
 * Sin esto, una ingesta que se cae deja el tablero mostrando los datos de ayer
 * sin ninguna señal — que es exactamente la falla que la pantalla de fuentes
 * existe para evitar.
 */
export async function registrarFalloGoogleAds(mensaje: string): Promise<void> {
  await db
    .insert(d360Fuentes)
    .values({
      slug: SLUG,
      nombre: "Google Ads",
      tipo: "ads",
      estado: "error",
      frecuenciaMin: 1440,
      ultimoError: mensaje.slice(0, 500),
    })
    .onConflictDoUpdate({
      target: d360Fuentes.slug,
      set: { estado: "error", ultimoError: mensaje.slice(0, 500) },
    });
}

export { VENTANA_DIAS };
