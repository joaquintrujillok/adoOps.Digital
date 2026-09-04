// Confirmación del correo: el paso que cierra el doble opt-in.
//
// ── Por qué esto es un archivo aparte y no vive en `perfilar` ────────────────
//
// Hasta el 04-09-2026 la única escritura de `estado = 'confirmado'` estaba
// dentro de `perfilar`, es decir, al **enviar** el formulario de preferencias.
// La página, en cambio, decía "Correo confirmado" apenas se abría el enlace.
//
// Las dos cosas no eran la misma, y el texto mentía: quien abría el enlace, leía
// que había quedado confirmado y cerraba la pestaña quedaba en `pendiente` para
// siempre. Nunca recibía nada, y como nadie mira los `pendiente`, nadie se
// enteraba. La promesa del doble opt-in es "hiciste clic, estás dentro"; el
// formulario es otra conversación.
//
// Ahora son dos pasos de verdad:
//   1. abrir el enlace válido  → confirma el correo. Acá.
//   2. enviar el formulario    → guarda taza, nombre, empresa, rol, teléfono.
//
// ── El costo de confirmar en un GET ─────────────────────────────────────────
//
// Los escáneres de enlaces de algunos correos corporativos visitan cada URL del
// mensaje. Con esto, esa visita confirma la dirección sin que nadie haya hecho
// clic, y debilita la prueba de consentimiento.
//
// Se acepta a sabiendas: es cómo funciona el doble opt-in en todas partes, y la
// alternativa —exigir un POST para confirmar— reintroduce exactamente el bug que
// esto arregla, porque vuelve a poner la confirmación detrás de un botón que la
// gente no aprieta. La baja sí exige POST (ver `darDeBaja`), y ahí la asimetría
// es deliberada: un escáner que confirma de más molesta; uno que da de baja
// borra a alguien que quería estar.

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoSuscriptores } from "@/db/schema";

export type EstadoEnlace =
  | { estado: "invalido" }
  | { estado: "vencido" }
  /** Se acaba de confirmar en esta visita. */
  | { estado: "recien"; suscriptor: Suscriptor }
  /** Ya venía confirmado de antes. */
  | { estado: "previo"; suscriptor: Suscriptor };

type Suscriptor = typeof cafecitoSuscriptores.$inferSelect;

/**
 * Resuelve el enlace y confirma el correo si corresponde. Idempotente: volver a
 * abrirlo no reescribe `confirmado_en` ni pisa nada.
 */
export async function abrirEnlaceDeConfirmacion(token: string): Promise<EstadoEnlace> {
  if (!token) return { estado: "invalido" };

  const [s] = await db
    .select()
    .from(cafecitoSuscriptores)
    .where(eq(cafecitoSuscriptores.tokenConfirmacion, token))
    .limit(1);

  if (!s) return { estado: "invalido" };

  if (s.estado === "confirmado") return { estado: "previo", suscriptor: s };

  // Una fila dada de baja que llega por un enlace viejo NO se reactiva sola.
  // Volver a suscribir a alguien porque su cliente de correo abrió un link de
  // hace meses es justo lo que una baja tiene que impedir. Si quiere volver, el
  // formulario del sitio lo repone: `registrar` limpia `bajaEn` y emite token
  // nuevo.
  if (s.estado === "baja") return { estado: "invalido" };

  if (s.confirmacionExpiraEn && s.confirmacionExpiraEn < new Date()) {
    return { estado: "vencido" };
  }

  // `isNull(confirmadoEn)` en el WHERE hace la escritura idempotente incluso si
  // dos pestañas abren el enlace a la vez: la segunda no encuentra fila y no
  // pisa la marca de tiempo de la primera.
  const ahora = new Date();
  await db
    .update(cafecitoSuscriptores)
    .set({ estado: "confirmado", confirmadoEn: ahora })
    .where(
      and(
        eq(cafecitoSuscriptores.id, s.id),
        isNull(cafecitoSuscriptores.confirmadoEn),
      ),
    );

  return {
    estado: "recien",
    suscriptor: { ...s, estado: "confirmado", confirmadoEn: s.confirmadoEn ?? ahora },
  };
}
