// Creación de tablas y sembrado del demo de Dashboard360.
//
// **Por qué esto vive acá y no en un script de `scripts/`.** La cadena de
// conexión de Neon está guardada como variable cifrada en Vercel, y Vercel las
// entrega en un solo sentido: se escriben, no se leen. Desde una máquina que no
// tenga el `.env.local` original no hay forma de correr un script contra la
// base. El runtime desplegado, en cambio, sí la tiene. Poner la lógica acá
// permite dispararla desde el propio despliegue con un endpoint protegido.
//
// Efecto secundario bienvenido: sembrar el demo de nuevo antes de una reunión
// es una llamada HTTP, no una sesión de terminal con credenciales a mano.
//
// Todo es **aditivo e idempotente**: `CREATE TABLE IF NOT EXISTS` sobre nombres
// con prefijo `d360_`. Nada de lo que ya vive en la base —la web corporativa,
// TV Mix, el CRM— se toca.

import { randomBytes, scryptSync } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Leads, d360Metricas, d360Users } from "@/db/dashboard360";

// ─── DDL ─────────────────────────────────────────────────────────────────────

const SENTENCIAS = [
  `CREATE TABLE IF NOT EXISTS d360_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(254),
    password_hash TEXT NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'analista',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_ingreso TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS d360_users_username_idx ON d360_users (username)`,
  `CREATE TABLE IF NOT EXISTS d360_fuentes (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(40) NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    cuenta VARCHAR(120),
    ultima_sync TIMESTAMP,
    frecuencia_min INTEGER NOT NULL DEFAULT 1440,
    ultimo_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS d360_fuentes_slug_idx ON d360_fuentes (slug)`,
  `CREATE TABLE IF NOT EXISTS d360_metricas_diarias (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(10) NOT NULL,
    fuente_slug VARCHAR(40) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    campania VARCHAR(160) NOT NULL,
    impresiones INTEGER,
    clics INTEGER,
    costo_clp INTEGER,
    envios INTEGER,
    aperturas INTEGER,
    interacciones INTEGER,
    seguidores_nuevos INTEGER,
    leads INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS d360_metricas_fecha_idx ON d360_metricas_diarias (fecha)`,
  `CREATE INDEX IF NOT EXISTS d360_metricas_fuente_idx ON d360_metricas_diarias (fuente_slug)`,
  `CREATE TABLE IF NOT EXISTS d360_leads (
    id SERIAL PRIMARY KEY,
    fecha VARCHAR(10) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    empresa VARCHAR(120),
    email VARCHAR(254),
    fuente_primer_toque VARCHAR(40) NOT NULL,
    fuente_ultimo_toque VARCHAR(40) NOT NULL,
    campania VARCHAR(160),
    estado VARCHAR(20) NOT NULL DEFAULT 'nuevo',
    valor_clp INTEGER,
    en_crm BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS d360_leads_fecha_idx ON d360_leads (fecha)`,
  `CREATE INDEX IF NOT EXISTS d360_leads_estado_idx ON d360_leads (estado)`,
  `CREATE TABLE IF NOT EXISTS d360_informes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(160) NOT NULL,
    desde VARCHAR(10) NOT NULL,
    hasta VARCHAR(10) NOT NULL,
    cuerpo_md TEXT NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
    autor_id INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS d360_informes_hasta_idx ON d360_informes (hasta)`,
];

export async function crearTablas(): Promise<number> {
  for (const s of SENTENCIAS) await db.execute(sql.raw(s));
  return SENTENCIAS.length;
}

// ─── Aleatorio con semilla ───────────────────────────────────────────────────
//
// Semilla fija: dos ejecuciones producen el mismo demo. Un demo que cambia
// entre el ensayo y la reunión no se puede ensayar.

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Catálogo del demo ───────────────────────────────────────────────────────

const FUENTES = [
  { slug: "google_ads", nombre: "Google Ads", tipo: "ads", estado: "conectada", cuenta: "adoOps Chile · 482-119-7730", frecuenciaMin: 1440, atrasoHoras: 6, error: null },
  { slug: "linkedin_ads", nombre: "LinkedIn Ads", tipo: "ads", estado: "conectada", cuenta: "adoOps · 508921166", frecuenciaMin: 1440, atrasoHoras: 9, error: null },
  { slug: "meta_ads", nombre: "Meta Ads", tipo: "ads", estado: "conectada", cuenta: "adoOps · act_771034922", frecuenciaMin: 1440, atrasoHoras: 14, error: null },
  { slug: "brevo", nombre: "Brevo · Email", tipo: "email", estado: "conectada", cuenta: "marketing@adoops.ai", frecuenciaMin: 720, atrasoHoras: 4, error: null },
  {
    slug: "linkedin_pages", nombre: "LinkedIn · Página", tipo: "social", estado: "error",
    cuenta: "adoOps", frecuenciaMin: 1440, atrasoHoras: 74,
    // Un error real y no un «algo salió mal»: es lo que de verdad pasa cuando
    // LinkedIn apaga una versión, y en la reunión demuestra que el monitoreo
    // de la pantalla de fuentes sirve para algo.
    error: "401 · el token de la Advertising API expiró tras la rotación de versión 202508. Requiere reautorizar.",
  },
  { slug: "ga4", nombre: "Google Analytics 4", tipo: "web", estado: "conectada", cuenta: "adoops.digital · 402118896", frecuenciaMin: 360, atrasoHoras: 2, error: null },
  { slug: "crm", nombre: "CRM comercial", tipo: "crm", estado: "pendiente", cuenta: null, frecuenciaMin: 1440, atrasoHoras: null, error: null },
];

// `costoBase` es el gasto diario típico en pesos y `leadsBase` los leads que la
// plataforma se atribuye por día. `crece` es cuánto sube el gasto entre el
// primer y el último día: es lo que le da al informe una historia que contar.
const CAMPANIAS = [
  { slug: "google_ads", nombre: "Búsqueda · Automatización de procesos", costoBase: 92_000, leadsBase: 2.1, ctr: 0.041, crece: 1.18 },
  { slug: "google_ads", nombre: "Búsqueda · Consultoría RPA", costoBase: 58_000, leadsBase: 1.4, ctr: 0.038, crece: 1.22 },
  { slug: "google_ads", nombre: "Display · Remarketing sitio", costoBase: 31_000, leadsBase: 0.5, ctr: 0.006, crece: 1.05 },
  { slug: "linkedin_ads", nombre: "ABM · Gerencias de operaciones", costoBase: 84_000, leadsBase: 1.1, ctr: 0.0072, crece: 1.35 },
  { slug: "linkedin_ads", nombre: "Lead Gen Form · Guía de adopción", costoBase: 47_000, leadsBase: 1.0, ctr: 0.0091, crece: 1.28 },
  // Sin un solo lead en el período: el hallazgo que el informe levanta
  { slug: "linkedin_ads", nombre: "Awareness · Video institucional", costoBase: 26_000, leadsBase: 0, ctr: 0.0044, crece: 1.6 },
  { slug: "meta_ads", nombre: "Advantage+ · Prospección fría", costoBase: 41_000, leadsBase: 2.4, ctr: 0.014, crece: 1.1 },
  { slug: "meta_ads", nombre: "Retargeting · Visitantes 30d", costoBase: 22_000, leadsBase: 1.2, ctr: 0.019, crece: 1.02 },
  { slug: "meta_ads", nombre: "Reconocimiento · Reel de marca", costoBase: 14_000, leadsBase: 0, ctr: 0.009, crece: 1.4 },
];

/** Los leads bajan un poco mientras el gasto sube. Sin esto el informe diría
 *  «todo bien» y no habría nada que discutir en la reunión. */
const CAIDA_LEADS = 0.88;

const NOMBRES = [
  "Camila Rojas", "Matías Fuentes", "Javiera Soto", "Ignacio Bravo", "Fernanda Díaz",
  "Sebastián Muñoz", "Antonia Vergara", "Cristóbal Herrera", "Valentina Pinto", "Diego Salazar",
  "Constanza Riquelme", "Felipe Navarro", "Isidora Cáceres", "Tomás Aguilera", "Martina Poblete",
  "Nicolás Cortés", "Catalina Espinoza", "Benjamín Tapia", "Josefa Contreras", "Vicente Lagos",
];
const EMPRESAS = [
  "Andes Logística", "Vitalmed", "Corporación Aurora", "Redlink SpA", "Grupo Maipo",
  "Tecnofrío", "Constructora Sur", "Bioquímica Austral", "Cencomex", "Puerto Digital",
  "Aseguradora Elqui", "Metalúrgica Loa", "Clínica del Valle", "Retail Norte", "AgroPacífico",
];

export function hashPassword(plano: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(plano, sal, 64);
  return `scrypt$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

// ─── Sembrado ────────────────────────────────────────────────────────────────

export interface ResultadoSeed {
  fuentes: number;
  metricas: number;
  leads: number;
  atribucionesPlataforma: number;
  usuario: string;
  desde: string;
  hasta: string;
}

const DIAS = 60; // 30 visibles + 30 de comparación

export async function sembrarDemo(opciones: {
  usuario: string;
  clave: string;
  limpiar?: boolean;
}): Promise<ResultadoSeed> {
  const rnd = mulberry32(20260824);
  const ruido = (amp: number) => 1 + (rnd() * 2 - 1) * amp;
  const entero = (n: number) => Math.max(0, Math.round(n));

  if (opciones.limpiar) {
    // Solo tablas d360_. Nunca un DELETE sobre algo que no sea del módulo.
    await db.execute(sql.raw("DELETE FROM d360_metricas_diarias"));
    await db.execute(sql.raw("DELETE FROM d360_leads"));
    await db.execute(sql.raw("DELETE FROM d360_informes"));
    await db.execute(sql.raw("DELETE FROM d360_fuentes"));
  }

  // Un día de rezago: las plataformas reportan con retraso y un demo que
  // muestra el día de hoy a medias se ve roto.
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  hoy.setUTCDate(hoy.getUTCDate() - 1);

  const fechas = Array.from({ length: DIAS }, (_, i) => {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() - (DIAS - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  // Fuentes
  for (const f of FUENTES) {
    const ultima = f.atrasoHoras === null ? null : new Date(Date.now() - f.atrasoHoras * 3_600_000);
    await db
      .insert(d360Fuentes)
      .values({
        slug: f.slug,
        nombre: f.nombre,
        tipo: f.tipo as never,
        estado: f.estado as never,
        cuenta: f.cuenta,
        ultimaSync: ultima,
        frecuenciaMin: f.frecuenciaMin,
        ultimoError: f.error,
      })
      .onConflictDoUpdate({
        target: d360Fuentes.slug,
        set: {
          nombre: f.nombre,
          estado: f.estado as never,
          cuenta: f.cuenta,
          ultimaSync: ultima,
          ultimoError: f.error,
        },
      });
  }

  // Métricas diarias
  const filas: (typeof d360Metricas.$inferInsert)[] = [];
  for (let i = 0; i < DIAS; i++) {
    const fecha = fechas[i];
    const t = i / (DIAS - 1);
    const dow = new Date(`${fecha}T00:00:00Z`).getUTCDay();
    // En B2B la actividad de fin de semana cae de verdad; una línea plana se
    // ve sintética.
    const finde = dow === 0 || dow === 6 ? 0.55 : 1;
    const reciente = i >= DIAS - 30;

    for (const c of CAMPANIAS) {
      const costo = entero(c.costoBase * (1 + (c.crece - 1) * t) * finde * ruido(0.16));
      const impresiones = entero((costo / (c.ctr * 900)) * ruido(0.12));
      filas.push({
        fecha,
        fuenteSlug: c.slug,
        tipo: "ads",
        campania: c.nombre,
        impresiones,
        clics: entero(impresiones * c.ctr * ruido(0.1)),
        costoClp: costo,
        leads: entero(c.leadsBase * finde * (reciente ? CAIDA_LEADS : 1) * ruido(0.55)),
      });
    }

    if (dow === 2 || dow === 4) {
      const envios = entero(2400 * ruido(0.08));
      filas.push({
        fecha,
        fuenteSlug: "brevo",
        tipo: "email",
        campania: "Newsletter quincenal · adopción",
        clics: entero(envios * 0.031 * ruido(0.2)),
        envios,
        aperturas: entero(envios * 0.284 * ruido(0.1)),
        leads: entero(1.6 * ruido(0.7)),
      });
    }

    // Se corta hace tres días, coherente con el token vencido de la fuente.
    if (i < DIAS - 3) {
      filas.push({
        fecha,
        fuenteSlug: "linkedin_pages",
        tipo: "social",
        campania: "Publicaciones de página",
        impresiones: entero(3100 * (1 + 0.4 * t) * finde * ruido(0.22)),
        clics: entero(88 * finde * ruido(0.25)),
        interacciones: entero(140 * finde * ruido(0.3)),
        seguidoresNuevos: entero(9 * finde * ruido(0.5)),
      });
    }
  }

  // Por lotes: Neon cobra latencia por viaje, y son ~700 filas.
  const LOTE = 200;
  for (let i = 0; i < filas.length; i += LOTE) {
    await db.insert(d360Metricas).values(filas.slice(i, i + LOTE));
  }

  // Leads deduplicados: ~1,36 atribuciones por persona, que es lo que se
  // observa cuando tres canales se cuelgan del mismo contacto.
  const atribuciones = filas.reduce((s, f) => s + (f.leads ?? 0), 0);
  const personas = Math.round(atribuciones / 1.36);
  const conLeads = CAMPANIAS.filter((c) => c.leadsBase > 0);

  const leads: (typeof d360Leads.$inferInsert)[] = [];
  for (let i = 0; i < personas; i++) {
    const idx = Math.min(Math.floor(Math.pow(rnd(), 0.85) * DIAS), DIAS - 1);
    const primero = conLeads[Math.floor(rnd() * conLeads.length)];
    const ultimo = rnd() < 0.72 ? primero : conLeads[Math.floor(rnd() * conLeads.length)];
    const r = rnd();
    const estado =
      r < 0.34 ? "nuevo" : r < 0.58 ? "contactado" : r < 0.78 ? "calificado" : r < 0.88 ? "oportunidad" : "descartado";

    leads.push({
      fecha: fechas[idx],
      nombre: NOMBRES[Math.floor(rnd() * NOMBRES.length)],
      empresa: EMPRESAS[Math.floor(rnd() * EMPRESAS.length)],
      fuentePrimerToque: primero.slug,
      fuenteUltimoToque: ultimo.slug,
      campania: primero.nombre,
      estado: estado as never,
      valorClp: estado === "oportunidad" ? entero((3_500_000 + rnd() * 22_000_000) / 100_000) * 100_000 : null,
      // Ni todos ni pocos: la brecha con el CRM es parte de lo que el informe
      // explica, y si fuera cero no habría nada que explicar.
      enCrm: rnd() < 0.72,
    });
  }
  for (let i = 0; i < leads.length; i += LOTE) {
    await db.insert(d360Leads).values(leads.slice(i, i + LOTE));
  }

  await db
    .insert(d360Users)
    .values({
      username: opciones.usuario,
      nombre: "Cuenta de demostración",
      email: "demo@adoops.ai",
      passwordHash: hashPassword(opciones.clave),
      rol: "gerente",
    })
    .onConflictDoUpdate({
      target: d360Users.username,
      set: { passwordHash: hashPassword(opciones.clave), rol: "gerente", activo: true },
    });

  return {
    fuentes: FUENTES.length,
    metricas: filas.length,
    leads: leads.length,
    atribucionesPlataforma: atribuciones,
    usuario: opciones.usuario,
    desde: fechas[0],
    hasta: fechas[DIAS - 1],
  };
}
