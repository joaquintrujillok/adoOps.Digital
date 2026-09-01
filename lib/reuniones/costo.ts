// Cuánto cuesta resumir una reunión.
//
// **Por qué se guarda el costo y no se calcula al mostrarlo.** Los precios de
// OpenAI cambian. Si la pantalla multiplicara los tokens por la tarifa de hoy,
// una reunión de hace seis meses mostraría un número que nunca se pagó. Lo que
// interesa saber es lo que costó, así que el costo se congela al momento de la
// llamada y la tabla de abajo solo sirve para calcularlo esa vez.
//
// Los tokens también se guardan, aparte del costo. Son el dato que no envejece:
// si mañana hay que estimar qué pasaría con otro modelo, se multiplica por otra
// tarifa. El costo en dólares no se puede des-calcular.

import type { CompletionUsage } from "openai/resources/completions";

/** USD por millón de tokens. */
type Tarifa = {
  entrada: number;
  /** Tokens de entrada que OpenAI ya tenía cacheados. Salen más baratos. */
  entradaCache: number;
  salida: number;
};

/**
 * Tarifas verificadas el 01-09-2026 contra
 * https://developers.openai.com/api/docs/pricing
 *
 * Va con fecha porque es un número que envejece y que nadie va a volver a
 * mirar por su cuenta. Un modelo que no esté acá no rompe nada: se guardan los
 * tokens y el costo queda en null, que es honesto — "no sé cuánto costó" es
 * mejor que un número inventado con la tarifa del modelo de al lado.
 */
const TARIFAS: Record<string, Tarifa> = {
  "gpt-4o-mini": { entrada: 0.15, entradaCache: 0.075, salida: 0.6 },
  "gpt-4o": { entrada: 2.5, entradaCache: 1.25, salida: 10 },
};

export type UsoModelo = {
  modelo: string;
  tokensEntrada: number;
  tokensEntradaCache: number;
  tokensSalida: number;
  /** USD. `null` si el modelo no está en la tabla de tarifas. */
  costoUsd: number | null;
};

export function medirUso(modelo: string, usage?: CompletionUsage | null): UsoModelo {
  const tokensEntrada = usage?.prompt_tokens ?? 0;
  const tokensEntradaCache = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const tokensSalida = usage?.completion_tokens ?? 0;

  // El nombre puede venir con sufijo de versión ("gpt-4o-mini-2024-07-18").
  // Se busca la tarifa por el prefijo más largo que calce, igual que
  // `moduloDe()` con las rutas.
  let tarifa: Tarifa | undefined;
  let mejor = "";
  for (const [nombre, t] of Object.entries(TARIFAS)) {
    if (modelo.startsWith(nombre) && nombre.length > mejor.length) {
      tarifa = t;
      mejor = nombre;
    }
  }

  if (!tarifa) {
    return { modelo, tokensEntrada, tokensEntradaCache, tokensSalida, costoUsd: null };
  }

  // `prompt_tokens` incluye los cacheados, así que se descuentan antes de
  // cobrarlos a tarifa plena o se pagaría dos veces por el mismo token.
  const frescos = Math.max(0, tokensEntrada - tokensEntradaCache);
  const costoUsd =
    (frescos * tarifa.entrada +
      tokensEntradaCache * tarifa.entradaCache +
      tokensSalida * tarifa.salida) /
    1_000_000;

  return { modelo, tokensEntrada, tokensEntradaCache, tokensSalida, costoUsd };
}
