// La escalera de canales: se toma el PRIMER carril disponible, no el preferido.
//
// ── La intuición que hay que corregir ────────────────────────────────────────
//
// "Mando invitaciones porque son gratis" es falso en términos operativos. El
// cupo real de invitaciones es 20–25 al día si se quiere que la cuenta
// sobreviva —unas 500 al mes—, mientras que los InMail a Open Profile no
// consumen crédito y tienen un techo de cientos al mes. La invitación es el
// recurso MÁS caro, no el más barato.
//
// Toda esta escalera existe para no quemar invitaciones en gente a la que se le
// puede escribir directo.

import type { LeadCanal } from "@/db/leads";

export type Carril =
  | "dm"
  | "inmail_open"
  | "inmail_credito"
  | "invitacion"
  | "email";

export interface PersonaAlcanzable {
  memberUrn: string | null;
  email: string | null;
  emailVerificado: boolean | null;
  esOpenProfile: boolean | null;
  networkDistance: number | null;
}

export interface Eleccion {
  carril: Carril;
  /** Lo que va en `lead_acciones.tipo`. */
  tipo: string;
  canal: LeadCanal;
  /** Por qué este carril y no otro. Se muestra en la fila del panel. */
  porque: string;
  /** `false` cuando consume un recurso escaso: crédito de InMail o cupo de invitación. */
  gratis: boolean;
}

/**
 * Elige el carril para el PRIMER contacto.
 *
 * Devuelve `null` cuando no hay por dónde escribirle. Eso no es un error: es una
 * persona que está en la base pero no es alcanzable, y la banda C lo dice con
 * todas sus letras en vez de dejar la acción en el limbo.
 */
export function elegirCarril(p: PersonaAlcanzable): Eleccion | null {
  // 1 · Ya es contacto de primer grado. Mensaje directo, sin gastar nada.
  if (p.networkDistance === 1 && p.memberUrn) {
    return {
      carril: "dm",
      tipo: "mensaje",
      canal: "linkedin",
      porque: "Ya es contacto de 1er grado",
      gratis: true,
    };
  }

  // 2 · Open Profile. El carril abundante, y el que casi nadie segmenta.
  //     `es_open_profile` es null mientras no se haya consultado: null NO es
  //     false. Descartar por "no sabemos" sería descartar por defecto.
  if (p.esOpenProfile === true && p.memberUrn) {
    return {
      carril: "inmail_open",
      tipo: "inmail",
      canal: "linkedin",
      porque: "Tiene Open Profile · InMail gratis, no gasta crédito",
      gratis: true,
    };
  }

  // 3 · Grupos y eventos compartidos también permiten mensaje directo sin
  //     crédito, pero requieren consultar la membresía del emisor. Queda fuera
  //     hasta tener Unipile conectado: adivinarlo produciría un 422 con la
  //     invitación ya gastada.

  // 4 · InMail con crédito: 50 al mes, y se recuperan solo si el destinatario
  //     responde en 90 días. Se reserva para prioritarios y por eso no se elige
  //     automáticamente — hoy no hay un criterio de prioridad medido, y gastar
  //     créditos con un criterio inventado es peor que no gastarlos.

  // 5 · Invitación con nota. El cuello de botella real.
  if (p.memberUrn) {
    return {
      carril: "invitacion",
      tipo: "invitacion",
      canal: "linkedin",
      porque: "Sin Open Profile ni conexión · 300 caracteres",
      gratis: false,
    };
  }

  // 6 · Email. Sin cupo relevante, pero exige verificación previa: un rebote
  //     duro daña el dominio, y eso sí es caro y lento de revertir.
  if (p.email && p.emailVerificado !== false) {
    return {
      carril: "email",
      tipo: "email",
      canal: "email",
      porque: p.emailVerificado
        ? "Sin perfil de LinkedIn · email verificado"
        : "Sin perfil de LinkedIn · email sin verificar todavía",
      gratis: true,
    };
  }

  return null;
}

/** Etiqueta corta para la columna "Carril" del panel. */
export const NOMBRE_CARRIL: Record<Carril, string> = {
  dm: "Mensaje directo",
  inmail_open: "InMail · open profile",
  inmail_credito: "InMail con crédito",
  invitacion: "Invitación con nota",
  email: "Email · ruta C",
};

/**
 * El tope de caracteres de la nota de una invitación. LinkedIn corta en 300 sin
 * avisar: un mensaje truncado a media frase se lee peor que uno corto.
 */
export const TOPE_NOTA_INVITACION = 300;
