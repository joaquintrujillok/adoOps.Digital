// Flujo de tienda: comprar por WhatsApp, de la búsqueda al link de pago. Es la entrada por defecto.
//
// Con modelo, es un agente con herramientas (buscar, ver, agregar, carrito,
// pagar, estado): el cliente escribe como habla —"necesito bandejas para 50
// porciones de torta"— y el agente decide qué herramienta usar. Sin modelo, las
// mismas acciones responden a comandos cortos. Las dos rutas comparten las
// herramientas: la lógica del carrito y del pedido está escrita una sola vez.

import type { VanniContacto, VanniEstadoTienda } from "@/db/vanni";
import type OpenAI from "openai";
import {
  buscarProductos,
  categoriasPrincipales,
  productoPorId,
  productosDeCategoria,
  type ProductoBreve,
} from "../catalogo";
import { clp } from "../formato";
import { cliente, hayModelo, hayPresupuesto, MODELO, registrarUso } from "../llm";
import { crearPedido, linkDePago, ultimoPedido } from "../pedidos";
import { guardarSesion, historial } from "./conversacion";
import type { Salida } from "./tipos";

interface Contexto {
  telefono: string;
  texto: string;
  contacto: VanniContacto | null;
  nombrePush: string | null;
  estado: VanniEstadoTienda;
  simulado: boolean;
}

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente_pago: "esperando el pago",
  pagado: "pagado, pasa a preparación",
  preparacion: "en preparación",
  despachado: "saliendo de bodega",
  en_camino: "en camino",
  llega_hoy: "llega hoy",
  entregado: "entregado",
  cancelado: "cancelado",
};

export const BIENVENIDA_TIENDA =
  "¡Hola! Bienvenido a la *tienda de Vanni por WhatsApp* 🛒\n" +
  "Escríbeme lo que buscas (ej: *bandejas para sushi*) o escribe *categorías*.\n" +
  "También puedes escribir *carrito*, *pagar* o *estado*.\n" +
  "_Precios y stock referenciales de demostración._";

// ─── Herramientas (compartidas por las dos rutas) ───────────────────────────

function lineaProducto(p: ProductoBreve, i: number): string {
  const stock = p.stock > 0 ? `stock ${p.stock}` : "sin stock";
  return `${i + 1}. ${p.nombre} — *${clp(p.precio)}* · ${stock}`;
}

function listar(ps: ProductoBreve[], encabezado: string): string {
  return (
    `${encabezado}\n${ps.map(lineaProducto).join("\n")}\n\n` +
    "Dime cuál y cuántas unidades, por ejemplo: *la 2, 10 unidades*. Con solo el número te muestro la foto."
  );
}

function resumenCarrito(e: VanniEstadoTienda): string {
  if (!e.carrito.length) return "Tu carrito está vacío.";
  const total = e.carrito.reduce((s, c) => s + c.precio * c.cantidad, 0);
  return (
    "*Tu carrito*\n" +
    e.carrito.map((c, i) => `${i + 1}. ${c.nombre} × ${c.cantidad} — ${clp(c.precio * c.cantidad)}`).join("\n") +
    `\n*Total: ${clp(total)}*\n\nEscribe *pagar* para recibir el link de pago, o *quitar 1* para sacar algo.`
  );
}

async function agregar(e: VanniEstadoTienda, productoId: number, cantidad: number): Promise<string> {
  const p = await productoPorId(productoId);
  if (!p || !p.activo) return "No encontré ese producto.";
  if (p.stock <= 0) return `*${p.nombre}* está sin stock en este momento.`;
  const n = Math.max(1, Math.min(cantidad || 1, p.stock));
  const linea = e.carrito.find((c) => c.productoId === p.id);
  if (linea) linea.cantidad = Math.min(linea.cantidad + n, p.stock);
  else e.carrito.push({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: n });
  const ajuste = n < cantidad ? ` (ajusté a ${n}, es el stock disponible)` : "";
  return `Agregué *${p.nombre}* × ${n}${ajuste} al carrito. 🛒`;
}

async function verProducto(productoId: number): Promise<Salida> {
  const p = await productoPorId(productoId);
  if (!p) return { texto: "No encontré ese producto." };
  const stock = p.stock > 0 ? `Stock: ${p.stock} unidades` : "Sin stock por ahora";
  const texto = `*${p.nombre}*\n${clp(p.precio)} · ${stock}${p.sku ? `\nSKU ${p.sku}` : ""}\n\nPara sumarlo: *agregar* y la cantidad.`;
  return { texto, imagenUrl: p.imagenUrl };
}

async function pagar(ctx: Contexto, direccion: string | null): Promise<string> {
  if (!ctx.estado.carrito.length) return "Tu carrito está vacío. Busca un producto para empezar.";
  const pedido = await crearPedido({
    telefono: ctx.telefono,
    contactoId: ctx.contacto?.id ?? null,
    nombreCliente: ctx.contacto?.razonSocial || ctx.contacto?.nombre || ctx.nombrePush,
    direccion,
    carrito: ctx.estado.carrito,
    simulado: ctx.simulado,
  });
  ctx.estado.carrito = [];
  ctx.estado.pendientes = [];
  ctx.estado.porConfirmar = undefined;
  return (
    `Listo, tu pedido *${pedido.codigo}* quedó creado por *${clp(pedido.total)}*.\n` +
    `Paga aquí: ${linkDePago(pedido.tokenPago)}\n\n` +
    "Apenas se confirme el pago te aviso por este chat, y después cada paso del despacho."
  );
}

async function estadoPedido(telefono: string): Promise<string> {
  const p = await ultimoPedido(telefono);
  if (!p) return "Todavía no tienes pedidos. Cuando compres, aquí te cuento cómo va.";
  return `Tu pedido *${p.codigo}* por ${clp(p.total)} está *${ETIQUETA_ESTADO[p.estado] ?? p.estado}*.`;
}

// ─── Ruta por reglas ────────────────────────────────────────────────────────

/** "la 6", "el 2", "n° 3": la referencia a un número de la lista. */
const REF_LISTA = /\b(?:la|el|n[°º]|nro\.?|n[uú]mero)\s*(\d{1,2})\b/g;
/** "2 unidades", "10 cajas", "x 3": la cantidad. */
const CANTIDAD = /(\d+)\s*(?:unidades?|uds?\b|u\b|cajas?|paquetes?|packs?)|\bx\s*(\d+)/i;

/**
 * Lo que eligió, antes de agregarlo: producto exacto, unidades, total y stock.
 * Lo arma el código y no el modelo, para que lo que se confirma sea lo que se
 * agrega. "2 y 3 unidades" se lee de dos formas; acá se ve cuál se entendió.
 */
async function proponer(e: VanniEstadoTienda, productoId: number, cantidad: number): Promise<string> {
  const p = await productoPorId(productoId);
  if (!p || !p.activo) return "No encontré ese producto. ¿Cuál número de la lista quieres?";
  if (p.stock <= 0) return `*${p.nombre}* está sin stock en este momento. ¿Quieres otro de la lista?`;
  const n = Math.max(1, Math.min(cantidad || 1, p.stock));
  e.porConfirmar = { productoId: p.id, cantidad: n };
  const ajuste = n < cantidad ? ` (hay ${p.stock} en stock, así que ajusté a ${n})` : "";
  return (
    `Te confirmo:\n*${p.nombre}* × ${n}${ajuste}\n${clp(p.precio)} c/u · total *${clp(p.precio * n)}* · stock en sucursal: ${p.stock}\n\n` +
    "¿Lo agrego? Responde *sí* o dime el cambio."
  );
}

// Sin \b: en JavaScript no reconoce letras con tilde y "sí" no calzaría.
const CONFIRMA = /^[^\p{L}\d]*(s[ií]+|sip|ok\p{L}*|dale|ya|listo|confirm[oa]|agr[eé]ga(lo)?|bueno|perfecto|correcto|eso)(?!\p{L})|^\W*👍/iu;

/** El cliente responde a "¿Lo agrego?": con un sí se agrega y se sigue con lo siguiente. */
async function responderConfirmacion(e: VanniEstadoTienda, texto: string): Promise<Salida[] | null> {
  const pc = e.porConfirmar;
  if (!pc) return null;
  e.porConfirmar = undefined;
  if (!CONFIRMA.test(texto)) return null; // un cambio o algo distinto: se atiende como mensaje nuevo
  const agregado = await agregar(e, pc.productoId, pc.cantidad);
  const siguiente = await siguientePendiente(e);
  return [{ texto: `✅ ${agregado}${siguiente || "\n\n¿Algo más? Escríbeme otro producto, o *pagar* para recibir el link."}` }];
}

/** Después de agregar: si pidió otros productos, se sigue con el siguiente. */
async function siguientePendiente(e: VanniEstadoTienda): Promise<string> {
  const siguiente = e.pendientes?.shift();
  if (!siguiente) return "";
  const ps = await buscarProductos(siguiente, 6);
  if (!ps.length) return `\n\nNo encontré *${siguiente}*. Prueba con otra palabra.`;
  e.ultimosProductos = ps.map((p) => p.id);
  e.ultimaLista = "productos";
  return `\n\n${listar(ps, `Ahora vamos con *${siguiente}*:`)}`;
}

async function responderConReglas(ctx: Contexto): Promise<Salida[]> {
  const t = ctx.texto.trim();
  const e = ctx.estado;
  const minus = t.toLowerCase();

  if (/^(#\s*tienda.*|hola|men[uú]|ayuda|inicio|buenas.*)$/i.test(t)) return [{ texto: BIENVENIDA_TIENDA }];

  if (/categor/i.test(minus)) {
    const cats = (await categoriasPrincipales()).slice(0, 12);
    e.ultimasCategorias = cats.map((c) => c.nombre);
    e.ultimaLista = "categorias";
    return [
      {
        texto:
          "*Categorías*\n" +
          cats.map((c, i) => `${i + 1}. ${c.nombre} (${c.productos})`).join("\n") +
          "\n\nResponde con el número de la categoría.",
      },
    ];
  }

  const agregarM = minus.match(/^(?:agrega(?:r|me)?|sumar?|a[ñn]adir|quiero)\s+(?:el\s+)?(\d+)(?:\s*(?:x|por|de|unidades?|u)?\s*(\d+))?/);
  if (agregarM) {
    const idx = Number(agregarM[1]) - 1;
    const id = e.ultimosProductos?.[idx];
    if (!id) return [{ texto: "Primero busca un producto y usa el número de la lista." }];
    return [{ texto: await proponer(e, id, Number(agregarM[2] ?? 1)) }];
  }

  // Elegir de la lista como se escribe: "la 6, 2 unidades", "6 x 2", "el 3".
  if (e.ultimaLista === "productos" && e.ultimosProductos?.length) {
    const refs = [...minus.matchAll(REF_LISTA)].map((m) => Number(m[1]));
    const directo = minus.match(/^(\d{1,2})\s*(?:,|y|x|por|con)\s*(\d+)/);
    if (refs.length > 1) {
      return [{ texto: "Vamos de a uno 🙂 ¿Cuál de esta lista y cuántas unidades? Por ejemplo: *la 2, 10 unidades*." }];
    }
    const n = refs[0] ?? (directo ? Number(directo[1]) : null);
    const id = n ? e.ultimosProductos[n - 1] : undefined;
    if (n && !id) return [{ texto: `La lista tiene ${e.ultimosProductos.length} productos. ¿Cuál número quieres?` }];
    if (id) {
      const c = minus.match(CANTIDAD);
      const cantidad = Number(c?.[1] ?? c?.[2] ?? directo?.[2] ?? 1);
      return [{ texto: await proponer(e, id, cantidad) }];
    }
  }

  if (/^(ver\s+)?carrito$/.test(minus)) return [{ texto: resumenCarrito(e) }];

  const quitarM = minus.match(/^(?:quitar|sacar|eliminar)\s+(\d+)/);
  if (quitarM) {
    const i = Number(quitarM[1]) - 1;
    if (!e.carrito[i]) return [{ texto: "Ese número no está en tu carrito." }];
    const [fuera] = e.carrito.splice(i, 1);
    return [{ texto: `Saqué *${fuera.nombre}*.\n\n${resumenCarrito(e)}` }];
  }

  if (/^vaciar/.test(minus)) {
    e.carrito = [];
    return [{ texto: "Vacié tu carrito." }];
  }

  const pagarM = t.match(/^(pagar|confirmar|comprar|finalizar)\b[:\s]*(.*)$/i);
  if (pagarM) return [{ texto: await pagar(ctx, pagarM[2]?.trim() || null) }];

  if (/(estado|mi pedido|seguimiento|d[oó]nde (est[aá]|va))/i.test(minus)) {
    return [{ texto: await estadoPedido(ctx.telefono) }];
  }

  const numero = t.match(/^(\d{1,2})$/);
  if (numero) {
    const i = Number(numero[1]) - 1;
    if (e.ultimaLista === "categorias" && e.ultimasCategorias?.[i]) {
      const ps = await productosDeCategoria(e.ultimasCategorias[i]);
      e.ultimosProductos = ps.map((p) => p.id);
      e.ultimaLista = "productos";
      return [{ texto: listar(ps, `*${e.ultimasCategorias[i]}*`) }];
    }
    const id = e.ultimosProductos?.[i];
    if (id) return [await verProducto(id)];
  }

  // Varios productos en un mensaje ("servilletas y bolsas de basura"): de a uno.
  const pedido = t.replace(/^(quiero|necesito|busco|me gustar[ií]a)\s+(comprar\s+)?/i, "");
  const partes = pedido.split(/\s*(?:,|\by\b|\be\b)\s*/i).map((x) => x.trim()).filter((x) => x.length > 2);
  const consulta = partes.length > 1 ? partes[0] : t;
  if (partes.length > 1) e.pendientes = partes.slice(1, 6);

  const ps = await buscarProductos(consulta, 6);
  if (!ps.length) {
    return [{ texto: "No encontré productos con eso. Prueba con otra palabra (ej: *vasos*, *servilletas*, *bolsas*) o escribe *categorías*." }];
  }
  e.ultimosProductos = ps.map((p) => p.id);
  e.ultimaLista = "productos";
  const encabezado = partes.length > 1 ? `Vamos de a uno 🙂 Primero, *${consulta}*:` : "Encontré esto:";
  return [{ texto: listar(ps, encabezado) }];
}

// ─── Ruta con modelo (agente con herramientas) ──────────────────────────────

const SISTEMA = `Eres el vendedor de la tienda de Vanni Chile por WhatsApp (envases, desechables, bandejas, bolsas, artículos de aseo).
Ayudas a encontrar productos, armar el carrito y pagar. Usa SIEMPRE las herramientas para buscar y operar: nunca inventes productos, precios ni stock.
- Atiende UN producto a la vez. Si el cliente pide varios ("servilletas y bolsas de basura"), anota los demás con anotar_pendientes, busca solo el primero y muestra UNA sola lista. Cuando quede agregado, sigue con el siguiente pendiente ("Listo ✅ Ahora vamos con las bolsas de basura:") y búscalo.
- Nunca muestres dos listas en un mismo mensaje. Los números que responde el cliente se refieren SIEMPRE a la última lista mostrada.
- Al mostrar productos, numéralos 1, 2, 3 en el mismo orden que devolvió la herramienta y con su precio. Termina preguntando cuál quiere y cuántas unidades.
- Cuando el cliente elija un producto y una cantidad, llama a agregar_al_carrito con ese id y esa cantidad. Eso NO lo agrega: el sistema le muestra al cliente el producto, el total y el stock y le pide que confirme. Nunca digas que algo quedó agregado; el sistema avisa cuando el cliente confirma. Un producto por mensaje.
- Si quiere pagar y quedan productos pendientes, pregúntale si los agrega antes o paga así.
- Para pagar, usa la herramienta pagar; si el cliente dio una dirección de despacho, pásala.
- Si pide ver una foto, usa ver_producto.
- Si pregunta por su pedido, usa estado_pedido.
- Aclara que los precios son referenciales de demostración si preguntan por ellos.
Estilo: español de Chile, cordial, breve. Formato WhatsApp: *negrita* con un asterisco, sin ## ni **.`;

const HERRAMIENTAS: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    name: "buscar_productos",
    description: "Busca productos del catálogo por lo que el cliente necesita.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { consulta: { type: "string" } },
      required: ["consulta"],
    },
  },
  {
    type: "function",
    name: "anotar_pendientes",
    description: "Anota los productos que el cliente pidió y que se atenderán después, de a uno.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { productos: { type: "array", items: { type: "string" } } },
      required: ["productos"],
    },
  },
  {
    type: "function",
    name: "ver_producto",
    description: "Envía la foto y el detalle de un producto.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { producto_id: { type: "integer" } },
      required: ["producto_id"],
    },
  },
  {
    type: "function",
    name: "agregar_al_carrito",
    description: "Registra el producto y la cantidad que eligió el cliente. El sistema le pide confirmación antes de agregarlo.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { producto_id: { type: "integer" }, cantidad: { type: "integer" } },
      required: ["producto_id", "cantidad"],
    },
  },
  {
    type: "function",
    name: "ver_carrito",
    description: "Muestra el carrito y el total.",
    strict: true,
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: "function",
    name: "quitar_del_carrito",
    description: "Quita un producto del carrito.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { producto_id: { type: "integer" } },
      required: ["producto_id"],
    },
  },
  {
    type: "function",
    name: "pagar",
    description: "Crea el pedido con el carrito y devuelve el link de pago.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { direccion: { type: ["string", "null"] } },
      required: ["direccion"],
    },
  },
  {
    type: "function",
    name: "estado_pedido",
    description: "Estado del último pedido del cliente.",
    strict: true,
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
  {
    type: "function",
    name: "categorias",
    description: "Lista las categorías principales del catálogo.",
    strict: true,
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
];

/** Lo que pasó en este turno: la tienda va de a un producto y de a una lista. */
interface Turno {
  /** Ya se mostró una lista y el cliente todavía no elige de ella. */
  listaAbierta: boolean;
  /** La lista que el cliente tenía a la vista al escribir este mensaje. */
  listaVisible: number[];
  /** Lo que eligió en este mensaje, a confirmar. */
  propuesta: { productoId: number; cantidad: number } | null;
}

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

async function ejecutar(
  nombre: string,
  args: Record<string, unknown>,
  ctx: Contexto,
  salidas: Salida[],
  turno: Turno,
): Promise<string> {
  const e = ctx.estado;
  switch (nombre) {
    case "anotar_pendientes": {
      const nuevos = (Array.isArray(args.productos) ? args.productos : []).map(String).filter(Boolean);
      e.pendientes = [...new Set([...(e.pendientes ?? []), ...nuevos])].slice(0, 6);
      return `Pendientes: ${JSON.stringify(e.pendientes)}. Atiende uno a la vez.`;
    }
    case "buscar_productos": {
      const consulta = String(args.consulta ?? "");
      // Una lista por mensaje: si ya hay una abierta en este turno, la segunda
      // búsqueda espera. Dos listas numeradas 1-6 a la vez confunden al
      // cliente y al número que responde.
      if (turno.listaAbierta || turno.propuesta) {
        e.pendientes = [...new Set([...(e.pendientes ?? []), consulta])].slice(0, 6);
        return `No busqué "${consulta}": ya hay una lista abierta en este mensaje. Quedó pendiente; atiéndelo cuando el cliente elija de la lista actual.`;
      }
      const ps = await buscarProductos(consulta, 6);
      e.ultimosProductos = ps.map((p) => p.id);
      e.ultimaLista = "productos";
      turno.listaAbierta = ps.length > 0;
      const c = normalizar(consulta);
      e.pendientes = (e.pendientes ?? []).filter((p) => !c.includes(normalizar(p)) && !normalizar(p).includes(c));
      return JSON.stringify(ps.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stock })));
    }
    case "ver_producto": {
      const s = await verProducto(Number(args.producto_id));
      salidas.push(s);
      return "Foto enviada al cliente.";
    }
    case "agregar_al_carrito": {
      const id = Number(args.producto_id);
      if (turno.propuesta) return "Ya hay un producto por confirmar en este mensaje. Uno a la vez.";
      // Solo de la lista que el cliente tenía a la vista (o algo ya en el
      // carrito). Es lo que evita agregar de otra lista por error.
      const enLista =
        turno.listaVisible.includes(id) || (e.ultimosProductos ?? []).includes(id) || e.carrito.some((c) => c.productoId === id);
      if (!enLista) return "Ese producto no está en la lista que ve el cliente. Pregúntale cuál quiere de la lista actual.";
      turno.propuesta = { productoId: id, cantidad: Number(args.cantidad) || 1 };
      return "Registrado. El sistema le muestra al cliente el producto, el total y el stock, y le pide confirmación. No agregues otra lista ni digas que quedó agregado.";
    }
    case "ver_carrito":
      return resumenCarrito(e);
    case "quitar_del_carrito": {
      e.carrito = e.carrito.filter((c) => c.productoId !== Number(args.producto_id));
      return resumenCarrito(e);
    }
    case "pagar":
      return pagar(ctx, (args.direccion as string | null) ?? null);
    case "estado_pedido":
      return estadoPedido(ctx.telefono);
    case "categorias": {
      const cats = (await categoriasPrincipales()).slice(0, 15);
      return JSON.stringify(cats);
    }
    default:
      return "Herramienta desconocida.";
  }
}

async function responderConModelo(ctx: Contexto): Promise<Salida[]> {
  const previo = await historial(ctx.telefono, 12);
  const salidas: Salida[] = [];
  const entrada: OpenAI.Responses.ResponseInput = [
    ...previo.slice(0, -1).map((m) => ({
      role: m.rol === "cliente" ? ("user" as const) : ("assistant" as const),
      content: m.texto,
    })),
    {
      role: "user",
      content:
        `Carrito actual: ${JSON.stringify(ctx.estado.carrito)}\n` +
        `Último listado mostrado (ids en orden): ${JSON.stringify(ctx.estado.ultimosProductos ?? [])}\n` +
        `Pendientes por atender, de a uno: ${JSON.stringify(ctx.estado.pendientes ?? [])}\n\n` +
        ctx.texto,
    },
  ];

  const turno: Turno = { listaAbierta: false, listaVisible: [...(ctx.estado.ultimosProductos ?? [])], propuesta: null };
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const r = await cliente().responses.create({
      model: MODELO,
      instructions: SISTEMA,
      input: entrada,
      tools: HERRAMIENTAS,
    });
    await registrarUso(r.usage?.input_tokens ?? 0, r.usage?.output_tokens ?? 0);

    const llamadas = r.output.filter((i) => i.type === "function_call");
    if (!llamadas.length) {
      if (turno.propuesta) {
        // Lo que se confirma lo escribe el código: es exactamente lo que se agregará.
        return [...salidas.filter((x) => x.imagenUrl), { texto: await proponer(ctx.estado, turno.propuesta.productoId, turno.propuesta.cantidad) }];
      }
      const texto = r.output_text?.trim();
      if (texto) salidas.push({ texto });
      return salidas;
    }
    // Las llamadas del modelo vuelven como entrada junto a sus resultados; el
    // SDK tipa la salida y la entrada por separado aunque la API acepte ambas.
    entrada.push(...(r.output as OpenAI.Responses.ResponseInputItem[]));
    for (const ll of llamadas) {
      if (ll.type !== "function_call") continue;
      const resultado = await ejecutar(ll.name, JSON.parse(ll.arguments || "{}"), ctx, salidas, turno);
      entrada.push({ type: "function_call_output", call_id: ll.call_id, output: resultado });
    }
  }
  salidas.push({ texto: "Perdona, me enredé. ¿Me repites qué necesitas?" });
  return salidas;
}

export async function responderTienda(ctx: Contexto): Promise<Salida[]> {
  let salidas: Salida[];
  const esSaludo = /^#\s*tienda/i.test(ctx.texto.trim());
  const confirmacion = esSaludo ? null : await responderConfirmacion(ctx.estado, ctx.texto);
  if (esSaludo) {
    salidas = [{ texto: BIENVENIDA_TIENDA }];
  } else if (confirmacion) {
    salidas = confirmacion;
  } else if (hayModelo() && (await hayPresupuesto())) {
    try {
      salidas = await responderConModelo(ctx);
    } catch (err) {
      console.error("[vanni] agente de tienda falló, uso reglas", err);
      salidas = await responderConReglas(ctx);
    }
  } else {
    salidas = await responderConReglas(ctx);
  }

  await guardarSesion({
    telefono: ctx.telefono,
    flujo: "tienda",
    contactoId: ctx.contacto?.id ?? null,
    estado: ctx.estado,
  });
  return salidas.length ? salidas : [{ texto: "¿Qué estás buscando?" }];
}

export type { Contexto as ContextoTienda };
