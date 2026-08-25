// Señales de compra: el hecho verificable que justifica el primer contacto.
//
// ── Por qué se cargan a mano por ahora ───────────────────────────────────────
//
// La API de Mercado Público todavía no está disponible (falta el ticket). Eso
// no bloquea el motor: la propia especificación del MVP dice que si hay que
// recortar algo, se recorta la ingesta automática y las señales se cargan a mano
// por un mes. Automatizar la fuente antes de saber si el motor convierte es
// construir una cañería hacia un estanque del que no sabemos si tiene fondo.
//
// Cuando llegue el ticket, `registrarSenal()` es la función que va a llamar el
// cron de ChileCompra. La pantalla de alta manual se queda igual: sirve para las
// señales que ninguna API va a traer —una nota de prensa, un cambio de gerencia,
// algo que alguien vio en LinkedIn—.
//
// ── La invariante que no se negocia ──────────────────────────────────────────
//
// `venceEn` es obligatorio. Una señal de hace ocho meses no es una señal: es
// ruido con fecha. Un panel que solo crece es otra bandeja que nadie mira.

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { LeadOrigen } from "@/db/leads";

export interface TipoSenal {
  id: string;
  nombre: string;
  /** Cuántos días vale el hecho. Sale del estudio de factibilidad. */
  ventanaDias: number;
  /** Cómo se lee en el mensaje. Es lo que termina en `{{senal}}`. */
  ejemplo: string;
  fuente: string;
}

export const TIPOS_SENAL: TipoSenal[] = [
  {
    id: "adjudicacion",
    nombre: "Se adjudicó una licitación",
    ventanaDias: 30,
    ejemplo: "se adjudicó la licitación 1057-42-LR26 por $184 millones",
    fuente: "ChileCompra",
  },
  {
    id: "licitacion_publicada",
    nombre: "Publicó una licitación",
    ventanaDias: 15,
    ejemplo: "publicó una licitación de servicios de marketing digital",
    fuente: "ChileCompra",
  },
  {
    id: "empresa_nueva",
    nombre: "Empresa constituida hace poco",
    ventanaDias: 90,
    ejemplo: "se constituyó en julio",
    fuente: "Registro de Empresas y Sociedades",
  },
  {
    id: "cambio_tramo",
    nombre: "Cambió de tramo de ventas",
    ventanaDias: 180,
    ejemplo: "pasó al tramo de ventas 9 en el último año comercial",
    fuente: "SII",
  },
  {
    id: "cambio_domicilio",
    nombre: "Abrió sucursal o cambió domicilio",
    ventanaDias: 180,
    ejemplo: "abrió una sucursal en Concepción",
    fuente: "SII · direcciones históricas",
  },
  {
    id: "otra",
    nombre: "Otra, verificable",
    ventanaDias: 45,
    ejemplo: "anunció la apertura de su operación en Perú",
    fuente: "manual · exige URL",
  },
];

export function tipoSenal(id: string): TipoSenal | undefined {
  return TIPOS_SENAL.find((t) => t.id === id);
}

export interface NuevaSenal {
  empresaId: number;
  tipo: string;
  resumen: string;
  evidenciaUrl: string | null;
  fechaHecho: Date;
  origen: LeadOrigen;
}

/**
 * Registra una señal y calcula su vencimiento desde la FECHA DEL HECHO, no
 * desde hoy.
 *
 * La distinción importa: una adjudicación de hace 25 días ya casi no sirve, y si
 * la ventana se contara desde la carga, el sistema la trataría como fresca por
 * 30 días más. `fecha_hecho` es cuándo ocurrió; `obtenido_en` es cuándo lo
 * supimos nosotros. Son dos columnas distintas por esto.
 */
export async function registrarSenal(s: NuevaSenal): Promise<{ id: number; venceEn: Date }> {
  const t = tipoSenal(s.tipo);
  const dias = t?.ventanaDias ?? 30;
  const venceEn = new Date(s.fechaHecho.getTime() + dias * 86_400_000);

  const r = await db.execute<{ id: number }>(sql`
    INSERT INTO lead_senales
      (empresa_id, tipo, resumen, evidencia_url, fecha_hecho, vence_en, estado, origen)
    VALUES (${s.empresaId}, ${s.tipo}, ${s.resumen}, ${s.evidenciaUrl},
            ${s.fechaHecho}, ${venceEn},
            ${venceEn > new Date() ? "vigente" : "vencida"}, ${s.origen})
    RETURNING id
  `);

  return { id: r.rows[0].id, venceEn };
}

export interface SenalEnLista {
  id: number;
  empresaId: number;
  empresa: string;
  rut: string | null;
  tipo: string;
  resumen: string;
  evidenciaUrl: string | null;
  fechaHecho: Date;
  venceEn: Date;
  estado: string;
  origen: string;
  personas: number;
  inscritas: number;
}

/**
 * Las señales, con cuántas personas de esa empresa hay en la base y cuántas ya
 * están inscritas.
 *
 * Las dos cifras juntas son lo accionable: una señal con 3 contactos y 0
 * inscritos es trabajo pendiente; con 0 contactos es una empresa que hay que
 * enriquecer antes de que la señal venza.
 */
export async function listarSenales(soloVigentes = false): Promise<SenalEnLista[]> {
  const r = await db.execute<{
    id: number;
    empresa_id: number;
    razon_social: string;
    rut: string | null;
    tipo: string;
    resumen: string;
    evidencia_url: string | null;
    fecha_hecho: string;
    vence_en: string;
    estado: string;
    origen: string;
    personas: number;
    inscritas: number;
  }>(sql`
    SELECT s.id, s.empresa_id, e.razon_social, e.rut, s.tipo, s.resumen,
           s.evidencia_url, s.fecha_hecho, s.vence_en, s.estado, s.origen,
           COALESCE(p.n, 0)::int AS personas,
           COALESCE(i.n, 0)::int AS inscritas
      FROM lead_senales s
      JOIN lead_empresas e ON e.id = s.empresa_id
      LEFT JOIN (
        SELECT empresa_id, count(*)::int AS n FROM lead_personas
         WHERE suprimido_en IS NULL GROUP BY empresa_id
      ) p ON p.empresa_id = s.empresa_id
      LEFT JOIN (
        SELECT pe.empresa_id, count(*)::int AS n
          FROM lead_inscripciones ins
          JOIN lead_personas pe ON pe.id = ins.persona_id
         GROUP BY pe.empresa_id
      ) i ON i.empresa_id = s.empresa_id
     ${soloVigentes ? sql`WHERE s.estado = 'vigente' AND s.vence_en > NOW()` : sql``}
     ORDER BY s.vence_en DESC
     LIMIT 200
  `);

  return r.rows.map((f) => ({
    id: f.id,
    empresaId: f.empresa_id,
    empresa: f.razon_social,
    rut: f.rut,
    tipo: f.tipo,
    resumen: f.resumen,
    evidenciaUrl: f.evidencia_url,
    fechaHecho: new Date(f.fecha_hecho),
    venceEn: new Date(f.vence_en),
    estado: f.estado,
    origen: f.origen,
    personas: f.personas,
    inscritas: f.inscritas,
  }));
}

/**
 * Marca como vencidas las señales cuya ventana ya pasó.
 *
 * No es indispensable para el motor —la cola descarta por `vence_en > NOW()` al
 * leer, igual que el CRM de CDC descarta por fecha en `alertasPendientes`— pero
 * sí para que la pantalla no muestre como "vigentes" cosas que no lo son.
 */
export async function vencerSenales(): Promise<number> {
  const r = await db.execute(sql`
    UPDATE lead_senales
       SET estado = 'vencida'
     WHERE estado = 'vigente' AND vence_en <= NOW()
  `);
  return r.rowCount ?? 0;
}

/** Empresas que calzan con lo tecleado, para el buscador del formulario. */
export async function buscarEmpresas(q: string, limite = 12) {
  if (!q.trim()) return [];
  const patron = `%${q.trim()}%`;
  const r = await db.execute<{
    id: number;
    razon_social: string;
    rut: string | null;
    personas: number;
  }>(sql`
    SELECT e.id, e.razon_social, e.rut,
           (SELECT count(*)::int FROM lead_personas p WHERE p.empresa_id = e.id) AS personas
      FROM lead_empresas e
     WHERE e.razon_social ILIKE ${patron} OR e.rut ILIKE ${patron}
     ORDER BY e.razon_social
     LIMIT ${limite}
  `);
  return r.rows.map((f) => ({
    id: f.id,
    razonSocial: f.razon_social,
    rut: f.rut,
    personas: f.personas,
  }));
}
