// El sistema que pregunta.
//
// La idea de fondo: **el CRM sabe qué no sabe**, y eso es accionable.
//
// Un CRM normal muestra una ficha con campos vacíos y espera que alguien los
// llene. Nadie los llena, porque llenar campos no es el trabajo de nadie. Este
// módulo invierte el planteamiento: en vez de una ficha con huecos, produce
// **una pregunta concreta, en el momento en que se puede hacer, ordenada por
// lo que desbloquea**.
//
// Tres reglas que gobiernan el diseño:
//
//   1. **Una pregunta a la vez, y de las buenas.** Saber qué parlantes tiene
//      vale muchísimo más que saber su cumpleaños. Si se muestran quince
//      preguntas, el vendedor contesta las fáciles y deja las que importan.
//   2. **El momento manda.** El presupuesto no se pregunta en el primer minuto;
//      qué escuchó no se pregunta por WhatsApp tres semanas después. Cada
//      pregunta declara dónde tiene sentido hacerla.
//   3. **"No sé" es una respuesta válida y hay que poder registrarla.** La
//      diferencia entre "no le pregunté" y "le pregunté y no tiene" es la
//      diferencia entre una pregunta pendiente y una oportunidad de venta.
//
// Lo que este módulo NO hace: preguntarle al cliente directamente. Las
// preguntas se las hace **el vendedor**, en su lenguaje, cuando corresponde. El
// sistema propone y ordena; la conversación es de la persona.

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { crmPerfilAtributos } from "@/db/crm";

/** Dónde tiene sentido hacer cada pregunta. */
export type Momento =
  /** Cerrando la audición, con la persona recién salida de la sala. */
  | "audicion"
  /** Después de una cotización que no cerró. */
  | "cotizacion"
  /** En la conversación de WhatsApp, sin invadir. */
  | "conversacion"
  /** Cualquier momento sirve. */
  | "siempre";

export interface Pregunta {
  /** La clave del atributo que llena. */
  clave: string;
  /** Cómo se le pregunta a una persona. No es la etiqueta de un campo. */
  texto: string;
  /** Qué se hace con la respuesta. Sirve para que el vendedor entienda por qué. */
  paraQue: string;
  grupo: "sistema" | "gusto" | "contexto" | "intencion";
  momentos: Momento[];
  /**
   * Cuánto desbloquea, de 1 a 10.
   *
   * No es "qué tan importante suena" sino **cuántas decisiones cambia**. Saber
   * qué amplificación tiene define qué parlantes se le pueden ofrecer, qué
   * upgrade tiene sentido y qué cables corresponden: vale 10. El cumpleaños
   * habilita un saludo al año: vale 2.
   */
  valor: number;
  /** Opciones sugeridas, cuando la respuesta es acotada. */
  opciones?: string[];
  /** Si la respuesta es un monto en pesos. */
  esMonto?: boolean;
}

/**
 * El catálogo.
 *
 * Salen de la lámina 6 de la presentación —"qué tiene en cada eslabón, qué
 * marcas descartó, qué sala tiene en casa, si escucha vinilo o digital, qué
 * audicionó, qué presupuesto declaró"— convertidas en preguntas que un vendedor
 * puede hacer sin que suene a encuesta.
 */
export const CATALOGO: Pregunta[] = [
  // ── El sistema: los cinco eslabones ──
  //
  // Valor máximo y sin discusión. Todo el resto del CRM —el mapa, el
  // recomendador, las señales de complemento— se apoya en esto.
  {
    clave: "sistema.fuente",
    texto: "¿Con qué escucha hoy? ¿Tornamesa, streamer, CD?",
    paraQue: "Define el primer eslabón de su cadena y si el resto le calza.",
    grupo: "sistema",
    momentos: ["audicion", "conversacion", "siempre"],
    valor: 9,
  },
  {
    clave: "sistema.amplificacion",
    texto: "¿Qué amplificación tiene? ¿Integrado, o previo y etapa separados?",
    paraQue:
      "Es lo que más limita qué parlantes se le pueden ofrecer. Sin esto, cualquier recomendación va a ciegas.",
    grupo: "sistema",
    momentos: ["audicion", "conversacion", "siempre"],
    valor: 10,
  },
  {
    clave: "sistema.parlantes",
    texto: "¿Qué parlantes tiene puestos?",
    paraQue: "Fija el nivel real de su equipo y el estándar contra el que va a comparar todo lo que escuche.",
    grupo: "sistema",
    momentos: ["audicion", "conversacion", "siempre"],
    valor: 10,
  },
  {
    clave: "sistema.cables",
    texto: "¿Con qué cableado está armado?",
    paraQue: "Es el eslabón que más se descuida y el que da la conversación de sinergia.",
    grupo: "sistema",
    momentos: ["audicion", "siempre"],
    valor: 6,
  },
  {
    clave: "sistema.acondicionamiento",
    texto: "¿Tiene algo para la corriente? ¿Acondicionador, regenerador?",
    paraQue: "Casi nadie lo tiene, y es la mejora más audible por peso en un equipo ya bueno.",
    grupo: "sistema",
    momentos: ["audicion", "siempre"],
    valor: 7,
  },

  // ── El gusto: qué quiere y qué no ──
  {
    clave: "gusto.formato",
    texto: "¿Escucha más vinilo, digital o streaming?",
    paraQue: "Define por dónde entra cualquier upgrade de fuente. Es la pregunta más fácil de hacer.",
    grupo: "gusto",
    momentos: ["audicion", "conversacion", "siempre"],
    valor: 7,
    opciones: ["Vinilo", "Digital / archivos", "Streaming", "Vinilo y digital", "Los tres"],
  },
  {
    clave: "gusto.marcas_prefiere",
    texto: "¿Hay alguna marca que le tire especialmente?",
    paraQue: "En este rubro la lealtad de marca es real: quien tiene un Accuphase suele seguir con Accuphase.",
    grupo: "gusto",
    momentos: ["audicion", "conversacion", "siempre"],
    valor: 8,
  },
  {
    clave: "gusto.marcas_descarto",
    texto: "¿Alguna que ya haya escuchado y no le haya convencido?",
    paraQue:
      "Vale tanto como la anterior y casi nunca se anota. Evita ofrecerle exactamente lo que ya rechazó.",
    grupo: "gusto",
    momentos: ["audicion", "conversacion"],
    valor: 8,
  },
  {
    clave: "gusto.musica",
    texto: "¿Qué escucha habitualmente?",
    paraQue: "Cambia qué sistema conviene mostrarle: no se elige igual para jazz de cámara que para orquesta.",
    grupo: "gusto",
    momentos: ["audicion", "siempre"],
    valor: 5,
  },

  // ── El contexto: dónde va a sonar ──
  {
    clave: "contexto.sala",
    texto: "¿Cómo es la sala donde lo tiene? ¿Grande, chica, con alfombra?",
    paraQue:
      "Determina qué parlante funciona de verdad en su casa. Un parlante grande en una sala chica suena peor que uno modesto.",
    grupo: "contexto",
    momentos: ["audicion", "siempre"],
    valor: 8,
  },
  {
    clave: "contexto.como_suena",
    texto: "¿Qué le falta a su equipo hoy? ¿Qué le gustaría que hiciera mejor?",
    paraQue:
      "La mejor pregunta del catálogo. La respuesta es, literalmente, el argumento de la próxima venta — dicho por la persona misma.",
    grupo: "contexto",
    momentos: ["audicion", "conversacion", "siempre"],
    valor: 10,
  },
  {
    clave: "contexto.quien_escucha",
    texto: "¿Escucha solo, o es un equipo de la casa?",
    paraQue: "Si hay más de una persona en la decisión, la conversación y los tiempos son otros.",
    grupo: "contexto",
    momentos: ["audicion"],
    valor: 4,
  },

  // ── La intención: cuánto y cuándo ──
  //
  // Estas van al final a propósito. Preguntar el presupuesto antes de entender
  // el sistema convierte una asesoría en una venta, y en este rango se nota.
  {
    clave: "intencion.presupuesto",
    texto: "¿En qué orden de inversión está pensando?",
    paraQue: "Acota el rango del catálogo. Nunca al principio: recién cuando ya hay confianza.",
    grupo: "intencion",
    momentos: ["cotizacion", "conversacion"],
    valor: 9,
    esMonto: true,
  },
  {
    clave: "intencion.plazo",
    texto: "¿Es algo para ahora o lo está proyectando?",
    paraQue: "Define cuándo corresponde volver a llamar. Sin esto, el seguimiento es adivinanza.",
    grupo: "intencion",
    momentos: ["cotizacion", "conversacion"],
    valor: 8,
    opciones: ["Este mes", "En dos o tres meses", "Este año", "Lo está proyectando"],
  },
  {
    clave: "intencion.siguiente_paso",
    texto: "¿Cuál diría que es su próximo paso en el equipo?",
    paraQue: "Su propia hoja de ruta. Alinea lo que se le ofrece con lo que ya venía pensando.",
    grupo: "intencion",
    momentos: ["audicion", "conversacion"],
    valor: 9,
  },
];

const POR_CLAVE = new Map(CATALOGO.map((p) => [p.clave, p]));

// ─── Lo que ya se sabe ────────────────────────────────────────────────────────

export interface AtributoConocido {
  clave: string;
  valor: string | null;
  estado: "conocido" | "sin_dato" | "no_tiene";
  confianza: number;
  origen: string;
  registradoEn: Date;
}

export async function perfilDe(contactId: number): Promise<Map<string, AtributoConocido>> {
  const filas = await db
    .select()
    .from(crmPerfilAtributos)
    .where(eq(crmPerfilAtributos.contactId, contactId));

  const mapa = new Map<string, AtributoConocido>();
  for (const f of filas) {
    // Un dato vencido se trata como no sabido. Un presupuesto declarado hace
    // dos años no es un presupuesto: es una anécdota.
    if (f.vigenteHasta && new Date(f.vigenteHasta) < new Date()) continue;
    mapa.set(f.clave, {
      clave: f.clave,
      valor: f.valor,
      estado: f.estado as AtributoConocido["estado"],
      confianza: f.confianza,
      origen: f.origen,
      registradoEn: f.registradoEn,
    });
  }
  return mapa;
}

// ─── El motor ─────────────────────────────────────────────────────────────────

export interface PreguntaPropuesta extends Pregunta {
  /**
   * Por qué esta y no otra. Se muestra al vendedor: una recomendación sin
   * motivo se ignora, y con motivo se discute — que ya es mejor.
   */
  porQue: string;
}

/**
 * Qué preguntarle a esta persona, ahora.
 *
 * Devuelve **como máximo tres**, y el tope no es negociable. Con quince
 * preguntas en pantalla el vendedor contesta las tres más fáciles —el
 * cumpleaños, la comuna— y deja sin responder justamente las que valen. Con
 * tres bien elegidas, las contesta todas.
 */
export async function queLePregunto(
  contactId: number,
  momento: Momento,
  limite = 3,
): Promise<PreguntaPropuesta[]> {
  const perfil = await perfilDe(contactId);

  const candidatas = CATALOGO.filter((p) => {
    // Del momento correcto, o de las que sirven siempre.
    if (!p.momentos.includes(momento) && !p.momentos.includes("siempre")) return false;

    const conocido = perfil.get(p.clave);
    if (!conocido) return true;

    // Ya se sabe con certeza: no se vuelve a preguntar. Repreguntar lo que el
    // cliente ya contestó es la señal más clara de que nadie tomó nota.
    if (conocido.estado === "conocido" && conocido.confianza >= 2) return false;

    // Confirmado que no lo tiene: tampoco se pregunta. Eso ya es una
    // oportunidad de venta y la trabaja el recomendador, no este módulo.
    if (conocido.estado === "no_tiene") return false;

    // Queda lo dudoso: dato de baja confianza o marcado como sin_dato. Vale
    // volver a preguntar, pero pesa menos que algo que nunca se preguntó.
    return true;
  });

  return candidatas
    .map((p) => {
      const conocido = perfil.get(p.clave);
      // Lo que nunca se preguntó vale su valor completo. Confirmar algo que ya
      // se sospecha vale la mitad: es útil, pero no urgente.
      const peso = conocido ? p.valor * 0.5 : p.valor;
      return {
        ...p,
        peso,
        porQue: conocido
          ? `Hay un dato de baja confianza (${conocido.origen}). Confirmarlo lo vuelve usable.`
          : p.paraQue,
      };
    })
    .sort((a, b) => b.peso - a.peso)
    .slice(0, limite)
    .map(({ peso: _peso, ...p }) => p);
}

// ─── Registrar la respuesta ───────────────────────────────────────────────────

export interface Respuesta {
  contactId: number;
  clave: string;
  /** El valor, o null si la respuesta fue "no tiene" o "no sabe". */
  valor?: string | null;
  estado?: "conocido" | "sin_dato" | "no_tiene";
  confianza?: number;
  origen?: string;
  origenId?: number;
  registradoPor?: number;
}

/**
 * Guarda lo que se supo.
 *
 * `ON CONFLICT` actualiza en vez de apilar: la ficha muestra lo que es cierto
 * hoy, no la historia de todo lo que alguna vez se creyó. Pero **solo pisa si
 * el dato nuevo es al menos tan confiable como el viejo**: que un vendedor
 * anote de memoria "creo que tiene Harbeth" no puede borrar un Accuphase que
 * está en una factura.
 */
export async function registrarRespuesta(r: Respuesta): Promise<void> {
  const definicion = POR_CLAVE.get(r.clave);
  const confianza = r.confianza ?? 2;

  // El presupuesto y el plazo caducan al año: dejar de saberlos es más honesto
  // que seguir mostrando una cifra que la persona dijo en otra situación.
  const caduca = definicion?.grupo === "intencion";
  const vigenteHasta = caduca ? new Date(Date.now() + 365 * 86_400_000) : null;

  await db
    .insert(crmPerfilAtributos)
    .values({
      contactId: r.contactId,
      clave: r.clave,
      valor: r.valor ?? null,
      estado: r.estado ?? (r.valor ? "conocido" : "sin_dato"),
      confianza,
      origen: r.origen ?? "vendedor",
      origenId: r.origenId ?? null,
      registradoPor: r.registradoPor ?? null,
      vigenteHasta,
    })
    .onConflictDoUpdate({
      target: [crmPerfilAtributos.contactId, crmPerfilAtributos.clave],
      set: {
        valor: sql`CASE WHEN EXCLUDED.confianza >= ${crmPerfilAtributos.confianza}
                        THEN EXCLUDED.valor ELSE ${crmPerfilAtributos.valor} END`,
        estado: sql`CASE WHEN EXCLUDED.confianza >= ${crmPerfilAtributos.confianza}
                         THEN EXCLUDED.estado ELSE ${crmPerfilAtributos.estado} END`,
        confianza: sql`GREATEST(EXCLUDED.confianza, ${crmPerfilAtributos.confianza})`,
        origen: sql`CASE WHEN EXCLUDED.confianza >= ${crmPerfilAtributos.confianza}
                         THEN EXCLUDED.origen ELSE ${crmPerfilAtributos.origen} END`,
        registradoEn: sql`NOW()`,
        vigenteHasta,
      },
    });
}

// ─── Cuánto se sabe ───────────────────────────────────────────────────────────

export interface Completitud {
  /** De los cinco eslabones, cuántos se conocen. */
  eslabonesConocidos: number;
  /** Cuántos se confirmó que no tiene. Esos son oportunidad. */
  eslabonesNoTiene: number;
  /** Cuántos siguen sin preguntarse. */
  eslabonesSinDato: number;
  /** Puntaje 0-100 sobre el total de valor del catálogo. */
  puntaje: number;
  /** La pregunta pendiente de mayor valor. */
  siguiente: Pregunta | null;
}

/**
 * Cuánto se sabe de una persona, en un número.
 *
 * El puntaje pondera por valor, no por cantidad de campos llenos: alguien de
 * quien se sabe la amplificación y los parlantes está mejor conocido que uno
 * con ocho campos triviales completos. Un CRM que cuenta campos premia llenar
 * los fáciles.
 */
export async function completitudDe(contactId: number): Promise<Completitud> {
  const perfil = await perfilDe(contactId);
  const ESLABONES = [
    "sistema.fuente",
    "sistema.amplificacion",
    "sistema.parlantes",
    "sistema.cables",
    "sistema.acondicionamiento",
  ];

  let conocidos = 0;
  let noTiene = 0;
  for (const clave of ESLABONES) {
    const a = perfil.get(clave);
    if (a?.estado === "conocido") conocidos++;
    else if (a?.estado === "no_tiene") noTiene++;
  }

  const valorTotal = CATALOGO.reduce((s, p) => s + p.valor, 0);
  const valorSabido = CATALOGO.reduce((s, p) => {
    const a = perfil.get(p.clave);
    // "No tiene" cuenta como sabido: es un dato, y de los buenos.
    return a && (a.estado === "conocido" || a.estado === "no_tiene") ? s + p.valor : s;
  }, 0);

  const pendientes = CATALOGO.filter((p) => {
    const a = perfil.get(p.clave);
    return !a || a.estado === "sin_dato";
  }).sort((a, b) => b.valor - a.valor);

  return {
    eslabonesConocidos: conocidos,
    eslabonesNoTiene: noTiene,
    eslabonesSinDato: ESLABONES.length - conocidos - noTiene,
    puntaje: Math.round((valorSabido / valorTotal) * 100),
    siguiente: pendientes[0] ?? null,
  };
}

// ─── La cartera, ordenada por lo que falta saber ──────────────────────────────

export interface HuecoDeCartera {
  contactId: number;
  cliente: string;
  telefono: string | null;
  invertido: number;
  puntaje: number;
  siguiente: Pregunta | null;
  ultimaAudicion: Date | null;
}

/**
 * A quién conviene preguntarle primero.
 *
 * Ordena por **plata invertida contra lo poco que se sabe de esa persona**: un
 * cliente de ochenta millones del que no se sabe qué amplificación tiene es un
 * problema mucho más caro que un desconocido del que tampoco se sabe nada.
 */
export async function huecosDeCartera(limite = 15): Promise<HuecoDeCartera[]> {
  const filas = await db.execute(sql`
    SELECT c.id AS "contactId", c.nombre AS cliente, c.telefono,
           COALESCE(SUM(o.total), 0)::float8 AS invertido,
           (SELECT MAX(a.fecha) FROM crm_audiciones a WHERE a.contact_id = c.id) AS "ultimaAudicion"
    FROM crm_contacts c
    LEFT JOIN crm_orders o ON o.contact_id = c.id
    GROUP BY c.id, c.nombre, c.telefono
    HAVING COALESCE(SUM(o.total), 0) > 0
    ORDER BY invertido DESC
    LIMIT 60
  `);

  type Fila = {
    contactId: number; cliente: string; telefono: string | null;
    invertido: number; ultimaAudicion: string | null;
  };

  const resultado: HuecoDeCartera[] = [];
  for (const f of filas.rows as unknown as Fila[]) {
    const c = await completitudDe(f.contactId);
    resultado.push({
      contactId: f.contactId,
      cliente: f.cliente,
      telefono: f.telefono,
      invertido: Number(f.invertido),
      puntaje: c.puntaje,
      siguiente: c.siguiente,
      ultimaAudicion: f.ultimaAudicion ? new Date(f.ultimaAudicion) : null,
    });
  }

  // Plata alta y puntaje bajo primero. El producto es deliberado: pondera las
  // dos cosas en una sola cifra en vez de obligar a elegir entre "los que más
  // gastan" y "los que menos conocemos".
  return resultado
    .sort((a, b) => b.invertido * (100 - b.puntaje) - a.invertido * (100 - a.puntaje))
    .slice(0, limite);
}
