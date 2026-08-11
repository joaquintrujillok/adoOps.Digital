// Base de demostración del CRM.
//
// Simula una distribuidora B2B chilena —equipamiento y consumibles para
// gastronomía y retail— porque ese rubro ejercita de verdad todos los módulos:
// hay recompra (los consumibles se acaban), cross-selling (el equipo arrastra su
// insumo), inventario que se agota, y un ciclo de venta con etapas.
//
// Es DETERMINÍSTICA: el generador pseudoaleatorio va con semilla fija, así que
// dos ejecuciones producen exactamente los mismos datos. Una demo que cambia
// sola entre ensayos no se puede ensayar.
//
// Idempotente: borra las tablas crm_* de datos antes de sembrar. NO toca
// crm_users (los logins) ni crm_settings (la configuración), ni ninguna tabla
// fuera del prefijo crm_.
//
// Uso:
//   node scripts/crm-seed.mjs            siembra
//   node scripts/crm-seed.mjs --limpiar  solo borra los datos de demostración

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

let semilla = 20260810;
function rnd() {
  // Mulberry32: corto, rápido y reproducible.
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => Math.floor(rnd() * (b - a + 1)) + a;
const elegir = (xs) => xs[Math.floor(rnd() * xs.length)];
const quizas = (p) => rnd() < p;

const HOY = new Date("2026-08-10T12:00:00Z");
const dias = (n) => new Date(HOY.getTime() - n * 86_400_000);

// ─── Limpieza ────────────────────────────────────────────────────────────────

async function limpiar() {
  // Orden: primero lo que referencia, después lo referenciado.
  const tablas = [
    "crm_wa_messages",
    "crm_wa_conversations",
    "crm_wa_templates",
    "crm_alerts",
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
  console.log(`✓ ${tablas.length} tablas de datos vaciadas (crm_users y crm_settings intactas)`);
}

if (process.argv.includes("--limpiar")) {
  await limpiar();
  process.exit(0);
}

await limpiar();

// ─── Usuarios ────────────────────────────────────────────────────────────────

const usuarios = await sql`SELECT id, nombre, rol FROM crm_users WHERE activo = TRUE ORDER BY id`;
if (usuarios.length === 0) {
  console.error(
    "No hay usuarios. Crea al menos uno:\n  node scripts/crm-usuario.mjs joaquin <clave> admin \"Tu Nombre\"",
  );
  process.exit(1);
}
const vendedores = usuarios.filter((u) => u.rol !== "admin");
const equipo = vendedores.length ? vendedores : usuarios;

// ─── Catálogo ────────────────────────────────────────────────────────────────

const PRODUCTOS = [
  // categoría, sku, nombre, precio, costo, stock, punto reposición, lead time
  ["Equipamiento", "EQ-HOR-01", "Horno convector 6 bandejas", 2_890_000, 1_950_000, 8, 3, 45],
  ["Equipamiento", "EQ-BAT-02", "Batidora planetaria 20 lt", 1_240_000, 820_000, 14, 5, 30],
  ["Equipamiento", "EQ-REF-03", "Refrigerador vertical 2 puertas", 1_780_000, 1_190_000, 2, 4, 60],
  ["Equipamiento", "EQ-CAF-04", "Máquina de café 2 grupos", 3_450_000, 2_400_000, 5, 2, 50],
  ["Consumibles", "CO-CAF-10", "Café en grano 1 kg (caja 10)", 128_000, 82_000, 320, 80, 12],
  ["Consumibles", "CO-ENV-11", "Envases compostables 500 un.", 46_000, 28_000, 640, 200, 15],
  ["Consumibles", "CO-LIM-12", "Kit limpieza industrial", 89_000, 54_000, 180, 60, 10],
  ["Consumibles", "CO-FIL-13", "Filtros de agua (pack 6)", 74_000, 41_000, 95, 40, 21],
  ["Menaje", "ME-VAJ-20", "Vajilla porcelana 48 piezas", 315_000, 198_000, 42, 12, 35],
  ["Menaje", "ME-CUB-21", "Set cubiertos acero 72 piezas", 189_000, 112_000, 60, 15, 28],
  ["Menaje", "ME-CRI-22", "Cristalería línea premium 36 un.", 240_000, 148_000, 18, 10, 40],
  // Los servicios van con stock `null`: no se les crea fila de inventario, y por
  // eso quedan fuera de la valorización de bodega y de las alertas de quiebre.
  ["Servicios", "SE-MAN-30", "Mantención preventiva anual", 690_000, 320_000, null, 0, 0],
  ["Servicios", "SE-INS-31", "Instalación y puesta en marcha", 380_000, 170_000, null, 0, 0],
  ["Servicios", "SE-CAP-32", "Capacitación de equipo (8 h)", 450_000, 190_000, null, 0, 0],
];

const productos = [];
for (const [categoria, sku, nombre, precio, costo, stock, punto, lead] of PRODUCTOS) {
  const [p] = await sql`
    INSERT INTO crm_products (sku, nombre, categoria, precio, costo, activo)
    VALUES (${sku}, ${nombre}, ${categoria}, ${precio}, ${costo}, TRUE)
    RETURNING id
  `;
  if (stock !== null) {
    await sql`
      INSERT INTO crm_inventory (product_id, stock, reservado, punto_reposicion, lead_time_dias)
      VALUES (${p.id}, ${stock}, 0, ${punto}, ${lead})
    `;
  }
  productos.push({ id: p.id, sku, nombre, categoria, precio, costo });
}
console.log(`✓ ${productos.length} productos con inventario`);

const porSku = Object.fromEntries(productos.map((p) => [p.sku, p]));
const consumibles = productos.filter((p) => p.categoria === "Consumibles");
const equipos = productos.filter((p) => p.categoria === "Equipamiento");
const menaje = productos.filter((p) => p.categoria === "Menaje");
const servicios = productos.filter((p) => p.categoria === "Servicios");

// ─── Campañas ────────────────────────────────────────────────────────────────

const CAMPANAS = [
  ["Google Ads · Equipamiento gastronómico", "ads", 420, 0, 4_800_000],
  ["Feria Espacio Food & Service 2025", "evento", 330, 300, 6_200_000],
  ["Newsletter mensual · base propia", "email", 400, 0, 890_000],
  ["LinkedIn · hoteles y cadenas", "social", 260, 60, 3_100_000],
  ["Programa de referidos", "referido", 500, 0, 1_400_000],
  ["Remarketing consumibles", "ads", 150, 0, 2_250_000],
  ["Webinar: eficiencia en cocina", "evento", 95, 88, 1_150_000],
  ["Campaña recompra WhatsApp", "whatsapp", 60, 0, 340_000],
];

const campanas = [];
for (const [nombre, canal, desdeDias, hastaDias, costo] of CAMPANAS) {
  const [c] = await sql`
    INSERT INTO crm_campaigns (nombre, canal, inicio, fin, costo, objetivo, activa)
    VALUES (
      ${nombre}, ${canal}, ${dias(desdeDias)},
      ${hastaDias > 0 ? dias(hastaDias) : null},
      ${costo},
      ${"Generar oportunidades calificadas en " + canal},
      ${hastaDias === 0}
    )
    RETURNING id
  `;
  campanas.push({ id: c.id, nombre, canal, desdeDias, hastaDias });
}
console.log(`✓ ${campanas.length} campañas`);

// ─── Cuentas y contactos ─────────────────────────────────────────────────────

const CUENTAS = [
  // nombre, industria, tamaño, ciudad, estado, arquetipo
  ["Hotel Cordillera", "Hotelería", "grande", "Santiago", "cliente", "fiel"],
  ["Restaurante Los Nogales", "Gastronomía", "pyme", "Santiago", "cliente", "fiel"],
  ["Cafetería Mirador", "Gastronomía", "micro", "Valparaíso", "cliente", "atrasado"],
  ["Casino Andes Norte", "Casinos", "grande", "Antofagasta", "cliente", "grande"],
  ["Panadería San Miguel", "Gastronomía", "pyme", "Santiago", "cliente", "fiel"],
  ["Hotel Bahía Azul", "Hotelería", "mediana", "Viña del Mar", "cliente", "atrasado"],
  ["Cadena Sabor Express", "Gastronomía", "mediana", "Santiago", "cliente", "grande"],
  ["Club Deportivo Lo Barnechea", "Clubes", "mediana", "Santiago", "cliente", "esporadico"],
  ["Bistró La Estación", "Gastronomía", "micro", "Concepción", "cliente", "atrasado"],
  ["Hotel Patagonia Sur", "Hotelería", "mediana", "Puerto Varas", "cliente", "fiel"],
  ["Universidad del Valle · Casino", "Educación", "grande", "Talca", "cliente", "esporadico"],
  ["Sushi Kohaku", "Gastronomía", "micro", "Santiago", "cliente", "atrasado"],
  ["Catering Eventos Premium", "Catering", "pyme", "Santiago", "cliente", "fiel"],
  ["Clínica Los Robles · Alimentación", "Salud", "grande", "Santiago", "cliente", "grande"],
  ["Pastelería Dulce Hogar", "Gastronomía", "micro", "Rancagua", "cliente", "esporadico"],
  ["Hostal Camino Real", "Hotelería", "micro", "La Serena", "inactivo", "perdido"],
  ["Food Truck Colectivo", "Gastronomía", "micro", "Santiago", "inactivo", "perdido"],
  ["Grupo Gastronómico Aysén", "Gastronomía", "mediana", "Coyhaique", "prospecto", "prospecto"],
  ["Hotel Vista Nevada", "Hotelería", "mediana", "Farellones", "prospecto", "prospecto_caliente"],
  ["Casino Enjoy Coquimbo", "Casinos", "grande", "Coquimbo", "prospecto", "prospecto_caliente"],
  ["Cervecería Artesanal Ñuble", "Gastronomía", "pyme", "Chillán", "prospecto", "prospecto"],
  ["Cadena Pausa Café", "Gastronomía", "mediana", "Santiago", "prospecto", "prospecto_caliente"],
  ["Colegio San Andrés · Casino", "Educación", "pyme", "Santiago", "prospecto", "prospecto"],
  ["Hotel Boutique Barrio Italia", "Hotelería", "micro", "Santiago", "prospecto", "prospecto"],
  ["Empresas Norte Gourmet", "Catering", "pyme", "Iquique", "prospecto", "prospecto"],
  ["Restaurante Mar Adentro", "Gastronomía", "pyme", "Valdivia", "prospecto", "prospecto_caliente"],
  ["Corporación Municipal Maipú", "Sector público", "grande", "Santiago", "prospecto", "prospecto"],
  ["Hotel Altos del Lago", "Hotelería", "pyme", "Villarrica", "perdido", "perdido"],
];

const NOMBRES = [
  "María José Herrera", "Cristián Salinas", "Paula Ibáñez", "Rodrigo Vera",
  "Carolina Muñoz", "Felipe Cárdenas", "Antonia Reyes", "Diego Fuentes",
  "Valentina Soto", "Sebastián Rivas", "Camila Godoy", "Nicolás Peña",
  "Francisca Tapia", "Andrés Villalobos", "Javiera Bustos", "Matías Contreras",
  "Daniela Espinoza", "Gonzalo Arriagada", "Constanza Leiva", "Ignacio Moreno",
  "Bárbara Núñez", "Tomás Aguirre", "Catalina Bravo", "Esteban Pizarro",
  "Macarena Ortiz", "Álvaro Sepúlveda", "Josefa Cabrera", "Vicente Marín",
];

const CARGOS_DECISOR = ["Gerente General", "Gerente de Operaciones", "Dueño", "Jefe de Compras"];
const CARGOS_OTROS = ["Chef Ejecutivo", "Administrador", "Encargado de Bodega", "Asistente de Compras"];

const cuentas = [];
let nombreIdx = 0;

for (const [nombre, industria, tamano, ciudad, estado, arquetipo] of CUENTAS) {
  const owner = elegir(equipo);
  const fuente = elegir(["Google Ads", "Feria", "Referido", "Newsletter", "LinkedIn", "Directo"]);
  const [c] = await sql`
    INSERT INTO crm_accounts (nombre, industria, tamano, ciudad, estado, fuente, owner_id, rut, sitio_web)
    VALUES (
      ${nombre}, ${industria}, ${tamano}, ${ciudad}, ${estado}, ${fuente}, ${owner.id},
      ${`${entre(70, 99)}.${entre(100, 999)}.${entre(100, 999)}-${entre(0, 9)}`},
      ${`https://www.${nombre.toLowerCase().replace(/[^a-z0-9]+/g, "")}.cl`}
    )
    RETURNING id
  `;

  const contactos = [];
  const cuantos = tamano === "grande" ? 3 : tamano === "micro" ? 1 : 2;
  for (let i = 0; i < cuantos; i++) {
    const persona = NOMBRES[nombreIdx++ % NOMBRES.length];
    const decisor = i === 0;
    // El correo se arma completo en JS: interpolar el dominio partido dentro del
    // template de SQL haría que Postgres leyera ".cl" como notación de columna.
    const usuarioEmail = persona
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, ".");
    const dominio = nombre.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const email = `${usuarioEmail}@${dominio}.cl`;
    // El opt-in de WhatsApp no es universal a propósito: en la vida real no
    // todos lo dan, y el módulo tiene que verse operando con esa restricción.
    const optIn = decisor ? quizas(0.75) : quizas(0.35);
    const [k] = await sql`
      INSERT INTO crm_contacts (account_id, nombre, cargo, email, telefono, es_decisor, opt_in_whatsapp)
      VALUES (
        ${c.id}, ${persona},
        ${decisor ? elegir(CARGOS_DECISOR) : elegir(CARGOS_OTROS)},
        ${email},
        ${"569" + entre(30000000, 99999999)},
        ${decisor}, ${optIn}
      )
      RETURNING id
    `;
    contactos.push({ id: k.id, nombre: persona, decisor, optIn });
  }

  cuentas.push({ id: c.id, nombre, estado, arquetipo, tamano, ownerId: owner.id, fuente, contactos });
}
console.log(`✓ ${cuentas.length} cuentas y sus contactos`);

// ─── Touchpoints de marketing ────────────────────────────────────────────────

const TIPOS_TOUCH = ["impresion", "click", "apertura", "formulario", "visita", "respuesta"];
let touchpoints = 0;

for (const cuenta of cuentas) {
  // Las cuentas que compran fueron tocadas más veces: es la correlación que el
  // factor de engagement del puntaje debería reflejar.
  const cuantos =
    cuenta.arquetipo === "prospecto_caliente" ? entre(6, 11)
    : cuenta.estado === "cliente" ? entre(4, 9)
    : entre(1, 4);

  for (let i = 0; i < cuantos; i++) {
    const campana = elegir(campanas);
    const contacto = elegir(cuenta.contactos);
    const cuando = dias(entre(campana.hastaDias, campana.desdeDias));
    await sql`
      INSERT INTO crm_touchpoints (contact_id, account_id, campaign_id, tipo, detalle, ocurrido_en)
      VALUES (${contacto.id}, ${cuenta.id}, ${campana.id}, ${elegir(TIPOS_TOUCH)},
              ${campana.nombre}, ${cuando})
    `;
    touchpoints++;
  }
}
console.log(`✓ ${touchpoints} interacciones de marketing`);

// Primer y último toque de cada cuenta, para la atribución de sus oportunidades.
const toquesPorCuenta = await sql`
  SELECT account_id,
         (array_agg(campaign_id ORDER BY ocurrido_en ASC))[1] AS primero,
         (array_agg(campaign_id ORDER BY ocurrido_en DESC))[1] AS ultimo
  FROM crm_touchpoints
  GROUP BY account_id
`;
const atribucion = Object.fromEntries(
  toquesPorCuenta.map((t) => [t.account_id, { primero: t.primero, ultimo: t.ultimo }]),
);

// ─── Órdenes históricas ──────────────────────────────────────────────────────

/**
 * Cada arquetipo de cliente compra distinto. Es lo que hace que la ventana de
 * recompra tenga algo que detectar: si todos compraran igual, no habría nada que
 * segmentar.
 */
const RITMO = {
  fiel: { ciclo: 45, compras: [8, 12], ultimaHace: [5, 25] },
  grande: { ciclo: 60, compras: [6, 9], ultimaHace: [10, 35] },
  esporadico: { ciclo: 120, compras: [3, 5], ultimaHace: [20, 90] },
  atrasado: { ciclo: 50, compras: [4, 7], ultimaHace: [110, 190] },
  perdido: { ciclo: 90, compras: [2, 3], ultimaHace: [280, 420] },
};

const CANALES_VENTA = ["Vendedor", "eCommerce", "Teléfono", "WhatsApp"];
let ordenes = 0;
let itemsOrden = 0;

for (const cuenta of cuentas) {
  const ritmo = RITMO[cuenta.arquetipo];
  if (!ritmo) continue; // prospectos: todavía no compran

  const cuantas = entre(ritmo.compras[0], ritmo.compras[1]);
  let hace = entre(ritmo.ultimaHace[0], ritmo.ultimaHace[1]);

  // Cada cuenta tiene su canasta habitual: un consumible fijo, a veces menaje.
  // Eso es lo que produce patrones reales de cross-selling en vez de ruido.
  const habitual = elegir(consumibles);
  const secundario = quizas(0.55) ? elegir(consumibles.filter((p) => p.id !== habitual.id)) : null;
  const conMenaje = quizas(0.4) ? elegir(menaje) : null;

  for (let i = 0; i < cuantas; i++) {
    const fecha = dias(hace);
    const items = [];

    items.push({ p: habitual, cant: entre(2, 8) });
    if (secundario && quizas(0.6)) items.push({ p: secundario, cant: entre(1, 5) });
    if (conMenaje && quizas(0.3)) items.push({ p: conMenaje, cant: entre(1, 3) });
    // La primera compra histórica suele traer el equipo grande y su servicio.
    if (i === cuantas - 1 && quizas(0.5)) {
      const eq = elegir(equipos);
      items.push({ p: eq, cant: 1 });
      if (quizas(0.7)) items.push({ p: elegir(servicios), cant: 1 });
    }

    const total = items.reduce((s, it) => s + it.p.precio * it.cant, 0);
    const [o] = await sql`
      INSERT INTO crm_orders (account_id, fecha, total, canal)
      VALUES (${cuenta.id}, ${fecha}, ${total}, ${elegir(CANALES_VENTA)})
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

    // Hacia atrás en el tiempo, con algo de dispersión sobre el ciclo base.
    hace += ritmo.ciclo + entre(-8, 12);
  }
}
console.log(`✓ ${ordenes} órdenes con ${itemsOrden} líneas`);

// ─── Oportunidades ───────────────────────────────────────────────────────────

const TITULOS = [
  "Renovación de equipamiento de cocina",
  "Suministro anual de consumibles",
  "Implementación cafetería nueva sucursal",
  "Reposición de menaje y cristalería",
  "Plan de mantención preventiva",
  "Habilitación de cocina central",
  "Ampliación de línea de café",
  "Contrato de abastecimiento semestral",
];

const MOTIVOS = [
  "Precio",
  "Se fue con la competencia",
  "Sin presupuesto",
  "Sin respuesta",
  "Momento equivocado",
  "Producto sin stock",
];

const ETAPAS_ABIERTAS = ["nuevo", "calificado", "propuesta", "negociacion"];
const PROB = { nuevo: 10, calificado: 30, propuesta: 50, negociacion: 75, ganado: 100, perdido: 0 };

let deals = 0;
let itemsDeal = 0;

for (const cuenta of cuentas) {
  // Los prospectos calientes tienen más de una oportunidad en juego; los
  // perdidos, solo su historia.
  const cuantas =
    cuenta.arquetipo === "prospecto_caliente" ? entre(1, 2)
    : cuenta.arquetipo === "perdido" ? entre(1, 2)
    : cuenta.estado === "cliente" ? entre(1, 3)
    : entre(0, 1);

  for (let i = 0; i < cuantas; i++) {
    const cerrada = cuenta.arquetipo === "perdido" ? true : quizas(0.45);
    const ganada = cerrada && cuenta.estado === "cliente" && quizas(0.62);
    const etapa = cerrada ? (ganada ? "ganado" : "perdido") : elegir(ETAPAS_ABIERTAS);

    const abiertoHace = entre(20, 260);
    const cerradoHace = cerrada ? Math.max(1, abiertoHace - entre(15, 70)) : null;

    // Algunas abiertas se dejan deliberadamente sin tocar por semanas: son las
    // que el motor de alertas tiene que encontrar.
    const ultimaActividadHace = cerrada
      ? cerradoHace
      : quizas(0.3)
        ? entre(18, 55)
        : entre(0, 12);

    const items = [];
    if (quizas(0.75)) items.push({ p: elegir(equipos), cant: quizas(0.25) ? 2 : 1 });
    if (quizas(0.8)) items.push({ p: elegir(consumibles), cant: entre(3, 12) });
    if (quizas(0.4)) items.push({ p: elegir(servicios), cant: 1 });
    if (items.length === 0) items.push({ p: elegir(menaje), cant: entre(1, 4) });

    const monto = items.reduce((s, it) => s + it.p.precio * it.cant, 0);
    const atrib = atribucion[cuenta.id] ?? {};
    const decisor = cuenta.contactos.find((k) => k.decisor) ?? cuenta.contactos[0];

    const [d] = await sql`
      INSERT INTO crm_deals (
        account_id, contact_id, titulo, etapa, monto, probabilidad, owner_id, fuente,
        campaign_first_id, campaign_last_id, abierto_en, cierre_estimado, cerrado_en,
        motivo_perdida, ultima_actividad_en
      ) VALUES (
        ${cuenta.id},
        ${quizas(0.85) ? decisor.id : elegir(cuenta.contactos).id},
        ${elegir(TITULOS)}, ${etapa}, ${monto}, ${PROB[etapa]},
        ${quizas(0.92) ? cuenta.ownerId : null},
        ${cuenta.fuente},
        ${atrib.primero ?? null}, ${atrib.ultimo ?? null},
        ${dias(abiertoHace)},
        ${dias(abiertoHace - entre(40, 95))},
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
console.log(`✓ ${deals} oportunidades con ${itemsDeal} líneas de producto`);

// Un producto deliberadamente sobrevendido: el refrigerador, con 2 unidades y
// lead time de 60 días. Sin un caso así, la alerta de stock comprometido no
// tendría nada que mostrar en la demo.
const refri = porSku["EQ-REF-03"];
const abiertasParaStock = await sql`
  SELECT id FROM crm_deals WHERE etapa IN ('propuesta','negociacion') ORDER BY monto DESC LIMIT 3
`;
for (const d of abiertasParaStock) {
  await sql`
    INSERT INTO crm_deal_items (deal_id, product_id, cantidad, precio_unitario)
    VALUES (${d.id}, ${refri.id}, 2, ${refri.precio})
  `;
  await sql`
    UPDATE crm_deals SET monto = monto + ${refri.precio * 2} WHERE id = ${d.id}
  `;
}

// ─── Actividades ─────────────────────────────────────────────────────────────

const ACTIVIDADES = {
  llamada: ["Llamada de seguimiento", "Llamada para coordinar visita", "Llamada: revisión de propuesta"],
  reunion: ["Reunión en sus oficinas", "Visita técnica a cocina", "Reunión de cierre"],
  email: ["Envío de cotización", "Envío de ficha técnica", "Respuesta a consulta de plazos"],
  nota: ["Nota: cambió el encargado de compras", "Nota: evalúan también a la competencia", "Nota: presupuesto se define en marzo"],
};

let actividades = 0;
const dealsAbiertos = await sql`
  SELECT id, account_id, owner_id, ultima_actividad_en FROM crm_deals WHERE etapa NOT IN ('ganado','perdido')
`;

// Los negocios cerrados también llevan bitácora: una ficha de un negocio ganado
// sin ninguna actividad se ve como un CRM que nadie usó.
const dealsCerrados = await sql`
  SELECT id, account_id, owner_id, etapa, cerrado_en FROM crm_deals WHERE etapa IN ('ganado','perdido')
`;
for (const d of dealsCerrados) {
  for (let i = 0; i < entre(2, 4); i++) {
    const tipo = elegir(Object.keys(ACTIVIDADES));
    await sql`
      INSERT INTO crm_activities (account_id, deal_id, tipo, titulo, owner_id, ocurrido_en)
      VALUES (${d.account_id}, ${d.id}, ${tipo}, ${elegir(ACTIVIDADES[tipo])},
              ${d.owner_id}, ${dias(entre(30, 200))})
    `;
    actividades++;
  }
  await sql`
    INSERT INTO crm_activities (account_id, deal_id, tipo, titulo, detalle, owner_id, ocurrido_en)
    VALUES (${d.account_id}, ${d.id}, 'nota',
            ${d.etapa === "ganado" ? "Negocio cerrado y ganado" : "Negocio cerrado como perdido"},
            ${d.etapa === "ganado" ? "Se coordina despacho e instalación." : null},
            ${d.owner_id}, ${d.cerrado_en})
  `;
  actividades++;
}

for (const d of dealsAbiertos) {
  for (let i = 0; i < entre(2, 5); i++) {
    const tipo = elegir(Object.keys(ACTIVIDADES));
    await sql`
      INSERT INTO crm_activities (account_id, deal_id, tipo, titulo, owner_id, ocurrido_en)
      VALUES (${d.account_id}, ${d.id}, ${tipo}, ${elegir(ACTIVIDADES[tipo])},
              ${d.owner_id}, ${dias(entre(1, 120))})
    `;
    actividades++;
  }
  // La última actividad tiene que calzar con la fecha del deal: es la que
  // alimenta la alerta de estancamiento, y una bitácora que la contradiga
  // rompería la credibilidad de la demo justo donde se mira.
  await sql`
    INSERT INTO crm_activities (account_id, deal_id, tipo, titulo, owner_id, ocurrido_en)
    VALUES (${d.account_id}, ${d.id}, 'llamada', 'Último contacto registrado',
            ${d.owner_id}, ${d.ultima_actividad_en})
  `;
  actividades++;
}

// Tareas pendientes, algunas ya vencidas.
const TAREAS = [
  "Enviar propuesta actualizada",
  "Confirmar disponibilidad de stock",
  "Agendar visita técnica",
  "Llamar para cerrar condiciones de pago",
  "Preparar comparativo con la competencia",
];
for (let i = 0; i < 9; i++) {
  const d = elegir(dealsAbiertos);
  const vencida = i < 4;
  await sql`
    INSERT INTO crm_activities (account_id, deal_id, tipo, titulo, owner_id, ocurrido_en, vence_en, completada)
    VALUES (${d.account_id}, ${d.id}, 'tarea', ${elegir(TAREAS)}, ${d.owner_id},
            ${dias(entre(3, 20))}, ${vencida ? dias(entre(2, 12)) : dias(-entre(1, 8))}, FALSE)
  `;
  actividades++;
}
console.log(`✓ ${actividades} actividades registradas`);

// ─── Plantillas y conversaciones de WhatsApp ─────────────────────────────────

const PLANTILLAS = [
  ["Recompra", "recompra", "Hola {{contacto}}, te escribo de {{empresa}}. Vi que ya pasó un tiempo desde tu último pedido de {{producto}}. ¿Te preparo una cotización con los precios de este mes? Si prefieres, te llamo cuando estés desocupado."],
  ["Cross-selling", "cross_sell", "Hola {{contacto}}, soy {{vendedor}} de {{empresa}}. Varios clientes que trabajan con {{producto}} están sumando complementos que les rinde bien. ¿Te muestro las opciones en dos minutos?"],
  ["Seguimiento de propuesta", "seguimiento", "Hola {{contacto}}, ¿alcanzaste a revisar la propuesta que te envié? Quedo atento a cualquier duda para ajustarla a lo que necesitas."],
  ["Reactivación", "reactivacion", "Hola {{contacto}}, hace {{dias}} días que no conversamos. ¿Sigue en pie lo que estaban evaluando en {{cuenta}}? Si cambió la prioridad, me sirve saberlo igual."],
];
for (const [nombre, proposito, cuerpo] of PLANTILLAS) {
  await sql`
    INSERT INTO crm_wa_templates (nombre, cuerpo, proposito, activa)
    VALUES (${nombre}, ${cuerpo}, ${proposito}, TRUE)
  `;
}

// Cuatro hilos con historia, incluido uno que pidió la baja: sin ese caso, el
// candado de BAJA no se puede mostrar funcionando.
// {{contacto}} se reemplaza por el nombre real de pila del contacto de la
// cuenta: un hilo que saluda a alguien que no es el contacto se nota al toque.
const HILOS = [
  {
    cuenta: "Cafetería Mirador",
    mensajes: [
      ["out", "Hola {{contacto}}, te escribo de Andes Supply. Vi que ya pasó un tiempo desde tu último pedido de café en grano. ¿Te preparo una cotización con los precios de este mes?", "simulado", 6],
      ["in", "Hola! Sí, justo estábamos por pedir. Mándame precio por 10 cajas.", null, 6],
      ["out", "Perfecto, te mando la cotización hoy mismo. ¿Sigue la dirección de despacho en Errázuriz?", "simulado", 5],
      ["in", "Sí, la misma. Gracias!", null, 5],
    ],
  },
  {
    cuenta: "Bistró La Estación",
    mensajes: [
      ["out", "Hola {{contacto}}, hace 140 días que no conversamos. ¿Sigue en pie lo que estaban evaluando en Bistró La Estación?", "simulado", 12],
      ["in", "Hola, por ahora no. Estamos con el local en remodelación. Te aviso en un par de meses.", null, 11],
    ],
  },
  {
    cuenta: "Hostal Camino Real",
    mensajes: [
      ["out", "Hola {{contacto}}, te escribo de Andes Supply para retomar contacto y mostrarte las novedades del catálogo.", "simulado", 20],
      ["in", "BAJA", null, 19],
    ],
  },
  {
    cuenta: "Hotel Vista Nevada",
    mensajes: [
      ["out", "Hola {{contacto}}, ¿alcanzaste a revisar la propuesta que te envié? Quedo atento a cualquier duda.", "simulado", 3],
    ],
  },
];

let conversaciones = 0;
let mensajesWa = 0;

for (const hilo of HILOS) {
  const cuenta = cuentas.find((c) => c.nombre === hilo.cuenta);
  if (!cuenta) continue;
  const contacto = cuenta.contactos[0];
  const [k] = await sql`SELECT telefono FROM crm_contacts WHERE id = ${contacto.id}`;

  const baja = hilo.mensajes.some((m) => m[0] === "in" && /baja/i.test(m[1]));
  const [conv] = await sql`
    INSERT INTO crm_wa_conversations (account_id, contact_id, telefono, nombre, estado, baja, ultimo_mensaje_en)
    VALUES (${cuenta.id}, ${contacto.id}, ${k.telefono}, ${contacto.nombre},
            ${baja ? "cerrada" : "abierta"}, ${baja},
            ${dias(hilo.mensajes[hilo.mensajes.length - 1][3])})
    RETURNING id
  `;
  conversaciones++;

  const nombrePila = contacto.nombre.split(" ")[0];

  for (const [direccion, plantilla, estado, hace] of hilo.mensajes) {
    const cuerpo = plantilla.replace(/\{\{contacto\}\}/g, nombrePila);
    await sql`
      INSERT INTO crm_wa_messages (conversation_id, direccion, cuerpo, estado, automatico, created_at, enviado_en)
      VALUES (${conv.id}, ${direccion}, ${cuerpo},
              ${direccion === "in" ? "sent" : estado},
              ${direccion === "out"}, ${dias(hace)}, ${dias(hace)})
    `;
    mensajesWa++;
  }
}
console.log(`✓ ${conversaciones} conversaciones con ${mensajesWa} mensajes de WhatsApp`);

// ─── Segmentos guardados ─────────────────────────────────────────────────────

const SEGMENTOS = [
  ["Mejores clientes", "Puntaje alto y compras recientes. Los que hay que cuidar.", { estado: ["cliente"], scoreMin: 70 }],
  ["En riesgo de fuga", "Compraron varias veces y llevan más de 120 días sin volver.", { estado: ["cliente"], comprasMin: 2, sinComprarMin: 120 }],
  ["Prospectos calientes", "Todavía no compran, pero interactúan y tienen buen puntaje.", { estado: ["prospecto"], scoreMin: 45 }],
  ["Contactables por WhatsApp", "Cuentas con al menos un contacto que autorizó WhatsApp.", { conWhatsapp: true }],
];
for (const [nombre, descripcion, definicion] of SEGMENTOS) {
  await sql`
    INSERT INTO crm_segments (nombre, descripcion, definicion)
    VALUES (${nombre}, ${descripcion}, ${JSON.stringify(definicion)})
  `;
}
console.log(`✓ ${SEGMENTOS.length} segmentos guardados`);

// ─── Reserva de inventario ───────────────────────────────────────────────────

// Lo comprometido en oportunidades abiertas se refleja como "reservado": es lo
// que hace que la disponibilidad de la pantalla de productos sea la real.
await sql`
  UPDATE crm_inventory i
  SET reservado = COALESCE((
    SELECT SUM(di.cantidad)
    FROM crm_deal_items di
    JOIN crm_deals d ON d.id = di.deal_id
    WHERE di.product_id = i.product_id AND d.etapa IN ('nuevo','calificado','propuesta','negociacion')
  ), 0)
`;

// ─── Configuración inicial ───────────────────────────────────────────────────

await sql`
  INSERT INTO crm_settings (clave, valor)
  VALUES ('general.empresa', 'Andes Supply'),
         ('whatsapp.simulado', 'true'),
         ('whatsapp.envio_habilitado', 'true'),
         ('insights.narrador_ia', 'true')
  ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
`;

console.log("\n✓ Base de demostración lista.");
console.log("  Empresa ficticia: Andes Supply (distribuidora B2B de equipamiento gastronómico).");
console.log("  Siguiente paso: entra a /crm y usa «Volver a analizar» en Alertas y acciones.");
