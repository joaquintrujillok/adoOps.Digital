import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
// GLM tarda ~8-13s y a veces se cuelga; damos margen a la función y cortamos
// nosotros antes con el timeout del cliente para responder un error limpio.
export const maxDuration = 60;

// Proveedor: Z.AI (GLM, API OpenAI-compatible) si hay ZAI_API_KEY; si no, OpenAI.
// El default es el endpoint del GLM Coding Plan (suscripción); para pago por
// uso: ZAI_BASE_URL=https://api.z.ai/api/paas/v4
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || "https://api.z.ai/api/coding/paas/v4";
const usingZai = () => !!process.env.ZAI_API_KEY;

function suggestModel(): string {
  if (process.env.SUGGEST_MODEL) return process.env.SUGGEST_MODEL;
  if (usingZai()) return "glm-5.2";
  return process.env.EXTRACT_MODEL || "gpt-4o-mini";
}

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    if (usingZai()) {
      _client = new OpenAI({
        apiKey: process.env.ZAI_API_KEY,
        baseURL: ZAI_BASE_URL,
        // si GLM se cuelga, cortamos a los 40s con error en vez de esperar a
        // que Vercel mate la función (deja al cliente colgado en "Pensando…").
        timeout: 40_000,
        maxRetries: 1,
      });
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("sin API key para el asistente");
      _client = new OpenAI({ apiKey, timeout: 40_000, maxRetries: 1 });
    }
  }
  return _client;
}

export type MixSuggestion = { artista: string; tema: string; motivo: string };

const PARAMETERS = {
  type: "object" as const,
  properties: {
    sugerencias: {
      type: "array",
      description: "Entre 4 y 6 temas concretos que existan en YouTube",
      items: {
        type: "object",
        properties: {
          artista: { type: "string" },
          tema: { type: "string", description: "Nombre exacto del tema" },
          motivo: {
            type: "string",
            description: "Por qué calza con la vibra pedida y con lo que suena (breve)",
          },
        },
        required: ["artista", "tema", "motivo"],
      },
    },
  },
  required: ["sugerencias"],
};

function sanitizeTitles(input: unknown, max: number): string[] {
  return Array.isArray(input)
    ? input
        .filter((t): t is string => typeof t === "string" && !!t.trim())
        .map((t) => t.slice(0, 120))
        .slice(0, max)
    : [];
}

/**
 * POST /api/mix/suggest — DJ asistente.
 * Body: { prompt, current?, history?, hour? } → { sugerencias: MixSuggestion[] }
 * `history` = temas ya sonados (no repetir) · `hour` = hora local (0-23) del
 * usuario para modular la energía.
 */
export async function POST(req: Request) {
  if (!process.env.ZAI_API_KEY && !process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "El asistente IA no está configurado (falta ZAI_API_KEY u OPENAI_API_KEY)" },
      { status: 503 },
    );
  }

  let body: { prompt?: string; current?: string[]; history?: string[]; hour?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim().slice(0, 300);
  if (!prompt) {
    return NextResponse.json({ error: "describe la vibra que buscas" }, { status: 400 });
  }
  const current = sanitizeTitles(body.current, 4);
  const history = sanitizeTitles(body.history, 40);
  const hour =
    typeof body.hour === "number" && body.hour >= 0 && body.hour <= 23
      ? Math.floor(body.hour)
      : null;

  try {
    const completion = await client().chat.completions.create({
      model: suggestModel(),
      temperature: 0.8,
      // GLM razona por defecto; para sugerencias rápidas se desactiva.
      ...(usingZai() ? { thinking: { type: "disabled" } } : {}),
      messages: [
        {
          role: "system",
          content:
            "Eres un DJ asistente. Sugieres temas reales y conocidos que se encuentren " +
            "fácil en YouTube, pensando en transiciones coherentes de energía y género. " +
            "Reglas de DJ: (1) NUNCA sugieras un tema que aparezca en la lista de ya " +
            "sonados, ni el mismo tema con otro nombre. (2) Evita repetir al artista " +
            "que está sonando o al de los últimos temas — varía, salvo que la vibra " +
            "pida un solo artista. (3) Prefiere temas populares y reconocibles por " +
            "sobre rarezas, salvo que la vibra pida lo contrario. (4) Si conoces la " +
            "hora local, modula la energía: subir hacia el peak de la noche, aterrizar " +
            "suave de madrugada o temprano. Responde únicamente llamando a la función.",
        },
        {
          role: "user",
          content:
            `Vibra pedida: ${prompt}\n` +
            `Sonando ahora: ${current.length ? current.join(" · ") : "nada todavía"}\n` +
            `Ya sonaron (prohibido repetir): ${history.length ? history.join(" · ") : "ninguno"}` +
            (hour !== null ? `\nHora local: ${hour}:00` : ""),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "sugerencias_mix",
            description: "Lista de temas sugeridos para el mix",
            parameters: PARAMETERS,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "sugerencias_mix" } },
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    const args = call && "function" in call ? call.function.arguments : null;
    if (!args) {
      return NextResponse.json({ error: "la IA no devolvió sugerencias" }, { status: 502 });
    }
    const parsed = JSON.parse(args) as { sugerencias?: MixSuggestion[] };
    return NextResponse.json({ sugerencias: (parsed.sugerencias ?? []).slice(0, 6) });
  } catch (error) {
    // el detalle del proveedor ayuda a diagnosticar (saldo, modelo, etc.)
    const detail =
      error instanceof OpenAI.APIError ? ` (${String(error.message).slice(0, 120)})` : "";
    return NextResponse.json(
      { error: `falló el asistente IA${detail}` },
      { status: 502 },
    );
  }
}
