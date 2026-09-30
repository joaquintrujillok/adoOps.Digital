// Cómo se muestra cada estado. Un solo lugar para que "Enviada" no diga
// "terminada" en una pantalla y "lista" en otra.

export const ESTADO_CAMPANA: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "" },
  enviando: { texto: "Enviando", clase: "vn-chip-aviso" },
  pausada: { texto: "Pausada", clase: "vn-chip-naranjo" },
  terminada: { texto: "Enviada", clase: "vn-chip-teal" },
};

export const ESTADO_OPORTUNIDAD: Record<string, { texto: string; clase: string }> = {
  por_llamar: { texto: "Por llamar", clase: "vn-chip-naranjo" },
  llamado: { texto: "Llamado", clase: "" },
  cotizando: { texto: "Cotizando", clase: "vn-chip-aviso" },
  ganada: { texto: "Ganada", clase: "vn-chip-teal" },
  perdida: { texto: "Perdida", clase: "vn-chip-rojo" },
};

export const ESTADO_PEDIDO: Record<string, { texto: string; clase: string }> = {
  pendiente_pago: { texto: "Cotizado · esperando pago", clase: "vn-chip-aviso" },
  pagado: { texto: "Pagado", clase: "vn-chip-naranjo" },
  preparacion: { texto: "En preparación", clase: "" },
  despachado: { texto: "Saliendo de bodega", clase: "" },
  en_camino: { texto: "En camino", clase: "" },
  llega_hoy: { texto: "Llega hoy", clase: "" },
  entregado: { texto: "Entregado", clase: "vn-chip-teal" },
  cancelado: { texto: "Cancelado", clase: "vn-chip-rojo" },
};

export const ENTREGA: Record<string, { texto: string; clase: string }> = {
  enviado: { texto: "Enviado", clase: "" },
  entregado: { texto: "Entregado", clase: "vn-chip-teal" },
  leido: { texto: "Leído", clase: "vn-chip-teal" },
  error: { texto: "Error", clase: "vn-chip-rojo" },
};

export const RESULTADO: Record<string, { texto: string; clase: string }> = {
  interesado: { texto: "Interesado", clase: "vn-chip-teal" },
  pregunta: { texto: "Preguntó", clase: "" },
  no_interesado: { texto: "No le interesa", clase: "" },
  baja: { texto: "Pidió baja", clase: "vn-chip-rojo" },
  reclamo: { texto: "Reclamo", clase: "vn-chip-naranjo" },
};
