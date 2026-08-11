// El embudo, en un solo lugar.
//
// Cambiar el pipeline de un cliente a otro debería ser editar este archivo y
// nada más. Las probabilidades por defecto son las que se aplican al mover una
// oportunidad de etapa; el vendedor puede sobrescribirlas a mano.

export const ETAPAS = [
  { id: "nuevo", nombre: "Nuevo", probabilidad: 10 },
  { id: "calificado", nombre: "Calificado", probabilidad: 30 },
  { id: "propuesta", nombre: "Propuesta", probabilidad: 50 },
  { id: "negociacion", nombre: "Negociación", probabilidad: 75 },
  { id: "ganado", nombre: "Ganado", probabilidad: 100 },
  { id: "perdido", nombre: "Perdido", probabilidad: 0 },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

/** Las que se ven en el tablero. Ganado y perdido salen del flujo. */
export const ETAPAS_ABIERTAS = ETAPAS.filter(
  (e) => e.id !== "ganado" && e.id !== "perdido",
);

export const ETAPAS_ABIERTAS_IDS = ETAPAS_ABIERTAS.map((e) => e.id) as string[];

export function nombreEtapa(id: string): string {
  return ETAPAS.find((e) => e.id === id)?.nombre ?? id;
}

export function probabilidadDe(id: string): number {
  return ETAPAS.find((e) => e.id === id)?.probabilidad ?? 10;
}

export function esCerrada(id: string): boolean {
  return id === "ganado" || id === "perdido";
}

/** Canales de marketing con su nombre para pantalla. */
export const CANALES = [
  { id: "ads", nombre: "Publicidad pagada" },
  { id: "email", nombre: "Email" },
  { id: "social", nombre: "Redes sociales" },
  { id: "evento", nombre: "Eventos" },
  { id: "referido", nombre: "Referidos" },
  { id: "whatsapp", nombre: "WhatsApp" },
  { id: "organico", nombre: "Orgánico" },
] as const;

export function nombreCanal(id: string | null | undefined): string {
  return CANALES.find((c) => c.id === id)?.nombre ?? id ?? "Sin canal";
}

export const MOTIVOS_PERDIDA = [
  "Precio",
  "Se fue con la competencia",
  "Sin presupuesto",
  "Sin respuesta",
  "Momento equivocado",
  "No calificaba",
  "Producto sin stock",
] as const;
