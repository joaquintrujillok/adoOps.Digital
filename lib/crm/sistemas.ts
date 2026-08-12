// El sistema de cada cliente y su siguiente paso.
//
// Este módulo existe porque el volumen del negocio obligó a cambiar de
// pregunta. Con tres ventas al mes no sirve preguntar "¿qué segmento crece?":
// la respuesta siempre va a ser ruido. La pregunta que sí tiene respuesta es
// **"¿qué le falta a Fulano y cuánto cuesta?"**, y esa se contesta mirando lo
// que ya compró.
//
// Un equipo de audio es una cadena de eslabones y suena tan bien como su
// eslabón más débil. Alguien con parlantes Magico de veintiún millones movidos
// por un integrado de cuatro no tiene un sistema equilibrado: tiene un sistema
// con un cuello de botella, y lo sabe. Ese desbalance es la conversación de
// venta más natural que existe en este rubro, y es completamente derivable de
// datos que la tienda ya tiene.
//
// **Lo que este módulo NO hace:** decidir por el vendedor. Entrega el hecho
// —"tiene X, le falta Y, su nivel es Z"— y el precio de referencia. Quien
// conoce al cliente decide si eso se dice, cuándo y cómo.

import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Los cinco eslabones de la cadena, en el orden en que se arma un sistema.
 *
 * Son los de la presentación, y difieren de la primera versión de este módulo
 * en dos puntos, ambos a favor de la presentación:
 *
 *   · **Previo y etapa se juntan en Amplificación.** Separarlos es correcto
 *     técnicamente pero deja incompleto a todo el que tiene un integrado, que
 *     es la mayoría. El mapa mostraba un hueco donde no hay ninguno.
 *   · **El soporte se abre en Cables y Acondicionamiento.** Estaban juntos en
 *     una bolsa llamada "soporte" que no se podía vender: son dos
 *     conversaciones distintas, con argumentos distintos, y el acondicionador
 *     de corriente casi nadie lo tiene.
 *
 * Racks y tubos quedaron fuera de los eslabones y se tratan como complemento.
 * Un rack no es parte de la cadena de señal, y contarlo obligaba a que todos
 * apareciesen incompletos para siempre.
 */
export const ESLABONES = [
  { clave: "fuente", nombre: "Fuente", categorias: ["Audio Digital", "Audio Análogo"] },
  {
    clave: "amplificacion",
    nombre: "Amplificación",
    categorias: ["Amplificadores", "Preamplificadores"],
  },
  { clave: "parlantes", nombre: "Parlantes", categorias: ["Parlantes y Cine"] },
  { clave: "cables", nombre: "Cables", categorias: ["Cables de Audio"] },
  {
    clave: "acondicionamiento",
    nombre: "Acondicionamiento",
    categorias: ["Acondicionador de Potencia"],
  },
] as const;

/** Fuera de la cadena de señal: complementan, no completan. */
export const COMPLEMENTOS = ["Racks y Antivibración", "Tubos y Válvulas"] as const;

export type ClaveEslabon = (typeof ESLABONES)[number]["clave"];

/** De categoría a eslabón. Se arma una vez y se consulta muchas. */
const ESLABON_DE_CATEGORIA = new Map<string, ClaveEslabon>(
  ESLABONES.flatMap((e) => e.categorias.map((c) => [c, e.clave] as [string, ClaveEslabon])),
);

/**
 * Los tres eslabones sin los cuales no hay sistema.
 *
 * Cables y acondicionamiento son eslabones de la cadena y aparecen en el mapa,
 * pero no cuentan para "sistema completo": todo el mundo tiene *algún* cable,
 * aunque sea el que venía en la caja. Lo que se vende ahí es subir de nivel, no
 * llenar un hueco, y son dos conversaciones distintas.
 */
const ESENCIALES: ClaveEslabon[] = ["fuente", "amplificacion", "parlantes"];

export interface PiezaDelSistema {
  productId: number;
  nombre: string;
  marca: string | null;
  categoria: string;
  eslabon: ClaveEslabon;
  precio: number;
  compradoEn: Date;
}

export interface SistemaCliente {
  contactId: number;
  cliente: string;
  telefono: string | null;
  piezas: PiezaDelSistema[];
  /** Lo que gastó en componentes, sin contar accesorios. */
  invertido: number;
  /** Qué eslabones tiene cubiertos. */
  cubiertos: ClaveEslabon[];
  /** Qué le falta para tener un sistema completo. */
  faltantes: ClaveEslabon[];
  /**
   * El nivel del sistema, tomado de su pieza más cara.
   *
   * Se usa la más cara y no el promedio porque es la que fija la aspiración: si
   * alguien puso veintiocho millones en parlantes, ese es el estándar contra el
   * que va a medir todo lo demás, aunque el resto de su equipo sea modesto.
   */
  nivel: number;
  /**
   * El nivel al que compra habitualmente: la mediana de sus componentes.
   *
   * Es distinto de `nivel` y sirve para otra cosa. `nivel` es la aspiración
   * —contra qué mide— y `nivelTipico` es el presupuesto en el que se mueve de
   * verdad. Recomendar contra el pico produce la propuesta de treinta millones
   * que nadie manda; recomendar contra la mediana produce la que sí se manda.
   */
  nivelTipico: number;
  /** La pieza que desentona hacia abajo, si hay una clara. */
  eslabonDebil: { eslabon: ClaveEslabon; pieza: PiezaDelSistema; brecha: number } | null;
  ultimaCompra: Date;
  diasSinComprar: number;
}

/**
 * Reconstruye el sistema de cada cliente a partir de lo que compró.
 *
 * Una sola consulta para toda la cartera: son cincuenta y tantas personas y
 * poco más de cien ventas. Paginar esto sería optimizar un problema que no
 * existe, y complicaría el código que después hay que explicarle a alguien.
 */
export async function sistemasDeClientes(): Promise<SistemaCliente[]> {
  const filas = await db.execute(sql`
    SELECT c.id AS "contactId", c.nombre AS cliente, c.telefono,
           p.id AS "productId", p.nombre AS producto, p.marca, p.categoria,
           i.precio_unitario::float8 AS precio, o.fecha
    FROM crm_contacts c
    JOIN crm_orders o ON o.contact_id = c.id
    JOIN crm_order_items i ON i.order_id = o.id
    JOIN crm_products p ON p.id = i.product_id
    ORDER BY c.id, o.fecha
  `);

  type Fila = {
    contactId: number; cliente: string; telefono: string | null;
    productId: number; producto: string; marca: string | null; categoria: string;
    precio: number; fecha: string;
  };

  const porCliente = new Map<number, Fila[]>();
  for (const f of filas.rows as unknown as Fila[]) {
    const lista = porCliente.get(f.contactId) ?? [];
    lista.push(f);
    porCliente.set(f.contactId, lista);
  }

  const sistemas: SistemaCliente[] = [];

  for (const [contactId, compras] of porCliente) {
    const piezas: PiezaDelSistema[] = [];

    for (const f of compras) {
      const eslabon = ESLABON_DE_CATEGORIA.get(f.categoria);
      // Los "Sistemas Highend" llave en mano y el "Audio Video" no caen en un
      // eslabón único. Un sistema completo cubre todo de una vez, y así se
      // registra más abajo.
      if (!eslabon) continue;
      piezas.push({
        productId: f.productId,
        nombre: f.producto,
        marca: f.marca,
        categoria: f.categoria,
        eslabon,
        precio: Number(f.precio),
        compradoEn: new Date(f.fecha),
      });
    }

    const compróSistemaCompleto = compras.some((f) => f.categoria === "Sistemas Highend");

    const cubiertos = compróSistemaCompleto
      ? [...ESENCIALES]
      : ESENCIALES.filter((e) => piezas.some((p) => p.eslabon === e));
    const faltantes = ESENCIALES.filter((e) => !cubiertos.includes(e));

    const componentes = piezas.filter((p) => ESENCIALES.includes(p.eslabon));
    const invertido = compras.reduce((s, f) => s + Number(f.precio), 0);
    const nivel = componentes.length ? Math.max(...componentes.map((p) => p.precio)) : 0;
    const nivelTipico = medianaDe(componentes.map((p) => p.precio));

    const ultimaCompra = compras.reduce(
      (max, f) => (new Date(f.fecha) > max ? new Date(f.fecha) : max),
      new Date(compras[0].fecha),
    );

    sistemas.push({
      contactId,
      cliente: compras[0].cliente,
      telefono: compras[0].telefono,
      piezas,
      invertido,
      cubiertos,
      faltantes,
      nivel,
      nivelTipico,
      eslabonDebil: detectarEslabonDebil(componentes, nivel),
      ultimaCompra,
      diasSinComprar: Math.floor((Date.now() - ultimaCompra.getTime()) / 86_400_000),
    });
  }

  return sistemas.sort((a, b) => b.invertido - a.invertido);
}

function medianaDe(valores: number[]): number {
  if (!valores.length) return 0;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2);
}

/**
 * Encuentra el componente que se queda corto frente al resto del sistema.
 *
 * El umbral es de un cuarto: se marca cuando una pieza vale menos del 25% de la
 * más cara del equipo. Ese número no salió de una fórmula, salió de mirar cómo
 * se habla en el rubro —"esos parlantes piden más amplificador"— y de que con
 * un umbral más suave la mitad de los clientes aparece con alerta, que es lo
 * mismo que no tener alerta.
 *
 * Solo se compara entre eslabones esenciales y solo si el cliente tiene al
 * menos dos: con una sola pieza no hay desbalance posible, hay una compra.
 */
function detectarEslabonDebil(
  componentes: PiezaDelSistema[],
  nivel: number,
): SistemaCliente["eslabonDebil"] {
  if (componentes.length < 2 || nivel === 0) return null;

  // Por eslabón se toma la pieza más cara: si alguien cambió de amplificación, lo que
  // manda es la que tiene puesta hoy, no la que reemplazó.
  const mejorPorEslabon = new Map<ClaveEslabon, PiezaDelSistema>();
  for (const p of componentes) {
    const actual = mejorPorEslabon.get(p.eslabon);
    if (!actual || p.precio > actual.precio) mejorPorEslabon.set(p.eslabon, p);
  }
  if (mejorPorEslabon.size < 2) return null;

  let debil: PiezaDelSistema | null = null;
  for (const p of mejorPorEslabon.values()) {
    if (p.precio >= nivel * 0.25) continue;
    if (!debil || p.precio < debil.precio) debil = p;
  }
  if (!debil) return null;

  return { eslabon: debil.eslabon, pieza: debil, brecha: nivel - debil.precio };
}

export interface Recomendacion {
  contactId: number;
  cliente: string;
  telefono: string | null;
  /** completar | equilibrar */
  tipo: "completar" | "equilibrar";
  eslabon: ClaveEslabon;
  eslabonNombre: string;
  motivo: string;
  /** El producto sugerido y su precio de lista. */
  sugerido: { productId: number; nombre: string; marca: string | null; precio: number } | null;
  /** Cuánto ha invertido este cliente. Es lo que ordena la lista. */
  invertido: number;
  diasSinComprar: number;
}

/**
 * Convierte los sistemas en una lista corta de conversaciones posibles.
 *
 * Ordenada por lo invertido y **cortada en veinte**. Con cincuenta y ocho
 * clientes se podría listar a todos, y sería un error: una lista de cincuenta
 * recomendaciones es una lista que nadie trabaja. Veinte son las que caben en
 * un mes de un vendedor que además atiende el showroom.
 */
export async function recomendacionesDeUpgrade(limite = 20): Promise<Recomendacion[]> {
  const [sistemas, catalogo] = await Promise.all([
    sistemasDeClientes(),
    db.execute(sql`
      SELECT id, nombre, marca, categoria, precio::float8 AS precio
      FROM crm_products WHERE activo ORDER BY precio
    `),
  ]);

  type Prod = { id: number; nombre: string; marca: string | null; categoria: string; precio: number };
  const productos = catalogo.rows as unknown as Prod[];

  /** Lo más cercano al presupuesto objetivo dentro del eslabón. */
  function sugerirPara(eslabon: ClaveEslabon, objetivo: number): Recomendacion["sugerido"] {
    const def = ESLABONES.find((e) => e.clave === eslabon);
    if (!def) return null;
    const candidatos = productos.filter((p) => (def.categorias as readonly string[]).includes(p.categoria));
    if (!candidatos.length) return null;

    const mejor = candidatos.reduce((a, b) =>
      Math.abs(Number(b.precio) - objetivo) < Math.abs(Number(a.precio) - objetivo) ? b : a,
    );
    return { productId: mejor.id, nombre: mejor.nombre, marca: mejor.marca, precio: Number(mejor.precio) };
  }

  const recomendaciones: Recomendacion[] = [];

  for (const s of sistemas) {
    // Un cliente con una sola compra y nada más no es candidato a upgrade: es
    // candidato a que lo llamen para saber cómo le fue. Eso lo cubre el módulo
    // de señales, no este.
    if (s.piezas.length < 2) continue;

    if (s.eslabonDebil) {
      const { eslabon, pieza, brecha } = s.eslabonDebil;
      const def = ESLABONES.find((e) => e.clave === eslabon);
      recomendaciones.push({
        contactId: s.contactId,
        cliente: s.cliente,
        telefono: s.telefono,
        tipo: "equilibrar",
        eslabon,
        eslabonNombre: def?.nombre ?? eslabon,
        motivo:
          `Su ${def?.nombre.toLowerCase()} (${pieza.nombre}, ${clp(pieza.precio)}) queda corto ` +
          `frente al resto del equipo, que llega a ${clp(s.nivel)}.`,
        // Se apunta a la mitad de la brecha, no al tope: proponerle de una la
        // pieza de treinta millones a alguien que tiene una de cuatro es la
        // forma más rápida de que deje de contestar.
        sugerido: sugerirPara(eslabon, pieza.precio + brecha * 0.5),
        invertido: s.invertido,
        diasSinComprar: s.diasSinComprar,
      });
      continue;
    }

    if (s.faltantes.length) {
      const eslabon = s.faltantes[0];
      const def = ESLABONES.find((e) => e.clave === eslabon);
      recomendaciones.push({
        contactId: s.contactId,
        cliente: s.cliente,
        telefono: s.telefono,
        tipo: "completar",
        eslabon,
        eslabonNombre: def?.nombre ?? eslabon,
        motivo:
          `Tiene ${s.cubiertos.length} de 4 eslabones. Le falta ${def?.nombre.toLowerCase()} ` +
          `para cerrar el sistema.`,
        // Contra la mediana de su equipo, no contra su pieza más cara. Apuntar
        // al pico hacía que todos los faltantes terminaran sugiriendo el mismo
        // producto del tope del catálogo, que es la señal más clara de que la
        // recomendación no está mirando al cliente.
        sugerido: sugerirPara(eslabon, s.nivelTipico),
        invertido: s.invertido,
        diasSinComprar: s.diasSinComprar,
      });
    }
  }

  return recomendaciones.sort((a, b) => b.invertido - a.invertido).slice(0, limite);
}

function clp(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export interface ResumenSistemas {
  /** Compró una sola pieza. No es un sistema, es una compra. */
  compraSuelta: number;
  /** Tiene dos o más piezas: está armando algo. */
  enConstruccion: number;
  /** Tiene los cuatro eslabones. */
  completos: number;
  conEslabonDebil: number;
  /** Cuánto vale, a precio de lista, cerrar los sistemas en construcción. */
  oportunidadEnPesos: number;
  /** Qué eslabón esencial falta más seguido, entre los sistemas en construcción. */
  faltantesPorEslabon: { eslabon: ClaveEslabon; nombre: string; clientes: number }[];
}

export async function resumenSistemas(): Promise<ResumenSistemas> {
  const [sistemas, recomendaciones] = await Promise.all([
    sistemasDeClientes(),
    recomendacionesDeUpgrade(999),
  ]);

  const conPiezas = sistemas.filter((s) => s.piezas.length > 0);

  /**
   * La distinción que hace que este panel sirva.
   *
   * Alguien que compró un par de parlantes y nada más tiene, técnicamente,
   * tres eslabones faltantes. Contarlo como "sistema incompleto" infla el
   * número hasta que deja de significar algo: en la primera versión salían
   * cuarenta y cuatro clientes sin amplificación, sobre cincuenta y cuatro, y con eso
   * el panel decía "casi todos", que es lo mismo que no decir nada.
   *
   * Un sistema en construcción es alguien que ya volvió al menos una vez. Esa
   * persona demostró que está armando algo, y su eslabón faltante es una
   * conversación real. El de una sola compra todavía no es nada de eso.
   */
  const enConstruccion = conPiezas.filter((s) => s.piezas.length >= 2);

  const faltantes = new Map<ClaveEslabon, number>();
  for (const s of enConstruccion) {
    for (const f of s.faltantes) faltantes.set(f, (faltantes.get(f) ?? 0) + 1);
  }

  return {
    compraSuelta: conPiezas.filter((s) => s.piezas.length === 1).length,
    enConstruccion: enConstruccion.length,
    completos: enConstruccion.filter((s) => s.faltantes.length === 0).length,
    conEslabonDebil: enConstruccion.filter((s) => s.eslabonDebil).length,
    // A precio de lista y sin descuento. Es un techo, no un pronóstico, y hay
    // que presentarlo como tal: en este rubro la venta grande se negocia.
    oportunidadEnPesos: recomendaciones.reduce((s, r) => s + (r.sugerido?.precio ?? 0), 0),
    faltantesPorEslabon: ESLABONES.filter((e) => ESENCIALES.includes(e.clave))
      .map((e) => ({ eslabon: e.clave, nombre: e.nombre, clientes: faltantes.get(e.clave) ?? 0 }))
      .sort((a, b) => b.clientes - a.clientes),
  };
}
