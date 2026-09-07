// Eventos de Cafecito hacia GA4.
//
// ── Por qué una función propia y no `sendGAEvent` directo ───────────────────
//
// Dos razones, y ninguna es preferencia de estilo:
//
// 1. **GA4 puede no estar montado.** El layout solo monta `<GoogleAnalytics />`
//    si existe `NEXT_PUBLIC_GA_ID`, y hoy esa variable no existe en ningún
//    entorno: el ID de medición está pendiente, y encender GA4 es además una
//    decisión abierta por la ley 21.719 y el consentimiento de cookies.
//    `sendGAEvent` sin GA inicializado no revienta, pero deja un `console.warn`
//    en el navegador de cada persona que se suscribe. Un aviso de desarrollo no
//    tiene por qué verlo un suscriptor.
//
// 2. **Los despliegues de preview no deben medir.** Cada preview tiene su URL, y
//    si esas visitas entraran a la misma propiedad estaríamos midiendo nuestro
//    propio trabajo. La variable va solo en Production, y este guard es el mismo
//    que el del layout: si no hay ID, no hay evento.
//
// El día que GA4 se encienda, esto empieza a emitir solo. El día que se decida
// no usarlo, se borra este archivo y las dos llamadas, y no queda nada más.

import { sendGAEvent } from "@next/third-parties/google";

/** Los eventos que este sitio mide. Lista cerrada: un typo no crea un evento nuevo. */
export type EventoCafecito = "suscripcion_iniciada" | "suscripcion_confirmada";

export function evento(nombre: EventoCafecito, parametros?: Record<string, string>) {
  if (!process.env.NEXT_PUBLIC_GA_ID) return;
  sendGAEvent("event", nombre, parametros ?? {});
}
