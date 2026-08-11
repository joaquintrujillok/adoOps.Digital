// Respuestas frecuentes del hilo, invocables escribiendo `/`.
//
// En una boutique de alta relojería las preguntas se repiten: si la referencia
// está en vitrina, cuándo se puede pasar a verla, cuánto demora una mantención,
// si se puede grabar la pieza. Hoy eso se teclea entero cada vez, y a las veinte
// veces se escribe distinto —lo que en una venta consultiva de ticket alto no es
// un detalle de estilo: es el cliente leyendo dos promesas que no coinciden.
//
// DE DÓNDE SALE CADA TEXTO. Las que afirman algo del servicio se apoyan en lo
// que el catálogo ya contiene: la mantención completa de movimiento, el pulido y
// restauración de caja, la tasación con certificado de autenticidad y el grabado
// personalizado son SKU reales de `crm_products`. Lo que este sistema NO sabe
// —horarios, direcciones exactas, formas de pago, plazos de garantía— va con un
// hueco entre corchetes en vez de un dato inventado: una respuesta rápida que
// miente es peor que teclearla.
//
// El hueco es visible a propósito. Si el vendedor manda "[hora de apertura]" sin
// completarlo, se nota al instante; un horario inventado que suena razonable no
// se nota hasta que un cliente llega a la puerta cerrada.
//
// Ninguna promete un plazo. En este rubro la pieza puede estar en vitrina, en
// otra boutique o en fábrica, y el mismo servicio demora distinto según el
// calibre: prometer "48 horas" acá sería inventar.
//
// Este catálogo es un punto de partida para que la boutique lo corrija con lo
// que sus vendedores contestan de verdad, no una definición cerrada.

export interface RespuestaRapida {
  /** Lo que se escribe después de la barra. Sin tildes ni espacios. */
  atajo: string;
  /** Qué es, para la lista que se despliega. */
  titulo: string;
  texto: string;
  /** `true` si el texto trae un hueco que hay que completar antes de mandar. */
  incompleta?: boolean;
}

/** Un hueco pendiente se ve así: `[algo]`. */
export const HUECO = /\[[^\]]+\]/;

export const RESPUESTAS_RAPIDAS: RespuestaRapida[] = [
  {
    atajo: "cita",
    titulo: "Invitar al showroom",
    texto:
      "¿Te parece si coordinamos una cita en el showroom para que la veas con calma? " +
      "Dime qué día te acomoda y la dejamos reservada a tu nombre.",
  },
  {
    atajo: "disponible",
    titulo: "Confirmar disponibilidad",
    // Sin plazo a propósito: la pieza puede estar en vitrina, en otra boutique o
    // en fábrica, y decir "mañana" por costumbre es exactamente lo que después
    // hay que desdecir.
    texto:
      "Déjame confirmar la disponibilidad de esa referencia y te aviso apenas la tenga. " +
      "Si no está en vitrina te digo el plazo real de llegada antes de que decidas.",
  },
  {
    atajo: "momento",
    titulo: "Pedir un momento",
    texto:
      "Dame un momento, por favor. Estoy revisando la información de la pieza y te confirmo enseguida.",
  },
  {
    atajo: "cotizacion",
    titulo: "La cotización sigue vigente",
    texto:
      "Tu cotización sigue vigente con los valores que te enviamos. " +
      "Cuando quieras avanzar, avísame y la dejamos lista.",
  },
  {
    atajo: "servicio",
    titulo: "Mantención y servicio",
    // La mantención completa de movimiento y el pulido de caja son servicios del
    // catálogo; el plazo no está en ninguna parte del sistema, así que va hueco.
    texto:
      "Hacemos mantención completa del movimiento y pulido de caja en nuestro taller. " +
      "Tráela cuando puedas y la revisamos sin costo para darte el presupuesto exacto; " +
      "el plazo es de [plazo del servicio] según el calibre.",
    incompleta: true,
  },
  {
    atajo: "tasacion",
    titulo: "Tasación y autenticidad",
    texto:
      "Podemos hacerle una tasación con certificado de autenticidad. " +
      "Necesitamos ver la pieza en el showroom y, si los tienes, la caja y los papeles originales.",
  },
  {
    atajo: "grabado",
    titulo: "Grabado personalizado",
    texto:
      "Sí, podemos grabarla. Cuéntame qué texto quieres y lo coordinamos antes de la entrega, " +
      "así te la llevas lista para regalar.",
  },
  {
    atajo: "gracias",
    titulo: "Cierre",
    texto:
      "Gracias por escribirnos. Cualquier duda quedamos atentos por este mismo medio.",
  },
  {
    atajo: "horario",
    titulo: "Horario de atención",
    texto: "Nuestro horario es [lunes a viernes de 00:00 a 00:00 y sábados de 00:00 a 00:00].",
    incompleta: true,
  },
  {
    atajo: "direccion",
    titulo: "Dónde estamos",
    texto:
      "Estamos en [dirección de la boutique]. Si prefieres, te reservo una cita para que no esperes.",
    incompleta: true,
  },
  {
    atajo: "pago",
    titulo: "Formas de pago",
    texto: "Aceptamos [formas de pago que recibe la boutique]. Lo vemos al momento de la compra.",
    incompleta: true,
  },
  {
    atajo: "garantia",
    titulo: "Garantía",
    texto:
      "La pieza viene con garantía oficial de la marca por [plazo de garantía], " +
      "y queda registrada a tu nombre al momento de la entrega.",
    incompleta: true,
  },
];

/**
 * Las que calzan con lo tecleado tras la barra.
 *
 * Busca en el atajo Y en el título: el vendedor se acuerda de "mantención"
 * antes que de "/servicio", y un catálogo que solo responde al atajo exacto
 * obliga a memorizar doce palabras.
 */
export function buscarRespuestas(consulta: string): RespuestaRapida[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return RESPUESTAS_RAPIDAS;
  const sinTildes = (t: string) =>
    t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return RESPUESTAS_RAPIDAS.filter(
    (r) => r.atajo.includes(sinTildes(q)) || sinTildes(r.titulo).includes(sinTildes(q)),
  );
}
