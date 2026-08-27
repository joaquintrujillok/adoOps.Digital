// Registro de áreas de Tuniche.
//
// **Por qué es código y no una tabla.** Misma razón que `lib/modulos.ts`: son
// dos o tres filas que cambian una vez al año y de las que dependen decisiones
// de permisos. En una tabla, agregar un área es un INSERT que nadie revisa; acá
// es un commit que alguien lee. Además, cuando cada área declare su plantilla de
// visita —que es lo que viene—, esa plantilla es código de todas formas.
//
// **Qué es un área.** No es un organigrama: es **un conjunto de gente que llena
// la misma sábana**. Mercado Nacional y Producción Altué visitan agricultores
// distintos, en cultivos distintos, y anotan cosas distintas. Ellos mismos lo
// dijeron en la reunión: "puede ser que Altué necesite 6 campos más y MN otros
// 6". Si dos grupos llenaran la misma planilla, serían una sola área.
//
// El área decide dos cosas y solo dos: **qué filas ve una persona** y **qué
// plantilla llena**. Todo lo demás —el flujo de audio, el historial, el envío al
// agricultor— es idéntico y por eso es un solo sistema y no dos.

/** Identificador estable. Es lo que se guarda en `tuniche_usuarios.area`. */
export type AreaId = "mn" | "altue";

export interface Area {
  id: AreaId;
  /** Cómo se llama en pantalla. Corto: va en menús y chips. */
  nombre: string;
  /** El nombre completo, para cuando hay espacio y hace falta desambiguar. */
  nombreLargo: string;
  /** Qué produce y a quién visita. Una línea. */
  nota: string;
}

export const AREAS: Area[] = [
  {
    id: "mn",
    nombre: "Mercado Nacional",
    nombreLargo: "Semillas Tuniche · Mercado Nacional",
    nota: "Maíz de grano y silo vendido a agricultores chilenos vía distribuidores. Visita por etapa fenológica, de presiembra a R5.",
  },
  {
    id: "altue",
    nombre: "Producción Altué",
    nombreLargo: "Altué · Producción de semilla híbrida",
    nota: "Semilla hortícola híbrida producida bajo contrato para clientes en el extranjero. Visita por momento: trasplante, floración, cosecha-trilla.",
  },
];

export function areaPorId(id: string | null | undefined): Area | undefined {
  if (!id) return undefined;
  return AREAS.find((a) => a.id === id);
}

/**
 * El nombre que se muestra cuando el área puede ser `null`.
 *
 * `null` no es un dato faltante: es el admin, que cruza áreas a propósito.
 * Pintarlo como "—" haría parecer un registro incompleto lo que es una decisión.
 */
export function nombreArea(id: string | null | undefined): string {
  if (!id) return "Todas las áreas";
  return areaPorId(id)?.nombre ?? id;
}

export function esAreaValida(id: string): id is AreaId {
  return AREAS.some((a) => a.id === id);
}
