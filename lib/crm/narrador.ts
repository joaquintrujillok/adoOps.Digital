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

import OpenAI from "openai";
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
 * Redacta un párrafo a partir de un resumen ya calculado.
 *
 * `respaldo` es lo que se muestra si el modelo no está disponible: se pasa
 * siempre, no es opcional, para que ninguna pantalla pueda quedar sin texto por
 * un problema del proveedor.
 */
export async function narrar(
  resumen: Record<string, unknown>,
  contexto: string,
  respaldo: string,
): Promise<Narracion> {
  if (!(await leerBooleano(CLAVES.narradorIa))) {
    return { texto: respaldo, origen: "plantilla" };
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
    return { texto, origen: "ia" };
  } catch (error) {
    // Un modelo caído no puede tumbar un reporte. Se registra y se sigue.
    console.error("[crm/narrador]", error);
    return { texto: respaldo, origen: "plantilla" };
  }
}

export function narradorDisponible(): boolean {
  return usandoZai() || !!process.env.OPENAI_API_KEY;
}
