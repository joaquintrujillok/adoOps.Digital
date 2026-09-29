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
  despachado: "despachado desde bodega",
  en_camino: "en camino",
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
    "Responde con el *número* para ver la foto, o *agregar 1 x 10* para sumarlo al carrito."
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
    return [{ texto: await agregar(e, id, Number(agregarM[2] ?? 1)) }];
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

  const ps = await buscarProductos(t, 6);
  if (!ps.length) {
    return [{ texto: "No encontré productos con eso. Prueba con otra palabra (ej: *vasos*, *servilletas*, *bolsas*) o escribe *categorías*." }];
  }
  e.ultimosProductos = ps.map((p) => p.id);
  e.ultimaLista = "productos";
  return [{ texto: listar(ps, "Encontré esto:") }];
}

// ─── Ruta con modelo (agente con herramientas) ──────────────────────────────

const SISTEMA = `Eres el vendedor de la tienda de Vanni Chile por WhatsApp (envases, desechables, bandejas, bolsas, artículos de aseo).
Ayudas a encontrar productos, armar el carrito y pagar. Usa SIEMPRE las herramientas para buscar y operar: nunca inventes productos, precios ni stock.
- Al mostrar productos, numéralos 1, 2, 3 en el mismo orden que devolvió la herramienta y con su precio. El cliente puede responder con el número.
- Para agregar, usa el id del producto. Si no dice cantidad, pregunta o usa 1 si es evidente.
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
    description: "Agrega un producto al carrito.",
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

async function ejecutar(nombre: string, args: Record<string, unknown>, ctx: Contexto, salidas: Salida[]): Promise<string> {
  const e = ctx.estado;
  switch (nombre) {
    case "buscar_productos": {
      const ps = await buscarProductos(String(args.consulta ?? ""), 6);
      e.ultimosProductos = ps.map((p) => p.id);
      e.ultimaLista = "productos";
      return JSON.stringify(ps.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stock })));
    }
    case "ver_producto": {
      const s = await verProducto(Number(args.producto_id));
      salidas.push(s);
      return "Foto enviada al cliente.";
    }
    case "agregar_al_carrito":
      return agregar(e, Number(args.producto_id), Number(args.cantidad));
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
        `Último listado mostrado (ids en orden): ${JSON.stringify(ctx.estado.ultimosProductos ?? [])}\n\n` +
        ctx.texto,
    },
  ];

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
      const texto = r.output_text?.trim();
      if (texto) salidas.push({ texto });
      return salidas;
    }
    // Las llamadas del modelo vuelven como entrada junto a sus resultados; el
    // SDK tipa la salida y la entrada por separado aunque la API acepte ambas.
    entrada.push(...(r.output as OpenAI.Responses.ResponseInputItem[]));
    for (const ll of llamadas) {
      if (ll.type !== "function_call") continue;
      const resultado = await ejecutar(ll.name, JSON.parse(ll.arguments || "{}"), ctx, salidas);
      entrada.push({ type: "function_call_output", call_id: ll.call_id, output: resultado });
    }
  }
  salidas.push({ texto: "Perdona, me enredé. ¿Me repites qué necesitas?" });
  return salidas;
}

export async function responderTienda(ctx: Contexto): Promise<Salida[]> {
  let salidas: Salida[];
  const esSaludo = /^#\s*tienda/i.test(ctx.texto.trim());
  if (esSaludo) {
    salidas = [{ texto: BIENVENIDA_TIENDA }];
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
