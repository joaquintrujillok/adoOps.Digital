// Configuración operativa en BD — lo que el cliente puede cambiar sin llamar a
// nadie. Es la mitad técnica del "prefiero que me enseñen a pescar": todo lo que
// vive acá se edita desde /crm/configuracion.
//
// Clave-valor en vez de columnas: agregar un interruptor nuevo no exige una
// migración ni un deploy de esquema.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crmSettings } from "@/db/crm";

export const CLAVES = {
  /** Modo simulado de WhatsApp: los envíos se registran pero no salen a la red. */
  waSimulado: "whatsapp.simulado",
  /** Corte general del envío. Apagado = nada sale, ni simulado ni real. */
  waHabilitado: "whatsapp.envio_habilitado",
  /** Pesos del scoring, JSON. Ver lib/crm/scoring.ts. */
  scoringPesos: "scoring.pesos",
  /** Umbrales del motor de alertas, JSON. Ver lib/crm/insights.ts. */
  alertasUmbrales: "alertas.umbrales",
  /** Deja que el LLM redacte los resúmenes ejecutivos. */
  narradorIa: "insights.narrador_ia",
  /** Nombre de la empresa que usa el CRM (encabezados y plantillas). */
  empresa: "general.empresa",
} as const;

const DEFAULTS: Record<string, string> = {
  [CLAVES.waSimulado]: "true",
  [CLAVES.waHabilitado]: "true",
  [CLAVES.narradorIa]: "true",
  [CLAVES.empresa]: "Demo adoOps",
};

export async function leer(clave: string): Promise<string | null> {
  const [fila] = await db
    .select()
    .from(crmSettings)
    .where(eq(crmSettings.clave, clave))
    .limit(1);
  return fila?.valor ?? DEFAULTS[clave] ?? null;
}

export async function leerBooleano(clave: string): Promise<boolean> {
  return (await leer(clave)) === "true";
}

export async function leerJson<T>(clave: string, porDefecto: T): Promise<T> {
  const crudo = await leer(clave);
  if (!crudo) return porDefecto;
  try {
    return JSON.parse(crudo) as T;
  } catch {
    // Un JSON corrupto no debe tumbar la pantalla: se cae al valor por defecto
    // y el usuario lo ve mal configurado, no roto.
    return porDefecto;
  }
}

export async function escribir(clave: string, valor: string): Promise<void> {
  await db
    .insert(crmSettings)
    .values({ clave, valor })
    .onConflictDoUpdate({
      target: crmSettings.clave,
      set: { valor, updatedAt: new Date() },
    });
}

/** Todas las claves de una, para la pantalla de configuración. */
export async function leerTodo(): Promise<Record<string, string>> {
  const filas = await db.select().from(crmSettings);
  const mapa: Record<string, string> = { ...DEFAULTS };
  for (const f of filas) mapa[f.clave] = f.valor;
  return mapa;
}
