// Base de demostración de Highend Chile.
//
// Reemplaza el mock masivo por uno del tamaño del negocio real: **tres o cuatro
// ventas al mes**. Son 156 ventas y 76 clientes en cuatro años, contra las 3.503
// y 1.200 de la versión anterior.
//
// El cambio de escala no es cosmético, cambia qué es verdad:
//
//   · **La venta grande SIEMPRE queda identificada.** Nadie vende parlantes de
//     veintiocho millones sin saber a quién. La brecha de datos del mock
//     anterior —la mitad de las boletas sin cliente— acá sería mentira, y una
//     mentira que el cliente detecta en la primera reunión.
//   · **El hueco está antes de la venta, no en ella.** A este showroom entra
//     gente a escuchar dos horas y se va sin comprar; vuelve a los seis meses.
//     Esa persona no deja ningún rastro, y es el dato que falta de verdad. Por
//     eso acá hay más visitas que ventas: es la proporción real y es el
//     argumento honesto para la captura en showroom.
//   · **La compra sigue la cadena.** Un sistema se arma por partes: fuente,
//     previo, etapa, parlantes, soporte. El que compró los parlantes vuelve por
//     la etapa, no por otros parlantes. La recompra de este rubro es upgrade,
//     no reposición, y el mock tiene que reproducirlo o el módulo de sistemas
//     no encuentra nada.
//   · **Sin estacionalidad de retail.** Diciembre no mueve la aguja en un
//     negocio donde nadie regala un amplificador de doce millones. Lo que sí
//     pesa son las ferias y las llegadas de producto.
//
// Determinístico: semilla fija, dos corridas dan lo mismo.
//
// Requiere el catálogo cargado: node scripts/crm-catalogo-highend.mjs
//
// Uso:
//   node scripts/crm-seed-highend.mjs            siembra
//   node scripts/crm-seed-highend.mjs --limpiar  borra solo lo de este seed

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
/**
 * Cuatro años de historia, no tres.
 *
 * El motivo es concreto. El corte más bajo de recencia del RFM es "más de tres
 * años sin comprar", y con exactamente tres años de datos esa fila queda vacía
 * **por construcción**: nadie puede tener más recencia que la que alcanza la
 * base. La matriz salía con una fila en blanco que se lee como un error del
 * sistema y no como lo que era.
 *
 * La tentación era mover el corte a dos años y medio para que se llenara. Eso
 * habría sido deformar el modelo para que el mock se viera bien, que es
 * exactamente el error contra el que están escritos los cortes absolutos. El
 * corte está bien para el rubro; lo que estaba corto era la historia.
 */
const DIAS_HISTORIA = 1460; // cuatro años

// ─── Limpieza ────────────────────────────────────────────────────────────────

async function limpiar() {
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
  console.error("No hay catálogo. Corre antes: node scripts/crm-catalogo-highend.mjs");
  process.exit(1);
}

const porCategoria = (c) => productos.filter((p) => p.categoria === c);

/** La cadena del sistema. El orden es el orden en que se arma. */
const ESLABONES = {
  fuente: [...porCategoria("Audio Digital"), ...porCategoria("Audio Análogo")],
  previo: porCategoria("Preamplificadores"),
  etapa: porCategoria("Amplificadores"),
  parlantes: porCategoria("Parlantes y Cine"),
  soporte: [
    ...porCategoria("Cables de Audio"),
    ...porCategoria("Acondicionador de Potencia"),
    ...porCategoria("Racks y Antivibración"),
    ...porCategoria("Tubos y Válvulas"),
  ],
};
const SISTEMAS = porCategoria("Sistemas Highend");
const VIDEO = porCategoria("Audio Video");

/** Los accesorios de verdad: bajo el millón. Es lo que se lleva de paso. */
const MENUDOS = productos.filter((p) => p.precio < 1_000_000);

/** Corta un eslabón por tramo de precio, para que el sistema sea coherente. */
function delEslabon(eslabon, nivel) {
  const lista = ESLABONES[eslabon] ?? [];
  if (!lista.length) return null;
  const ordenados = [...lista].sort((a, b) => a.precio - b.precio);
  // nivel 0 = entrada, 1 = medio, 2 = referencia
  const tercio = Math.ceil(ordenados.length / 3);
  const tramo = ordenados.slice(nivel * tercio, (nivel + 1) * tercio);
  return elegir(tramo.length ? tramo : ordenados);
}

// ─── Personas ────────────────────────────────────────────────────────────────

const NOMBRES = [
  "Agustín", "Alejandra", "Alfonso", "Andrés", "Arturo", "Beatriz", "Benjamín",
  "Camila", "Carlos", "Carolina", "Cecilia", "Clemente", "Cristóbal", "Daniela",
  "Diego", "Eduardo", "Enrique", "Esteban", "Felipe", "Fernanda", "Francisca",
  "Francisco", "Gabriel", "Gonzalo", "Ignacio", "Javiera", "Joaquín", "Juan Pablo",
  "Lucas", "Macarena", "Manuel", "Marcelo", "Martín", "Matías", "Nicolás", "Paula",
  "Pedro", "Rafael", "Raimundo", "Ricardo", "Roberto", "Rodrigo", "Sebastián",
  "Sergio", "Tomás", "Valentina", "Vicente", "Víctor", "Ximena",
];

const APELLIDOS = [
  "Errázuriz", "Undurraga", "Larraín", "Fernández", "Amenábar", "Montt",
  "Izquierdo", "Valdés", "Correa", "Cruzat", "Guzmán", "Ovalle", "Edwards",
  "Balmaceda", "Subercaseaux", "Irarrázabal", "Ruiz-Tagle", "Echenique",
  "Vicuña", "Barros", "Concha", "Bulnes", "Alessandri", "Vergara", "Prieto",
  "Ossa", "Silva", "Rojas", "Muñoz", "González", "Contreras", "Sepúlveda",
  "Espinoza", "Bravo", "Fuenzalida", "Lira", "Solar", "Riesco", "Prado", "Vial",
  "Costa", "Toro", "Marín", "Pizarro", "Hurtado", "Domínguez", "Zegers", "Matte",
];

const COMUNAS = [
  ["Vitacura", 20], ["Las Condes", 24], ["Lo Barnechea", 18], ["Providencia", 11],
  ["La Reina", 5], ["Ñuñoa", 4], ["Viña del Mar", 6], ["Concón", 2],
  ["Concepción", 3], ["Antofagasta", 2], ["Puerto Varas", 2], ["La Serena", 2],
  ["Temuco", 1],
];

const FUENTES = [
  ["Showroom", 24], ["Referido", 26], ["Instagram", 10], ["Google", 12],
  ["Foro de audio", 9], ["Feria / evento", 8], ["E-commerce", 8], ["Prensa especializada", 3],
];

/**
 * Arquetipos del audiófilo, y cuántos hay de cada uno.
 *
 * La diferencia con el retail común está en la mitad de abajo de la tabla: acá
 * el que vuelve, vuelve para SUBIR, no para reponer. El `nivel` es el tramo de
 * catálogo en el que se mueve y es lo que hace que un sistema se vea coherente
 * —nadie pone parlantes de treinta millones con una etapa de cuatro.
 *
 *   clave, peso, compras, días entre compras, nivel, prob. e-commerce
 */
const ARQUETIPOS = [
  // Entró, armó su sistema de una vez y quedó feliz. Es el más común.
  ["sistema_unico", 34, [1, 1], [0, 0], 1, 0.10],
  // Compró un componente suelto y no volvió.
  ["una_pieza", 20, [1, 1], [0, 0], 0, 0.30],
  // Arma por partes, con calma. El corazón del negocio.
  ["armando", 22, [2, 3], [240, 540], 1, 0.18],
  // Cambia componentes cada tanto: el upgrade permanente.
  ["upgrader", 13, [3, 5], [180, 380], 2, 0.20],
  // El audiófilo de referencia. Pocos, y son la mitad de la facturación.
  ["referencia", 5, [5, 8], [120, 260], 2, 0.12],
  // Solo cables, válvulas y aisladores. Ticket chico, viene seguido.
  ["accesorista", 6, [2, 4], [90, 220], 0, 0.55],
];

const BOUTIQUES = [["Showroom Vitacura", 82], ["Sala de audición", 18]];

const MEDIOS_PAGO_POS = [
  ["Transferencia", 46], ["Tarjeta de crédito", 30], ["Crédito directo", 14],
  ["Tarjeta de débito", 7], ["Efectivo", 3],
];

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
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ─── Clientes ────────────────────────────────────────────────────────────────

// Calibrado hacia atrás desde el dato que dio el cliente: tres a cuatro ventas
// al mes. Son unas 120 en tres años, y con esta mezcla de arquetipos eso da
// poco menos de sesenta personas. Fijar los clientes y ver qué ventas salen
// sería al revés: el número que el negocio conoce es el de ventas.
const TOTAL_CLIENTES = 76;
const clientes = [];
const usados = new Set();

for (let i = 0; i < TOTAL_CLIENTES; i++) {
  let nombre;
  let intentos = 0;
  do {
    nombre = `${elegir(NOMBRES)} ${elegir(APELLIDOS)} ${elegir(APELLIDOS)}`;
    intentos++;
  } while (usados.has(nombre) && intentos < 12);
  usados.add(nombre);

  const config = elegirPesado(ARQUETIPOS.map((a) => [a, a[1]]));
  const [arquetipo, , rangoCompras, intervalo, nivel, probEcommerce] = config;

  const antiguedad = Math.floor(DIAS_HISTORIA * Math.pow(rnd(), 0.95));

  // Contactabilidad alta: acá el vendedor conoce a cada cliente por nombre.
  // Mostrar un 30% de fichas sin teléfono sería inventar un problema que este
  // negocio no tiene, y el gerente lo sabría al mirar la pantalla.
  const tieneEmail = quizas(0.9);
  const tieneTelefono = quizas(0.95);
  const consentimiento = (tieneEmail || tieneTelefono) && quizas(0.72);

  clientes.push({
    nombre,
    arquetipo,
    compras: entre(rangoCompras[0], rangoCompras[1]),
    intervalo,
    nivel,
    probEcommerce,
    primeraCompraHace: Math.min(DIAS_HISTORIA - 1, antiguedad),
    ciudad: elegirPesado(COMUNAS),
    fuente: elegirPesado(FUENTES),
    ownerId: elegir(ejecutivos).id,
    rut: rutChileno(entre(6_000_000, 26_000_000)),
    tieneEmail,
    tieneTelefono,
    consentimiento,
    optIn: consentimiento && quizas(0.9),
  });
}

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
  const etiquetas = [];
  if (c.arquetipo === "referencia") etiquetas.push("Referencia", "VIP");
  if (c.arquetipo === "upgrader") etiquetas.push("Upgrade activo");
  if (c.arquetipo === "accesorista") etiquetas.push("Accesorios");

  return [
    c.nombre,
    c.tieneEmail
      ? `${usuario}${entre(1, 99)}@${elegir(["gmail.com", "correo.cl", "outlook.com", "vtr.net"])}`
      : null,
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
    new Date(Date.UTC(1970 + entre(0, 40), entre(0, 11), entre(1, 28))),
    JSON.stringify(etiquetas),
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

/**
 * Qué compra este cliente en su compra número `n`.
 *
 * Acá está la regla del rubro: la primera compra define el nivel del sistema y
 * las siguientes van llenando los eslabones que faltan, en el orden en que se
 * arma un equipo. Cuando ya no falta nada, el cliente pasa a mejorar lo que
 * tiene —cambia la etapa, sube de fuente— que es exactamente lo que hace un
 * audiófilo de verdad.
 */
function piezasDeCompra(cliente, n, canal) {
  const piezas = [];

  if (canal === "ecommerce") {
    // Online se venden accesorios y algún componente de entrada. Nadie compra
    // un preamplificador de veinticuatro millones por carrito web.
    piezas.push({ p: elegir(MENUDOS), cant: quizas(0.25) ? 2 : 1 });
    if (quizas(0.3)) piezas.push({ p: elegir(MENUDOS), cant: 1 });
    return piezas;
  }

  if (cliente.arquetipo === "accesorista") {
    piezas.push({ p: elegir(MENUDOS), cant: entre(1, 3) });
    if (quizas(0.35)) piezas.push({ p: elegir(MENUDOS), cant: 1 });
    return piezas;
  }

  /**
   * El salto de nivel que desequilibra el sistema.
   *
   * Uno de cada cuatro compra la pieza por sobre su nivel habitual —los
   * parlantes que escuchó y no pudo dejar de escuchar— y la mueve con lo que
   * ya tenía. Ese desbalance es de verdad la conversación de venta más común
   * del rubro, y sin modelarlo el detector de eslabón débil nunca encuentra
   * nada: los sistemas salen todos prolijos, que es justo lo que no pasa.
   */
  const nivelDe = (base) => (quizas(0.25) ? Math.min(2, base + 1) : base);

  // Primera compra: o se lleva un sistema completo, o entra por un eslabón.
  if (n === 0) {
    if (cliente.arquetipo === "sistema_unico" && quizas(0.55)) {
      piezas.push({ p: elegir(SISTEMAS), cant: 1 });
    } else {
      // Por dónde entra la gente al rubro: casi siempre por los parlantes o
      // por la fuente. Nadie parte comprando un preamplificador solo.
      const entrada = elegirPesado([
        ["parlantes", 38], ["fuente", 30], ["etapa", 18], ["previo", 8], ["soporte", 6],
      ]);
      cliente.eslabones = new Set([entrada]);
      // Se entra fuerte: la pieza por la que alguien llega a este rubro suele
      // ser la que escuchó y lo convenció, no la prudente.
      piezas.push({ p: delEslabon(entrada, nivelDe(cliente.nivel)), cant: 1 });
    }
    if (quizas(0.45)) piezas.push({ p: elegir(MENUDOS), cant: 1 });
    return piezas;
  }

  // Compras siguientes: completar la cadena antes que repetir.
  const tiene = cliente.eslabones ?? new Set();
  const faltantes = ["fuente", "previo", "etapa", "parlantes"].filter((e) => !tiene.has(e));

  if (faltantes.length && quizas(0.75)) {
    const siguiente = faltantes[0];
    tiene.add(siguiente);
    cliente.eslabones = tiene;
    piezas.push({ p: delEslabon(siguiente, nivelDe(cliente.nivel)), cant: 1 });
  } else if (quizas(0.35)) {
    // Ya está completo: sube de nivel en un eslabón que ya tiene.
    const eslabon = elegir([...tiene]);
    piezas.push({ p: delEslabon(eslabon, Math.min(2, cliente.nivel + 1)), cant: 1 });
  } else {
    // O se lleva soporte: cables, acondicionador, aisladores.
    piezas.push({ p: delEslabon("soporte", cliente.nivel), cant: 1 });
  }

  if (quizas(0.5)) piezas.push({ p: elegir(MENUDOS), cant: 1 });
  return piezas;
}

for (const cliente of clientes) {
  let hace = cliente.primeraCompraHace;

  for (let n = 0; n < cliente.compras; n++) {
    const canal = quizas(cliente.probEcommerce) ? "ecommerce" : "pos";
    const piezas = piezasDeCompra(cliente, n, canal).filter((it) => it.p);
    if (!piezas.length) continue;

    const fecha = dias(hace);
    const total = piezas.reduce((s, it) => s + it.p.precio * it.cant, 0);

    ordenes.push({
      contactId: cliente.id,
      fecha,
      total,
      canal: canal === "ecommerce" ? "E-commerce" : "Showroom",
      origen: canal,
      externalId: canal === "ecommerce" ? `WC-${1000 + ordenes.length}` : `RB-${5000 + ordenes.length}`,
      documento:
        canal === "ecommerce"
          ? "Boleta electrónica"
          : elegirPesado([["Factura electrónica", 58], ["Boleta electrónica", 42]]),
      numeroDocumento: String(entre(100000, 999999)),
      sucursal: canal === "ecommerce" ? "Tienda online" : elegirPesado(BOUTIQUES),
      identificado: true,
      metodoIdentificacion:
        canal === "ecommerce" ? "cuenta_web" : elegirPesado([["rut", 82], ["email", 10], ["telefono", 8]]),
      vendedor: canal === "ecommerce" ? null : elegir(ejecutivos).nombre,
      medioPago:
        canal === "ecommerce"
          ? elegirPesado([["Webpay", 45], ["Transferencia", 40], ["Tarjeta de crédito", 15]])
          : elegirPesado(MEDIOS_PAGO_POS),
      piezas,
    });

    hace -= entre(cliente.intervalo[0], cliente.intervalo[1]);
    if (hace < 0) break;
  }
}

/**
 * Las pocas ventas sin cliente identificado.
 *
 * Acá va contra el mock anterior a propósito. En un negocio de ticket alto la
 * venta grande **siempre** queda con nombre: hay factura, hay despacho, hay
 * instalación, y muchas veces hay crédito directo. Decir que la mitad de las
 * boletas sale sin cliente sería un diagnóstico falso, y falso a favor nuestro,
 * que es la peor clase.
 *
 * Lo que sí sale sin registrar es la venta de mostrador chica: un juego de
 * válvulas, un cable de poder, un set de aisladores. Poca plata y algunos
 * clientes que el CRM no ve. Es un problema real y de tamaño real.
 */
const VENTAS_ANONIMAS = 12;
for (let i = 0; i < VENTAS_ANONIMAS; i++) {
  const piezas = [{ p: elegir(MENUDOS), cant: entre(1, 2) }];
  ordenes.push({
    contactId: null,
    fecha: dias(entre(1, DIAS_HISTORIA)),
    total: piezas.reduce((s, it) => s + it.p.precio * it.cant, 0),
    canal: "Showroom",
    origen: "pos",
    externalId: `RB-${9000 + i}`,
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

ordenes.sort((a, b) => a.fecha - b.fecha);

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
  `✓ ${ordenes.length} ventas en ${(DIAS_HISTORIA / 365).toFixed(0)} años ` +
    `(${(ordenes.length / (DIAS_HISTORIA / 30.4)).toFixed(1)} al mes) · ` +
    `${Math.round((identificadas / ordenes.length) * 100)}% identificadas`,
);

// ─── Visitas al showroom ─────────────────────────────────────────────────────

/**
 * Acá está el verdadero hueco de datos, y por eso hay más visitas que ventas.
 *
 * A este showroom entra alguien, se sienta dos horas a escuchar un sistema de
 * veinte millones, agradece y se va. Vuelve en seis meses. En el intertanto no
 * existe para nadie: no hay boleta, no hay ficha, no hay forma de escribirle
 * cuando llega el modelo que estaba esperando.
 *
 * Con tres ventas al mes, **cada visita perdida pesa**. Recuperar dos al año
 * paga el sistema completo, y ese es el cálculo que hay que poder mostrar.
 */
const INTERESES = [
  "Parlantes y Cine", "Amplificadores", "Audio Digital", "Audio Análogo",
  "Preamplificadores", "Sistemas Highend", "Cables de Audio", "Sala de audición",
  "Acondicionador de Potencia", "Todavía no lo sé",
];
const EVENTOS = [
  null, null, null, null,
  "Audición Børresen", "Llegada Accuphase", "Feria Audio Show", "Demo Aurender",
];

const visitas = [];
for (let i = 0; i < 78; i++) {
  const hace = entre(0, 150);
  const nombre = `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`;
  const dejoTelefono = quizas(0.9);
  const dejoEmail = quizas(0.74);
  const consentimiento = (dejoTelefono || dejoEmail) && quizas(0.8);
  // La conversión es baja y lenta a propósito: acá la decisión toma meses.
  const estado =
    hace <= 7
      ? "pendiente"
      : elegirPesado([["contactado", 52], ["convertido", 9], ["descartado", 27], ["pendiente", 12]]);

  visitas.push([
    nombre,
    dejoTelefono ? `569${entre(30000000, 99999999)}` : null,
    dejoEmail ? `${sinTildes(nombre.split(" ")[0].toLowerCase())}${entre(1, 99)}@correo.cl` : null,
    elegir(INTERESES),
    quizas(0.45)
      ? elegir([
          "Escuchó el sistema de referencia. Quiere volver con su señora.",
          "Está comparando contra otra marca. Pidió precio por escrito.",
          "Tiene equipo antiguo, evalúa renovar la etapa.",
          "Espera la llegada del modelo nuevo para decidir.",
          "Consultó por financiamiento en cuotas.",
        ])
      : null,
    elegirPesado(BOUTIQUES),
    elegirPesado([["qr", 58], ["tablet", 30], ["evento", 12]]),
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
console.log(`✓ ${visitas.length} visitas al showroom en 5 meses`);

// ─── Ajustes finales ─────────────────────────────────────────────────────────

// El corte de "inactivo" es a tres años, no a dos: el ciclo de este rubro es
// largo y alguien que compró hace dos años sigue siendo un cliente vivo.
await sql`
  UPDATE crm_contacts c SET estado = CASE
    WHEN u.ultima IS NULL THEN 'prospecto'
    WHEN u.ultima < NOW() - INTERVAL '1095 days' THEN 'inactivo'
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
    (SELECT COUNT(*) FROM crm_orders WHERE fecha >= NOW() - INTERVAL '12 months')::int AS ventas12m,
    (SELECT COALESCE(SUM(total),0)::float8 FROM crm_orders WHERE fecha >= NOW() - INTERVAL '12 months') AS facturacion12m,
    (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total)::float8 FROM crm_orders) AS ticket_mediana,
    (SELECT COALESCE(SUM(total),0)::float8 FROM crm_orders) AS facturacion,
    (SELECT COUNT(*) FROM crm_showroom_visitas)::int AS visitas
`;
const r = resumen[0];
const clp = (n) => "$" + Math.round(n).toLocaleString("es-CL");

console.log("\n✓ Base de Highend Chile lista.");
console.log(`  ${r.clientes} clientes · ${r.ventas} ventas · ${clp(r.facturacion)} en cuatro años`);
console.log(`  Últimos 12 meses: ${r.ventas12m} ventas (${(r.ventas12m / 12).toFixed(1)}/mes) · ${clp(r.facturacion12m)}`);
console.log(`  Ticket mediano: ${clp(r.ticket_mediana)}`);
console.log(`  ${Math.round((r.identificadas / r.ventas) * 100)}% de las ventas tiene cliente identificado`);
// La comparación tiene que ser sobre la misma ventana o no dice nada: las
// visitas son de cinco meses y las ventas del año, así que se anualiza.
const visitasAlAnio = (r.visitas / 5) * 12;
console.log(
  `  ${r.visitas} visitas en 5 meses ≈ ${Math.round(visitasAlAnio)} al año, ` +
    `${(visitasAlAnio / r.ventas12m).toFixed(1)}x las ventas`,
);
console.log(`\n  Por cada venta entran ${(visitasAlAnio / r.ventas12m).toFixed(1)} personas al showroom.`);
console.log(`  Ahí está el dato que hoy no existe en ninguna parte.`);
