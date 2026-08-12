// Base de demostración para la analítica de clientes.
//
// Genera el volumen que un dashboard de RFM y LTV necesita para verse como un
// negocio y no como una maqueta: ~1.200 clientes y ~4.000 transacciones de tres
// años, llegando por dos vías que no se conocen entre sí —el POS de la tienda y
// el e-commerce— igual que en la operación real del cliente.
//
// LO QUE SE MODELA A PROPÓSITO, porque es lo que hace creíble el análisis:
//
//   · **Cola larga.** La mayoría compra una sola vez y no vuelve. Un mock donde
//     todos compran tres veces produce un RFM sin forma, con todos los clientes
//     apelotonados en el centro de la matriz.
//   · **Ventas sin cliente identificado.** Un porcentaje alto de las boletas del
//     POS sale sin RUT ni correo. Es el hallazgo más importante que el dashboard
//     tiene que mostrar, y si el mock no lo tiene, el dashboard miente.
//   · **Cohortes de tres años**, para que la curva de LTV acumulado tenga de
//     dónde salir.
//   · **Clientes omnicanal**: los que compran en tienda y online valen más, y
//     ese contraste es el argumento que vende la integración.
//   · **Estacionalidad chilena**: diciembre y mayo (día de la madre) pesan.
//
// Determinístico: semilla fija, dos corridas dan lo mismo.
//
// Uso:
//   node scripts/crm-seed-analitica.mjs            siembra
//   node scripts/crm-seed-analitica.mjs --limpiar  borra solo lo de este seed

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

let semilla = 20260812;
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

/** Elige con pesos: [[valor, peso], …]. */
function elegirPesado(pares) {
  const total = pares.reduce((s, [, p]) => s + p, 0);
  let r = rnd() * total;
  for (const [v, p] of pares) {
    r -= p;
    if (r <= 0) return v;
  }
  return pares[pares.length - 1][0];
}

const HOY = new Date("2026-08-12T12:00:00Z");
const dias = (n) => new Date(HOY.getTime() - n * 86_400_000);
const DIAS_HISTORIA = 1095; // tres años

// ─── Limpieza ────────────────────────────────────────────────────────────────

async function limpiar() {
  // Se borra en orden de dependencia. Los usuarios, la configuración y el
  // catálogo NO se tocan: el catálogo lo siembra crm-seed.mjs y este script
  // construye encima.
  for (const t of [
    "crm_senales",
    "crm_showroom_visitas",
    "crm_order_items",
    "crm_orders",
    "crm_contacts",
  ]) {
    await sql.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
  }
  console.log("✓ Clientes, ventas, visitas y señales vaciados");
}

if (process.argv.includes("--limpiar")) {
  await limpiar();
  process.exit(0);
}

await limpiar();

// ─── Equipo y catálogo ───────────────────────────────────────────────────────

const usuarios = await sql`SELECT id, nombre, rol FROM crm_users WHERE activo = TRUE ORDER BY id`;
if (usuarios.length === 0) {
  console.error('No hay usuarios. Corre antes: node scripts/crm-usuario.mjs joaquin <clave> admin "Tu Nombre"');
  process.exit(1);
}
const equipo = usuarios.filter((u) => u.rol !== "admin");
const ejecutivos = equipo.length ? equipo : usuarios;

const productos = await sql`
  SELECT id, sku, nombre, categoria, marca, precio FROM crm_products WHERE activo = TRUE ORDER BY id
`;
if (productos.length === 0) {
  console.error("No hay catálogo. Corre antes: node scripts/crm-seed.mjs");
  process.exit(1);
}

const porCategoria = (c) => productos.filter((p) => p.categoria === c);
const altaRelojeria = porCategoria("Alta relojería");
const deportivos = porCategoria("Relojes deportivos");
const clasicos = porCategoria("Relojes clásicos");
const altaJoyeria = porCategoria("Alta joyería");
const joyeriaFina = porCategoria("Joyería fina");
const accesorios = porCategoria("Accesorios");
const servicios = porCategoria("Servicios");

/**
 * Qué se vende en cada canal.
 *
 * El e-commerce de una boutique de alta gama no vende el tourbillon de noventa
 * millones: vende accesorios, joyería fina y algún clásico. La pieza grande se
 * cierra en el showroom, con la persona delante. Modelarlo al revés produciría
 * un dashboard donde el canal online parece el negocio principal, que es
 * justamente la conclusión equivocada.
 */
const CATALOGO_ECOMMERCE = [...accesorios, ...joyeriaFina, ...clasicos.slice(0, 2)];
const CATALOGO_POS = productos;

// ─── Personas ────────────────────────────────────────────────────────────────

const NOMBRES = [
  "Agustín", "Alejandra", "Alfonso", "Amparo", "Andrés", "Antonia", "Arturo", "Beatriz",
  "Benjamín", "Bernardita", "Camila", "Carlos", "Carolina", "Catalina", "Cecilia",
  "Clemente", "Constanza", "Cristóbal", "Daniela", "Diego", "Dominga", "Eduardo",
  "Elena", "Emilia", "Enrique", "Esteban", "Felipe", "Fernanda", "Florencia",
  "Francisca", "Francisco", "Gabriel", "Gonzalo", "Ignacia", "Ignacio", "Isidora",
  "Javiera", "Joaquín", "Josefa", "Juan Pablo", "Julieta", "Laura", "Lucas",
  "Macarena", "Magdalena", "Manuel", "Margarita", "María Jesús", "María Paz",
  "Martín", "Matías", "Mercedes", "Nicolás", "Paula", "Pedro", "Pilar", "Rafael",
  "Raimundo", "Renata", "Ricardo", "Rodrigo", "Rosario", "Sebastián", "Sofía",
  "Tomás", "Trinidad", "Valentina", "Vicente", "Victoria", "Ximena",
];

const APELLIDOS = [
  "Errázuriz", "Undurraga", "Larraín", "Fernández", "Amenábar", "Montt", "Izquierdo",
  "Valdés", "Correa", "Bezanilla", "Cruzat", "Guzmán", "Ovalle", "Edwards", "Pérez",
  "Balmaceda", "Yrarrázaval", "Subercaseaux", "Irarrázabal", "Ruiz-Tagle",
  "Astaburuaga", "Echenique", "Vicuña", "Barros", "Concha", "Bulnes", "Alessandri",
  "Vergara", "Prieto", "Ossa", "Silva", "Rojas", "Muñoz", "González", "Contreras",
  "Sepúlveda", "Espinoza", "Tapia", "Bravo", "Fuenzalida", "Cerda", "Lira", "Solar",
  "Riesco", "Prado", "Vial", "Costa", "Bulnes", "Toro", "Marín",
];

const COMUNAS = [
  ["Vitacura", 22], ["Las Condes", 26], ["Lo Barnechea", 16], ["Providencia", 12],
  ["La Reina", 5], ["Ñuñoa", 5], ["Viña del Mar", 6], ["Concón", 2],
  ["Concepción", 2], ["Antofagasta", 2], ["Puerto Varas", 1], ["La Serena", 1],
];

const FUENTES = [
  ["Showroom", 30], ["Instagram", 18], ["Referido", 16], ["Google", 12],
  ["Evento", 8], ["E-commerce", 10], ["Concesionario", 3], ["Newsletter", 3],
];

/**
 * Arquetipos de cliente y su peso en la base.
 *
 * La forma importa más que los nombres: **el 62% compra una sola vez**. Es la
 * distribución que tiene el retail de lujo de verdad, y es la que hace que el
 * RFM tenga algo que decir. Si todos volvieran, no habría nada que segmentar.
 */
const ARQUETIPOS = [
  // clave, peso, compras, días entre compras, sesgo a pieza cara, prob. e-commerce
  //
  // El sesgo NO multiplica el precio: decide con qué probabilidad la compra cae
  // en el tramo alto del catálogo. Multiplicar el total dejaría la venta
  // diciendo un número que sus propias líneas no suman.
  ["unica_vez", 62, [1, 1], [0, 0], 0.10, 0.25],
  ["ocasional", 20, [2, 3], [180, 420], 0.16, 0.3],
  ["habitual", 11, [4, 6], [90, 240], 0.24, 0.45],
  ["coleccionista", 5, [7, 12], [60, 150], 0.70, 0.35],
  ["corporativo", 2, [3, 6], [120, 300], 0.20, 0.15],
];

const BOUTIQUES = [
  ["Alonso de Córdova", 55],
  ["Casa Costanera", 30],
  ["Viña del Mar", 15],
];

const MEDIOS_PAGO_POS = [
  ["Tarjeta de crédito", 45], ["Transferencia", 30], ["Tarjeta de débito", 15],
  ["Efectivo", 5], ["Crédito directo", 5],
];

/** RUT chileno con dígito verificador correcto. Un RUT falso se nota. */
function rutChileno(n) {
  let suma = 0;
  let multiplo = 2;
  for (let i = String(n).length - 1; i >= 0; i--) {
    suma += Number(String(n)[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return `${n}-${dv}`;
}

function sinTildes(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// ─── Estacionalidad ──────────────────────────────────────────────────────────

/**
 * Peso de cada mes. Diciembre manda (regalos), mayo pesa por el día de la madre
 * y hay un repunte en agosto. Sin esto, la curva mensual sale plana y cualquiera
 * que conozca el retail nota que los datos son inventados.
 */
const PESO_MES = [0.7, 0.65, 0.85, 0.9, 1.35, 0.95, 0.9, 1.1, 1.0, 1.0, 1.15, 2.1];

/** Corre la fecha hacia un mes más probable, manteniéndola dentro del historial. */
function ajustarPorEstacionalidad(fecha) {
  const mes = fecha.getMonth();
  // Si el mes es flojo, hay chance de mover la compra al mes fuerte más cercano.
  if (PESO_MES[mes] < 1 && quizas(0.35)) {
    const destino = PESO_MES[(mes + 1) % 12] > PESO_MES[(mes + 11) % 12] ? 1 : -1;
    const movida = new Date(fecha);
    movida.setMonth(movida.getMonth() + destino);
    if (movida < HOY && movida > dias(DIAS_HISTORIA)) return movida;
  }
  return fecha;
}

// ─── Generación de clientes ──────────────────────────────────────────────────

const TOTAL_CLIENTES = 1200;
const clientes = [];
const usados = new Set();

for (let i = 0; i < TOTAL_CLIENTES; i++) {
  let nombre;
  let intentos = 0;
  do {
    nombre = `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
    intentos++;
  } while (usados.has(nombre) && intentos < 10);
  usados.add(nombre);

  const arquetipo = elegirPesado(ARQUETIPOS.map((a) => [a, a[1]]))[0];
  const config = ARQUETIPOS.find((a) => a[0] === arquetipo);

  const compras = entre(config[2][0], config[2][1]);
  const intervalo = config[3];
  const sesgoAlto = config[4];
  const probEcommerce = config[5];

  // Cuándo entró: se reparte a lo largo de los tres años, con más gente
  // reciente (el negocio crece).
  const antiguedad = Math.floor(DIAS_HISTORIA * Math.pow(rnd(), 0.75));
  const primeraCompraHace = Math.min(DIAS_HISTORIA - 1, antiguedad);

  // Contactabilidad: no todos dejan todo. Es lo que el dashboard tiene que
  // poder mostrar como brecha.
  const tieneEmail = quizas(0.72);
  const tieneTelefono = quizas(0.86);
  const consentimiento = (tieneEmail || tieneTelefono) && quizas(0.64);

  clientes.push({
    nombre,
    arquetipo,
    compras,
    intervalo,
    sesgoAlto,
    probEcommerce,
    primeraCompraHace,
    ciudad: elegirPesado(COMUNAS),
    fuente: elegirPesado(FUENTES),
    ownerId: elegir(ejecutivos).id,
    rut: rutChileno(entre(6_000_000, 26_000_000)),
    tieneEmail,
    tieneTelefono,
    consentimiento,
    optIn: consentimiento && quizas(0.85),
  });
}

// Inserción por lotes: 1.200 inserts de a uno contra Neon por HTTP tardan
// minutos. Con VALUES agrupados baja a segundos.
async function insertarLote(tabla, columnas, filas, porLote = 200) {
  const ids = [];
  for (let i = 0; i < filas.length; i += porLote) {
    const trozo = filas.slice(i, i + porLote);
    const params = [];
    const values = trozo
      .map(
        (fila) =>
          `(${fila
            .map((v) => {
              params.push(v);
              return `$${params.length}`;
            })
            .join(",")})`,
      )
      .join(",");
    const filasInsertadas = await sql.query(
      `INSERT INTO ${tabla} (${columnas.join(",")}) VALUES ${values} RETURNING id`,
      params,
    );
    ids.push(...filasInsertadas.map((f) => f.id));
  }
  return ids;
}

const filasContactos = clientes.map((c) => {
  const partes = c.nombre.split(" ");
  const usuario = sinTildes(`${partes[0]}.${partes[1]}`.toLowerCase()).replace(/[^a-z.]/g, "");
  const primeraCompra = dias(c.primeraCompraHace);
  return [
    c.nombre,
    c.tieneEmail ? `${usuario}${entre(1, 99)}@${elegir(["gmail.com", "correo.cl", "outlook.com", "vtr.net"])}` : null,
    c.tieneTelefono ? `569${entre(30000000, 99999999)}` : null,
    c.rut,
    c.ciudad,
    c.fuente,
    c.ownerId,
    "cliente",
    c.optIn,
    c.consentimiento,
    c.consentimiento ? primeraCompra : null,
    primeraCompra,
    // Cumpleaños: año irrelevante, importa el día y el mes.
    new Date(Date.UTC(1970 + entre(0, 45), entre(0, 11), entre(1, 28))),
    JSON.stringify(c.arquetipo === "coleccionista" ? ["coleccionista", "VIP"] : []),
  ];
});

const idsContactos = await insertarLote(
  "crm_contacts",
  [
    "nombre", "email", "telefono", "rut", "ciudad", "fuente", "owner_id", "estado",
    "opt_in_whatsapp", "consentimiento", "consentimiento_en", "primera_compra_en",
    "cumpleanos", "etiquetas",
  ],
  filasContactos,
);
clientes.forEach((c, i) => (c.id = idsContactos[i]));
console.log(`✓ ${clientes.length} clientes`);

// ─── Ventas ──────────────────────────────────────────────────────────────────

const ordenes = [];
const lineasPorOrden = [];

function piezasDeCompra(cliente, canal) {
  const catalogo = canal === "ecommerce" ? CATALOGO_ECOMMERCE : CATALOGO_POS;
  const piezas = [];

  if (canal === "ecommerce") {
    // Online se compran cosas chicas, y a veces varias.
    piezas.push({ p: elegir(catalogo), cant: quizas(0.2) ? 2 : 1 });
    if (quizas(0.3)) piezas.push({ p: elegir(accesorios), cant: 1 });
    return piezas;
  }

  // En tienda, la pieza principal depende del arquetipo.
  const principal =
    cliente.arquetipo === "coleccionista" && quizas(cliente.sesgoAlto ?? 0.5)
      ? elegir([...altaRelojeria, ...altaJoyeria, ...deportivos])
      : cliente.arquetipo === "corporativo"
        ? elegir([...clasicos, ...joyeriaFina, ...accesorios])
        : // En unidades manda lo accesible: por cada tourbillon se venden
          // decenas de pares de aros. Invertir esta proporción da un ticket
          // promedio de catorce millones, que nadie del rubro se cree.
          elegirPesado([
            [elegir(joyeriaFina), 34],
            [elegir(accesorios), 22],
            [elegir(clasicos), 20],
            [elegir(deportivos), 13],
            [elegir(servicios), 6],
            [elegir(altaJoyeria), 3],
            [elegir(altaRelojeria), 2],
          ]);

  piezas.push({ p: principal, cant: cliente.arquetipo === "corporativo" ? entre(1, 4) : 1 });

  // El accesorio que acompaña a la pieza: es el cross-sell que después el
  // dashboard tiene que poder descubrir solo.
  if (quizas(0.42)) piezas.push({ p: elegir(accesorios), cant: 1 });
  if (quizas(0.18)) piezas.push({ p: elegir(servicios), cant: 1 });

  return piezas;
}

for (const cliente of clientes) {
  let hace = cliente.primeraCompraHace;

  for (let n = 0; n < cliente.compras; n++) {
    const canal = quizas(cliente.probEcommerce) ? "ecommerce" : "pos";
    const piezas = piezasDeCompra(cliente, canal);
    const fecha = ajustarPorEstacionalidad(dias(hace));

    // El total es la suma exacta de las líneas. Aplicarle un multiplicador
    // dejaría la cabecera diciendo una cosa y el detalle otra, que es
    // exactamente el error que hace desconfiar de un dashboard entero.
    const total = piezas.reduce((s, it) => s + it.p.precio * it.cant, 0);

    // El e-commerce siempre identifica: hay cuenta, correo y despacho. El POS
    // depende de que el cliente dé el dato, y ahí está la brecha del negocio.
    const identificado = canal === "ecommerce" ? true : true;

    ordenes.push({
      contactId: cliente.id,
      fecha,
      total,
      canal: canal === "ecommerce" ? "E-commerce" : "Showroom",
      origen: canal,
      externalId: canal === "ecommerce" ? `WC-${ordenes.length + 1000}` : `RB-${ordenes.length + 5000}`,
      documento: canal === "ecommerce" ? "Boleta electrónica" : elegirPesado([["Boleta electrónica", 78], ["Factura electrónica", 22]]),
      numeroDocumento: String(entre(100000, 999999)),
      sucursal: canal === "ecommerce" ? "Tienda online" : elegirPesado(BOUTIQUES),
      identificado,
      metodoIdentificacion: canal === "ecommerce" ? "cuenta_web" : elegirPesado([["rut", 70], ["email", 18], ["telefono", 12]]),
      vendedor: canal === "ecommerce" ? null : elegir(ejecutivos).nombre,
      medioPago: canal === "ecommerce" ? elegirPesado([["Tarjeta de crédito", 70], ["Transferencia", 20], ["Webpay", 10]]) : elegirPesado(MEDIOS_PAGO_POS),
      piezas,
    });

    hace -= entre(cliente.intervalo[0], cliente.intervalo[1]);
    if (hace < 0) break;
  }
}

/**
 * Ventas de mostrador SIN cliente identificado.
 *
 * Es el corazón del diagnóstico. Un POS registra a la persona solo cuando la
 * persona lo pide: quien paga con tarjeta y se va no deja nada. Estas ventas
 * existen en la contabilidad y no existen en el CRM, y el dashboard tiene que
 * decirlo con un número, no con una nota al pie.
 */
const VENTAS_ANONIMAS = Math.round(ordenes.length * 0.55);
for (let i = 0; i < VENTAS_ANONIMAS; i++) {
  const hace = entre(1, DIAS_HISTORIA);
  const piezas = piezasDeCompra({ arquetipo: "ocasional" }, "pos");
  ordenes.push({
    contactId: null,
    fecha: ajustarPorEstacionalidad(dias(hace)),
    total: piezas.reduce((s, it) => s + it.p.precio * it.cant, 0),
    canal: "Showroom",
    origen: "pos",
    externalId: `RB-${50000 + i}`,
    documento: "Boleta electrónica",
    numeroDocumento: String(entre(100000, 999999)),
    sucursal: elegirPesado(BOUTIQUES),
    identificado: false,
    metodoIdentificacion: null,
    vendedor: elegir(ejecutivos).nombre,
    medioPago: elegirPesado(MEDIOS_PAGO_POS),
    piezas,
  });
}

const idsOrdenes = await insertarLote(
  "crm_orders",
  [
    "contact_id", "fecha", "total", "canal", "origen", "external_id", "documento",
    "numero_documento", "sucursal", "identificado", "metodo_identificacion",
    "vendedor", "medio_pago",
  ],
  ordenes.map((o) => [
    o.contactId, o.fecha, o.total, o.canal, o.origen, o.externalId, o.documento,
    o.numeroDocumento, o.sucursal, o.identificado, o.metodoIdentificacion,
    o.vendedor, o.medioPago,
  ]),
);

for (let i = 0; i < ordenes.length; i++) {
  for (const it of ordenes[i].piezas) {
    lineasPorOrden.push([idsOrdenes[i], it.p.id, it.cant, it.p.precio]);
  }
}
await insertarLote(
  "crm_order_items",
  ["order_id", "product_id", "cantidad", "precio_unitario"],
  lineasPorOrden,
);

const identificadas = ordenes.filter((o) => o.identificado).length;
console.log(
  `✓ ${ordenes.length} ventas (${lineasPorOrden.length} líneas) · ` +
    `${Math.round((identificadas / ordenes.length) * 100)}% identificadas · ` +
    `${ordenes.filter((o) => o.origen === "ecommerce").length} del e-commerce`,
);

// ─── Visitas al showroom ─────────────────────────────────────────────────────

const INTERESES = [
  "Alta relojería", "Relojes deportivos", "Relojes clásicos", "Alta joyería",
  "Joyería fina", "Anillo de compromiso", "Regalo", "Servicio y mantención",
];
const EVENTOS = [null, null, null, "Velada de coleccionistas", "Lanzamiento colección", "Feria del reloj"];

const visitas = [];
for (let i = 0; i < 180; i++) {
  const hace = entre(0, 120);
  const nombre = `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`;
  const dejoTelefono = quizas(0.88);
  const dejoEmail = quizas(0.7);
  const consentimiento = (dejoTelefono || dejoEmail) && quizas(0.76);
  // Estado según antigüedad: lo de esta semana está pendiente, lo viejo ya se
  // trabajó. Una bandeja donde todo lleva cuatro meses pendiente se lee como un
  // sistema que nadie usa.
  const estado =
    hace <= 4
      ? "pendiente"
      : elegirPesado([["contactado", 45], ["convertido", 18], ["descartado", 25], ["pendiente", 12]]);

  visitas.push([
    nombre,
    dejoTelefono ? `569${entre(30000000, 99999999)}` : null,
    dejoEmail ? `${sinTildes(nombre.split(" ")[0].toLowerCase())}${entre(1, 99)}@correo.cl` : null,
    elegir(INTERESES),
    quizas(0.4) ? "Pidió que le avisen cuando llegue la próxima colección." : null,
    elegirPesado(BOUTIQUES),
    elegirPesado([["qr", 62], ["tablet", 28], ["evento", 10]]),
    elegir(EVENTOS),
    consentimiento,
    consentimiento ? dias(hace) : null,
    elegir(ejecutivos).id,
    estado,
    dias(hace),
  ]);
}

await insertarLote(
  "crm_showroom_visitas",
  [
    "nombre", "telefono", "email", "interes", "detalle", "boutique", "medio",
    "evento", "consentimiento", "consentimiento_en", "atendido_por", "estado",
    "created_at",
  ],
  visitas,
);
console.log(`✓ ${visitas.length} visitas al showroom`);

// ─── Ajustes finales ─────────────────────────────────────────────────────────

// El estado del contacto se deriva de su última compra: quien no vuelve hace más
// de dos años está inactivo, y decirlo es la mitad del valor del CRM.
await sql`
  UPDATE crm_contacts c SET estado = CASE
    WHEN u.ultima IS NULL THEN 'prospecto'
    WHEN u.ultima < NOW() - INTERVAL '730 days' THEN 'inactivo'
    ELSE 'cliente'
  END
  FROM (SELECT contact_id, MAX(fecha) AS ultima FROM crm_orders WHERE contact_id IS NOT NULL GROUP BY contact_id) u
  WHERE u.contact_id = c.id
`;

const resumen = await sql`
  SELECT
    (SELECT COUNT(*) FROM crm_contacts)::int AS clientes,
    (SELECT COUNT(*) FROM crm_orders)::int AS ventas,
    (SELECT COUNT(*) FROM crm_orders WHERE identificado)::int AS identificadas,
    (SELECT COUNT(DISTINCT contact_id) FROM crm_orders WHERE origen = 'ecommerce')::int AS clientes_web,
    (SELECT COALESCE(SUM(total),0)::float8 FROM crm_orders) AS facturacion
`;
const r = resumen[0];

console.log("\n✓ Base de analítica lista.");
console.log(`  ${r.clientes} clientes · ${r.ventas} ventas · $${Math.round(r.facturacion).toLocaleString("es-CL")}`);
console.log(`  ${Math.round((r.identificadas / r.ventas) * 100)}% de las ventas tiene cliente identificado`);
console.log(`  ${r.clientes_web} clientes compraron alguna vez en el e-commerce`);
