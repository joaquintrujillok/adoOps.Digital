// Cuánto cuesta resumir una reunión.
//
// **Por qué se guarda el costo y no se calcula al mostrarlo.** Los precios de
// OpenAI cambian —esta tabla ya se actualizó una vez— y si la pantalla
// multiplicara los tokens por la tarifa de hoy, una reunión de hace seis meses
// mostraría un número que nunca se pagó. El costo se congela al momento de la
// llamada y la tabla de abajo solo sirve para calcularlo esa vez.
//
// Los tokens también se guardan, aparte del costo. Son el dato que no envejece:
// si mañana hay que estimar qué pasaría con otro modelo, se multiplican por otra
// tarifa. El costo en dólares no se puede des-calcular.

import type { CompletionUsage } from "openai/resources/completions";

/** USD por millón de tokens. */
type Tarifa = {
  entrada: number;
  /** Tokens de entrada que OpenAI ya tenía cacheados. Salen mucho más baratos. */
  entradaCache: number;
  salida: number;
  /**
   * Si el modelo cobra distinto según el largo del contexto.
   *
   * Los `gpt-5.6-*` tienen dos tramos, "short context" y "long context", y el
   * segundo vale el doble. **La página de precios no dice dónde está el corte**
   * —se revisó el 01-09-2026—, y la respuesta de la API tampoco informa qué
   * tramo se aplicó. Así que acá se cobra siempre al tramo corto y se marca la
   * fila: para estos modelos el número es un piso, no una certeza. Con
   * `gpt-4o-mini`, que tiene tarifa única, el número es exacto.
   */
  tramos?: true;
};

/**
 * Tarifas verificadas el 01-09-2026 contra
 * https://developers.openai.com/api/docs/pricing
 *
 * Va con fecha porque es un número que envejece y que nadie va a volver a
 * mirar por su cuenta. Un modelo que no esté acá no rompe nada: se guardan los
 * tokens y el costo queda en null, que es honesto — "no sé cuánto costó" es
 * mejor que un número inventado con la tarifa del modelo de al lado.
 *
 * Ojo con el calce por prefijo: `gpt-4o-mini-transcribe` calzaría con
 * `gpt-4o-mini` y le pondría la tarifa equivocada. No pasa hoy porque este
 * módulo nunca transcribe audio —lee subtítulos— y `lib/stt.ts`, que sí lo
 * hace, no usa esta tabla. Si algún día la comparten, hay que separar las dos.
 */
const TARIFAS: Record<string, Tarifa> = {
  // Los vigentes. `luna` es el barato de la familia y el candidato natural el
  // día que se quiera dejar atrás la generación 4o.
  "gpt-5.6-luna": { entrada: 0.2, entradaCache: 0.02, salida: 1.2, tramos: true },
  "gpt-5.6-terra": { entrada: 2, entradaCache: 0.2, salida: 12, tramos: true },
  "gpt-5.6-sol": { entrada: 4, entradaCache: 0.4, salida: 20, tramos: true },
  // Generación anterior, todavía en la tabla de precios y todavía el default de
  // este repo. Tarifa única: para estos el costo calculado es exacto.
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
  /**
   * `true` si el modelo cobra por tramos de contexto y este costo asume el
   * tramo corto. La pantalla lo muestra con un "≈" en vez de dar por exacta
   * una cifra que puede ser la mitad de la real.
   */
  costoAproximado: boolean;
};

export function medirUso(modelo: string, usage?: CompletionUsage | null): UsoModelo {
  const tokensEntrada = usage?.prompt_tokens ?? 0;
  const tokensEntradaCache = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  const tokensSalida = usage?.completion_tokens ?? 0;

  // El nombre puede venir con sufijo de versión ("gpt-4o-mini-2024-07-18").
  // Se busca la tarifa por el prefijo más largo que calce, igual que
  // `moduloDe()` con las rutas: `gpt-4o` no debe ganarle a `gpt-4o-mini`.
  let tarifa: Tarifa | undefined;
  let mejor = "";
  for (const [nombre, t] of Object.entries(TARIFAS)) {
    if (modelo.startsWith(nombre) && nombre.length > mejor.length) {
      tarifa = t;
      mejor = nombre;
    }
  }

  if (!tarifa) {
    return {
      modelo,
      tokensEntrada,
      tokensEntradaCache,
      tokensSalida,
      costoUsd: null,
      costoAproximado: false,
    };
  }

  // `prompt_tokens` incluye los cacheados, así que se descuentan antes de
  // cobrarlos a tarifa plena o se pagaría dos veces por el mismo token.
  const frescos = Math.max(0, tokensEntrada - tokensEntradaCache);
  const costoUsd =
    (frescos * tarifa.entrada +
      tokensEntradaCache * tarifa.entradaCache +
      tokensSalida * tarifa.salida) /
    1_000_000;

  return {
    modelo,
    tokensEntrada,
    tokensEntradaCache,
    tokensSalida,
    costoUsd,
    costoAproximado: tarifa.tramos === true,
  };
}
