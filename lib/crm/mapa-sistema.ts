// El mapa del sistema de una persona, eslabón por eslabón.
//
// Esta es la lámina 5 de la presentación hecha código, y su aporte real es
// **juntar dos fuentes que hasta ahora vivían separadas**:
//
//   · lo que el cliente COMPRÓ acá, que está en las ventas
//   · lo que el cliente TIENE, que solo se sabe si alguien preguntó
//
// La diferencia entre las dos es el punto ciego más caro del negocio. Un
// cliente puede tener unos Harbeth comprados hace diez años en otra tienda:
// para el sistema de ventas no existen, y sin embargo son lo que define qué se
// le puede ofrecer. Mirando solo las ventas, el CRM concluye "le faltan
// parlantes" y el vendedor le ofrece exactamente lo que ya tiene — que es la
// forma más rápida de que el cliente decida que no lo conocen.
//
// Por eso cada eslabón tiene tres estados y no dos:
//
//   registrado  hay una venta. Es un hecho con documento
//   declarado   lo dijo y alguien lo anotó. Es un hecho blando pero usable
//   sin dato    nadie preguntó. **No es una carencia, es una pregunta**
//
// Y un cuarto que solo aparece cuando se preguntó de verdad:
//
//   no tiene    se confirmó que no lo tiene. **Esto** sí es una oportunidad

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ESLABONES, type ClaveEslabon } from "./sistemas";
import { perfilDe } from "./preguntas";

export type EstadoEslabon = "registrado" | "declarado" | "sin_dato" | "no_tiene";

export interface EslabonDelMapa {
  clave: ClaveEslabon;
  nombre: string;
  estado: EstadoEslabon;
  /** La marca, cuando se sabe. Es lo que se muestra grande en la ficha. */
  marca: string | null;
  /** El modelo o la descripción corta. */
  detalle: string | null;
  /** Cuánto costó, si vino de una venta. */
  precio: number | null;
  /** Cuándo se supo. */
  desde: Date | null;
  /**
   * Si esto es una conversación de venta hoy, y de qué tipo:
   *   completar   confirmó que no lo tiene
   *   preguntar   no se sabe: primero hay que averiguar
   *   mejorar     lo tiene, pero desentona con el resto
   *   ninguna     está bien así
   */
  accion: "completar" | "preguntar" | "mejorar" | "ninguna";
}

export interface MapaSistema {
  contactId: number;
  eslabones: EslabonDelMapa[];
  /** Cuántos de los cinco se conocen, por cualquier vía. */
  conocidos: number;
  /** Cuántos son pregunta pendiente. */
  sinDato: number;
  /** El nivel del equipo, según la pieza más cara que se le conoce. */
  nivel: number;
}

/**
 * Arma el mapa de una persona.
 *
 * La venta gana sobre lo declarado cuando hay conflicto: si compró un
 * amplificador acá el año pasado y hace tres años dijo que tenía otro, lo que
 * vale es la factura. Pero **lo declarado gana sobre el vacío**, que es
 * justamente lo que el modelo anterior no sabía hacer.
 */
export async function mapaDe(contactId: number): Promise<MapaSistema> {
  const [ventas, perfil] = await Promise.all([
    db.execute(sql`
      SELECT p.categoria, p.marca, p.nombre AS producto,
             i.precio_unitario::float8 AS precio, o.fecha
      FROM crm_orders o
      JOIN crm_order_items i ON i.order_id = o.id
      JOIN crm_products p ON p.id = i.product_id
      WHERE o.contact_id = ${contactId}
      ORDER BY o.fecha DESC
    `),
    perfilDe(contactId),
  ]);

  type Venta = {
    categoria: string; marca: string | null; producto: string;
    precio: number; fecha: string;
  };
  const compras = ventas.rows as unknown as Venta[];

  const eslabones: EslabonDelMapa[] = ESLABONES.map((def) => {
    // 1. ¿Hay una venta de este eslabón? Se toma la más cara, que es la que
    //    está puesta: si cambió de amplificación, manda la nueva.
    const delEslabon = compras
      .filter((c) => (def.categorias as readonly string[]).includes(c.categoria))
      .sort((a, b) => Number(b.precio) - Number(a.precio));

    if (delEslabon.length) {
      const v = delEslabon[0];
      return {
        clave: def.clave,
        nombre: def.nombre,
        estado: "registrado" as const,
        marca: v.marca,
        detalle: v.producto,
        precio: Number(v.precio),
        desde: new Date(v.fecha),
        accion: "ninguna" as const,
      };
    }

    // 2. ¿Alguien preguntó? El atributo del perfil responde las dos cosas que
    //    la venta no puede: lo que tiene comprado en otra parte, y lo que
    //    confirmó que no tiene.
    const atributo = perfil.get(`sistema.${def.clave}`);

    if (atributo?.estado === "conocido") {
      return {
        clave: def.clave,
        nombre: def.nombre,
        estado: "declarado" as const,
        marca: atributo.valor,
        detalle: "declarado por el cliente",
        precio: null,
        desde: atributo.registradoEn,
        accion: "ninguna" as const,
      };
    }

    if (atributo?.estado === "no_tiene") {
      return {
        clave: def.clave,
        nombre: def.nombre,
        estado: "no_tiene" as const,
        marca: null,
        detalle: "confirmado: no tiene",
        precio: null,
        desde: atributo.registradoEn,
        accion: "completar" as const,
      };
    }

    // 3. Nadie preguntó. La acción es preguntar, no vender.
    return {
      clave: def.clave,
      nombre: def.nombre,
      estado: "sin_dato" as const,
      marca: null,
      detalle: null,
      precio: null,
      desde: null,
      accion: "preguntar" as const,
    };
  });

  const precios = eslabones.map((e) => e.precio ?? 0).filter((p) => p > 0);
  const nivel = precios.length ? Math.max(...precios) : 0;

  // El eslabón débil se marca solo entre los registrados: no se puede decir que
  // una pieza desentona si no se sabe cuál es. Sobre lo declarado tampoco, que
  // no trae precio.
  if (nivel > 0) {
    for (const e of eslabones) {
      if (e.estado !== "registrado" || e.precio === null) continue;
      if (e.precio < nivel * 0.25) e.accion = "mejorar";
    }
  }

  return {
    contactId,
    eslabones,
    conocidos: eslabones.filter((e) => e.estado === "registrado" || e.estado === "declarado").length,
    sinDato: eslabones.filter((e) => e.estado === "sin_dato").length,
    nivel,
  };
}

/**
 * Deriva atributos de perfil desde las ventas.
 *
 * Lo que se compró acá **es** lo que la persona tiene, y no tiene sentido
 * preguntarlo. Esta función escribe esos hechos en el perfil con confianza 3
 * —hay documento— para que el motor de preguntas deje de proponerlos.
 *
 * Se corre después de sincronizar ventas. Es idempotente: vuelve a escribir lo
 * mismo con la misma confianza.
 */
export async function derivarPerfilDesdeVentas(): Promise<number> {
  // Por eslabón, la pieza más cara que cada cliente compró. Es la que está
  // puesta hoy: en este rubro se cambia hacia arriba, no hacia abajo.
  const filas = await db.execute(sql`
    SELECT DISTINCT ON (o.contact_id, p.categoria)
           o.contact_id AS "contactId", p.categoria, p.marca, p.nombre AS producto,
           o.id AS "orderId"
    FROM crm_orders o
    JOIN crm_order_items i ON i.order_id = o.id
    JOIN crm_products p ON p.id = i.product_id
    WHERE o.contact_id IS NOT NULL
    ORDER BY o.contact_id, p.categoria, i.precio_unitario DESC
  `);

  type Fila = {
    contactId: number; categoria: string; marca: string | null;
    producto: string; orderId: number;
  };

  const categoriaAEslabon = new Map<string, ClaveEslabon>(
    ESLABONES.flatMap((e) => e.categorias.map((c) => [c, e.clave] as [string, ClaveEslabon])),
  );

  let escritos = 0;
  for (const f of filas.rows as unknown as Fila[]) {
    const eslabon = categoriaAEslabon.get(f.categoria);
    if (!eslabon) continue;

    await db.execute(sql`
      INSERT INTO crm_perfil_atributos
        (contact_id, clave, valor, estado, confianza, origen, origen_id)
      VALUES
        (${f.contactId}, ${"sistema." + eslabon}, ${f.marca ?? f.producto},
         'conocido', 3, 'venta', ${f.orderId})
      ON CONFLICT (contact_id, clave) DO UPDATE
        SET valor = EXCLUDED.valor,
            estado = 'conocido',
            confianza = 3,
            origen = 'venta',
            origen_id = EXCLUDED.origen_id,
            registrado_en = NOW()
        WHERE crm_perfil_atributos.confianza <= 3
    `);
    escritos++;
  }

  return escritos;
}
