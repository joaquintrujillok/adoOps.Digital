// Base de demostración del CRM.
//
// Simula **Belmont Alta Relojería**, una boutique chilena de relojería fina y
// alta joyería con showroom en Alonso de Córdova. El rubro se eligió porque
// reproduce la mecánica comercial que interesa mostrar —ticket alto, venta
// consultiva por WhatsApp, showroom con cita, catálogo por marca, cliente
// coleccionista que vuelve, accesorios y servicio para cross-sell— sin ser el
// producto de nadie en particular. Marcas y clientes son inventados.
//
// El CONTACTO es el eje: quien compra un reloj de doce millones lo hace a
// título personal. Las empresas existen solo para el caso de regalo
// corporativo, que es minoritario y por eso se ve poco.
//
// Es DETERMINÍSTICA: generador con semilla fija, dos ejecuciones dan los mismos
// datos. Una demo que cambia sola entre ensayos no se puede ensayar.
//
// Idempotente: vacía las tablas de datos antes de sembrar. NO toca crm_users
// (los logins) ni crm_settings (la configuración).
//
// Uso:
//   node scripts/crm-seed.mjs            siembra
//   node scripts/crm-seed.mjs --limpiar  solo borra

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL no encontrada");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());

// ─── Aleatoriedad con semilla ────────────────────────────────────────────────

let semilla = 20260811;
function rnd() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
const elegir = (xs) => xs[Math.floor(rnd() * xs.length)];
const quizas = (p) => rnd() < p;

const HOY = new Date("2026-08-11T12:00:00Z");
const dias = (n) => new Date(HOY.getTime() - n * 86_400_000);

// ─── Limpieza ────────────────────────────────────────────────────────────────

async function limpiar() {
  const tablas = [
    "crm_quote_items",
    "crm_quotes",
    "crm_wa_messages",
    "crm_wa_conversations",
    "crm_wa_templates",
    "crm_alerts",
    "crm_narraciones",
    "crm_segments",
    "crm_order_items",
    "crm_orders",
    "crm_deal_items",
    "crm_deals",
    "crm_activities",
    "crm_touchpoints",
    "crm_campaigns",
    "crm_inventory",
    "crm_products",
    "crm_contacts",
    "crm_accounts",
  ];
  for (const t of tablas) {
    await sql.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
  }
  console.log(`✓ ${tablas.length} tablas vaciadas (crm_users y crm_settings intactas)`);
}

if (process.argv.includes("--limpiar")) {
  await limpiar();
  process.exit(0);
}

await limpiar();

// ─── Equipo ──────────────────────────────────────────────────────────────────

const usuarios = await sql`SELECT id, nombre, rol FROM crm_users WHERE activo = TRUE ORDER BY id`;
if (usuarios.length === 0) {
  console.error(
    'No hay usuarios. Crea al menos uno:\n  node scripts/crm-usuario.mjs joaquin <clave> admin "Tu Nombre"',
  );
  process.exit(1);
}
const vendedores = usuarios.filter((u) => u.rol !== "admin");
const equipo = vendedores.length ? vendedores : usuarios;

const BOUTIQUES = ["Alonso de Córdova", "Casa Costanera", "Viña del Mar"];

// ─── Catálogo ────────────────────────────────────────────────────────────────
//
// Marcas inventadas con aire suizo, alemán e italiano. Los topes de descuento
// son la regla de negocio que más se nota en el mostrador: la alta relojería no
// se descuenta (contrato de distribución), la joyería propia sí.

const PRODUCTOS = [
  // categoría, marca, sku, nombre, precio, costo, stock, punto, lead, tope bp (null = sin tope, 0 = no admite)
  ["Alta relojería", "Aubert & Fils", "AF-CAL-01", "Calendario Perpetuo Cronógrafo, oro rosa", 58_400_000, 39_800_000, 1, 1, 180, 0],
  ["Alta relojería", "Aubert & Fils", "AF-TOU-02", "Tourbillon Esqueleto, platino", 92_000_000, 64_000_000, 1, 1, 240, 0],
  ["Alta relojería", "König Werke", "KW-CRO-03", "Cronómetro de Observatorio, acero", 24_900_000, 16_100_000, 2, 1, 150, 0],
  ["Relojes deportivos", "Vanterre", "VT-DIV-10", "Diver 300 Automático, acero y cerámica", 12_700_000, 8_200_000, 3, 2, 120, 300],
  ["Relojes deportivos", "Vanterre", "VT-GMT-11", "GMT Piloto, titanio", 15_300_000, 9_900_000, 2, 2, 120, 300],
  ["Relojes deportivos", "König Werke", "KW-REG-12", "Regatta Cronógrafo, acero", 8_950_000, 5_600_000, 4, 2, 90, 500],
  ["Relojes clásicos", "Solveig", "SV-ULT-20", "Ultraplano 38 mm, oro blanco", 6_400_000, 3_900_000, 5, 2, 90, 500],
  ["Relojes clásicos", "Solveig", "SV-LUN-21", "Fases de Luna, acero", 4_850_000, 2_950_000, 6, 3, 75, 700],
  ["Relojes clásicos", "Marchetti", "MC-DAM-22", "Dama Nácar 32 mm, acero y diamantes", 5_600_000, 3_400_000, 4, 2, 75, 700],
  ["Alta joyería", "Casa Duarte", "CD-ANI-30", "Anillo solitario 1,2 ct, oro blanco", 28_500_000, 19_400_000, 1, 1, 120, 0],
  ["Alta joyería", "Casa Duarte", "CD-COL-31", "Collar Río de Diamantes, oro blanco", 41_000_000, 28_700_000, 1, 1, 150, 0],
  ["Alta joyería", "Marchetti", "MC-ARE-32", "Aretes Gota de Esmeralda, oro amarillo", 16_800_000, 10_900_000, 2, 1, 100, 500],
  ["Joyería fina", "Casa Duarte", "CD-PUL-40", "Pulsera Tennis, oro blanco", 3_900_000, 2_200_000, 6, 3, 60, 1000],
  ["Joyería fina", "Marchetti", "MC-ARO-41", "Aros Cápsula, oro rosa", 1_450_000, 780_000, 12, 5, 45, 1000],
  ["Joyería fina", "Marchetti", "MC-COL-42", "Collar Cadena Veneciana, oro amarillo", 2_300_000, 1_290_000, 9, 4, 45, 1000],
  ["Accesorios", "Belmont", "BE-COR-50", "Correa de cocodrilo, hecha a medida", 890_000, 380_000, 24, 8, 30, 1500],
  ["Accesorios", "Belmont", "BE-EST-51", "Estuche de viaje para 4 relojes, cuero", 640_000, 260_000, 15, 6, 30, 1500],
  ["Accesorios", "Belmont", "BE-WIN-52", "Watch winder doble, nogal", 1_180_000, 590_000, 8, 3, 45, 1500],
  // Servicios: sin inventario (stock null). El taller no se agota.
  ["Servicios", "Belmont", "SV-MAN-60", "Mantención completa de movimiento", 1_240_000, 480_000, null, 0, 0, 0],
  ["Servicios", "Belmont", "SV-PUL-61", "Pulido y restauración de caja", 480_000, 170_000, null, 0, 0, 0],
  ["Servicios", "Belmont", "SV-TAS-62", "Tasación y certificado de autenticidad", 320_000, 95_000, null, 0, 0, 0],
  ["Servicios", "Belmont", "SV-GRA-63", "Grabado personalizado", 180_000, 45_000, null, 0, 0, 1500],
];

const productos = [];
for (const [categoria, marca, sku, nombre, precio, costo, stock, punto, lead, tope] of PRODUCTOS) {
  const [p] = await sql`
    INSERT INTO crm_products (sku, nombre, categoria, marca, precio, costo, activo, permite_descuento, tope_descuento_bp)
    VALUES (${sku}, ${nombre}, ${categoria}, ${marca}, ${precio}, ${costo}, TRUE,
            ${tope !== 0}, ${tope === 0 ? null : tope})
    RETURNING id
  `;
  if (stock !== null) {
    await sql`
      INSERT INTO crm_inventory (product_id, stock, reservado, punto_reposicion, lead_time_dias)
      VALUES (${p.id}, ${stock}, 0, ${punto}, ${lead})
    `;
  }
  productos.push({ id: p.id, sku, nombre, categoria, marca, precio, costo, tope });
}
console.log(`✓ ${productos.length} piezas en catálogo`);

const porCategoria = (c) => productos.filter((p) => p.categoria === c);
const altaRelojeria = porCategoria("Alta relojería");
const deportivos = porCategoria("Relojes deportivos");
const clasicos = porCategoria("Relojes clásicos");
const altaJoyeria = porCategoria("Alta joyería");
const joyeriaFina = porCategoria("Joyería fina");
const accesorios = porCategoria("Accesorios");
const servicios = porCategoria("Servicios");
const relojes = [...altaRelojeria, ...deportivos, ...clasicos];

// ─── Campañas ────────────────────────────────────────────────────────────────

const CAMPANAS = [
  ["Instagram · Colección Aubert & Fils", "social", 300, 0, 8_400_000],
  ["Velada privada de coleccionistas", "evento", 210, 205, 12_600_000],
  ["Newsletter · novedades de temporada", "email", 400, 0, 1_900_000],
  ["Google Ads · alta relojería Santiago", "ads", 260, 0, 6_800_000],
  ["Programa de referidos de clientes", "referido", 500, 0, 3_200_000],
  ["Catálogo de fin de año", "email", 260, 220, 4_100_000],
  ["Alianza concesionario automotriz", "evento", 150, 140, 5_500_000],
  ["Recordatorio de mantención por WhatsApp", "whatsapp", 90, 0, 620_000],
];

const campanas = [];
for (const [nombre, canal, desdeDias, hastaDias, costo] of CAMPANAS) {
  const [c] = await sql`
    INSERT INTO crm_campaigns (nombre, canal, inicio, fin, costo, objetivo, activa)
    VALUES (${nombre}, ${canal}, ${dias(desdeDias)},
            ${hastaDias > 0 ? dias(hastaDias) : null}, ${costo},
            ${"Generar visitas calificadas al showroom · " + canal},
            ${hastaDias === 0})
    RETURNING id
  `;
  campanas.push({ id: c.id, nombre, canal, desdeDias, hastaDias });
}
console.log(`✓ ${campanas.length} campañas`);

// ─── Empresas (el caso minoritario: regalo corporativo) ──────────────────────

const EMPRESAS = [
  ["Viña Aguas Claras", "Vitivinícola", "mediana", "Santiago"],
  ["Grupo Minero Atacama", "Minería", "grande", "Antofagasta"],
  ["Estudio Jurídico Ossa & Prieto", "Servicios legales", "pyme", "Santiago"],
];
const empresas = [];
for (const [nombre, industria, tamano, ciudad] of EMPRESAS) {
  const [a] = await sql`
    INSERT INTO crm_accounts (nombre, industria, tamano, ciudad, estado, fuente, owner_id)
    VALUES (${nombre}, ${industria}, ${tamano}, ${ciudad}, 'cliente', 'Referido', ${elegir(equipo).id})
    RETURNING id
  `;
  empresas.push({ id: a.id, nombre });
}

// ─── Clientes ────────────────────────────────────────────────────────────────
//
// Los arquetipos son lo que hace que el CRM tenga algo que detectar: sin un
// coleccionista que compra cada seis meses y un cliente que lleva dos años sin
// volver, la ventana de recompra no distingue nada.

const CLIENTES = [
  // nombre, ciudad, estado, arquetipo, preferencias
  ["Ignacio Errázuriz Vial", "Vitacura", "cliente", "coleccionista", "Alta relojería suiza. Prefiere oro rosa y complicaciones. Avisar antes que nadie de piezas únicas."],
  ["María Paz Undurraga", "Lo Barnechea", "cliente", "coleccionista", "Alta joyería, esmeraldas. Compra para aniversarios en marzo."],
  ["Rodrigo Larraín Costa", "Las Condes", "cliente", "fiel", "Deportivos de titanio. Bucea, le importa la resistencia al agua."],
  ["Antonia Fernández Ruiz", "Vitacura", "cliente", "fiel", "Joyería fina para uso diario. Talla 14 de anillo."],
  ["Cristóbal Amenábar", "Lo Barnechea", "cliente", "coleccionista", "Cronómetros alemanes. Colecciona por precisión, no por marca."],
  ["Javiera Montt Silva", "Viña del Mar", "cliente", "regalo", "Compra regalos para su marido en junio y diciembre."],
  ["Felipe Izquierdo Bravo", "Las Condes", "cliente", "fiel", "Clásicos ultraplanos. Usa reloj de vestir a diario."],
  ["Sofía Valdés Echeverría", "Vitacura", "cliente", "regalo", "Regalos de graduación para sus hijos."],
  ["Matías Correa Bulnes", "Antofagasta", "cliente", "esporadico", "Viaja a Santiago cada tres meses. Compra en esas visitas."],
  ["Catalina Bezanilla", "Las Condes", "cliente", "fiel", "Aros y collares de oro rosa. Siempre pide grabado."],
  ["Tomás Cruzat Riesco", "Lo Barnechea", "cliente", "esporadico", "Compró su primer reloj de alta relojería en 2024."],
  ["Isidora Guzmán Lira", "Vitacura", "cliente", "coleccionista", "Alta joyería. Trabaja con su asesora de imagen."],
  ["Andrés Ovalle Prado", "Concepción", "cliente", "atrasado", "Deportivos. Hace dos años que no viene."],
  ["Francisca Edwards Silva", "Las Condes", "cliente", "atrasado", "Joyería fina. Se mudó y dejó de venir."],
  ["Gonzalo Pérez Cotapos", "Vitacura", "cliente", "atrasado", "Compró dos relojes clásicos y no volvió."],
  ["Trinidad Balmaceda", "Lo Barnechea", "cliente", "esporadico", "Prefiere que la atiendan con cita fuera de horario."],
  ["Nicolás Yrarrázaval", "Las Condes", "cliente", "fiel", "Manda a mantención sus piezas cada año sin falta."],
  ["Camila Subercaseaux", "Viña del Mar", "cliente", "regalo", "Compra para su padre en septiembre."],
  ["Sebastián Irarrázabal Ruiz", "Vitacura", "prospecto", "prospecto_caliente", "Vino tres veces al showroom por el Tourbillon. No decide."],
  ["Magdalena Ruiz-Tagle", "Lo Barnechea", "prospecto", "prospecto_caliente", "Busca anillo de compromiso. Presupuesto amplio."],
  ["Diego Astaburuaga", "Las Condes", "prospecto", "prospecto_caliente", "Cambió de trabajo, quiere marcar el hito con un reloj."],
  ["Valentina Echenique", "Vitacura", "prospecto", "prospecto", "Llegó por Instagram. Mira joyería fina."],
  ["Joaquín Vicuña Mackenna", "Santiago", "prospecto", "prospecto", "Consultó por WhatsApp precios de deportivos."],
  ["Emilia Barros Luco", "Las Condes", "prospecto", "prospecto", "Vino a la velada de coleccionistas."],
  ["Benjamín Undurraga Solar", "Antofagasta", "prospecto", "prospecto", "Contacto del concesionario automotriz."],
  ["Rosario Concha Toro", "Viña del Mar", "prospecto", "prospecto", "Pidió catálogo de alta joyería."],
  ["Vicente Bulnes Cerda", "Lo Barnechea", "inactivo", "perdido", "Compró una vez en 2024, no responde hace un año."],
  ["Constanza Alessandri", "Las Condes", "inactivo", "perdido", "Se fue con la competencia por un tema de plazos."],
];

const FUENTES = ["Showroom", "Instagram", "Referido", "Google", "Evento", "Concesionario", "Newsletter"];
const ETIQUETAS_POSIBLES = ["VIP", "coleccionista", "prefiere WhatsApp", "cliente de regalo", "espera pieza", "atención con cita"];

const clientes = [];
for (const [nombre, ciudad, estado, arquetipo, preferencias] of CLIENTES) {
  const owner = elegir(equipo);
  const etiquetas = [];
  if (arquetipo === "coleccionista") etiquetas.push("coleccionista", "VIP");
  if (arquetipo === "regalo") etiquetas.push("cliente de regalo");
  if (quizas(0.4)) etiquetas.push(elegir(ETIQUETAS_POSIBLES));

  const partes = nombre.split(" ");
  const usuario = `${partes[0].toLowerCase()}.${partes[1].toLowerCase()}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z.]/g, "");

  // El opt-in de WhatsApp no es universal: en la vida real no todos lo dan, y
  // el módulo tiene que verse operando con esa restricción.
  const optIn = arquetipo === "perdido" ? quizas(0.3) : quizas(0.8);

  const [c] = await sql`
    INSERT INTO crm_contacts (
      account_id, nombre, email, telefono, es_decisor, opt_in_whatsapp,
      estado, fuente, owner_id, ciudad, etiquetas, preferencias
    ) VALUES (
      ${quizas(0.1) ? elegir(empresas).id : null},
      ${nombre}, ${usuario + "@correo.cl"}, ${"569" + entre(30000000, 99999999)},
      TRUE, ${optIn}, ${estado}, ${elegir(FUENTES)}, ${owner.id}, ${ciudad},
      ${JSON.stringify([...new Set(etiquetas)])}, ${preferencias}
    )
    RETURNING id
  `;
  clientes.push({ id: c.id, nombre, estado, arquetipo, ownerId: owner.id, optIn });
}
console.log(`✓ ${clientes.length} clientes`);

// ─── Interacciones de marketing ──────────────────────────────────────────────

const TIPOS_TOUCH = ["impresion", "click", "apertura", "formulario", "visita", "respuesta"];
let touchpoints = 0;

for (const cliente of clientes) {
  const cuantos =
    cliente.arquetipo === "prospecto_caliente" ? entre(6, 11)
    : cliente.estado === "cliente" ? entre(4, 9)
    : entre(1, 4);

  for (let i = 0; i < cuantos; i++) {
    const campana = elegir(campanas);
    await sql`
      INSERT INTO crm_touchpoints (contact_id, account_id, campaign_id, tipo, detalle, ocurrido_en)
      VALUES (${cliente.id}, NULL, ${campana.id}, ${elegir(TIPOS_TOUCH)},
              ${campana.nombre}, ${dias(entre(campana.hastaDias, campana.desdeDias))})
    `;
    touchpoints++;
  }
}
console.log(`✓ ${touchpoints} interacciones de marketing`);

const toquesPorContacto = await sql`
  SELECT contact_id,
         (array_agg(campaign_id ORDER BY ocurrido_en ASC))[1] AS primero,
         (array_agg(campaign_id ORDER BY ocurrido_en DESC))[1] AS ultimo
  FROM crm_touchpoints GROUP BY contact_id
`;
const atribucion = Object.fromEntries(
  toquesPorContacto.map((t) => [t.contact_id, { primero: t.primero, ultimo: t.ultimo }]),
);

// ─── Compras históricas ──────────────────────────────────────────────────────

const RITMO = {
  coleccionista: { ciclo: 150, compras: [4, 7], ultimaHace: [10, 60] },
  fiel: { ciclo: 210, compras: [3, 5], ultimaHace: [20, 90] },
  regalo: { ciclo: 180, compras: [3, 4], ultimaHace: [30, 110] },
  esporadico: { ciclo: 300, compras: [2, 3], ultimaHace: [60, 180] },
  atrasado: { ciclo: 200, compras: [2, 4], ultimaHace: [420, 700] },
  perdido: { ciclo: 240, compras: [1, 2], ultimaHace: [500, 800] },
};

const CANALES_VENTA = ["Showroom", "WhatsApp", "Teléfono", "Cita privada"];
let ordenes = 0;
let itemsOrden = 0;

for (const cliente of clientes) {
  const ritmo = RITMO[cliente.arquetipo];
  if (!ritmo) continue; // prospectos: todavía no compran

  const cuantas = entre(ritmo.compras[0], ritmo.compras[1]);
  let hace = entre(ritmo.ultimaHace[0], ritmo.ultimaHace[1]);

  for (let i = 0; i < cuantas; i++) {
    const items = [];
    // La pieza principal según el perfil, y casi siempre algo que la acompaña:
    // es lo que produce patrones reales de cross-selling en vez de ruido.
    if (cliente.arquetipo === "coleccionista") {
      items.push({ p: quizas(0.5) ? elegir(altaRelojeria) : elegir(altaJoyeria), cant: 1 });
    } else if (cliente.arquetipo === "regalo") {
      items.push({ p: elegir([...joyeriaFina, ...clasicos]), cant: 1 });
    } else {
      items.push({ p: elegir([...deportivos, ...clasicos, ...joyeriaFina]), cant: 1 });
    }
    if (quizas(0.55)) items.push({ p: elegir(accesorios), cant: quizas(0.3) ? 2 : 1 });
    if (quizas(0.35)) items.push({ p: elegir(servicios), cant: 1 });

    const total = items.reduce((s, it) => s + it.p.precio * it.cant, 0);
    const [o] = await sql`
      INSERT INTO crm_orders (contact_id, fecha, total, canal)
      VALUES (${cliente.id}, ${dias(hace)}, ${total}, ${elegir(CANALES_VENTA)})
      RETURNING id
    `;
    for (const it of items) {
      await sql`
        INSERT INTO crm_order_items (order_id, product_id, cantidad, precio_unitario)
        VALUES (${o.id}, ${it.p.id}, ${it.cant}, ${it.p.precio})
      `;
      itemsOrden++;
    }
    ordenes++;
    hace += ritmo.ciclo + entre(-25, 40);
  }
}
console.log(`✓ ${ordenes} compras con ${itemsOrden} líneas`);

// ─── Oportunidades ───────────────────────────────────────────────────────────

const TITULOS = {
  "Alta relojería": ["Pieza de colección", "Complicación para colección", "Reloj de aniversario"],
  "Relojes deportivos": ["Reloj deportivo para uso diario", "Cronógrafo de regata"],
  "Relojes clásicos": ["Reloj de vestir", "Clásico ultraplano"],
  "Alta joyería": ["Anillo de compromiso", "Collar para ocasión especial", "Aretes de alta joyería"],
  "Joyería fina": ["Set de joyería fina", "Regalo de aniversario"],
  Servicios: ["Mantención de colección", "Restauración de pieza heredada"],
};

const MOTIVOS = [
  "Precio",
  "Se fue con la competencia",
  "Prefirió esperar la próxima colección",
  "Sin respuesta",
  "Momento equivocado",
  "No había stock de la referencia",
];

const ETAPAS_ABIERTAS = ["nuevo", "calificado", "propuesta", "negociacion"];
const PROB = { nuevo: 10, calificado: 30, propuesta: 50, negociacion: 75, ganado: 100, perdido: 0 };

let deals = 0;
let itemsDeal = 0;

for (const cliente of clientes) {
  const cuantas =
    cliente.arquetipo === "prospecto_caliente" ? entre(1, 2)
    : cliente.arquetipo === "perdido" ? 1
    : cliente.estado === "cliente" ? entre(1, 2)
    : entre(0, 1);

  for (let i = 0; i < cuantas; i++) {
    const cerrada = cliente.arquetipo === "perdido" ? true : quizas(0.4);
    const ganada = cerrada && cliente.estado === "cliente" && quizas(0.65);
    const etapa = cerrada ? (ganada ? "ganado" : "perdido") : elegir(ETAPAS_ABIERTAS);

    const abiertoHace = entre(15, 220);
    const cerradoHace = cerrada ? Math.max(1, abiertoHace - entre(20, 80)) : null;
    // Algunas se dejan sin tocar a propósito: son las que el motor de alertas
    // tiene que encontrar.
    const ultimaActividadHace = cerrada
      ? cerradoHace
      : quizas(0.3)
        ? entre(18, 55)
        : entre(0, 12);

    const principal =
      cliente.arquetipo === "coleccionista" ? elegir([...altaRelojeria, ...altaJoyeria])
      : cliente.arquetipo === "prospecto_caliente" ? elegir([...altaRelojeria, ...altaJoyeria, ...deportivos])
      : elegir([...deportivos, ...clasicos, ...joyeriaFina]);

    const items = [{ p: principal, cant: 1 }];
    if (quizas(0.45)) items.push({ p: elegir(accesorios), cant: 1 });
    if (quizas(0.25)) items.push({ p: elegir(servicios), cant: 1 });

    const monto = items.reduce((s, it) => s + it.p.precio * it.cant, 0);
    const atrib = atribucion[cliente.id] ?? {};
    const titulos = TITULOS[principal.categoria] ?? ["Oportunidad de venta"];

    const [d] = await sql`
      INSERT INTO crm_deals (
        account_id, contact_id, titulo, etapa, monto, probabilidad, owner_id, fuente,
        campaign_first_id, campaign_last_id, abierto_en, cierre_estimado, cerrado_en,
        motivo_perdida, ultima_actividad_en
      ) VALUES (
        NULL, ${cliente.id}, ${elegir(titulos)}, ${etapa}, ${monto}, ${PROB[etapa]},
        ${quizas(0.92) ? cliente.ownerId : null},
        ${elegir(FUENTES)},
        ${atrib.primero ?? null}, ${atrib.ultimo ?? null},
        ${dias(abiertoHace)}, ${dias(abiertoHace - entre(30, 80))},
        ${cerradoHace ? dias(cerradoHace) : null},
        ${etapa === "perdido" ? elegir(MOTIVOS) : null},
        ${dias(ultimaActividadHace)}
      )
      RETURNING id
    `;

    for (const it of items) {
      await sql`
        INSERT INTO crm_deal_items (deal_id, product_id, cantidad, precio_unitario)
        VALUES (${d.id}, ${it.p.id}, ${it.cant}, ${it.p.precio})
      `;
      itemsDeal++;
    }
    deals++;
  }
}
console.log(`✓ ${deals} oportunidades con ${itemsDeal} líneas`);

// Una pieza única comprometida en varias oportunidades: sin este caso, la
// alerta de stock no tendría nada que mostrar. Y es un problema real del rubro:
// hay una sola unidad y tres clientes interesados.
const tourbillon = productos.find((p) => p.sku === "AF-TOU-02");
const disputadas = await sql`
  SELECT id FROM crm_deals WHERE etapa IN ('propuesta','negociacion') ORDER BY monto DESC LIMIT 2
`;
for (const d of disputadas) {
  await sql`
    INSERT INTO crm_deal_items (deal_id, product_id, cantidad, precio_unitario)
    VALUES (${d.id}, ${tourbillon.id}, 1, ${tourbillon.precio})
  `;
  await sql`UPDATE crm_deals SET monto = monto + ${tourbillon.precio} WHERE id = ${d.id}`;
}

// ─── Actividades ─────────────────────────────────────────────────────────────

const ACTIVIDADES = {
  llamada: ["Llamada de seguimiento", "Llamada para coordinar visita", "Llamada: confirma interés"],
  reunion: ["Visita al showroom", "Cita privada fuera de horario", "Presentación de la pieza"],
  email: ["Envío de ficha técnica", "Envío de fotos adicionales", "Respuesta sobre disponibilidad"],
  nota: [
    "Nota: pidió ver la pieza con luz natural",
    "Nota: consulta por financiamiento en cuotas",
    "Nota: su señora prefiere oro rosa",
    "Nota: viaja el próximo mes, quiere cerrar antes",
  ],
};

let actividades = 0;
const dealsAbiertos = await sql`
  SELECT id, contact_id, owner_id, ultima_actividad_en FROM crm_deals WHERE etapa NOT IN ('ganado','perdido')
`;
const dealsCerrados = await sql`
  SELECT id, contact_id, owner_id, etapa, cerrado_en FROM crm_deals WHERE etapa IN ('ganado','perdido')
`;

for (const d of dealsAbiertos) {
  for (let i = 0; i < entre(2, 5); i++) {
    const tipo = elegir(Object.keys(ACTIVIDADES));
    await sql`
      INSERT INTO crm_activities (account_id, contact_id, deal_id, tipo, titulo, owner_id, ocurrido_en)
      VALUES (NULL, ${d.contact_id}, ${d.id}, ${tipo}, ${elegir(ACTIVIDADES[tipo])},
              ${d.owner_id}, ${dias(entre(1, 120))})
    `;
    actividades++;
  }
  // La última actividad calza con la fecha del deal: una bitácora que la
  // contradiga rompe la credibilidad justo donde se mira.
  await sql`
    INSERT INTO crm_activities (account_id, contact_id, deal_id, tipo, titulo, owner_id, ocurrido_en)
    VALUES (NULL, ${d.contact_id}, ${d.id}, 'llamada', 'Último contacto registrado',
            ${d.owner_id}, ${d.ultima_actividad_en})
  `;
  actividades++;
}

for (const d of dealsCerrados) {
  for (let i = 0; i < entre(2, 4); i++) {
    const tipo = elegir(Object.keys(ACTIVIDADES));
    await sql`
      INSERT INTO crm_activities (account_id, contact_id, deal_id, tipo, titulo, owner_id, ocurrido_en)
      VALUES (NULL, ${d.contact_id}, ${d.id}, ${tipo}, ${elegir(ACTIVIDADES[tipo])},
              ${d.owner_id}, ${dias(entre(30, 200))})
    `;
    actividades++;
  }
  await sql`
    INSERT INTO crm_activities (account_id, contact_id, deal_id, tipo, titulo, detalle, owner_id, ocurrido_en)
    VALUES (NULL, ${d.contact_id}, ${d.id}, 'nota',
            ${d.etapa === "ganado" ? "Venta cerrada" : "Oportunidad cerrada como perdida"},
            ${d.etapa === "ganado" ? "Se coordina entrega y grabado." : null},
            ${d.owner_id}, ${d.cerrado_en})
  `;
  actividades++;
}

const TAREAS = [
  "Enviar fotos de la pieza con luz natural",
  "Confirmar fecha de llegada de la referencia",
  "Agendar cita privada",
  "Llamar para cerrar condiciones de pago",
  "Preparar tasación de la pieza que entrega en parte de pago",
];
for (let i = 0; i < 9; i++) {
  const d = elegir(dealsAbiertos);
  const vencida = i < 4;
  await sql`
    INSERT INTO crm_activities (account_id, contact_id, deal_id, tipo, titulo, owner_id, ocurrido_en, vence_en, completada)
    VALUES (NULL, ${d.contact_id}, ${d.id}, 'tarea', ${elegir(TAREAS)}, ${d.owner_id},
            ${dias(entre(3, 20))}, ${vencida ? dias(entre(2, 12)) : dias(-entre(1, 8))}, FALSE)
  `;
  actividades++;
}
console.log(`✓ ${actividades} actividades`);

// ─── Plantillas y conversaciones ─────────────────────────────────────────────

const PLANTILLAS = [
  ["Recompra", "recompra", "Hola {{contacto}}, te escribo de {{empresa}}. Llegaron piezas nuevas que creo que te van a interesar por lo que conversamos la última vez. ¿Te reservo una cita para que las veas con calma?"],
  ["Cross-selling", "cross_sell", "Hola {{contacto}}, soy {{vendedor}} de {{empresa}}. Para tu {{producto}} tenemos correas hechas a medida y estuches de viaje. ¿Te muestro las opciones?"],
  ["Seguimiento de cotización", "seguimiento", "Hola {{contacto}}, ¿alcanzaste a revisar la cotización que te envié? Quedo atento por si quieres verla en persona o ajustar algo."],
  ["Reactivación", "reactivacion", "Hola {{contacto}}, hace {{dias}} días que no conversamos. Quería contarte que llegó la colección nueva. ¿Te gustaría pasar a verla?"],
  ["Mantención anual", "mantencion", "Hola {{contacto}}, ya se cumple el año desde la última mantención de tu pieza. ¿Quieres que la agendemos? La dejamos lista en dos semanas."],
];
for (const [nombre, proposito, cuerpo] of PLANTILLAS) {
  await sql`
    INSERT INTO crm_wa_templates (nombre, cuerpo, proposito, activa)
    VALUES (${nombre}, ${cuerpo}, ${proposito}, TRUE)
  `;
}

// Hilos con historia. Incluye uno que pidió la baja: sin ese caso, el candado
// no se puede mostrar funcionando.
const HILOS = [
  {
    cliente: "Sebastián Irarrázabal Ruiz",
    mensajes: [
      ["out", "Hola {{contacto}}, te escribo de Belmont. Ya llegó el Tourbillon Esqueleto que viste la semana pasada. ¿Te reservo una cita para verlo con calma?", "simulado", 5],
      ["in", "Hola! Sí, me interesa. ¿Tienen el de platino o solo el de oro?", null, 5],
      ["out", "Tenemos el de platino, es pieza única. ¿Te viene bien el jueves a las 18:00, cuando la boutique está más tranquila?", "simulado", 4],
      ["in", "El jueves me complica. ¿Viernes a la misma hora?", null, 4],
      ["out", "Perfecto, te dejo agendado para el viernes a las 18:00. Te espero.", "simulado", 4],
    ],
  },
  {
    cliente: "Magdalena Ruiz-Tagle",
    mensajes: [
      ["out", "Hola {{contacto}}, soy {{vendedor}} de Belmont. Te preparé la cotización del solitario que conversamos.", "simulado", 8],
      ["in", "Gracias! ¿El precio incluye el grabado?", null, 8],
      ["out", "Sí, el grabado va incluido. Y si prefieres cambiar el corte de la piedra, podemos ajustarlo sin costo adicional.", "simulado", 7],
      ["in", "Lo voy a conversar y te confirmo esta semana.", null, 7],
    ],
  },
  {
    cliente: "Andrés Ovalle Prado",
    mensajes: [
      ["out", "Hola {{contacto}}, hace tiempo que no conversamos. Quería contarte que llegó la colección nueva de deportivos. ¿Te gustaría pasar a verla?", "simulado", 15],
      ["in", "Hola, gracias. Ahora estoy en Concepción, no viajo a Santiago por un tiempo.", null, 14],
    ],
  },
  {
    cliente: "Vicente Bulnes Cerda",
    mensajes: [
      ["out", "Hola {{contacto}}, te escribo de Belmont para contarte las novedades de la temporada.", "simulado", 22],
      ["in", "BAJA", null, 21],
    ],
  },
  {
    cliente: "Nicolás Yrarrázaval",
    mensajes: [
      ["out", "Hola {{contacto}}, ya se cumple el año desde la última mantención de tu pieza. ¿Quieres que la agendemos?", "simulado", 3],
      ["in", "Sí por favor. ¿Cuánto se demora esta vez?", null, 3],
      ["out", "Dos semanas. Si la traes esta semana, la tienes lista antes de fin de mes.", "simulado", 2],
    ],
  },
];

let conversaciones = 0;
let mensajesWa = 0;

for (const hilo of HILOS) {
  const cliente = clientes.find((c) => c.nombre === hilo.cliente);
  if (!cliente) continue;
  const [k] = await sql`SELECT telefono, nombre FROM crm_contacts WHERE id = ${cliente.id}`;
  const nombrePila = k.nombre.split(" ")[0];
  const vendedor = usuarios.find((u) => u.id === cliente.ownerId)?.nombre ?? "el equipo";

  const baja = hilo.mensajes.some((m) => m[0] === "in" && /baja/i.test(m[1]));
  const [conv] = await sql`
    INSERT INTO crm_wa_conversations (account_id, contact_id, telefono, nombre, estado, baja, ultimo_mensaje_en)
    VALUES (NULL, ${cliente.id}, ${k.telefono}, ${k.nombre},
            ${baja ? "cerrada" : "abierta"}, ${baja},
            ${dias(hilo.mensajes[hilo.mensajes.length - 1][3])})
    RETURNING id
  `;
  conversaciones++;

  for (const [direccion, plantilla, estado, hace] of hilo.mensajes) {
    const cuerpo = plantilla
      .replace(/\{\{contacto\}\}/g, nombrePila)
      .replace(/\{\{vendedor\}\}/g, vendedor.split(" ")[0]);
    await sql`
      INSERT INTO crm_wa_messages (conversation_id, direccion, cuerpo, estado, automatico, created_at, enviado_en)
      VALUES (${conv.id}, ${direccion}, ${cuerpo},
              ${direccion === "in" ? "sent" : estado},
              ${direccion === "out"}, ${dias(hace)}, ${dias(hace)})
    `;
    mensajesWa++;
  }
}
console.log(`✓ ${conversaciones} conversaciones con ${mensajesWa} mensajes`);

// ─── Cotizaciones de mostrador ───────────────────────────────────────────────
//
// El módulo portado de CDC. Se siembran en los cuatro estados para que el
// embudo tenga algo que mostrar, incluida una editada después de enviarse.

const conversacionesPorContacto = Object.fromEntries(
  (await sql`SELECT id, contact_id FROM crm_wa_conversations`).map((c) => [c.contact_id, c.id]),
);

const COTIZACIONES = [
  { cliente: "Sebastián Irarrázabal Ruiz", estado: "enviada", hace: 5, piezas: [["AF-TOU-02", 1, 0]], global: 0 },
  { cliente: "Magdalena Ruiz-Tagle", estado: "enviada", hace: 8, piezas: [["CD-ANI-30", 1, 0], ["SV-GRA-63", 1, 0]], global: 500_000 },
  { cliente: "Diego Astaburuaga", estado: "enviada", hace: 12, piezas: [["VT-GMT-11", 1, 400_000], ["BE-COR-50", 1, 89_000]], global: 0 },
  { cliente: "Valentina Echenique", estado: "abierta", hace: 1, piezas: [["MC-ARO-41", 1, 0], ["MC-COL-42", 1, 0]], global: 0 },
  { cliente: "Joaquín Vicuña Mackenna", estado: "abierta", hace: 2, piezas: [["VT-DIV-10", 1, 0]], global: 0 },
  { cliente: "Emilia Barros Luco", estado: "descartada", hace: 40, piezas: [["MC-DAM-22", 1, 0]], global: 0 },
  { cliente: "Rosario Concha Toro", estado: "enviada", hace: 25, piezas: [["MC-ARE-32", 1, 800_000]], global: 0 },
  { cliente: "Ignacio Errázuriz Vial", estado: "convertida", hace: 55, piezas: [["AF-CAL-01", 1, 0], ["BE-WIN-52", 1, 100_000]], global: 0 },
  { cliente: "María Paz Undurraga", estado: "convertida", hace: 90, piezas: [["CD-COL-31", 1, 0]], global: 1_000_000 },
  { cliente: "Catalina Bezanilla", estado: "convertida", hace: 30, piezas: [["MC-ARO-41", 2, 145_000], ["SV-GRA-63", 2, 0]], global: 0 },
  { cliente: "Trinidad Balmaceda", estado: "enviada", hace: 3, piezas: [["SV-LUN-21", 1, 0], ["BE-EST-51", 1, 0]], global: 0 },
  { cliente: "Benjamín Undurraga Solar", estado: "abierta", hace: 0, piezas: [["KW-REG-12", 1, 0]], global: 0 },
];

const porSku = Object.fromEntries(productos.map((p) => [p.sku, p]));
let cotizaciones = 0;

for (const c of COTIZACIONES) {
  const cliente = clientes.find((x) => x.nombre === c.cliente);
  if (!cliente) continue;
  const [k] = await sql`SELECT telefono, nombre FROM crm_contacts WHERE id = ${cliente.id}`;

  const items = c.piezas.map(([sku, cant, desc]) => {
    const p = porSku[sku];
    return {
      p,
      cant,
      desc,
      total: p.precio * cant - desc,
    };
  });

  const subtotal = items.reduce((s, i) => s + i.p.precio * i.cant, 0);
  const descItems = items.reduce((s, i) => s + i.desc, 0);
  const total = subtotal - descItems - c.global;

  // Un regalo de cada tres: quien cotiza no siempre es quien usa la pieza.
  const paraSiMismo = !quizas(0.33);

  const [q] = await sql`
    INSERT INTO crm_quotes (
      contact_id, cotizante_nombre, cotizante_telefono, para_si_mismo, destinatario_nombre,
      boutique, created_by_id, subtotal, descuento_global, total, estado,
      conversation_id, enviada_en, convertida_en, editada_tras_envio, created_at
    ) VALUES (
      ${cliente.id}, ${k.nombre}, ${k.telefono}, ${paraSiMismo},
      ${paraSiMismo ? null : "su esposa"},
      ${elegir(BOUTIQUES)}, ${cliente.ownerId}, ${subtotal}, ${c.global}, ${total}, ${c.estado},
      ${conversacionesPorContacto[cliente.id] ?? null},
      ${c.estado === "abierta" ? null : dias(c.hace)},
      ${c.estado === "convertida" ? dias(Math.max(0, c.hace - entre(3, 15))) : null},
      ${c.estado === "enviada" && quizas(0.25)},
      ${dias(c.hace)}
    )
    RETURNING id
  `;

  for (const i of items) {
    await sql`
      INSERT INTO crm_quote_items (
        quote_id, product_id, producto_nombre, sku, marca, cantidad,
        precio_unitario, descuento, tope_descuento_bp, total
      ) VALUES (
        ${q.id}, ${i.p.id}, ${i.p.nombre}, ${i.p.sku}, ${i.p.marca}, ${i.cant},
        ${i.p.precio}, ${i.desc}, ${i.p.tope === 0 ? null : i.p.tope}, ${i.total}
      )
    `;
  }
  cotizaciones++;
}
console.log(`✓ ${cotizaciones} cotizaciones de mostrador`);

// ─── Segmentos ───────────────────────────────────────────────────────────────

const SEGMENTOS = [
  ["Coleccionistas", "Puntaje alto y compras recurrentes. Los que hay que cuidar.", { estado: ["cliente"], scoreMin: 70 }],
  ["En riesgo de fuga", "Compraron varias veces y llevan más de un año sin volver.", { estado: ["cliente"], comprasMin: 2, sinComprarMin: 365 }],
  ["Prospectos calientes", "Todavía no compran, pero interactúan y tienen buen puntaje.", { estado: ["prospecto"], scoreMin: 45 }],
  ["Contactables por WhatsApp", "Clientes que autorizaron recibir mensajes.", { conWhatsapp: true }],
];
for (const [nombre, descripcion, definicion] of SEGMENTOS) {
  await sql`
    INSERT INTO crm_segments (nombre, descripcion, definicion)
    VALUES (${nombre}, ${descripcion}, ${JSON.stringify(definicion)})
  `;
}

// ─── Reserva de inventario y configuración ───────────────────────────────────

await sql`
  UPDATE crm_inventory i
  SET reservado = COALESCE((
    SELECT SUM(di.cantidad) FROM crm_deal_items di
    JOIN crm_deals d ON d.id = di.deal_id
    WHERE di.product_id = i.product_id AND d.etapa IN ('nuevo','calificado','propuesta','negociacion')
  ), 0)
`;

await sql`
  INSERT INTO crm_settings (clave, valor)
  VALUES ('general.empresa', 'Belmont Alta Relojería'),
         ('whatsapp.simulado', 'true'),
         ('whatsapp.envio_habilitado', 'true'),
         ('insights.narrador_ia', 'true')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
`;

console.log("\n✓ Base de demostración lista.");
console.log("  Belmont Alta Relojería · relojería fina y alta joyería, showroom en Alonso de Córdova.");
console.log("  Siguiente paso: entra a /crm y usa «Volver a analizar» en Alertas y acciones.");
