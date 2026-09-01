// El embudo de adoOps, en un solo lugar.
//
// Cambiar el pipeline debería ser editar este archivo y nada más.
//
// **No se importa el de `/crm`**, aunque exista y sea parecido. Ese es el embudo
// de una tienda de relojes de alta gama: sus etapas están hechas para una venta
// de mostrador con audición y cotización. Este es de servicios B2B, donde el
// paso que decide es conseguir la primera reunión. La duplicación acá es más
// barata que el acoplamiento, por la misma razón que `lib/dashboard360/session.ts`
// no importa la del CRM: son productos que se venden por separado.

export const ETAPAS = [
  { id: "nuevo", nombre: "Nuevo", probabilidad: 5 },
  // "Contactado" existe y el embudo de la tienda no la tiene: en servicios, entre
  // conocer a alguien y que responda hay un abismo donde se pierde la mayoría, y
  // meter esas dos cosas en la misma columna esconde justo dónde se cae el
  // embudo.
  { id: "contactado", nombre: "Contactado", probabilidad: 15 },
  { id: "reunion", nombre: "Reunión agendada", probabilidad: 35 },
  { id: "propuesta", nombre: "Propuesta enviada", probabilidad: 55 },
  { id: "negociacion", nombre: "Negociación", probabilidad: 75 },
  { id: "ganado", nombre: "Ganado", probabilidad: 100 },
  { id: "perdido", nombre: "Perdido", probabilidad: 0 },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

/** Las que se ven en el tablero. Ganado y perdido salen del flujo. */
export const ETAPAS_ABIERTAS = ETAPAS.filter(
  (e) => e.id !== "ganado" && e.id !== "perdido",
);

export function nombreEtapa(id: string): string {
  return ETAPAS.find((e) => e.id === id)?.nombre ?? id;
}

export function probabilidadDe(id: string): number {
  return ETAPAS.find((e) => e.id === id)?.probabilidad ?? 5;
}

export function esCerrada(id: string): boolean {
  return id === "ganado" || id === "perdido";
}

/** De dónde salió el prospecto. Texto libre no: sin esto no se puede comparar. */
export const FUENTES = [
  { id: "motor", nombre: "Motor de prospección" },
  { id: "linkedin", nombre: "LinkedIn a mano" },
  { id: "referido", nombre: "Referido" },
  { id: "web", nombre: "Formulario de la web" },
  { id: "evento", nombre: "Evento" },
  { id: "reunion", nombre: "Salió de una reunión" },
  { id: "otro", nombre: "Otro" },
] as const;

export function nombreFuente(id: string | null): string {
  if (!id) return "sin origen";
  return FUENTES.find((f) => f.id === id)?.nombre ?? id;
}

export const TIPOS_ACTIVIDAD = [
  { id: "nota", nombre: "Nota" },
  { id: "llamada", nombre: "Llamada" },
  { id: "correo", nombre: "Correo" },
  { id: "reunion", nombre: "Reunión" },
  { id: "mensaje", nombre: "Mensaje" },
] as const;
