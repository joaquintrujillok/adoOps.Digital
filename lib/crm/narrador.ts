// El narrador — pone en palabras lo que las reglas ya calcularon.
//
// Reparto de trabajo, y es deliberado:
//   · las cifras las produce el motor determinístico (lib/crm/insights.ts)
//   · el modelo SOLO redacta el párrafo que las acompaña
//
// El modelo nunca ve la base ni inventa números: recibe un resumen ya cerrado y
// tiene prohibido agregar cifras que no estén en él. Un resumen ejecutivo con un
// número inventado destruye la confianza en todo el tablero, no solo en el
// párrafo.
//
// Si no hay API key, si el modelo demora o si falla, cae a un texto armado con
// plantillas sobre los mismos datos. La pantalla nunca queda esperando ni vacía.

import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { db } from "@/db";
import { crmNarraciones } from "@/db/crm";
import { CLAVES, leerBooleano } from "./settings";

const ZAI_BASE_URL =
  process.env.ZAI_BASE_URL || "https://api.z.ai/api/coding/paas/v4";
const usandoZai = () => !!process.env.ZAI_API_KEY;

function modelo(): string {
  if (process.env.CRM_NARRADOR_MODEL) return process.env.CRM_NARRADOR_MODEL;
  return usandoZai() ? "glm-5.2" : "gpt-4o-mini";
}

let _cliente: OpenAI | null = null;
function cliente(): OpenAI | null {
  if (_cliente) return _cliente;
  if (usandoZai()) {
    _cliente = new OpenAI({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: ZAI_BASE_URL,
      timeout: 25_000,
      maxRetries: 1,
    });
  } else if (process.env.OPENAI_API_KEY) {
    _cliente = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25_000,
      maxRetries: 1,
    });
  }
  return _cliente;
}

export interface Narracion {
  texto: string;
  /** De dónde salió el texto. Se muestra en pantalla: el cliente tiene derecho
   *  a saber cuándo lo escribió un modelo y cuándo una plantilla. */
  origen: "ia" | "plantilla";
}

const SISTEMA = `Eres el analista comercial de un CRM chileno.
Recibes un resumen de cifras YA CALCULADAS y escribes un párrafo ejecutivo en español de Chile.

Reglas estrictas:
- No inventes ninguna cifra. Usa solo los números del resumen, tal como vienen.
- No afirmes causas que las cifras no demuestren. Si propones una explicación, márcala como hipótesis ("probablemente", "puede explicarse por").
- No uses "vos" ni modismos argentinos. Trata de "tú" si te diriges a alguien.
- Máximo 4 frases. Directo, sin relleno ni saludos.
- Estructura: qué pasó, por qué está pasando y qué conviene hacer primero.
- Nada de listas ni viñetas: un solo párrafo corrido.`;

/**
 * Huella de las cifras que produjeron un texto.
 *
 * Las claves se ordenan antes de serializar: el mismo resumen tiene que dar la
 * misma huella aunque el objeto se arme en otro orden, o el caché no acertaría
 * nunca.
 */
function huellaDe(resumen: Record<string, unknown>): string {
  const ordenado = Object.keys(resumen)
    .sort()
    .map((k) => [k, resumen[k]]);
  return createHash("sha256").update(JSON.stringify(ordenado)).digest("hex");
}

/** Cuánto vale un texto guardado aunque las cifras no hayan cambiado. */
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

/**
 * Redacta un párrafo a partir de un resumen ya calculado.
 *
 * **Primero busca en el caché.** Medido en producción: la llamada al modelo
 * tarda entre 6 y 14 segundos y es el 95% del tiempo de carga de la pantalla,
 * mientras que todas las consultas a la base juntas tardan 430 ms. Sin caché,
 * cada visita paga esa espera —y consume un prompt del plan— para volver a
 * escribir el mismo párrafo sobre las mismas cifras.
 *
 * El texto se reusa mientras la huella de las cifras coincida y no hayan pasado
 * 24 horas. Cambia un número, cambia la huella, se vuelve a redactar.
 *
 * `respaldo` es lo que se muestra si el modelo no está disponible: se pasa
 * siempre, no es opcional, para que ninguna pantalla pueda quedar sin texto por
 * un problema del proveedor.
 */
export async function narrar(
  resumen: Record<string, unknown>,
  contexto: string,
  respaldo: string,
  /** Identifica la pantalla en el caché. Sin esto no se guarda nada. */
  clave?: string,
): Promise<Narracion> {
  if (!(await leerBooleano(CLAVES.narradorIa))) {
    return { texto: respaldo, origen: "plantilla" };
  }

  const huella = huellaDe(resumen);

  if (clave) {
    const guardada = await leerCache(clave, huella);
    if (guardada) return guardada;
  }

  const c = cliente();
  if (!c) return { texto: respaldo, origen: "plantilla" };

  try {
    const respuesta = await c.chat.completions.create({
      model: modelo(),
      messages: [
        { role: "system", content: SISTEMA },
        {
          role: "user",
          content: `Contexto: ${contexto}\n\nCifras:\n${JSON.stringify(resumen, null, 2)}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 320,
      ...(usandoZai() ? { thinking: { type: "disabled" } } : {}),
    } as Parameters<typeof c.chat.completions.create>[0]);

    const texto = (respuesta as { choices?: { message?: { content?: string } }[] })
      .choices?.[0]?.message?.content?.trim();

    if (!texto) return { texto: respaldo, origen: "plantilla" };

    if (clave) await guardarCache(clave, huella, texto);
    return { texto, origen: "ia" };
  } catch (error) {
    // Un modelo caído no puede tumbar un reporte. Se registra y se sigue.
    console.error("[crm/narrador]", error);
    return { texto: respaldo, origen: "plantilla" };
  }
}

// ─── Caché ───────────────────────────────────────────────────────────────────

async function leerCache(clave: string, huella: string): Promise<Narracion | null> {
  try {
    const [fila] = await db
      .select()
      .from(crmNarraciones)
      .where(eq(crmNarraciones.clave, clave))
      .limit(1);

    if (!fila || fila.huella !== huella) return null;
    if (Date.now() - new Date(fila.generadaEn).getTime() > VIGENCIA_MS) return null;

    return { texto: fila.texto, origen: "ia" };
  } catch (error) {
    // Un caché que falla no puede romper la pantalla: se sigue de largo y, como
    // mucho, se paga la llamada al modelo.
    console.error("[crm/narrador] cache", error);
    return null;
  }
}

async function guardarCache(clave: string, huella: string, texto: string): Promise<void> {
  try {
    await db
      .insert(crmNarraciones)
      .values({ clave, huella, texto, origen: "ia" })
      .onConflictDoUpdate({
        target: crmNarraciones.clave,
        set: { huella, texto, origen: "ia", generadaEn: new Date() },
      });
  } catch (error) {
    console.error("[crm/narrador] cache", error);
  }
}

export function narradorDisponible(): boolean {
  return usandoZai() || !!process.env.OPENAI_API_KEY;
}
