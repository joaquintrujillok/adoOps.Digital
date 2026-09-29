// Acceso al modelo para el motor de Vanni, con tope diario.
//
// El tope viene del bot de Paine: un bucle, o alguien escribiendo sin parar,
// no debe convertirse en una factura. Se cuenta en **llamadas** y no en
// dólares a propósito: el precio por token cambia y no queremos un número
// inventado decidiendo cuándo se apaga el agente. Si se configuran los precios
// (`VANNI_USD_MTOK_ENTRADA` / `_SALIDA`), además se registra el costo.
//
// Sin `OPENAI_API_KEY` el motor no se cae: usa sus reglas (ver motor/reglas.ts).

import OpenAI from "openai";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniPresupuesto } from "@/db/vanni";

export const MODELO = process.env.VANNI_MODEL || "gpt-5.4-nano";
export const MODELO_EMBEDDINGS = "text-embedding-3-small";
const LIMITE_DIARIO = Number(process.env.VANNI_LIMITE_LLAMADAS_DIA || 3000);

let _client: OpenAI | null = null;

export function hayModelo(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function cliente(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

/** ¿Queda presupuesto hoy? Si falla la consulta, se asume que sí: el tope no debe tumbar el bot. */
export async function hayPresupuesto(): Promise<boolean> {
  try {
    const [fila] = await db
      .select({ llamadas: vanniPresupuesto.llamadas })
      .from(vanniPresupuesto)
      .where(sql`${vanniPresupuesto.fecha} = ${hoy()}`);
    return (fila?.llamadas ?? 0) < LIMITE_DIARIO;
  } catch {
    return true;
  }
}

export async function registrarUso(tokensEntrada: number, tokensSalida: number): Promise<void> {
  const pe = Number(process.env.VANNI_USD_MTOK_ENTRADA || 0);
  const ps = Number(process.env.VANNI_USD_MTOK_SALIDA || 0);
  const costo = (tokensEntrada * pe + tokensSalida * ps) / 1_000_000;
  try {
    await db
      .insert(vanniPresupuesto)
      .values({
        fecha: hoy(),
        llamadas: 1,
        tokensEntrada,
        tokensSalida,
        costoUsd: costo.toFixed(4),
      })
      .onConflictDoUpdate({
        target: vanniPresupuesto.fecha,
        set: {
          llamadas: sql`${vanniPresupuesto.llamadas} + 1`,
          tokensEntrada: sql`${vanniPresupuesto.tokensEntrada} + ${tokensEntrada}`,
          tokensSalida: sql`${vanniPresupuesto.tokensSalida} + ${tokensSalida}`,
          costoUsd: sql`${vanniPresupuesto.costoUsd} + ${costo.toFixed(4)}`,
        },
      });
  } catch (err) {
    console.error("[vanni] no se pudo registrar el uso del modelo", err);
  }
}

export async function embedding(texto: string): Promise<number[]> {
  const r = await cliente().embeddings.create({ model: MODELO_EMBEDDINGS, input: texto });
  return r.data[0].embedding;
}
