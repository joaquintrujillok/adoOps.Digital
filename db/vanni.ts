// Vanni Chile — esquema del piloto de reactivación y de la tienda por WhatsApp.
//
// **Dos flujos, un número.** El piloto tiene dos demos que comparten el número
// de WhatsApp de Vanni (una sesión propia de WaSender, separada de la que usa
// Tuniche): la campaña de clientes inactivos (`#Ofertas`) y la tienda por
// WhatsApp (`#tienda-whatsapp`). La llave con que alguien entra decide el flujo,
// y `vanni_sesiones` recuerda en cuál está cada teléfono para que los dos no se
// pisen en medio de una conversación.
//
// **Adentro hay personas reales.** La base de inactivos que carga Vanni son
// clientes con nombre y teléfono. Por eso el módulo es `produccion` aunque el
// contrato diga "piloto". Las filas de ejemplo que se cargan para mostrar el
// sistema llevan `ejemplo = true`, que la pantalla marca y que se borran de un
// botón: la mezcla existe, pero se ve y se limpia.
//
// **El catálogo sí es de mentira en una parte.** Los 777 productos, sus
// categorías y sus fotos salen de vannichile.cl, pero allá cuestan $1: el precio
// y el stock de acá son ficticios y lo dicen (`precio_ficticio`).

import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// ─── Equipo ──────────────────────────────────────────────────────────────────

/**
 * Quién entra al backoffice. Dos roles:
 *
 * - `admin`     — todo: carga bases, lanza campañas, edita el catálogo, gestiona el equipo.
 * - `ejecutiva` — ve y gestiona sus oportunidades y los pedidos. Es quien recibe
 *                 el aviso de un cliente interesado, por WhatsApp y por correo.
 */
export type VanniRol = "admin" | "ejecutiva";

export const vanniUsuarios = pgTable(
  "vanni_usuarios",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 60 }).notNull(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }),
    /** Formato 569XXXXXXXX. Es a donde llega el aviso de un interesado. */
    telefono: varchar("telefono", { length: 20 }),
    rol: varchar("rol", { length: 20 }).notNull().default("ejecutiva"),
    passwordHash: text("password_hash").notNull(),
    activo: boolean("activo").notNull().default(true),
    debeCambiarClave: boolean("debe_cambiar_clave").notNull().default(true),
    ultimoIngreso: timestamp("ultimo_ingreso", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("vanni_usuarios_username_idx").on(t.username)],
);

// ─── Contactos y segmentos ───────────────────────────────────────────────────

export const vanniContactos = pgTable(
  "vanni_contactos",
  {
    id: serial("id").primaryKey(),
    /** Normalizado a 569XXXXXXXX. Es la identidad en WhatsApp. */
    telefono: varchar("telefono", { length: 20 }).notNull(),
    nombre: varchar("nombre", { length: 160 }),
    razonSocial: varchar("razon_social", { length: 200 }),
    rut: varchar("rut", { length: 20 }),
    email: varchar("email", { length: 254 }),
    sucursal: varchar("sucursal", { length: 80 }),
    categoriaHabitual: varchar("categoria_habitual", { length: 120 }),
    ejecutivaId: integer("ejecutiva_id").references(() => vanniUsuarios.id, {
      onDelete: "set null",
    }),

    // Insumos del RFM. Vienen en la planilla; sin ellos el contacto queda
    // "Sin historial" y se puede contactar igual.
    ultimaCompra: date("ultima_compra"),
    nCompras: integer("n_compras"),
    montoTotal: bigint("monto_total", { mode: "number" }),

    // RFM calculado contra toda la base (quintiles). Se recalcula al cargar.
    rScore: smallint("r_score"),
    fScore: smallint("f_score"),
    mScore: smallint("m_score"),
    segmento: varchar("segmento", { length: 40 }).notNull().default("Sin historial"),

    /** `activo` | `baja`. Quien pidió no ser contactado no vuelve a recibir nada. */
    estado: varchar("estado", { length: 20 }).notNull().default("activo"),
    /** De dónde entró: `planilla` | `manual` | `whatsapp`. */
    origen: varchar("origen", { length: 20 }).notNull().default("manual"),
    ejemplo: boolean("ejemplo").notNull().default(false),
    bajaAt: timestamp("baja_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("vanni_contactos_telefono_idx").on(t.telefono),
    index("vanni_contactos_segmento_idx").on(t.segmento),
  ],
);

// ─── Campañas ────────────────────────────────────────────────────────────────

/** `borrador` → `enviando` ⇄ `pausada` → `terminada`. */
export type VanniEstadoCampana = "borrador" | "enviando" | "pausada" | "terminada";

export const vanniCampanas = pgTable("vanni_campanas", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 160 }).notNull(),
  /** La promoción, en una frase. Es lo único que el agente puede ofrecer. */
  promocion: text("promocion").notNull(),
  /** Condiciones de la promoción, para responder preguntas sin inventar. */
  condiciones: text("condiciones"),
  ejecutivaId: integer("ejecutiva_id").references(() => vanniUsuarios.id, {
    onDelete: "set null",
  }),
  estado: varchar("estado", { length: 20 }).notNull().default("borrador"),
  /** Segmentos RFM a los que va. Vacío = todos los contactos activos. */
  segmentos: jsonb("segmentos").$type<string[]>().notNull().default([]),
  sucursales: jsonb("sucursales").$type<string[]>().notNull().default([]),
  /** Horas tras el envío para un recordatorio único. `null` = sin recordatorio. */
  recordatorioHoras: integer("recordatorio_horas"),
  ejemplo: boolean("ejemplo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  iniciadaAt: timestamp("iniciada_at", { withTimezone: true }),
  terminadaAt: timestamp("terminada_at", { withTimezone: true }),
});

/** Cada campaña prueba hasta tres textos. El tablero dice cuál convirtió más. */
export const vanniVariantes = pgTable("vanni_variantes", {
  id: serial("id").primaryKey(),
  campanaId: integer("campana_id")
    .notNull()
    .references(() => vanniCampanas.id, { onDelete: "cascade" }),
  codigo: varchar("codigo", { length: 4 }).notNull(),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  /** Con `{nombre}`, `{promocion}`, `{categoria}`, `{sucursal}`. */
  plantilla: text("plantilla").notNull(),
});

/**
 * Un mensaje de campaña a un contacto. Es la fila que mide todo el embudo:
 * se envió, se entregó, se leyó, respondió, y qué resultó.
 */
export const vanniEnvios = pgTable(
  "vanni_envios",
  {
    id: serial("id").primaryKey(),
    campanaId: integer("campana_id")
      .notNull()
      .references(() => vanniCampanas.id, { onDelete: "cascade" }),
    contactoId: integer("contacto_id")
      .notNull()
      .references(() => vanniContactos.id, { onDelete: "cascade" }),
    varianteId: integer("variante_id").references(() => vanniVariantes.id, {
      onDelete: "set null",
    }),
    telefono: varchar("telefono", { length: 20 }).notNull(),
    texto: text("texto").notNull(),
    /** Cola: `pendiente` → `enviado` | `error` | `cancelado`. */
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
    /** Lo que dice WhatsApp: `enviado` → `entregado` → `leido`, o `error`. */
    entrega: varchar("entrega", { length: 20 }),
    /** `msgId` que devuelve WaSender al enviar. */
    waMsgId: varchar("wa_msg_id", { length: 64 }),
    /** `key.id` de WhatsApp, que es lo que traen los webhooks de estado. */
    waKeyId: varchar("wa_key_id", { length: 128 }),
    error: text("error"),
    intentos: smallint("intentos").notNull().default(0),
    /** Cuándo lo tomó la cola. Un envío tomado hace más de 5 min sin terminar se rescata. */
    tomadoAt: timestamp("tomado_at", { withTimezone: true }),
    enviadoAt: timestamp("enviado_at", { withTimezone: true }),
    entregadoAt: timestamp("entregado_at", { withTimezone: true }),
    leidoAt: timestamp("leido_at", { withTimezone: true }),
    respondioAt: timestamp("respondio_at", { withTimezone: true }),
    /** `interesado` | `pregunta` | `no_interesado` | `baja` | `reclamo`. */
    resultado: varchar("resultado", { length: 20 }),
    recordatorioAt: timestamp("recordatorio_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("vanni_envios_campana_contacto_idx").on(t.campanaId, t.contactoId),
    index("vanni_envios_estado_idx").on(t.estado),
    index("vanni_envios_telefono_idx").on(t.telefono),
    index("vanni_envios_msg_idx").on(t.waMsgId),
    index("vanni_envios_key_idx").on(t.waKeyId),
  ],
);

// ─── Oportunidades ───────────────────────────────────────────────────────────

/** `por_llamar` → `llamado` → `cotizando` → `ganada` | `perdida`. */
export type VanniEstadoOportunidad =
  | "por_llamar"
  | "llamado"
  | "cotizando"
  | "ganada"
  | "perdida";

/** Un cliente que mostró interés y espera la llamada de una ejecutiva. */
export const vanniOportunidades = pgTable(
  "vanni_oportunidades",
  {
    id: serial("id").primaryKey(),
    contactoId: integer("contacto_id")
      .notNull()
      .references(() => vanniContactos.id, { onDelete: "cascade" }),
    campanaId: integer("campana_id").references(() => vanniCampanas.id, {
      onDelete: "set null",
    }),
    envioId: integer("envio_id").references(() => vanniEnvios.id, { onDelete: "set null" }),
    ejecutivaId: integer("ejecutiva_id").references(() => vanniUsuarios.id, {
      onDelete: "set null",
    }),
    /** `interes` | `reclamo`. Un reclamo también va a la ejecutiva, sin oferta. */
    tipo: varchar("tipo", { length: 20 }).notNull().default("interes"),
    /** Qué le interesa, en las palabras del cliente. */
    interes: text("interes"),
    /** La conversación en dos líneas, para llamar con contexto. */
    resumen: text("resumen"),
    estado: varchar("estado", { length: 20 }).notNull().default("por_llamar"),
    notas: text("notas"),
    montoCotizado: bigint("monto_cotizado", { mode: "number" }),
    notificadaAt: timestamp("notificada_at", { withTimezone: true }),
    ejemplo: boolean("ejemplo").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("vanni_oportunidades_estado_idx").on(t.estado)],
);

// ─── Conversación ────────────────────────────────────────────────────────────

/** Estado que viaja con la sesión. Es jsonb: agregar un campo no requiere migración. */
export interface VanniEstadoTienda {
  carrito: { productoId: number; nombre: string; precio: number; cantidad: number }[];
  /** Último listado mostrado, para que "el 2" signifique algo. */
  ultimosProductos?: number[];
  /** Última lista de categorías mostrada. */
  ultimasCategorias?: string[];
  /** Qué se listó por última vez: decide qué significa un número suelto. */
  ultimaLista?: "productos" | "categorias";
  /** En `#Ofertas`: ya se le preguntó qué necesita; la próxima respuesta se deriva. */
  esperandoDetalle?: boolean;
}

/**
 * En qué flujo está cada teléfono. Una fila por teléfono.
 *
 * Es lo que evita que los dos demos choquen: un mensaje sin llave va al flujo
 * de la sesión vigente, y una llave nueva cambia de flujo explícitamente.
 */
export const vanniSesiones = pgTable("vanni_sesiones", {
  telefono: varchar("telefono", { length: 20 }).primaryKey(),
  /** `ofertas` | `tienda`. */
  flujo: varchar("flujo", { length: 20 }).notNull(),
  contactoId: integer("contacto_id").references(() => vanniContactos.id, {
    onDelete: "set null",
  }),
  /** La campaña de la que viene, en `ofertas`. */
  campanaId: integer("campana_id").references(() => vanniCampanas.id, {
    onDelete: "set null",
  }),
  estado: jsonb("estado").$type<VanniEstadoTienda>(),
  actualizadaAt: timestamp("actualizada_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Historial de mensajes, entrantes y salientes. El motor lee los últimos. */
export const vanniMensajes = pgTable(
  "vanni_mensajes",
  {
    id: serial("id").primaryKey(),
    telefono: varchar("telefono", { length: 20 }).notNull(),
    /** `ofertas` | `tienda` | `sistema`. */
    flujo: varchar("flujo", { length: 20 }).notNull(),
    /** `in` | `out`. */
    direccion: varchar("direccion", { length: 4 }).notNull(),
    texto: text("texto").notNull(),
    imagenUrl: text("imagen_url"),
    /** Salió por el simulador del backoffice y no por WhatsApp. */
    simulado: boolean("simulado").notNull().default(false),
    waMsgId: varchar("wa_msg_id", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("vanni_mensajes_telefono_idx").on(t.telefono, t.createdAt)],
);

// ─── Catálogo ────────────────────────────────────────────────────────────────

export const vanniCategorias = pgTable("vanni_categorias", {
  /** El id de WooCommerce. Se conserva para poder re-importar sin duplicar. */
  id: integer("id").primaryKey(),
  nombre: varchar("nombre", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  parentId: integer("parent_id"),
  conteo: integer("conteo").notNull().default(0),
});

/** Dimensiones de `text-embedding-3-small`, igual que `conocimiento_trozos`. */
export const VANNI_DIMENSIONES = 1536;

export const vanniProductos = pgTable(
  "vanni_productos",
  {
    id: serial("id").primaryKey(),
    wooId: integer("woo_id").notNull(),
    sku: varchar("sku", { length: 60 }),
    nombre: varchar("nombre", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 300 }),
    descripcion: text("descripcion"),
    /** Categoría de primer nivel, para agrupar el catálogo. */
    categoria: varchar("categoria", { length: 160 }),
    categoriaIds: jsonb("categoria_ids").$type<number[]>().notNull().default([]),
    imagenUrl: text("imagen_url"),
    imagenOrigen: text("imagen_origen"),
    permalink: text("permalink"),
    /** En CLP, sin decimales. */
    precio: integer("precio").notNull(),
    /** Verdadero mientras el precio sea el inventado para la demo. */
    precioFicticio: boolean("precio_ficticio").notNull().default(true),
    stock: integer("stock").notNull().default(0),
    activo: boolean("activo").notNull().default(true),
    destacado: boolean("destacado").notNull().default(false),
    embedding: vector("embedding", { dimensions: VANNI_DIMENSIONES }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("vanni_productos_woo_idx").on(t.wooId),
    index("vanni_productos_categoria_idx").on(t.categoria),
  ],
);

// ─── Pedidos ─────────────────────────────────────────────────────────────────

/**
 * El ciclo del pedido. Cada paso después del pago le avisa al cliente por
 * WhatsApp: es la experiencia de la fase 4 del deck.
 */
export const VANNI_ESTADOS_PEDIDO = [
  "pendiente_pago",
  "pagado",
  "preparacion",
  "despachado",
  "en_camino",
  "entregado",
  "cancelado",
] as const;
export type VanniEstadoPedido = (typeof VANNI_ESTADOS_PEDIDO)[number];

export const vanniPedidos = pgTable(
  "vanni_pedidos",
  {
    id: serial("id").primaryKey(),
    /** Código corto que se le dice al cliente: V-1042. */
    codigo: varchar("codigo", { length: 20 }).notNull(),
    telefono: varchar("telefono", { length: 20 }).notNull(),
    contactoId: integer("contacto_id").references(() => vanniContactos.id, {
      onDelete: "set null",
    }),
    nombreCliente: varchar("nombre_cliente", { length: 160 }),
    direccion: text("direccion"),
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente_pago"),
    total: integer("total").notNull(),
    /** Token del link de pago. Sin él no se llega a la página de pago. */
    tokenPago: varchar("token_pago", { length: 40 }).notNull(),
    historial: jsonb("historial")
      .$type<{ estado: string; at: string }[]>()
      .notNull()
      .default([]),
    simulado: boolean("simulado").notNull().default(false),
    pagadoAt: timestamp("pagado_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("vanni_pedidos_codigo_idx").on(t.codigo),
    uniqueIndex("vanni_pedidos_token_idx").on(t.tokenPago),
    index("vanni_pedidos_telefono_idx").on(t.telefono),
  ],
);

export const vanniPedidoItems = pgTable("vanni_pedido_items", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedido_id")
    .notNull()
    .references(() => vanniPedidos.id, { onDelete: "cascade" }),
  productoId: integer("producto_id").references(() => vanniProductos.id, {
    onDelete: "set null",
  }),
  nombre: varchar("nombre", { length: 300 }).notNull(),
  precio: integer("precio").notNull(),
  cantidad: integer("cantidad").notNull(),
});

// ─── Presupuesto del modelo ──────────────────────────────────────────────────

/**
 * Gasto diario del modelo, con corte. Viene del bot de Paine: un bucle o un
 * número que escribe sin parar no debe convertirse en una factura.
 */
export const vanniPresupuesto = pgTable("vanni_presupuesto", {
  fecha: date("fecha").primaryKey(),
  llamadas: integer("llamadas").notNull().default(0),
  tokensEntrada: integer("tokens_entrada").notNull().default(0),
  tokensSalida: integer("tokens_salida").notNull().default(0),
  costoUsd: numeric("costo_usd", { precision: 10, scale: 4 }).notNull().default("0"),
});

export type VanniUsuario = typeof vanniUsuarios.$inferSelect;
export type VanniContacto = typeof vanniContactos.$inferSelect;
export type VanniCampana = typeof vanniCampanas.$inferSelect;
export type VanniVariante = typeof vanniVariantes.$inferSelect;
export type VanniEnvio = typeof vanniEnvios.$inferSelect;
export type VanniOportunidad = typeof vanniOportunidades.$inferSelect;
export type VanniSesion = typeof vanniSesiones.$inferSelect;
export type VanniMensaje = typeof vanniMensajes.$inferSelect;
export type VanniProducto = typeof vanniProductos.$inferSelect;
export type VanniPedido = typeof vanniPedidos.$inferSelect;
export type VanniPedidoItem = typeof vanniPedidoItems.$inferSelect;
