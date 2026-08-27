// Extracción estructurada de la visita, a partir de la transcripción del audio.
//
// **Lo que hace distinto a esto de `lib/extract.ts`** —el de la demo de
// TorreControl— es que el esquema no está escrito a mano: se **arma desde
// `plantillas.ts`**. Agregar un campo a la plantilla lo agrega a lo que se le
// pide a la IA, sin tocar este archivo. Al revés —esquema escrito a mano y
// plantilla escrita aparte— las dos se desincronizan al segundo cambio, y el
// síntoma es un campo que la pantalla muestra siempre vacío sin que nadie sepa
// por qué.
//
// **Y la otra diferencia, que es la que decide si esto sirve:** no se le pide a
// la IA que invente el nombre del campo. Se le pasan los lotes reales del zonal
// —código, agricultor, localidad, cultivo, variedad— y se le pide que **elija
// uno o devuelva null**. Un informe atribuido al lote equivocado es peor que un
// informe sin lote: el primero contamina el historial de un agricultor que no
// tuvo esa visita.

import OpenAI from "openai";
import type { AreaId } from "./areas";
import { VISITA, etapasDe, type Campo } from "./plantillas";

/**
 * El modelo de extracción.
 *
 * **Por qué el grande y no el barato.** Esta llamada no solo llena campos:
 * elige un lote entre los del zonal, o declara que no supo. Esa segunda parte es
 * la que importa, y es justo donde un modelo chico prefiere elegir algo
 * plausible antes que admitir incertidumbre. El costo de equivocarse no es un
 * campo vacío: es una visita colgada del historial de un agricultor que no la
 * tuvo, que es el peor error que este sistema puede cometer.
 *
 * El volumen no justifica ahorrar acá. Una visita son ~1.350 tokens de entrada
 * y ~250 de salida: alrededor de un centavo de dólar. La diferencia contra el
 * modelo más económico es de una milésima de dólar por visita.
 *
 * Se fija `gpt-5.6-sol` y no el alias `gpt-5.6`: un alias lo puede reapuntar
 * OpenAI, y entonces el comportamiento de producción cambiaría sin que exista un
 * commit que lo explique.
 *
 * `TUNICHE_EXTRACT_MODEL` es la vuelta atrás sin desplegar. No hereda de
 * `EXTRACT_MODEL` a propósito: esa la usan las demos de TorreControl, y
 * abaratarlas allá no debe abaratar el sistema de un cliente.
 */
const MODEL = process.env.TUNICHE_EXTRACT_MODEL || "gpt-5.6-sol";

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/** Un lote candidato, tal como se le ofrece al modelo para que elija. */
export interface LoteCandidato {
  id: number;
  /** El área del lote. La usa la pantalla para no ofrecer lotes de la otra. */
  area: string;
  codigo: string;
  agricultor: string;
  localidad: string | null;
  cultivo: string | null;
  variedad: string | null;
}

export interface VisitaExtraida {
  /** `id` del lote elegido, o null si no se pudo determinar sin adivinar. */
  loteId: number | null;
  /** Lo que el zonal dijo para nombrar el campo. Sirve para corregir a mano. */
  loteMencionado: string | null;
  etapa: string | null;
  datos: Record<string, unknown>;
  notaAgronomica: number | null;
  resumen: string;
}

/** Traduce un campo de la plantilla a su forma en el esquema de la función. */
function propiedadDe(c: Campo): Record<string, unknown> {
  const base: Record<string, unknown> = { description: c.ayuda ?? c.etiqueta };
  switch (c.tipo) {
    case "numero":
    case "porcentaje":
      return { ...base, type: ["number", "null"] };
    case "fecha":
      return { ...base, type: ["string", "null"], description: `${base.description} (AAAA-MM-DD)` };
    case "opcion":
      // El null va en el enum y no solo en el tipo: es lo que le da al modelo
      // una forma explícita de decir "no se mencionó" en vez de elegir el
      // primer valor de la lista, que es lo que hace cuando no tiene salida.
      return { ...base, type: ["string", "null"], enum: [...(c.valores ?? []), null] };
    case "opciones":
      return { ...base, type: "array", items: { type: "string", enum: c.valores ?? [] } };
    case "lista":
      return { ...base, type: "array", items: { type: "string" } };
    case "fotos":
      // Las fotos no salen del audio: llegan como mensajes aparte. Se excluyen.
      return { ...base, type: "null" };
    default:
      return { ...base, type: ["string", "null"] };
  }
}

const SISTEMA = `Eres un asistente que estructura reportes de visita a campo de una empresa de semillas en Chile.
Recibes la transcripción de un audio de WhatsApp que mandó un zonal desde el campo, muchas veces desde una camioneta en movimiento.

Reglas, en orden de importancia:
1. NO INVENTES. Si algo no se menciona, devuelve null o lista vacía. Un campo vacío es correcto; un campo inventado corrompe el historial de un agricultor.
2. Para elegir el lote, usa SOLO la lista de lotes que se te entrega. Si lo que dijo el zonal no calza claramente con uno, devuelve loteId null y copia en loteMencionado lo que dijo.
3. La nota agronómica es un porcentaje de 0 a 100. Solo devuélvela si el zonal dijo un número; no la deduzcas del tono.
4. El resumen son 2 o 3 frases en español de Chile, en el vocabulario del zonal, listo para que un agricultor lo lea.`;

export async function extraerVisita(params: {
  transcripcion: string;
  area: AreaId;
  lotes: LoteCandidato[];
}): Promise<VisitaExtraida> {
  const { transcripcion, area, lotes } = params;

  const propiedades: Record<string, unknown> = {
    loteId: {
      type: ["integer", "null"],
      description: "id del lote de la lista entregada. null si no calza con ninguno sin adivinar.",
    },
    loteMencionado: {
      type: ["string", "null"],
      description: "Cómo nombró el zonal el campo o el lote, tal cual lo dijo.",
    },
    etapa: {
      type: ["string", "null"],
      enum: [...etapasDe(area).map((e) => e.nombre), null],
      description: "Etapa del cultivo mencionada, si se menciona.",
    },
    resumen: { type: "string", description: "2 o 3 frases. Es lo que leerá el agricultor." },
  };
  for (const c of VISITA) {
    if (c.id === "etapa" || c.tipo === "fotos") continue;
    propiedades[c.id] = propiedadDe(c);
  }

  const listado = lotes.length
    ? lotes
        .map(
          (l) =>
            `- id ${l.id} · ${l.codigo} · ${l.agricultor}` +
            `${l.localidad ? ` · ${l.localidad}` : ""}` +
            `${l.cultivo ? ` · ${l.cultivo}` : ""}${l.variedad ? ` ${l.variedad}` : ""}`,
        )
        .join("\n")
    : "(este zonal no tiene lotes cargados)";

  const completion = await client().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SISTEMA },
      {
        role: "user",
        content:
          `Lotes que este zonal tiene a cargo:\n${listado}\n\n` +
          `Transcripción del audio:\n"""${transcripcion}"""`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "registrar_visita",
          description: "Registra de forma estructurada una visita a campo.",
          parameters: {
            type: "object",
            properties: propiedades,
            required: ["loteId", "loteMencionado", "etapa", "resumen"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "registrar_visita" } },
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    throw new Error("El modelo no devolvió la estructura esperada");
  }
  const crudo = JSON.parse(call.function.arguments) as Record<string, unknown>;

  // El id que devuelve el modelo se verifica contra la lista que se le dio. Un
  // id inventado apuntaría a un lote de OTRO agricultor, y el modelo no tiene
  // forma de saber que se equivocó.
  const idCrudo = crudo.loteId;
  const loteId =
    typeof idCrudo === "number" && lotes.some((l) => l.id === idCrudo) ? idCrudo : null;

  const datos: Record<string, unknown> = {};
  for (const c of VISITA) {
    if (c.id === "etapa" || c.tipo === "fotos") continue;
    const v = crudo[c.id];
    if (v === null || v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && !v.trim()) continue;
    datos[c.id] = v;
  }

  const nota = crudo.nota_agronomica;
  const notaAgronomica =
    typeof nota === "number" && nota >= 0 && nota <= 100 ? Math.round(nota) : null;

  return {
    loteId,
    loteMencionado: (crudo.loteMencionado as string | null) ?? null,
    etapa: (crudo.etapa as string | null) ?? null,
    datos,
    notaAgronomica,
    resumen: (crudo.resumen as string) ?? "",
  };
}
