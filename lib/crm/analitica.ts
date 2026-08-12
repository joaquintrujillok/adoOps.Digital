// Analítica de clientes: RFM, valor de vida, cohortes y calidad del dato.
//
// Todo lo que sale de acá se calcula con reglas explícitas y reproducibles. No
// hay modelo ni caja negra: cuando un gerente pregunta "¿por qué este cliente
// está en riesgo?", la respuesta tiene que ser una frase con números, no "así
// lo clasificó el sistema".
//
// **Se traen los datos y se calcula en memoria**, en vez de resolverlo con SQL
// analítico. Con la escala de un retail de nicho —miles de clientes, decenas de
// miles de transacciones— la diferencia de velocidad es despreciable, y a cambio
// las reglas quedan legibles para quien las tenga que discutir con el cliente.
// Si esto creciera a cientos de miles de clientes, los quintiles y las cohortes
// bajan a SQL sin cambiar la interfaz de este módulo.

import { sql } from "drizzle-orm";
import { db } from "@/db";

// ─── Datos base ──────────────────────────────────────────────────────────────

export interface ClienteAnalitico {
  contactId: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rut: string | null;
  ciudad: string | null;
  fuente: string | null;
  ownerId: number | null;
  ejecutivo: string | null;
  consentimiento: boolean;
  optInWhatsapp: boolean;
  /** Fecha de la primera compra: define su cohorte y no cambia nunca. */
  primeraCompra: Date | null;
  ultimaCompra: Date | null;
  compras: number;
  monto: number;
  ticketPromedio: number;
  /** Días desde la última compra. */
  recencia: number | null;
  /** Días entre la primera y la última compra: cuánto lleva siendo cliente. */
  vidaDias: number;
  /** Días promedio entre compras. Null si compró una sola vez. */
  cicloDias: number | null;
  canales: string[];
  /** Compró en tienda y en la web. Es el segmento que más vale. */
  omnicanal: boolean;
  categorias: string[];
  marcas: string[];
  categoriaEntrada: string | null;
  categoriaPrincipal: string | null;
}

interface FilaCompra {
  contactId: number;
  fecha: string;
  total: number;
  origen: string;
}

/**
 * Trae a todos los clientes con compras y sus agregados.
 *
 * Tres consultas y un cruce en memoria. Nunca subconsultas correlacionadas
 * dentro del select: sin joins, Drizzle escribe la columna externa sin calificar
 * la tabla y adentro de la subconsulta se resuelve contra la tabla equivocada —
 * la consulta corre sin error y devuelve cifras falsas.
 */
export async function clientesAnaliticos(): Promise<ClienteAnalitico[]> {
  const [contactos, compras, lineas] = await Promise.all([
    db.execute(sql`
      SELECT c.id, c.nombre, c.email, c.telefono, c.rut, c.ciudad, c.fuente,
             c.owner_id AS "ownerId", u.nombre AS ejecutivo,
             c.consentimiento, c.opt_in_whatsapp AS "optInWhatsapp"
      FROM crm_contacts c
      LEFT JOIN crm_users u ON u.id = c.owner_id
    `),
    db.execute(sql`
      SELECT contact_id AS "contactId", fecha, total::float8 AS total, origen
      FROM crm_orders
      WHERE contact_id IS NOT NULL
      ORDER BY contact_id, fecha
    `),
    db.execute(sql`
      SELECT o.contact_id AS "contactId", o.fecha, p.categoria, p.marca,
             (i.cantidad * i.precio_unitario)::float8 AS subtotal
      FROM crm_order_items i
      JOIN crm_orders o ON o.id = i.order_id
      JOIN crm_products p ON p.id = i.product_id
      WHERE o.contact_id IS NOT NULL
      ORDER BY o.contact_id, o.fecha
    `),
  ]);

  const porCliente = new Map<number, FilaCompra[]>();
  for (const f of compras.rows as unknown as FilaCompra[]) {
    const lista = porCliente.get(f.contactId) ?? [];
    lista.push(f);
    porCliente.set(f.contactId, lista);
  }

  type FilaLinea = {
    contactId: number;
    fecha: string;
    categoria: string | null;
    marca: string | null;
    subtotal: number;
  };
  const lineasPorCliente = new Map<number, FilaLinea[]>();
  for (const f of lineas.rows as unknown as FilaLinea[]) {
    const lista = lineasPorCliente.get(f.contactId) ?? [];
    lista.push(f);
    lineasPorCliente.set(f.contactId, lista);
  }

  const ahora = Date.now();
  const resultado: ClienteAnalitico[] = [];

  for (const c of contactos.rows as unknown as Record<string, unknown>[]) {
    const id = Number(c.id);
    const suyas = porCliente.get(id) ?? [];
    if (suyas.length === 0) continue; // sin compras no entra al RFM

    const fechas = suyas.map((s) => new Date(s.fecha).getTime()).sort((a, b) => a - b);
    const monto = suyas.reduce((s, x) => s + Number(x.total), 0);
    const primera = fechas[0];
    const ultima = fechas[fechas.length - 1];

    const misLineas = lineasPorCliente.get(id) ?? [];
    const porCategoria = new Map<string, number>();
    const marcas = new Set<string>();
    for (const l of misLineas) {
      if (l.categoria) porCategoria.set(l.categoria, (porCategoria.get(l.categoria) ?? 0) + Number(l.subtotal));
      if (l.marca) marcas.add(l.marca);
    }

    // La categoría de entrada es la de mayor monto de su PRIMERA compra: es la
    // que respondió "por qué entró", y suele predecir mejor que la más repetida.
    const fechaPrimera = misLineas[0]?.fecha;
    const deLaPrimera = misLineas.filter((l) => l.fecha === fechaPrimera);
    const categoriaEntrada =
      [...deLaPrimera.reduce((m, l) => {
        if (l.categoria) m.set(l.categoria, (m.get(l.categoria) ?? 0) + Number(l.subtotal));
        return m;
      }, new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const canales = [...new Set(suyas.map((s) => s.origen))];

    resultado.push({
      contactId: id,
      nombre: String(c.nombre),
      email: (c.email as string) ?? null,
      telefono: (c.telefono as string) ?? null,
      rut: (c.rut as string) ?? null,
      ciudad: (c.ciudad as string) ?? null,
      fuente: (c.fuente as string) ?? null,
      ownerId: c.ownerId ? Number(c.ownerId) : null,
      ejecutivo: (c.ejecutivo as string) ?? null,
      consentimiento: Boolean(c.consentimiento),
      optInWhatsapp: Boolean(c.optInWhatsapp),
      primeraCompra: new Date(primera),
      ultimaCompra: new Date(ultima),
      compras: suyas.length,
      monto,
      ticketPromedio: Math.round(monto / suyas.length),
      recencia: Math.floor((ahora - ultima) / 86_400_000),
      vidaDias: Math.floor((ultima - primera) / 86_400_000),
      cicloDias:
        fechas.length > 1
          ? Math.round((ultima - primera) / (fechas.length - 1) / 86_400_000)
          : null,
      canales,
      omnicanal: canales.includes("pos") && canales.includes("ecommerce"),
      categorias: [...porCategoria.keys()],
      marcas: [...marcas],
      categoriaEntrada,
      categoriaPrincipal:
        [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    });
  }

  return resultado;
}

// ─── RFM ─────────────────────────────────────────────────────────────────────

export type SegmentoRfm =
  | "campeones"
  | "leales"
  | "potenciales"
  | "nuevos"
  | "prometedores"
  | "necesitan_atencion"
  | "por_dormirse"
  | "en_riesgo"
  | "no_perder"
  | "hibernando"
  | "perdidos";

export const SEGMENTOS: Record<
  SegmentoRfm,
  { nombre: string; descripcion: string; accion: string; tono: string }
> = {
  campeones: {
    nombre: "Campeones",
    descripcion: "Compran seguido, hace poco y son los que más gastan.",
    accion: "Acceso anticipado a piezas nuevas y atención con cita reservada.",
    tono: "var(--series-6)",
  },
  leales: {
    nombre: "Leales",
    descripcion: "Vuelven con regularidad y responden bien.",
    accion: "Invitarlos a eventos y pedirles referidos.",
    tono: "var(--series-3)",
  },
  potenciales: {
    nombre: "Potenciales leales",
    descripcion: "Compraron hace poco más de una vez. Están enganchando.",
    accion: "Empujar la segunda o tercera compra con algo complementario.",
    tono: "var(--series-1)",
  },
  nuevos: {
    nombre: "Nuevos",
    descripcion: "Primera compra reciente. Todavía no son clientes.",
    accion: "Bienvenida con servicio y contenido de la marca que compraron.",
    tono: "var(--ramp-2)",
  },
  prometedores: {
    nombre: "Prometedores",
    descripcion: "Compraron una vez, no hace mucho, y todavía están cerca.",
    accion: "Un contacto con motivo concreto antes de que se enfríen.",
    tono: "var(--ramp-3)",
  },
  necesitan_atencion: {
    nombre: "Necesitan atención",
    descripcion: "Buenos clientes que empezaron a espaciar sus compras.",
    accion: "Llamada del ejecutivo, no un correo masivo.",
    tono: "var(--series-4)",
  },
  por_dormirse: {
    nombre: "A punto de dormirse",
    descripcion: "Poca frecuencia y ya llevan tiempo sin aparecer.",
    accion: "Reactivación con una novedad de su categoría.",
    tono: "var(--series-2)",
  },
  en_riesgo: {
    nombre: "En riesgo",
    descripcion: "Compraban seguido y dejaron de venir.",
    accion: "Contacto personal para entender qué pasó.",
    tono: "var(--series-8)",
  },
  no_perder: {
    nombre: "No los puedo perder",
    descripcion: "Los que más gastaron y llevan mucho sin volver.",
    accion: "Prioridad uno del gerente: llamada, no mensaje.",
    tono: "var(--status-critical)",
  },
  hibernando: {
    nombre: "Hibernando",
    descripcion: "Compra pequeña y hace mucho tiempo.",
    accion: "Campaña de bajo costo. No gastar tiempo de ejecutivo.",
    tono: "var(--series-7)",
  },
  perdidos: {
    nombre: "Perdidos",
    descripcion: "Una compra chica, hace años, sin señales de vida.",
    accion: "Mantener en la base, no invertir en ellos.",
    tono: "var(--crm-muted)",
  },
};

export interface ClienteRfm extends ClienteAnalitico {
  r: number;
  f: number;
  m: number;
  segmento: SegmentoRfm;
}

/**
 * Escalas por cortes absolutos, no por quintiles.
 *
 * Esta fue la decisión más importante del modelo y va contra el manual. El RFM
 * de libro reparte la cartera en quintiles, y con cien mil clientes eso está
 * bien. Acá hay ochenta y tantos y entran tres o cuatro compras al mes.
 *
 * Con esa cantidad el quintil deja de describir el negocio y empieza a
 * inventarlo: el 20% superior son diecisiete personas **por definición**, hayan
 * gastado cuarenta millones o seiscientas lucas. Si un año la cartera es pareja,
 * el modelo igual va a coronar campeones y condenar perdidos, porque su trabajo
 * es partir la lista en cinco, no medir. Y al revés: basta que entre un cliente
 * de $39.900.000 para que todos los demás bajen un escalón sin haber cambiado su
 * conducta. La jerarquía se movería sola.
 *
 * Los cortes fijos no tienen ese defecto y además se explican en una frase.
 * "M5 es sobre treinta millones" es algo que un gerente repite en una reunión.
 * "M5 es el quintil superior de la distribución" no lo es, y lo que no se puede
 * repetir no se usa.
 *
 * El costo es real y hay que decirlo: estos números quedan amarrados a la
 * realidad del 2026 y hay que revisarlos si cambia el mix o si el peso se mueve
 * fuerte. Es un costo barato comparado con un dashboard que miente en silencio.
 */
function escalaPorCortes(cortes: number[], invertido = false): (v: number) => number {
  return (v: number) => {
    let nivel = 1;
    for (const c of cortes) if (v > c) nivel++;
    return invertido ? 6 - nivel : nivel;
  };
}

/**
 * Recencia en días, calibrada al ciclo del rubro.
 *
 * Un sistema de audio no se renueva como un reloj ni como un par de zapatos. El
 * cliente compra los parlantes, escucha un año, y recién ahí empieza a pensar en
 * la etapa de potencia. Dieciocho meses de silencio son normales acá y serían
 * alarma en cualquier retail. Por eso R3 llega hasta los dos años: alguien que
 * compró hace veinte meses no está perdido, está escuchando.
 */
const CORTES_RECENCIA = [180, 365, 730, 1095]; // 6m · 12m · 24m · 36m

/**
 * Monto acumulado en pesos, calibrado al catálogo real ($49.900 a $39.900.000).
 *
 * Los tramos siguen el sistema, no la estadística: bajo el millón se compran
 * cables y accesorios; sobre los treinta hay un sistema de referencia completo.
 */
const CORTES_MONTO = [1_000_000, 4_000_000, 12_000_000, 30_000_000];

/**
 * Asigna el segmento según la combinación de R y F.
 *
 * El monto no entra en la regla de segmento —solo R y F— porque la plata ya está
 * dentro de la frecuencia en la práctica, y meterla produce segmentos que nadie
 * sabe explicar. El monto se usa para priorizar DENTRO del segmento, que es
 * donde de verdad sirve.
 */
function segmentoDe(r: number, f: number, m: number): SegmentoRfm {
  if (r >= 4 && f >= 4) return "campeones";
  if (r >= 3 && f >= 3) return "leales";
  if (r >= 4 && f >= 2) return "potenciales";
  if (r === 5 && f === 1) return "nuevos";
  if (r === 4 && f === 1) return "prometedores";
  if (r === 3 && f <= 2) return "por_dormirse";
  if (r === 3) return "necesitan_atencion";
  if (r <= 2 && f >= 4 && m >= 4) return "no_perder";
  if (r <= 2 && f >= 3) return "en_riesgo";
  if (r === 2) return "hibernando";
  return f >= 2 ? "hibernando" : "perdidos";
}

/**
 * Frecuencia por cortes naturales, no por quintiles.
 *
 * La frecuencia es discreta y está aplastada contra el 1: en retail de alta gama
 * dos de cada tres clientes compran una sola vez. Con quintiles, los tres
 * primeros caen todos en "1 compra" y la matriz sale con columnas enteras
 * vacías — que se lee como un error del sistema, no como una propiedad del
 * negocio.
 *
 * Los cortes fijos además se explican solos: "F5 son los que compraron seis
 * veces o más" es una frase que un gerente puede repetir. "F5 es el quintil
 * superior de la distribución de frecuencia" no lo es.
 */
function escalaFrecuencia(compras: number): number {
  if (compras >= 5) return 5;
  if (compras === 4) return 4;
  if (compras === 3) return 3;
  if (compras === 2) return 2;
  return 1;
}

export function calcularRfm(clientes: ClienteAnalitico[]): ClienteRfm[] {
  if (clientes.length === 0) return [];

  const escalaR = escalaPorCortes(CORTES_RECENCIA, true);
  const escalaM = escalaPorCortes(CORTES_MONTO);

  return clientes.map((c) => {
    const r = escalaR(c.recencia ?? 9999);
    const f = escalaFrecuencia(c.compras);
    const m = escalaM(c.monto);
    return { ...c, r, f, m, segmento: segmentoDe(r, f, m) };
  });
}

/** Los cortes, en texto, para mostrarlos junto a la matriz. */
export const LEYENDA_ESCALAS = {
  recencia: ["Más de 3 años", "2 a 3 años", "1 a 2 años", "6 a 12 meses", "Últimos 6 meses"],
  frecuencia: ["1 compra", "2 compras", "3 compras", "4 compras", "5 o más"],
  monto: ["Bajo $1M", "$1M a $4M", "$4M a $12M", "$12M a $30M", "Sobre $30M"],
} as const;

export interface ResumenSegmento {
  segmento: SegmentoRfm;
  nombre: string;
  descripcion: string;
  accion: string;
  tono: string;
  clientes: number;
  porcentaje: number;
  monto: number;
  porcentajeMonto: number;
  ticketPromedio: number;
  recenciaMediana: number;
  comprasPromedio: number;
  contactables: number;
}

export function resumirSegmentos(rfm: ClienteRfm[]): ResumenSegmento[] {
  const total = rfm.length;
  const montoTotal = rfm.reduce((s, c) => s + c.monto, 0) || 1;

  return (Object.keys(SEGMENTOS) as SegmentoRfm[])
    .map((seg) => {
      const miembros = rfm.filter((c) => c.segmento === seg);
      const monto = miembros.reduce((s, c) => s + c.monto, 0);
      const recencias = miembros.map((c) => c.recencia ?? 0).sort((a, b) => a - b);

      return {
        segmento: seg,
        ...SEGMENTOS[seg],
        clientes: miembros.length,
        porcentaje: total > 0 ? (miembros.length / total) * 100 : 0,
        monto,
        porcentajeMonto: (monto / montoTotal) * 100,
        ticketPromedio: miembros.length
          ? Math.round(monto / miembros.reduce((s, c) => s + c.compras, 0))
          : 0,
        recenciaMediana: recencias.length ? recencias[Math.floor(recencias.length / 2)] : 0,
        comprasPromedio: miembros.length
          ? miembros.reduce((s, c) => s + c.compras, 0) / miembros.length
          : 0,
        contactables: miembros.filter((c) => c.consentimiento && (c.telefono || c.email)).length,
      };
    })
    .filter((s) => s.clientes > 0)
    .sort((a, b) => b.monto - a.monto);
}

/** La matriz 5×5: cuántos clientes y cuánta plata hay en cada celda R×F. */
export function matrizRfm(rfm: ClienteRfm[]) {
  const celdas: { r: number; f: number; clientes: number; monto: number }[] = [];
  for (let r = 5; r >= 1; r--) {
    for (let f = 1; f <= 5; f++) {
      const miembros = rfm.filter((c) => c.r === r && c.f === f);
      celdas.push({
        r,
        f,
        clientes: miembros.length,
        monto: miembros.reduce((s, c) => s + c.monto, 0),
      });
    }
  }
  return celdas;
}

/**
 * Migración entre segmentos: dónde estaba cada cliente hace `mesesAtras` y dónde
 * está hoy.
 *
 * Es la vista que convierte el RFM en algo accionable. Una foto dice "tienes 80
 * clientes en riesgo"; la migración dice "**23 de tus leales cayeron a en
 * riesgo este trimestre**", que es una conversación completamente distinta.
 */
export async function migracionSegmentos(mesesAtras = 3) {
  const corte = new Date();
  corte.setMonth(corte.getMonth() - mesesAtras);

  const [hoy, antes] = await Promise.all([
    clientesAnaliticos().then(calcularRfm),
    clientesAnaliticosHasta(corte).then(calcularRfm),
  ]);

  const antesPorId = new Map(antes.map((c) => [c.contactId, c.segmento]));
  const movimientos = new Map<string, number>();

  for (const c of hoy) {
    const previo = antesPorId.get(c.contactId);
    // Sin historia previa es un cliente nuevo, no una migración.
    if (!previo) continue;
    if (previo === c.segmento) continue;
    const clave = `${previo}→${c.segmento}`;
    movimientos.set(clave, (movimientos.get(clave) ?? 0) + 1);
  }

  const nuevos = hoy.filter((c) => !antesPorId.has(c.contactId)).length;

  return {
    movimientos: [...movimientos.entries()]
      .map(([clave, n]) => {
        const [desde, hasta] = clave.split("→") as [SegmentoRfm, SegmentoRfm];
        return {
          desde,
          hasta,
          nombreDesde: SEGMENTOS[desde].nombre,
          nombreHasta: SEGMENTOS[hasta].nombre,
          clientes: n,
          // Un movimiento es bueno si sube en la jerarquía de valor.
          mejora: ORDEN_VALOR.indexOf(hasta) < ORDEN_VALOR.indexOf(desde),
        };
      })
      .sort((a, b) => b.clientes - a.clientes),
    nuevos,
    mesesAtras,
  };
}

/** De más a menos valioso. Define si una migración es buena o mala noticia. */
const ORDEN_VALOR: SegmentoRfm[] = [
  "campeones", "leales", "potenciales", "no_perder", "necesitan_atencion",
  "nuevos", "prometedores", "en_riesgo", "por_dormirse", "hibernando", "perdidos",
];

/** El mismo análisis pero cortando la historia en una fecha: para comparar. */
async function clientesAnaliticosHasta(corte: Date): Promise<ClienteAnalitico[]> {
  const todos = await clientesAnaliticos();
  const compras = await db.execute(sql`
    SELECT contact_id AS "contactId", fecha, total::float8 AS total, origen
    FROM crm_orders
    WHERE contact_id IS NOT NULL AND fecha <= ${corte}
    ORDER BY contact_id, fecha
  `);

  const porCliente = new Map<number, FilaCompra[]>();
  for (const f of compras.rows as unknown as FilaCompra[]) {
    const lista = porCliente.get(f.contactId) ?? [];
    lista.push(f);
    porCliente.set(f.contactId, lista);
  }

  const ahora = corte.getTime();
  const resultado: ClienteAnalitico[] = [];

  for (const c of todos) {
    const suyas = porCliente.get(c.contactId) ?? [];
    // Quien todavía no había comprado a esa fecha no existía como cliente: no
    // se le puede asignar un segmento retroactivo.
    if (suyas.length === 0) continue;
    const fechas = suyas.map((s) => new Date(s.fecha).getTime()).sort((a, b) => a - b);
    resultado.push({
      ...c,
      compras: suyas.length,
      monto: suyas.reduce((s, x) => s + Number(x.total), 0),
      recencia: Math.floor((ahora - fechas[fechas.length - 1]) / 86_400_000),
    });
  }

  return resultado;
}

// ─── Valor de vida ───────────────────────────────────────────────────────────

export interface ResumenLtv {
  /** Promedio de lo que ya gastó cada cliente. */
  ltvHistorico: number;
  ltvMediana: number;
  /** Lo que se espera que gaste en los próximos 12 meses, por cliente activo. */
  ltvProyectado12m: number;
  ticketPromedio: number;
  comprasPromedio: number;
  vidaPromedioDias: number;
  /** Qué parte de los ingresos aporta el 20% que más gasta. */
  concentracionTop20: number;
  /** Cuánto más vale un cliente que compra en los dos canales. */
  ltvOmnicanal: number;
  ltvUnCanal: number;
}

export function resumirLtv(clientes: ClienteAnalitico[]): ResumenLtv {
  if (clientes.length === 0) {
    return {
      ltvHistorico: 0, ltvMediana: 0, ltvProyectado12m: 0, ticketPromedio: 0,
      comprasPromedio: 0, vidaPromedioDias: 0, concentracionTop20: 0,
      ltvOmnicanal: 0, ltvUnCanal: 0,
    };
  }

  const montos = clientes.map((c) => c.monto).sort((a, b) => b - a);
  const total = montos.reduce((s, m) => s + m, 0);
  const top20 = montos.slice(0, Math.max(1, Math.round(montos.length * 0.2)));

  // Proyección simple y honesta: ticket promedio × frecuencia anual observada.
  // No hay modelo probabilístico —BG/NBD y compañía— porque para una propuesta
  // el número tiene que poder explicarse en una frase, y porque con un año de
  // datos limpios cualquier modelo sofisticado estaría ajustando ruido.
  const activos = clientes.filter((c) => (c.recencia ?? 9999) <= 365);
  const proyectado = activos.length
    ? Math.round(
        activos.reduce((s, c) => {
          const comprasAnuales = c.cicloDias ? 365 / Math.max(30, c.cicloDias) : 0.5;
          return s + c.ticketPromedio * comprasAnuales;
        }, 0) / activos.length,
      )
    : 0;

  const omni = clientes.filter((c) => c.omnicanal);
  const uno = clientes.filter((c) => !c.omnicanal);

  return {
    ltvHistorico: Math.round(total / clientes.length),
    ltvMediana: montos[Math.floor(montos.length / 2)] ?? 0,
    ltvProyectado12m: proyectado,
    ticketPromedio: Math.round(
      total / clientes.reduce((s, c) => s + c.compras, 0),
    ),
    comprasPromedio: clientes.reduce((s, c) => s + c.compras, 0) / clientes.length,
    vidaPromedioDias: Math.round(
      clientes.reduce((s, c) => s + c.vidaDias, 0) / clientes.length,
    ),
    concentracionTop20: (top20.reduce((s, m) => s + m, 0) / (total || 1)) * 100,
    ltvOmnicanal: omni.length ? Math.round(omni.reduce((s, c) => s + c.monto, 0) / omni.length) : 0,
    ltvUnCanal: uno.length ? Math.round(uno.reduce((s, c) => s + c.monto, 0) / uno.length) : 0,
  };
}

export interface Cohorte {
  /** Año de la primera compra. */
  clave: string;
  etiqueta: string;
  clientes: number;
  /** Ingreso acumulado promedio por cliente al cerrar el trimestre N. */
  acumulado: number[];
  /** Cuántos de la cohorte compraron durante el trimestre N. */
  retencion: number[];
  ltvActual: number;
}

/**
 * Cohortes por año de adquisición, medidas en trimestres.
 *
 * La versión anterior agrupaba por mes de entrada y medía mes a mes, que es lo
 * que hace todo el mundo. Acá no funciona. Entran unos treinta clientes nuevos
 * al año: una cohorte mensual son dos o tres personas, y con dos personas la
 * tabla no muestra una tendencia, muestra si a uno de los dos le gustó el
 * amplificador. Basta que uno compre parlantes para que su cohorte parezca la
 * mejor de la historia.
 *
 * Agrupar por año deja treinta clientes por fila —ahí sí un promedio significa
 * algo— y medir en trimestres respeta el ritmo del rubro, donde entre una compra
 * y la siguiente pasan meses. La pregunta que responde sigue siendo la misma y
 * es la que importa: ¿los clientes que entraron este año valen más o menos que
 * los del año pasado a la misma edad?
 */
export async function cohortes(trimestresMaximos = 12): Promise<Cohorte[]> {
  const filas = await db.execute(sql`
    SELECT c.id AS "contactId",
           to_char(date_trunc('year', c.primera_compra_en), 'YYYY') AS cohorte,
           o.total::float8 AS total,
           (FLOOR((EXTRACT(YEAR FROM AGE(o.fecha, c.primera_compra_en)) * 12
                   + EXTRACT(MONTH FROM AGE(o.fecha, c.primera_compra_en))) / 3))::int
             AS "trimestreRelativo"
    FROM crm_contacts c
    JOIN crm_orders o ON o.contact_id = c.id
    WHERE c.primera_compra_en IS NOT NULL
    ORDER BY cohorte, "trimestreRelativo"
  `);

  type Fila = { contactId: number; cohorte: string; total: number; trimestreRelativo: number };
  const datos = filas.rows as unknown as Fila[];

  const porCohorte = new Map<string, Fila[]>();
  for (const f of datos) {
    const lista = porCohorte.get(f.cohorte) ?? [];
    lista.push(f);
    porCohorte.set(f.cohorte, lista);
  }

  const resultado: Cohorte[] = [];

  for (const [anio, filasCohorte] of [...porCohorte.entries()].sort()) {
    const clientes = new Set(filasCohorte.map((f) => f.contactId));
    const acumulado: number[] = [];
    const retencion: number[] = [];
    let suma = 0;

    for (let t = 0; t <= trimestresMaximos; t++) {
      const delTrimestre = filasCohorte.filter((f) => f.trimestreRelativo === t);
      suma += delTrimestre.reduce((s, f) => s + Number(f.total), 0);
      acumulado.push(Math.round(suma / clientes.size));
      retencion.push(new Set(delTrimestre.map((f) => f.contactId)).size);
    }

    resultado.push({
      clave: anio,
      etiqueta: anio,
      clientes: clientes.size,
      acumulado,
      retencion,
      ltvActual: acumulado[acumulado.length - 1] ?? 0,
    });
  }

  return resultado;
}

// ─── Producto y categoría ────────────────────────────────────────────────────

export interface AfinidadCategoria {
  categoria: string;
  clientes: number;
  monto: number;
  /** Ticket promedio de quienes compran esta categoría. */
  ticket: number;
  /** LTV promedio de quien la compró alguna vez. */
  ltv: number;
  /** Qué porcentaje de quienes la compran vuelve a comprar algo. */
  tasaRecompra: number;
  /** Repartición por segmento RFM. */
  porSegmento: { segmento: SegmentoRfm; nombre: string; clientes: number }[];
}

export function afinidadPorCategoria(rfm: ClienteRfm[]): AfinidadCategoria[] {
  const categorias = new Set(rfm.flatMap((c) => c.categorias));

  return [...categorias]
    .map((categoria) => {
      const compradores = rfm.filter((c) => c.categorias.includes(categoria));
      const monto = compradores.reduce((s, c) => s + c.monto, 0);
      const conteoSeg = new Map<SegmentoRfm, number>();
      for (const c of compradores) {
        conteoSeg.set(c.segmento, (conteoSeg.get(c.segmento) ?? 0) + 1);
      }

      return {
        categoria,
        clientes: compradores.length,
        monto,
        ticket: compradores.length
          ? Math.round(monto / compradores.reduce((s, c) => s + c.compras, 0))
          : 0,
        ltv: compradores.length ? Math.round(monto / compradores.length) : 0,
        tasaRecompra: compradores.length
          ? (compradores.filter((c) => c.compras > 1).length / compradores.length) * 100
          : 0,
        porSegmento: [...conteoSeg.entries()]
          .map(([segmento, clientes]) => ({
            segmento,
            nombre: SEGMENTOS[segmento].nombre,
            clientes,
          }))
          .sort((a, b) => b.clientes - a.clientes),
      };
    })
    .sort((a, b) => b.monto - a.monto);
}

export interface PuertaDeEntrada {
  categoria: string;
  clientes: number;
  /** LTV promedio de quien ENTRÓ por esta categoría. */
  ltv: number;
  /** Qué porcentaje de los que entraron por acá volvió a comprar. */
  tasaRecompra: number;
  comprasPromedio: number;
  /** Lo que compran después, en orden de frecuencia. */
  siguientes: { categoria: string; clientes: number }[];
}

/**
 * Por qué categoría entra cada cliente y qué pasa después.
 *
 * Es el análisis que más cambia decisiones de inversión: si quien entra por
 * accesorios vuelve tres veces más que quien entra por alta relojería, el
 * accesorio deja de ser un complemento de bajo margen y pasa a ser el producto
 * de adquisición.
 */
export function puertasDeEntrada(rfm: ClienteRfm[]): PuertaDeEntrada[] {
  const categorias = new Set(
    rfm.map((c) => c.categoriaEntrada).filter((c): c is string => Boolean(c)),
  );

  return [...categorias]
    .map((categoria) => {
      const entrantes = rfm.filter((c) => c.categoriaEntrada === categoria);
      const siguientes = new Map<string, number>();
      for (const c of entrantes) {
        for (const cat of c.categorias) {
          if (cat === categoria) continue;
          siguientes.set(cat, (siguientes.get(cat) ?? 0) + 1);
        }
      }

      return {
        categoria,
        clientes: entrantes.length,
        ltv: entrantes.length
          ? Math.round(entrantes.reduce((s, c) => s + c.monto, 0) / entrantes.length)
          : 0,
        tasaRecompra: entrantes.length
          ? (entrantes.filter((c) => c.compras > 1).length / entrantes.length) * 100
          : 0,
        comprasPromedio: entrantes.length
          ? entrantes.reduce((s, c) => s + c.compras, 0) / entrantes.length
          : 0,
        siguientes: [...siguientes.entries()]
          .map(([cat, n]) => ({ categoria: cat, clientes: n }))
          .sort((a, b) => b.clientes - a.clientes)
          .slice(0, 4),
      };
    })
    .sort((a, b) => b.clientes - a.clientes);
}

// ─── Calidad del dato ────────────────────────────────────────────────────────

export interface CalidadDatos {
  ventasTotales: number;
  ventasIdentificadas: number;
  porcentajeIdentificado: number;
  montoIdentificado: number;
  montoAnonimo: number;
  /** Cuánta facturación no se puede atribuir a nadie. */
  porcentajeMontoAnonimo: number;
  porOrigen: { origen: string; ventas: number; identificadas: number; monto: number }[];
  contactables: {
    total: number;
    conEmail: number;
    conTelefono: number;
    conAmbos: number;
    conConsentimiento: number;
    conWhatsapp: number;
  };
  /** Evolución trimestral del porcentaje identificado. */
  evolucion: { periodo: string; etiqueta: string; identificadas: number; total: number; porcentaje: number }[];
}

export async function calidadDatos(): Promise<CalidadDatos> {
  const [ventas, porOrigen, contactos, evolucion] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE identificado)::int AS identificadas,
             COALESCE(SUM(total) FILTER (WHERE identificado),0)::float8 AS monto_identificado,
             COALESCE(SUM(total) FILTER (WHERE NOT identificado),0)::float8 AS monto_anonimo
      FROM crm_orders
    `),
    db.execute(sql`
      SELECT origen, COUNT(*)::int AS ventas,
             COUNT(*) FILTER (WHERE identificado)::int AS identificadas,
             COALESCE(SUM(total),0)::float8 AS monto
      FROM crm_orders GROUP BY origen ORDER BY monto DESC
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE email IS NOT NULL)::int AS con_email,
             COUNT(*) FILTER (WHERE telefono IS NOT NULL)::int AS con_telefono,
             COUNT(*) FILTER (WHERE email IS NOT NULL AND telefono IS NOT NULL)::int AS con_ambos,
             COUNT(*) FILTER (WHERE consentimiento)::int AS con_consentimiento,
             COUNT(*) FILTER (WHERE opt_in_whatsapp)::int AS con_whatsapp
      FROM crm_contacts
    `),
    // Por trimestre y no por mes: con tres o cuatro ventas mensuales, el
    // porcentaje de identificación salta entre 33% y 100% según si el vendedor
    // alcanzó a pedir el RUT una vez más. Eso no es una tendencia, es ruido
    // dibujado como gráfico. El trimestre junta una docena de ventas, que ya es
    // suficiente para que el número signifique algo.
    db.execute(sql`
      SELECT to_char(date_trunc('quarter', fecha), 'YYYY-Q') AS periodo,
             EXTRACT(QUARTER FROM fecha)::int AS trimestre,
             to_char(fecha, 'YYYY') AS anio,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE identificado)::int AS identificadas
      FROM crm_orders
      WHERE fecha >= NOW() - INTERVAL '24 months'
      GROUP BY 1, 2, 3 ORDER BY 3, 2
    `),
  ]);

  const v = ventas.rows[0] as unknown as {
    total: number; identificadas: number; monto_identificado: number; monto_anonimo: number;
  };
  const c = contactos.rows[0] as unknown as Record<string, number>;

  return {
    ventasTotales: v.total,
    ventasIdentificadas: v.identificadas,
    porcentajeIdentificado: v.total > 0 ? (v.identificadas / v.total) * 100 : 0,
    montoIdentificado: v.monto_identificado,
    montoAnonimo: v.monto_anonimo,
    porcentajeMontoAnonimo:
      v.monto_identificado + v.monto_anonimo > 0
        ? (v.monto_anonimo / (v.monto_identificado + v.monto_anonimo)) * 100
        : 0,
    porOrigen: (porOrigen.rows as unknown as { origen: string; ventas: number; identificadas: number; monto: number }[]),
    contactables: {
      total: Number(c.total),
      conEmail: Number(c.con_email),
      conTelefono: Number(c.con_telefono),
      conAmbos: Number(c.con_ambos),
      conConsentimiento: Number(c.con_consentimiento),
      conWhatsapp: Number(c.con_whatsapp),
    },
    evolucion: (
      evolucion.rows as unknown as {
        periodo: string; trimestre: number; anio: string; total: number; identificadas: number;
      }[]
    ).map((f) => ({
      periodo: f.periodo,
      etiqueta: `T${f.trimestre} ${f.anio.slice(2)}`,
      identificadas: Number(f.identificadas),
      total: Number(f.total),
      porcentaje: Number(f.total) > 0 ? (Number(f.identificadas) / Number(f.total)) * 100 : 0,
    })),
  };
}

// ─── Panorama ────────────────────────────────────────────────────────────────

export interface Panorama {
  clientesConCompra: number;
  clientesActivos12m: number;
  clientesNuevos12m: number;
  clientesRecuperados: number;
  clientesEnRiesgo: number;
  facturacion12m: number;
  facturacionPrevia: number;
  variacion: number | null;
  ticketPromedio: number;
  /**
   * La mediana del ticket, que acá dice más que el promedio: el catálogo va de
   * $49.900 a $39.900.000, así que una venta de parlantes arrastra el promedio
   * de todo un año. La mediana muestra cómo es la venta típica de verdad.
   */
  ticketMediana: number;
  /** El número que manda el negocio: cuántas ventas entran al mes. */
  ventasPorMesPromedio: number;
  tasaRecompra: number;
  omnicanal: number;
  ingresosPorCanal: { canal: string; monto: number; ventas: number }[];
  ventasPorTrimestre: { etiqueta: string; monto: number; ventas: number }[];
  /**
   * Las últimas ventas con nombre y apellido.
   *
   * Con cuarenta ventas al año esto no es un detalle decorativo, es el corazón
   * del panorama. El gerente no necesita que le resuman un mes que tuvo tres
   * ventas: necesita ver cuáles fueron.
   */
  ultimasVentas: {
    id: number;
    fecha: Date;
    cliente: string | null;
    contactId: number | null;
    total: number;
    origen: string;
    detalle: string | null;
  }[];
}

export async function panorama(rfm: ClienteRfm[]): Promise<Panorama> {
  const [canales, trimestres, previa, ultimas, tickets] = await Promise.all([
    db.execute(sql`
      SELECT origen AS canal, COALESCE(SUM(total),0)::float8 AS monto, COUNT(*)::int AS ventas
      FROM crm_orders WHERE fecha >= NOW() - INTERVAL '12 months'
      GROUP BY origen ORDER BY monto DESC
    `),
    // Trimestres en vez de meses: un mes con tres ventas dibuja un serrucho
    // donde no hay ninguna historia. Que febrero tenga dos ventas y marzo cinco
    // no significa nada; que un trimestre caiga a la mitad del anterior sí.
    db.execute(sql`
      SELECT EXTRACT(QUARTER FROM fecha)::int AS trimestre,
             to_char(fecha, 'YYYY') AS anio,
             COALESCE(SUM(total),0)::float8 AS monto, COUNT(*)::int AS ventas
      FROM crm_orders WHERE fecha >= NOW() - INTERVAL '24 months'
      GROUP BY 1, 2 ORDER BY 2, 1
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(total),0)::float8 AS monto FROM crm_orders
      WHERE fecha >= NOW() - INTERVAL '24 months' AND fecha < NOW() - INTERVAL '12 months'
    `),
    db.execute(sql`
      SELECT o.id, o.fecha, o.total::float8 AS total, o.origen,
             c.nombre AS cliente, c.id AS "contactId",
             (SELECT p.nombre FROM crm_order_items i
                JOIN crm_products p ON p.id = i.product_id
               WHERE i.order_id = o.id
               ORDER BY i.precio_unitario DESC LIMIT 1) AS detalle
      FROM crm_orders o
      LEFT JOIN crm_contacts c ON c.id = o.contact_id
      ORDER BY o.fecha DESC LIMIT 12
    `),
    db.execute(sql`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total)::float8 AS mediana
      FROM crm_orders WHERE fecha >= NOW() - INTERVAL '12 months'
    `),
  ]);

  const activos = rfm.filter((c) => (c.recencia ?? 9999) <= 365);
  const nuevos = rfm.filter(
    (c) => c.primeraCompra && Date.now() - c.primeraCompra.getTime() <= 365 * 86_400_000,
  );
  // "Recuperado": volvió este año después de más de un año sin comprar. Se
  // detecta porque su vida como cliente supera el año pero su recencia no.
  const recuperados = rfm.filter(
    (c) => (c.recencia ?? 9999) <= 365 && c.vidaDias > 400 && c.compras > 1,
  );

  const facturacion12m = (canales.rows as unknown as { monto: number }[]).reduce(
    (s, f) => s + Number(f.monto), 0,
  );
  const facturacionPrevia = Number((previa.rows[0] as unknown as { monto: number }).monto);
  const ventas12m = (canales.rows as unknown as { ventas: number }[]).reduce(
    (s, f) => s + Number(f.ventas), 0,
  );

  return {
    clientesConCompra: rfm.length,
    clientesActivos12m: activos.length,
    clientesNuevos12m: nuevos.length,
    clientesRecuperados: recuperados.length,
    clientesEnRiesgo: rfm.filter((c) =>
      ["en_riesgo", "no_perder", "por_dormirse"].includes(c.segmento),
    ).length,
    facturacion12m,
    facturacionPrevia,
    variacion:
      facturacionPrevia > 0
        ? ((facturacion12m - facturacionPrevia) / facturacionPrevia) * 100
        : null,
    ticketPromedio: rfm.length
      ? Math.round(rfm.reduce((s, c) => s + c.monto, 0) / rfm.reduce((s, c) => s + c.compras, 0))
      : 0,
    ticketMediana: Math.round(
      Number((tickets.rows[0] as unknown as { mediana: number | null })?.mediana ?? 0),
    ),
    ventasPorMesPromedio: ventas12m / 12,
    tasaRecompra: rfm.length
      ? (rfm.filter((c) => c.compras > 1).length / rfm.length) * 100
      : 0,
    omnicanal: rfm.filter((c) => c.omnicanal).length,
    ingresosPorCanal: (canales.rows as unknown as { canal: string; monto: number; ventas: number }[]).map(
      (f) => ({
        canal: f.canal === "ecommerce" ? "E-commerce" : f.canal === "pos" ? "Showroom" : String(f.canal),
        monto: Number(f.monto),
        ventas: Number(f.ventas),
      }),
    ),
    ventasPorTrimestre: (
      trimestres.rows as unknown as { trimestre: number; anio: string; monto: number; ventas: number }[]
    ).map((f) => ({
      etiqueta: `T${f.trimestre} ${f.anio.slice(2)}`,
      monto: Number(f.monto),
      ventas: Number(f.ventas),
    })),
    ultimasVentas: (
      ultimas.rows as unknown as {
        id: number; fecha: string; cliente: string | null; contactId: number | null;
        total: number; origen: string; detalle: string | null;
      }[]
    ).map((f) => ({
      id: Number(f.id),
      fecha: new Date(f.fecha),
      cliente: f.cliente,
      contactId: f.contactId,
      total: Number(f.total),
      origen: f.origen,
      detalle: f.detalle,
    })),
  };
}
