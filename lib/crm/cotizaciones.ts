// Cotización de mostrador — el dato se captura antes de que exista una ficha.
//
// Portado del CRM de CDC. Allá resolvió un problema medido: el mostrador
// cotizaba sin capturar el teléfono y el 59% del volumen quedaba sin forma de
// hacerle seguimiento. La mecánica es la misma acá: se piden tres datos, se
// arma la cotización con el catálogo real y se le manda al cliente por
// WhatsApp. La ficha completa se llena recién cuando hay interés.
//
// Este módulo NO importa el cliente de WaSender: el envío pasa por
// lib/crm/whatsapp-dispatch.ts como todo lo demás, así que hereda los mismos
// candados.

import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  crmContacts,
  crmProducts,
  crmQuoteItems,
  crmQuotes,
  crmUsers,
  type CrmQuote,
} from "@/db/crm";
import { normalizarTelefono } from "./telefono";
import {
  construirDocumento,
  type DatosDocumento,
  type ItemDocumento,
} from "./documento-cotizacion";

// ─── Catálogo ────────────────────────────────────────────────────────────────

export interface PiezaCatalogo {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  precio: number;
  permiteDescuento: boolean;
  /** Tope en puntos base: 1000 = 10%. Null = admite, sin tope definido. */
  topeDescuentoBp: number | null;
  disponible: number | null;
}

/**
 * Busca piezas por nombre, marca o SKU.
 *
 * Cada palabra por separado y tienen que calzar todas, así "cronógrafo acero"
 * encuentra igual que "acero cronógrafo". Sin tildes: nadie las escribe al
 * teclear rápido con el cliente delante.
 */
export async function buscarPiezas(consulta: string, limite = 12): Promise<PiezaCatalogo[]> {
  const palabras = consulta.trim().split(/\s+/).filter(Boolean).slice(0, 4);

  const filas = await db
    .select({
      id: crmProducts.id,
      sku: crmProducts.sku,
      nombre: crmProducts.nombre,
      marca: crmProducts.marca,
      categoria: crmProducts.categoria,
      precio: crmProducts.precio,
      permiteDescuento: crmProducts.permiteDescuento,
      topeDescuentoBp: crmProducts.topeDescuento,
      disponible: sql<number | null>`(
        select (i.stock - i.reservado)::int from crm_inventory i
        where i.product_id = crm_products.id
      )`,
    })
    .from(crmProducts)
    .where(
      and(
        eq(crmProducts.activo, true),
        ...palabras.map(
          (p) =>
            sql`(
              unaccent(lower(${crmProducts.nombre})) like unaccent(lower(${"%" + p + "%"}))
              or unaccent(lower(coalesce(${crmProducts.marca}, ''))) like unaccent(lower(${"%" + p + "%"}))
              or lower(${crmProducts.sku}) like lower(${"%" + p + "%"})
            )`,
        ),
      ),
    )
    .orderBy(crmProducts.marca, crmProducts.nombre)
    .limit(limite);

  return filas;
}

// ─── Creación y edición ──────────────────────────────────────────────────────

export interface DatosCotizacion {
  contactId?: number | null;
  cotizanteNombre: string;
  /** Número tal como se tecleó; se normaliza acá. */
  cotizanteTelefono: string;
  paraSiMismo: boolean;
  destinatarioNombre?: string | null;
  boutique?: string | null;
  createdById: number;
  /** `descuento` en pesos, no en porcentaje: en el mostrador se negocia
   *  "te lo dejo en un millón ochocientos", y convertir a porcentaje en el
   *  cliente introduce redondeos que después no cuadran con la boleta. */
  items: { productId: number; cantidad: number; descuento?: number }[];
  descuentoGlobal?: number;
}

export type Resultado =
  | { ok: true; id: number }
  | { ok: false; error: string };

interface Calculado {
  datos: {
    cotizanteNombre: string;
    cotizanteTelefono: string;
    paraSiMismo: boolean;
    destinatarioNombre: string | null;
    subtotal: number;
    descuentoGlobal: number;
    total: number;
  };
  items: {
    productId: number;
    productoNombre: string;
    sku: string;
    marca: string | null;
    cantidad: number;
    precioUnitario: number;
    descuento: number;
    topeDescuentoBp: number | null;
    total: number;
  }[];
  descuentoItems: number;
}

/**
 * Valida y calcula, sin escribir nada.
 *
 * Crear y editar comparten esta función entera: si el editor tuviera su propia
 * validación, el día que cambie un tope una cotización nueva y una editada
 * aceptarían descuentos distintos.
 */
async function validarYCalcular(
  d: DatosCotizacion,
): Promise<{ ok: false; error: string } | ({ ok: true } & Calculado)> {
  const nombre = d.cotizanteNombre.trim();
  if (nombre.length < 5 || !/\s/.test(nombre)) {
    return { ok: false, error: "Escribe nombre y apellido de quien cotiza" };
  }

  const telefono = normalizarTelefono(d.cotizanteTelefono);
  if (!telefono) {
    return { ok: false, error: `Teléfono inválido: ${d.cotizanteTelefono}` };
  }

  if (!d.paraSiMismo && (d.destinatarioNombre ?? "").trim().length < 3) {
    return { ok: false, error: "Falta el nombre de quien recibe la pieza" };
  }
  if (!d.items.length) return { ok: false, error: "Agrega al menos una pieza" };

  // Los precios se releen del catálogo, nunca se aceptan del formulario: si
  // vinieran del cliente, cualquiera podría cotizar un reloj en $1.
  const ids = [...new Set(d.items.map((i) => i.productId))];
  const catalogo = await db
    .select()
    .from(crmProducts)
    .where(inArray(crmProducts.id, ids));

  if (catalogo.length !== ids.length) {
    return { ok: false, error: "Alguna de las piezas ya no está en el catálogo" };
  }
  const porId = new Map(catalogo.map((p) => [p.id, p]));

  const items: Calculado["items"] = [];

  for (const i of d.items) {
    const p = porId.get(i.productId)!;
    const cantidad = Math.max(1, Math.min(20, i.cantidad));
    const bruto = p.precio * cantidad;

    // El descuento se recalcula y se revalida acá, contra el catálogo. Lo que
    // llega del formulario es una intención, no un hecho: si se aceptara tal
    // cual, el tope sería una sugerencia visual que cualquiera puede saltarse.
    let descuento = Math.max(0, Math.round(i.descuento ?? 0));

    if (descuento > 0 && !p.permiteDescuento) {
      return { ok: false, error: `"${p.nombre}" no admite descuento` };
    }
    // Nunca más que la propia pieza: un descuento mayor al precio dejaría un
    // total negativo que ninguna boleta va a aceptar.
    if (descuento > bruto) descuento = bruto;

    const tope = p.topeDescuento;
    if (tope !== null && descuento > Math.round((bruto * tope) / 10000)) {
      const pct = (tope / 100).toFixed(tope % 100 === 0 ? 0 : 1);
      const maximo = Math.round((bruto * tope) / 10000);
      return {
        ok: false,
        error: `"${p.nombre}" admite hasta ${pct}% de descuento ($${maximo.toLocaleString("es-CL")})`,
      };
    }

    items.push({
      productId: p.id,
      productoNombre: p.nombre,
      sku: p.sku,
      marca: p.marca,
      cantidad,
      precioUnitario: p.precio,
      descuento,
      topeDescuentoBp: tope,
      total: bruto - descuento,
    });
  }

  const subtotal = items.reduce((s, i) => s + i.precioUnitario * i.cantidad, 0);
  const descuentoItems = items.reduce((s, i) => s + i.descuento, 0);
  const trasItems = subtotal - descuentoItems;

  // El descuento global se aplica DESPUÉS de los de pieza y sobre lo que quedó.
  // No tiene tope propio —es la rebaja que se negocia al cierre— pero queda
  // guardado aparte para que se vea cuánto del margen se fue por acá.
  let global = Math.max(0, Math.round(d.descuentoGlobal ?? 0));
  if (global > trasItems) global = trasItems;

  return {
    ok: true,
    datos: {
      cotizanteNombre: nombre,
      cotizanteTelefono: telefono,
      paraSiMismo: d.paraSiMismo,
      destinatarioNombre: d.paraSiMismo ? null : (d.destinatarioNombre ?? "").trim(),
      subtotal,
      descuentoGlobal: global,
      total: trasItems - global,
    },
    items,
    descuentoItems,
  };
}

export async function crearCotizacion(d: DatosCotizacion): Promise<Resultado> {
  const calculo = await validarYCalcular(d);
  if (!calculo.ok) return calculo;

  // Se vincula al contacto existente por teléfono. Un cliente que vuelve no
  // puede aparecer dos veces en la cartera solo porque cotizó de nuevo.
  const contactId =
    d.contactId ?? (await contactoPorTelefono(calculo.datos.cotizanteTelefono));

  const [creada] = await db
    .insert(crmQuotes)
    .values({
      contactId,
      cotizanteNombre: calculo.datos.cotizanteNombre,
      cotizanteTelefono: calculo.datos.cotizanteTelefono,
      paraSiMismo: calculo.datos.paraSiMismo,
      destinatarioNombre: calculo.datos.destinatarioNombre,
      boutique: d.boutique ?? null,
      createdById: d.createdById,
      subtotal: calculo.datos.subtotal,
      descuentoGlobal: calculo.datos.descuentoGlobal,
      total: calculo.datos.total,
      estado: "abierta",
    })
    .returning({ id: crmQuotes.id });

  await db.insert(crmQuoteItems).values(
    calculo.items.map((i) => ({ ...i, quoteId: creada.id })),
  );

  return { ok: true, id: creada.id };
}

export async function actualizarCotizacion(
  id: number,
  d: DatosCotizacion,
): Promise<Resultado> {
  const [previa] = await db.select().from(crmQuotes).where(eq(crmQuotes.id, id)).limit(1);
  if (!previa) return { ok: false, error: "La cotización no existe" };
  if (previa.estado === "convertida") {
    return { ok: false, error: "Una cotización ya convertida no se edita" };
  }

  const calculo = await validarYCalcular(d);
  if (!calculo.ok) return calculo;

  await db
    .update(crmQuotes)
    .set({
      cotizanteNombre: calculo.datos.cotizanteNombre,
      cotizanteTelefono: calculo.datos.cotizanteTelefono,
      paraSiMismo: calculo.datos.paraSiMismo,
      destinatarioNombre: calculo.datos.destinatarioNombre,
      subtotal: calculo.datos.subtotal,
      descuentoGlobal: calculo.datos.descuentoGlobal,
      total: calculo.datos.total,
      editadaEn: new Date(),
      // El cliente tiene en la mano un documento que ya no dice lo mismo.
      // Marcarlo es la única forma de que alguien se entere antes de la caja.
      editadaTrasEnvio: previa.estado === "enviada" || previa.editadaTrasEnvio,
    })
    .where(eq(crmQuotes.id, id));

  await db.delete(crmQuoteItems).where(eq(crmQuoteItems.quoteId, id));
  await db.insert(crmQuoteItems).values(
    calculo.items.map((i) => ({ ...i, quoteId: id })),
  );

  return { ok: true, id };
}

async function contactoPorTelefono(telefono: string): Promise<number | null> {
  const [c] = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(eq(crmContacts.telefono, telefono))
    .limit(1);
  return c?.id ?? null;
}

// ─── Consulta ────────────────────────────────────────────────────────────────

export interface CotizacionCompleta {
  cotizacion: CrmQuote;
  items: (typeof crmQuoteItems.$inferSelect)[];
  vendedor: string | null;
  contacto: { id: number; nombre: string } | null;
  descuentoItems: number;
}

export async function obtenerCotizacion(id: number): Promise<CotizacionCompleta | null> {
  const [fila] = await db
    .select({
      q: crmQuotes,
      vendedor: crmUsers.nombre,
      contactoId: crmContacts.id,
      contacto: crmContacts.nombre,
    })
    .from(crmQuotes)
    .leftJoin(crmUsers, eq(crmUsers.id, crmQuotes.createdById))
    .leftJoin(crmContacts, eq(crmContacts.id, crmQuotes.contactId))
    .where(eq(crmQuotes.id, id))
    .limit(1);

  if (!fila) return null;

  const items = await db
    .select()
    .from(crmQuoteItems)
    .where(eq(crmQuoteItems.quoteId, id))
    .orderBy(crmQuoteItems.id);

  return {
    cotizacion: fila.q,
    items,
    vendedor: fila.vendedor,
    contacto: fila.contactoId ? { id: fila.contactoId, nombre: fila.contacto! } : null,
    descuentoItems: items.reduce((s, i) => s + i.descuento, 0),
  };
}

/** Arma el documento a partir de una cotización guardada. */
export function documentoDe(c: CotizacionCompleta, empresa: string): string {
  const datos: DatosDocumento = {
    id: c.cotizacion.id,
    cotizanteNombre: c.cotizacion.cotizanteNombre,
    paraSiMismo: c.cotizacion.paraSiMismo,
    destinatarioNombre: c.cotizacion.destinatarioNombre,
    items: c.items.map<ItemDocumento>((i) => ({
      nombre: i.productoNombre,
      marca: i.marca,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      descuento: i.descuento,
      total: i.total,
    })),
    subtotal: c.cotizacion.subtotal,
    descuentoItems: c.descuentoItems,
    descuentoGlobal: c.cotizacion.descuentoGlobal,
    total: c.cotizacion.total,
    empresa,
    vendedor: c.vendedor,
    boutique: c.cotizacion.boutique,
  };
  return construirDocumento(datos);
}

export interface FilaCotizacion {
  id: number;
  cotizanteNombre: string;
  cotizanteTelefono: string;
  paraSiMismo: boolean;
  destinatarioNombre: string | null;
  estado: string;
  total: number;
  piezas: number;
  vendedor: string | null;
  contactId: number | null;
  conversationId: number | null;
  editadaTrasEnvio: boolean;
  createdAt: Date;
  enviadaEn: Date | null;
  /** Días desde que se envió sin respuesta ni conversión. */
  diasSinCerrar: number | null;
}

export async function listarCotizaciones(opciones?: {
  estado?: string;
  desde?: Date;
  hasta?: Date;
  busqueda?: string;
  limite?: number;
}): Promise<FilaCotizacion[]> {
  const condiciones = [];
  if (opciones?.estado) condiciones.push(eq(crmQuotes.estado, opciones.estado));
  if (opciones?.desde) condiciones.push(gte(crmQuotes.createdAt, opciones.desde));
  if (opciones?.hasta) condiciones.push(lte(crmQuotes.createdAt, opciones.hasta));
  if (opciones?.busqueda) {
    const q = `%${opciones.busqueda.toLowerCase()}%`;
    condiciones.push(
      or(
        sql`lower(${crmQuotes.cotizanteNombre}) like ${q}`,
        sql`${crmQuotes.cotizanteTelefono} like ${q}`,
      ),
    );
  }

  const filas = await db
    .select({
      q: crmQuotes,
      vendedor: crmUsers.nombre,
      piezas: sql<number>`(select count(*) from crm_quote_items it where it.quote_id = crm_quotes.id)::int`,
    })
    .from(crmQuotes)
    .leftJoin(crmUsers, eq(crmUsers.id, crmQuotes.createdById))
    .where(condiciones.length ? and(...condiciones) : undefined)
    .orderBy(desc(crmQuotes.createdAt))
    .limit(opciones?.limite ?? 200);

  return filas.map((f) => ({
    id: f.q.id,
    cotizanteNombre: f.q.cotizanteNombre,
    cotizanteTelefono: f.q.cotizanteTelefono,
    paraSiMismo: f.q.paraSiMismo,
    destinatarioNombre: f.q.destinatarioNombre,
    estado: f.q.estado,
    total: f.q.total,
    piezas: f.piezas,
    vendedor: f.vendedor,
    contactId: f.q.contactId,
    conversationId: f.q.conversationId,
    editadaTrasEnvio: f.q.editadaTrasEnvio,
    createdAt: f.q.createdAt,
    enviadaEn: f.q.enviadaEn,
    diasSinCerrar:
      f.q.estado === "enviada" && f.q.enviadaEn
        ? Math.floor((Date.now() - new Date(f.q.enviadaEn).getTime()) / 86_400_000)
        : null,
  }));
}

// ─── El embudo de cotizaciones ───────────────────────────────────────────────

export interface EmbudoCotizaciones {
  abiertas: number;
  enviadas: number;
  convertidas: number;
  descartadas: number;
  montoEnviado: number;
  montoConvertido: number;
  /** De las que se enviaron, cuántas terminaron en venta. */
  tasaConversion: number;
  /** Días promedio entre el envío y la conversión. */
  diasACerrar: number | null;
  ticketPromedio: number;
}

export async function embudoCotizaciones(desde?: Date): Promise<EmbudoCotizaciones> {
  const [f] = await db
    .select({
      abiertas: sql<number>`count(*) filter (where ${crmQuotes.estado} = 'abierta')::int`,
      enviadas: sql<number>`count(*) filter (where ${crmQuotes.estado} = 'enviada')::int`,
      convertidas: sql<number>`count(*) filter (where ${crmQuotes.estado} = 'convertida')::int`,
      descartadas: sql<number>`count(*) filter (where ${crmQuotes.estado} = 'descartada')::int`,
      montoEnviado: sql<number>`coalesce(sum(${crmQuotes.total}) filter (where ${crmQuotes.estado} in ('enviada','convertida')),0)::float8`,
      montoConvertido: sql<number>`coalesce(sum(${crmQuotes.total}) filter (where ${crmQuotes.estado} = 'convertida'),0)::float8`,
      diasACerrar: sql<number | null>`avg(extract(epoch from (${crmQuotes.convertidaEn} - ${crmQuotes.enviadaEn})) / 86400) filter (where ${crmQuotes.estado} = 'convertida')`,
    })
    .from(crmQuotes)
    .where(desde ? gte(crmQuotes.createdAt, desde) : undefined);

  // El denominador son las que efectivamente salieron: una cotización que se
  // quedó abierta en el mostrador no se le puede cobrar a nadie como pérdida.
  const salieron = (f?.enviadas ?? 0) + (f?.convertidas ?? 0);

  return {
    abiertas: f?.abiertas ?? 0,
    enviadas: f?.enviadas ?? 0,
    convertidas: f?.convertidas ?? 0,
    descartadas: f?.descartadas ?? 0,
    montoEnviado: f?.montoEnviado ?? 0,
    montoConvertido: f?.montoConvertido ?? 0,
    tasaConversion: salieron > 0 ? ((f?.convertidas ?? 0) / salieron) * 100 : 0,
    diasACerrar: f?.diasACerrar != null ? Math.round(Number(f.diasACerrar)) : null,
    ticketPromedio:
      (f?.convertidas ?? 0) > 0
        ? Math.round((f?.montoConvertido ?? 0) / (f?.convertidas ?? 1))
        : 0,
  };
}
