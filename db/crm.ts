// =============================================================================
// CRM adoOps — esquema (/crm)
// =============================================================================
//
// Todas las tablas llevan prefijo `crm_` porque comparten la base de Neon con la
// web corporativa (`leads`) y con TV Mix (`mix_rooms`). Sin prefijo, un `orders`
// o un `users` chocaría con lo que venga después.
//
// **Los montos son enteros en pesos chilenos.** No hay `numeric`: el CLP no
// tiene decimales y `numeric` en Drizzle vuelve como string, lo que obliga a
// parsear en cada suma y termina en errores de redondeo silenciosos. Un
// `integer` aguanta hasta ~2.147 millones de millones; de sobra.
//
// Una sola organización. No hay `org_id`: el CRM se despliega por cliente, y un
// campo de aislamiento que nadie filtra es peor que no tenerlo.

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Usuarios y sesión ───────────────────────────────────────────────────────

/** admin mantiene la plataforma · gerente ve todo · vendedor ve lo suyo. */
export type CrmRole = "admin" | "gerente" | "vendedor";

export const crmUsers = pgTable(
  "crm_users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 60 }).notNull(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }),
    // scrypt$sal$hash — ver lib/crm/session.ts
    passwordHash: text("password_hash").notNull(),
    rol: varchar("rol", { length: 20 }).notNull().default("vendedor"),
    activo: boolean("activo").notNull().default(true),
    ultimoIngreso: timestamp("ultimo_ingreso"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("crm_users_username_idx").on(t.username)],
);

// ─── Cuentas y contactos ─────────────────────────────────────────────────────

export type CrmAccountEstado = "prospecto" | "cliente" | "inactivo" | "perdido";
export type CrmTamano = "micro" | "pyme" | "mediana" | "grande";

export const crmAccounts = pgTable(
  "crm_accounts",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 160 }).notNull(),
    rut: varchar("rut", { length: 20 }),
    industria: varchar("industria", { length: 80 }),
    tamano: varchar("tamano", { length: 20 }),
    ciudad: varchar("ciudad", { length: 80 }),
    sitioWeb: varchar("sitio_web", { length: 200 }),
    estado: varchar("estado", { length: 20 }).notNull().default("prospecto"),
    /** Cómo entró la cuenta. Se conserva aunque después cambie de campaña. */
    fuente: varchar("fuente", { length: 60 }),
    ownerId: integer("owner_id"),
    notas: text("notas"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("crm_accounts_estado_idx").on(t.estado),
    index("crm_accounts_owner_idx").on(t.ownerId),
  ],
);

/**
 * La persona. **Es el eje del CRM**, no la empresa.
 *
 * En una boutique de alta gama el cliente es alguien con nombre y teléfono, no
 * una razón social: quien compra un reloj de doce millones lo hace a título
 * personal y vuelve tres años después por otro. `accountId` existe para el caso
 * minoritario —una empresa que compra un regalo corporativo— y por eso es
 * opcional.
 *
 * Los campos de gestión comercial (estado, fuente, dueño) viven acá y no en la
 * cuenta: si colgaran de la empresa, el 90% de la cartera los tendría vacíos.
 */
export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: serial("id").primaryKey(),
    /** Opcional: solo cuando compra a nombre de una empresa. */
    accountId: integer("account_id"),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    cargo: varchar("cargo", { length: 120 }),
    email: varchar("email", { length: 254 }),
    /** E.164 sin '+' — normalizado por lib/crm/telefono.ts (Chile por defecto). */
    telefono: varchar("telefono", { length: 20 }),
    esDecisor: boolean("es_decisor").notNull().default(false),
    /** Sin esto no sale un WhatsApp. Lo revisa el despacho, no la UI. */
    optInWhatsapp: boolean("opt_in_whatsapp").notNull().default(false),

    // ── Gestión comercial (antes vivían en la cuenta) ──
    estado: varchar("estado", { length: 20 }).notNull().default("prospecto"),
    /** Cómo llegó: showroom, referido, Instagram, evento… */
    fuente: varchar("fuente", { length: 60 }),
    ownerId: integer("owner_id"),
    ciudad: varchar("ciudad", { length: 80 }),
    /** Etiquetas libres: "coleccionista", "VIP", "espera lista Nautilus". */
    etiquetas: jsonb("etiquetas").$type<string[]>(),
    /** Lo que hay que saber antes de llamarlo. */
    notas: text("notas"),
    /** Preferencias declaradas: marcas, estilo, tallas. Alimenta el cross-sell. */
    preferencias: text("preferencias"),

    // ── Identidad e historia ──
    /** RUT: la llave con la que el POS identifica a una persona en Chile. */
    rut: varchar("rut", { length: 20 }),
    /** Cuándo compró por primera vez. Define su cohorte y no cambia nunca más. */
    primeraCompraEn: timestamp("primera_compra_en"),
    /** Consentimiento para recibir comunicaciones, con su fecha. */
    consentimiento: boolean("consentimiento").notNull().default(false),
    consentimientoEn: timestamp("consentimiento_en"),
    /** Cumpleaños: solo día y mes importan, pero se guarda la fecha completa. */
    cumpleanos: timestamp("cumpleanos"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("crm_contacts_account_idx").on(t.accountId),
    index("crm_contacts_telefono_idx").on(t.telefono),
    index("crm_contacts_estado_idx").on(t.estado),
    index("crm_contacts_owner_idx").on(t.ownerId),
  ],
);

// ─── Catálogo e inventario ───────────────────────────────────────────────────

export const crmProducts = pgTable(
  "crm_products",
  {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 40 }).notNull(),
    nombre: varchar("nombre", { length: 160 }).notNull(),
    categoria: varchar("categoria", { length: 80 }),
    /** La marca importa tanto como la categoría en alta gama. */
    marca: varchar("marca", { length: 80 }),
    /** CLP, entero. */
    precio: integer("precio").notNull().default(0),
    costo: integer("costo").notNull().default(0),
    activo: boolean("activo").notNull().default(true),
    descripcion: text("descripcion"),
    /**
     * Si la pieza admite descuento. Hay marcas que lo prohíben por contrato de
     * distribución, y ese "no" tiene que vivir en el catálogo y no en la cabeza
     * de quien vende.
     */
    permiteDescuento: boolean("permite_descuento").notNull().default(true),
    /** Tope como fracción: 0.10 = 10%. Null = admite, sin tope definido. */
    topeDescuento: integer("tope_descuento_bp"),
  },
  (t) => [uniqueIndex("crm_products_sku_idx").on(t.sku)],
);

/**
 * Inventario aparte del producto a propósito: es el dato que en una
 * implementación real llega del ERP y se refresca solo. Separarlo deja claro
 * dónde enchufar esa integración sin tocar el catálogo.
 */
export const crmInventory = pgTable("crm_inventory", {
  productId: integer("product_id").primaryKey(),
  stock: integer("stock").notNull().default(0),
  /** Comprometido en oportunidades abiertas. Disponible = stock - reservado. */
  reservado: integer("reservado").notNull().default(0),
  puntoReposicion: integer("punto_reposicion").notNull().default(0),
  leadTimeDias: integer("lead_time_dias").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Marketing ───────────────────────────────────────────────────────────────

export type CrmCanal =
  | "email"
  | "ads"
  | "social"
  | "evento"
  | "referido"
  | "whatsapp"
  | "organico";

export const crmCampaigns = pgTable("crm_campaigns", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 160 }).notNull(),
  canal: varchar("canal", { length: 30 }).notNull(),
  inicio: timestamp("inicio").notNull(),
  fin: timestamp("fin"),
  /** CLP invertidos. Es lo que permite calcular CAC y ROI, no adorno. */
  costo: integer("costo").notNull().default(0),
  objetivo: text("objetivo"),
  activa: boolean("activa").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrmTouchTipo =
  | "impresion"
  | "click"
  | "apertura"
  | "formulario"
  | "visita"
  | "respuesta"
  | "reunion";

/**
 * Cada interacción de marketing con un contacto. Es la materia prima de la
 * trazabilidad: sin esta tabla, "de qué campaña salió esta venta" es una
 * opinión.
 */
export const crmTouchpoints = pgTable(
  "crm_touchpoints",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id").notNull(),
    /** Opcional: se conserva por si el toque fue a una empresa. */
    accountId: integer("account_id"),
    campaignId: integer("campaign_id"),
    tipo: varchar("tipo", { length: 20 }).notNull(),
    detalle: text("detalle"),
    ocurridoEn: timestamp("ocurrido_en").defaultNow().notNull(),
  },
  (t) => [
    index("crm_touchpoints_account_idx").on(t.accountId),
    index("crm_touchpoints_campaign_idx").on(t.campaignId),
    index("crm_touchpoints_fecha_idx").on(t.ocurridoEn),
  ],
);

// ─── Oportunidades ───────────────────────────────────────────────────────────

export type CrmEtapa =
  | "nuevo"
  | "calificado"
  | "propuesta"
  | "negociacion"
  | "ganado"
  | "perdido";

export const crmDeals = pgTable(
  "crm_deals",
  {
    id: serial("id").primaryKey(),
    /** Opcional: solo si el negocio va a nombre de una empresa. */
    accountId: integer("account_id"),
    /** Quién compra. Es el vínculo que de verdad se usa. */
    contactId: integer("contact_id"),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    etapa: varchar("etapa", { length: 20 }).notNull().default("nuevo"),
    /** CLP. Se recalcula desde los items cuando la oportunidad tiene productos. */
    monto: integer("monto").notNull().default(0),
    probabilidad: integer("probabilidad").notNull().default(10),
    ownerId: integer("owner_id"),
    fuente: varchar("fuente", { length: 60 }),
    /**
     * Categoría corregida a mano. NULL = usa la de la pieza más cara.
     *
     * Existe porque la derivación falla justo donde importa: un cronómetro
     * cotizado como regalo corporativo pesa en "Alta relojería" cuando el
     * negocio es de empresa, y eso lo sabe quien vende, no el catálogo.
     */
    categoria: varchar("categoria", { length: 80 }),
    /** Atribución: primera y última campaña que tocó a la cuenta antes del cierre. */
    campaignFirstId: integer("campaign_first_id"),
    campaignLastId: integer("campaign_last_id"),
    abiertoEn: timestamp("abierto_en").defaultNow().notNull(),
    cierreEstimado: timestamp("cierre_estimado"),
    cerradoEn: timestamp("cerrado_en"),
    motivoPerdida: varchar("motivo_perdida", { length: 200 }),
    /** Última vez que alguien hizo algo con esta oportunidad. Alimenta alertas. */
    ultimaActividadEn: timestamp("ultima_actividad_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("crm_deals_etapa_idx").on(t.etapa),
    index("crm_deals_account_idx").on(t.accountId),
    index("crm_deals_owner_idx").on(t.ownerId),
  ],
);

export const crmDealItems = pgTable(
  "crm_deal_items",
  {
    id: serial("id").primaryKey(),
    dealId: integer("deal_id").notNull(),
    productId: integer("product_id").notNull(),
    cantidad: integer("cantidad").notNull().default(1),
    precioUnitario: integer("precio_unitario").notNull().default(0),
  },
  (t) => [index("crm_deal_items_deal_idx").on(t.dealId)],
);

// ─── Actividades ─────────────────────────────────────────────────────────────

export type CrmActividadTipo =
  | "llamada"
  | "reunion"
  | "email"
  | "nota"
  | "tarea"
  | "whatsapp";

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: serial("id").primaryKey(),
    /** Opcional: la actividad cuelga del contacto, no de la empresa. */
    accountId: integer("account_id"),
    dealId: integer("deal_id"),
    contactId: integer("contact_id"),
    tipo: varchar("tipo", { length: 20 }).notNull(),
    titulo: varchar("titulo", { length: 200 }).notNull(),
    detalle: text("detalle"),
    ownerId: integer("owner_id"),
    ocurridoEn: timestamp("ocurrido_en").defaultNow().notNull(),
    /** Solo para tipo 'tarea'. Una tarea sin completar y vencida genera alerta. */
    venceEn: timestamp("vence_en"),
    completada: boolean("completada").notNull().default(true),
  },
  (t) => [
    index("crm_activities_account_idx").on(t.accountId),
    index("crm_activities_deal_idx").on(t.dealId),
    index("crm_activities_fecha_idx").on(t.ocurridoEn),
  ],
);

// ─── Ventas cerradas ─────────────────────────────────────────────────────────

/**
 * Una venta materializada. Existe separada de `crm_deals` porque una cuenta
 * recompra sin pasar por una oportunidad nueva, y porque la recompra y el
 * cross-sell se calculan sobre lo que efectivamente se facturó.
 */
export const crmOrders = pgTable(
  "crm_orders",
  {
    id: serial("id").primaryKey(),
    /** Quién compró. El eje. */
    contactId: integer("contact_id"),
    /** Solo si la compra fue a nombre de una empresa. */
    accountId: integer("account_id"),
    dealId: integer("deal_id"),
    /** Si nació de una cotización de mostrador. */
    quoteId: integer("quote_id"),
    fecha: timestamp("fecha").defaultNow().notNull(),
    /** CLP. Suma de los items. */
    total: integer("total").notNull().default(0),
    canal: varchar("canal", { length: 40 }),

    // ── Origen omnicanal ──
    //
    // El CRM no vende: recibe ventas de dos sistemas que no se conocen entre sí
    // —el POS de la tienda y el e-commerce— y su trabajo es reconocer que el
    // señor que compró en Alonso de Córdova es el mismo que pidió una correa
    // por la web. Sin `origen` esa pregunta no se puede hacer.
    /** 'pos' | 'ecommerce' | 'manual' */
    origen: varchar("origen", { length: 20 }).notNull().default("pos"),
    /** Id en el sistema de origen. Es lo que hace la sincronización idempotente. */
    externalId: varchar("external_id", { length: 80 }),
    /** Tipo de documento del POS: boleta, factura, nota de venta. */
    documento: varchar("documento", { length: 30 }),
    numeroDocumento: varchar("numero_documento", { length: 40 }),
    sucursal: varchar("sucursal", { length: 80 }),
    /**
     * Si la venta quedó asociada a una persona.
     *
     * **Es el indicador que ordena todo el proyecto.** Una boleta sin RUT ni
     * correo ni teléfono es una venta que existe en la contabilidad y no existe
     * en el CRM: no tiene RFM, no tiene LTV, no se le puede escribir. Guardarlo
     * como columna —y no deducirlo de `contact_id is null`— permite distinguir
     * "no se pidió el dato" de "se pidió y no se pudo cruzar".
     */
    identificado: boolean("identificado").notNull().default(true),
    /** Cómo se identificó: rut, email, telefono, cuenta_web, manual. */
    metodoIdentificacion: varchar("metodo_identificacion", { length: 20 }),
    vendedor: varchar("vendedor", { length: 120 }),
    medioPago: varchar("medio_pago", { length: 40 }),
  },
  (t) => [
    index("crm_orders_contact_idx").on(t.contactId),
    index("crm_orders_account_idx").on(t.accountId),
    index("crm_orders_fecha_idx").on(t.fecha),
    index("crm_orders_origen_idx").on(t.origen),
    uniqueIndex("crm_orders_external_idx").on(t.origen, t.externalId),
  ],
);

export const crmOrderItems = pgTable(
  "crm_order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull(),
    productId: integer("product_id").notNull(),
    cantidad: integer("cantidad").notNull().default(1),
    precioUnitario: integer("precio_unitario").notNull().default(0),
  },
  (t) => [
    index("crm_order_items_order_idx").on(t.orderId),
    index("crm_order_items_product_idx").on(t.productId),
  ],
);

// ─── Captura en showroom ─────────────────────────────────────────────────────

/**
 * El visitante que entró a la tienda y dejó sus datos.
 *
 * Existe como tabla propia y no como un contacto más porque son dos cosas
 * distintas: acá entra gente que todavía no compró y que puede no volver nunca.
 * Mezclarlos desde el minuto cero ensucia la cartera y hace que el puntaje de
 * potencial promedie sobre personas de las que no se sabe nada.
 *
 * Cuando la visita se convierte —compra, cotiza o responde— se crea el contacto
 * y `contact_id` los une. Hasta entonces vive acá.
 */
export const crmShowroomVisitas = pgTable(
  "crm_showroom_visitas",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    telefono: varchar("telefono", { length: 20 }),
    email: varchar("email", { length: 254 }),
    /** Qué vino a ver. Es lo que hace accionable el seguimiento. */
    interes: varchar("interes", { length: 120 }),
    detalle: text("detalle"),
    boutique: varchar("boutique", { length: 80 }),
    /** Cómo llegó el dato: formulario con QR, tablet del vendedor, evento. */
    medio: varchar("medio", { length: 30 }).notNull().default("qr"),
    /** Nombre del evento o activación, cuando corresponde. */
    evento: varchar("evento", { length: 120 }),
    /**
     * Consentimiento explícito para recibir comunicaciones.
     *
     * Sin esto marcado el dato sirve para el registro de visitas y para nada
     * más: no se le escribe. La ley 19.628 y el sentido común coinciden acá.
     */
    consentimiento: boolean("consentimiento").notNull().default(false),
    /** Momento exacto del consentimiento: es lo que se muestra si alguien reclama. */
    consentimientoEn: timestamp("consentimiento_en"),
    atendidoPor: integer("atendido_por"),
    contactId: integer("contact_id"),

    /**
     * HEREDADAS. Estas dos columnas existen en la base desde una versión previa
     * en que la visita registraba sala y cita; ese dato hoy vive en
     * `crm_audiciones`. No se leen ni se escriben desde el código.
     *
     * Se declaran para que una migración no las borre: hay 78 filas con datos.
     * Para eliminarlas de verdad, hay que hacerlo con una migración explícita y
     * a conciencia, no de refilón.
     */
    conCita: boolean("con_cita").notNull().default(false),
    salaId: integer("sala_id"),
    /** pendiente | contactado | convertido | descartado */
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("crm_showroom_estado_idx").on(t.estado),
    index("crm_showroom_fecha_idx").on(t.createdAt),
    index("crm_showroom_telefono_idx").on(t.telefono),
  ],
);

// ─── Señales de conversación ─────────────────────────────────────────────────

/**
 * Un hecho concreto que justifica que alguien llame o escriba hoy.
 *
 * El problema del ejecutivo no es a quién contactar: es **qué decirle** que no
 * suene a "hola, ¿cómo estás?". Una señal trae tres cosas —motivo, evidencia y
 * un borrador— para que el contacto tenga contenido desde el primer segundo.
 *
 * `clave` es la huella del hallazgo: permite recalcular todos los días sin
 * duplicar la misma señal. Y una señal se acciona o se descarta, nunca se
 * acumula: un panel que solo crece se convierte en otra bandeja que nadie mira.
 */
export const crmSenales = pgTable(
  "crm_senales",
  {
    id: serial("id").primaryKey(),
    clave: varchar("clave", { length: 200 }).notNull(),
    contactId: integer("contact_id").notNull(),
    /** recompra | aniversario | complemento | mantencion | novedad_marca | reactivacion | cumpleanos */
    tipo: varchar("tipo", { length: 40 }).notNull(),
    /** Qué tan urgente es hablarle: alta, media, baja. */
    prioridad: varchar("prioridad", { length: 10 }).notNull().default("media"),
    /** El motivo, en una línea. */
    titulo: varchar("titulo", { length: 250 }).notNull(),
    /** El dato que sostiene el motivo. Sin evidencia es una corazonada. */
    evidencia: text("evidencia"),
    /** El mensaje listo para editar y mandar. */
    borrador: text("borrador"),
    /** Producto o categoría a la que apunta, si aplica. */
    productId: integer("product_id"),
    ownerId: integer("owner_id"),
    /** pendiente | accionada | descartada */
    estado: varchar("estado", { length: 20 }).notNull().default("pendiente"),
    /** Vale hasta esta fecha: una señal de cumpleaños en marzo no sirve en junio. */
    venceEn: timestamp("vence_en"),
    generadaEn: timestamp("generada_en").defaultNow().notNull(),
    resueltaEn: timestamp("resuelta_en"),
  },
  (t) => [
    uniqueIndex("crm_senales_clave_idx").on(t.clave),
    index("crm_senales_estado_idx").on(t.estado),
    index("crm_senales_contact_idx").on(t.contactId),
    index("crm_senales_owner_idx").on(t.ownerId),
  ],
);

// ─── Cotizaciones de mostrador ───────────────────────────────────────────────

/**
 * La cotización que se arma con el cliente delante —o por WhatsApp— antes de
 * que exista una oportunidad formal.
 *
 * Portada del CRM de CDC, donde resolvió un problema medido: el mostrador
 * cotizaba sin capturar el teléfono, y el 59% del volumen quedaba sin forma de
 * hacerle seguimiento. Acá la lógica es la misma —tres datos, catálogo real,
 * documento por WhatsApp— y la ficha completa del cliente se llena recién
 * cuando hay interés.
 *
 * `paraSiMismo` traduce directo al rubro: en joyería la mitad de las consultas
 * son un regalo, y a quien se le escribe no es quien va a usar la pieza.
 *
 * Estados:
 *   abierta    se está armando
 *   enviada    el documento salió por WhatsApp
 *   convertida se transformó en venta
 *   descartada se cerró sin seguimiento
 */
export const crmQuotes = pgTable(
  "crm_quotes",
  {
    id: serial("id").primaryKey(),
    /** Se vincula al contacto si ya existía; si no, la cotización lo crea. */
    contactId: integer("contact_id"),
    /** Quién pregunta y a qué número se le escribe. */
    cotizanteNombre: varchar("cotizante_nombre", { length: 120 }).notNull(),
    cotizanteTelefono: varchar("cotizante_telefono", { length: 20 }).notNull(),
    /** Falso cuando la pieza es para otra persona: cambia a quién se saluda. */
    paraSiMismo: boolean("para_si_mismo").notNull().default(true),
    destinatarioNombre: varchar("destinatario_nombre", { length: 120 }),
    /** Dónde se atendió. */
    boutique: varchar("boutique", { length: 80 }),
    createdById: integer("created_by_id"),

    /**
     * Subtotal antes de descuentos, descuento global y total.
     *
     * Se guarda desglosado —y no solo el total— para poder explicar después
     * dónde se fue el margen: cuánto salió de los descuentos por pieza y
     * cuánto de la rebaja global que se negoció al cierre.
     */
    subtotal: integer("subtotal").notNull().default(0),
    descuentoGlobal: integer("descuento_global").notNull().default(0),
    total: integer("total").notNull().default(0),

    estado: varchar("estado", { length: 20 }).notNull().default("abierta"),
    /** Hilo por el que se envió y por el que responde el cliente. */
    conversationId: integer("conversation_id"),
    /** La venta que salió de acá, si se concretó. */
    orderId: integer("order_id"),
    dealId: integer("deal_id"),

    enviadaEn: timestamp("enviada_en"),
    convertidaEn: timestamp("convertida_en"),
    /**
     * Marca que el cliente tiene en la mano un documento que ya no dice lo
     * mismo. Es la única forma de que alguien se entere de esa diferencia
     * antes de que llegue a la caja.
     */
    editadaTrasEnvio: boolean("editada_tras_envio").notNull().default(false),
    editadaEn: timestamp("editada_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("crm_quotes_estado_idx").on(t.estado),
    index("crm_quotes_contact_idx").on(t.contactId),
    index("crm_quotes_telefono_idx").on(t.cotizanteTelefono),
    index("crm_quotes_fecha_idx").on(t.createdAt),
  ],
);

/**
 * Cada pieza cotizada.
 *
 * El nombre y el precio se COPIAN al cotizar, no se leen del catálogo al
 * mostrar: si mañana sube el precio de lista, la cotización que ya se le mandó
 * a un cliente tiene que seguir diciendo lo que decía. Lo mismo con el tope de
 * descuento, para poder explicar por qué esta cotización llevaba ese descuento
 * sin que la regla de hoy contradiga la decisión de ayer.
 */
export const crmQuoteItems = pgTable(
  "crm_quote_items",
  {
    id: serial("id").primaryKey(),
    quoteId: integer("quote_id").notNull(),
    productId: integer("product_id").notNull(),
    productoNombre: varchar("producto_nombre", { length: 160 }).notNull(),
    sku: varchar("sku", { length: 40 }),
    marca: varchar("marca", { length: 80 }),
    cantidad: integer("cantidad").notNull().default(1),
    precioUnitario: integer("precio_unitario").notNull().default(0),
    /** Descuento en pesos, no en porcentaje: se negocia "te lo dejo en X". */
    descuento: integer("descuento").notNull().default(0),
    /** El tope que regía cuando se aplicó, en puntos base (1000 = 10%). */
    topeDescuentoBp: integer("tope_descuento_bp"),
    total: integer("total").notNull().default(0),
  },
  (t) => [index("crm_quote_items_quote_idx").on(t.quoteId)],
);

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export const crmWaConversations = pgTable(
  "crm_wa_conversations",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id"),
    contactId: integer("contact_id"),
    dealId: integer("deal_id"),
    telefono: varchar("telefono", { length: 20 }).notNull(),
    nombre: varchar("nombre", { length: 120 }),
    estado: varchar("estado", { length: 20 }).notNull().default("abierta"),
    /** La palabra BAJA cierra la puerta. El despacho la respeta, no la UI. */
    baja: boolean("baja").notNull().default(false),
    ultimoMensajeEn: timestamp("ultimo_mensaje_en"),
    /**
     * Cuándo alguien abrió el hilo por última vez. Nulo = nunca se leyó.
     * "No leído" es una marca de la persona que atiende, no un cálculo sobre la
     * dirección del último mensaje: una conversación leída y dejada para
     * mañana no puede volver a aparecer como pendiente en cada recarga.
     */
    leidoEn: timestamp("leido_en"),
    /** Marcada a mano para no perderla de vista. Nada la enciende solo. */
    destacada: boolean("destacada").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("crm_wa_conv_telefono_idx").on(t.telefono),
    index("crm_wa_conv_estado_idx").on(t.estado),
    index("crm_wa_conv_destacada_idx").on(t.destacada),
  ],
);

/**
 * `estado` del mensaje saliente:
 *   draft     nadie lo aprobó todavía
 *   pending   aprobado, esperando despacho
 *   simulado  el modo simulado lo dio por enviado sin tocar la red
 *   sent      salió de verdad por WaSender
 *   retenido  un candado lo frenó (el motivo queda escrito)
 *   failed    se intentó y la API respondió mal
 */
export const crmWaMessages = pgTable(
  "crm_wa_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    direccion: varchar("direccion", { length: 4 }).notNull(),
    cuerpo: text("cuerpo").notNull(),
    estado: varchar("estado", { length: 20 }).notNull().default("draft"),
    motivo: text("motivo"),
    automatico: boolean("automatico").notNull().default(false),
    autorId: integer("autor_id"),
    waMessageId: varchar("wa_message_id", { length: 120 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    enviadoEn: timestamp("enviado_en"),
  },
  (t) => [
    index("crm_wa_msg_conv_idx").on(t.conversationId),
    index("crm_wa_msg_estado_idx").on(t.estado),
  ],
);

export const crmWaTemplates = pgTable("crm_wa_templates", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  /** Texto con {{contacto}}, {{cuenta}}, {{producto}}, {{monto}}, {{vendedor}}. */
  cuerpo: text("cuerpo").notNull(),
  proposito: varchar("proposito", { length: 40 }),
  activa: boolean("activa").notNull().default(true),
});

// ─── Inteligencia ────────────────────────────────────────────────────────────

/**
 * Segmento guardado. `definicion` es el filtro declarativo que evalúa
 * lib/crm/segmentos.ts — se guarda la regla, no la lista de resultados, para
 * que el segmento siga vivo cuando los datos cambien.
 */
export const crmSegments = pgTable("crm_segments", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  descripcion: text("descripcion"),
  definicion: jsonb("definicion").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CrmAlertaSeveridad = "alta" | "media" | "baja";
export type CrmAlertaEstado = "abierta" | "atendida" | "descartada";

/**
 * Alertas e insights generados por el motor de reglas.
 *
 * `clave` es la huella del hallazgo (tipo + entidad + ventana): permite volver
 * a correr el motor las veces que sea sin duplicar la misma alerta.
 */
export const crmAlerts = pgTable(
  "crm_alerts",
  {
    id: serial("id").primaryKey(),
    clave: varchar("clave", { length: 200 }).notNull(),
    tipo: varchar("tipo", { length: 40 }).notNull(),
    severidad: varchar("severidad", { length: 10 }).notNull().default("media"),
    titulo: varchar("titulo", { length: 250 }).notNull(),
    detalle: text("detalle"),
    entidadTipo: varchar("entidad_tipo", { length: 20 }),
    entidadId: integer("entidad_id"),
    /** Qué hacer, en forma ejecutable: { accion, etiqueta, params }. */
    accionSugerida: jsonb("accion_sugerida"),
    estado: varchar("estado", { length: 20 }).notNull().default("abierta"),
    generadaEn: timestamp("generada_en").defaultNow().notNull(),
    resueltaEn: timestamp("resuelta_en"),
  },
  (t) => [
    uniqueIndex("crm_alerts_clave_idx").on(t.clave),
    index("crm_alerts_estado_idx").on(t.estado),
  ],
);

/**
 * Resúmenes ya redactados, guardados para no volver a pedirlos.
 *
 * `huella` es un hash de las cifras que produjeron el texto: mientras los
 * números no cambien, el párrafo sigue siendo válido y no hay razón para pagar
 * otra llamada al modelo —ni para hacer esperar a nadie seis segundos por una
 * frase idéntica a la anterior—.
 */
export const crmNarraciones = pgTable("crm_narraciones", {
  /** Qué pantalla lo pidió: 'portada', 'alertas', 'marketing', 'reportes'. */
  clave: varchar("clave", { length: 40 }).primaryKey(),
  huella: varchar("huella", { length: 64 }).notNull(),
  texto: text("texto").notNull(),
  origen: varchar("origen", { length: 12 }).notNull(),
  generadaEn: timestamp("generada_en").defaultNow().notNull(),
});

/** Configuración operativa editable desde la UI. Clave-valor, sin migraciones. */
export const crmSettings = pgTable("crm_settings", {
  clave: varchar("clave", { length: 80 }).primaryKey(),
  valor: text("valor").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Tipos inferidos ─────────────────────────────────────────────────────────

export type CrmUser = typeof crmUsers.$inferSelect;
export type CrmAccount = typeof crmAccounts.$inferSelect;
export type CrmContact = typeof crmContacts.$inferSelect;
export type CrmProduct = typeof crmProducts.$inferSelect;
export type CrmInventory = typeof crmInventory.$inferSelect;
export type CrmCampaign = typeof crmCampaigns.$inferSelect;
export type CrmTouchpoint = typeof crmTouchpoints.$inferSelect;
export type CrmDeal = typeof crmDeals.$inferSelect;
export type CrmDealItem = typeof crmDealItems.$inferSelect;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type CrmOrder = typeof crmOrders.$inferSelect;
export type CrmOrderItem = typeof crmOrderItems.$inferSelect;
export type CrmWaConversation = typeof crmWaConversations.$inferSelect;
export type CrmWaMessage = typeof crmWaMessages.$inferSelect;
export type CrmWaTemplate = typeof crmWaTemplates.$inferSelect;
export type CrmSegment = typeof crmSegments.$inferSelect;
export type CrmAlert = typeof crmAlerts.$inferSelect;
export type CrmNarracion = typeof crmNarraciones.$inferSelect;
export type CrmQuote = typeof crmQuotes.$inferSelect;
export type CrmQuoteItem = typeof crmQuoteItems.$inferSelect;
export type CrmShowroomVisita = typeof crmShowroomVisitas.$inferSelect;
export type CrmSenal = typeof crmSenales.$inferSelect;

// ─── El perfil: lo que se sabe y cómo se supo ────────────────────────────────

/**
 * Un dato conocido de una persona, con su procedencia.
 *
 * Existe como tabla de atributos y no como columnas de `crm_contacts` por tres
 * razones que resultaron ser la misma: **hay que saber cuánto se confía en cada
 * dato, cuándo se supo, y poder agregar datos nuevos sin migrar**.
 *
 * `estado` es lo más importante de acá y corrige un error del modelo anterior.
 * Antes, un cliente sin parlantes comprados aparecía como "le faltan
 * parlantes". Es falso: puede tenerlos hace diez años, comprados en otra parte.
 * Son tres cosas distintas:
 *
 *   conocido   se sabe qué tiene
 *   sin_dato   no se sabe. Es una pregunta pendiente, no una carencia
 *   no_tiene   se preguntó y confirmó. **Esto** sí es una oportunidad
 *
 * Ofrecerle parlantes a quien está en `sin_dato` es la forma más rápida de que
 * el cliente concluya que no lo conocen.
 */
export const crmPerfilAtributos = pgTable(
  "crm_perfil_atributos",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id").notNull(),
    clave: varchar("clave", { length: 60 }).notNull(),
    valor: text("valor"),
    /** conocido | sin_dato | no_tiene */
    estado: varchar("estado", { length: 12 }).notNull().default("conocido"),
    /** 3 hay documento · 2 lo dijo y se anotó · 1 corazonada o inferencia */
    confianza: smallint("confianza").notNull().default(2),
    /** venta | audicion | cotizacion | conversacion | vendedor | inferido */
    origen: varchar("origen", { length: 20 }).notNull().default("vendedor"),
    origenId: integer("origen_id"),
    registradoPor: integer("registrado_por"),
    registradoEn: timestamp("registrado_en").defaultNow().notNull(),
    /** Los datos de intención caducan: un presupuesto de hace dos años no lo es. */
    vigenteHasta: timestamp("vigente_hasta"),
  },
  (t) => [
    uniqueIndex("crm_perfil_atributo_idx").on(t.contactId, t.clave),
    index("crm_perfil_clave_idx").on(t.clave),
    index("crm_perfil_estado_idx").on(t.estado),
  ],
);

/**
 * Las cinco salas del showroom.
 *
 * Cuál se usó es un dato de venta, no de logística: quien pidió la Sala
 * Reference y se quedó dos horas está en otra conversación que quien pasó por
 * Lifestyle.
 */
export const crmSalas = pgTable("crm_salas", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 60 }).notNull(),
  descripcion: text("descripcion"),
  capacidadMin: smallint("capacidad_min").notNull().default(1),
  capacidadMax: smallint("capacidad_max").notNull().default(4),
  /** Qué tan arriba del catálogo está el equipo montado, de 1 a 5. */
  nivel: smallint("nivel").notNull().default(3),
  orden: smallint("orden").notNull().default(0),
  activa: boolean("activa").notNull().default(true),
});

/**
 * La audición: lo más valioso que pasa en el negocio.
 *
 * Vive aparte de `crm_showroom_visitas` porque son cosas distintas. La visita
 * es que alguien entró; la audición es que se sentó dos horas a escuchar un
 * sistema concreto en una sala concreta. Una visita puede no tener audición, y
 * un cliente de años puede venir a una audición sin ser una visita nueva.
 *
 * `descarto` está separado de `leGusto` a propósito: saber qué rechazó vale
 * tanto como saber qué le gustó, y es lo que evita volver a ofrecerle
 * exactamente lo que ya dijo que no.
 */
export const crmAudiciones = pgTable(
  "crm_audiciones",
  {
    id: serial("id").primaryKey(),
    contactId: integer("contact_id"),
    visitaId: integer("visita_id"),
    salaId: integer("sala_id"),
    /** Con cita o pasó y había sala libre. Cambia cómo se lee el interés. */
    conCita: boolean("con_cita").notNull().default(true),
    fecha: timestamp("fecha").defaultNow().notNull(),
    duracionMinutos: smallint("duracion_minutos"),
    acompanantes: smallint("acompanantes").notNull().default(0),
    /** Ids de crm_products, como JSON. Qué equipo estaba montado. */
    equipoEscuchado: text("equipo_escuchado"),
    /** En sus palabras. Es con lo que se le vuelve a escribir en seis meses. */
    queDijo: text("que_dijo"),
    leGusto: text("le_gusto"),
    descarto: text("descarto"),
    /** Lo que mencionó, si lo mencionó. Nunca se pregunta de frente. */
    presupuestoMencionado: integer("presupuesto_mencionado"),
    atendidoPor: integer("atendido_por"),
    proximoPaso: text("proximo_paso"),
    proximoPasoEn: timestamp("proximo_paso_en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("crm_audiciones_contacto_idx").on(t.contactId),
    index("crm_audiciones_fecha_idx").on(t.fecha),
    index("crm_audiciones_sala_idx").on(t.salaId),
  ],
);

export type CrmPerfilAtributo = typeof crmPerfilAtributos.$inferSelect;
export type CrmSala = typeof crmSalas.$inferSelect;
export type CrmAudicion = typeof crmAudiciones.$inferSelect;
