// Siembra datos de demostración del Sistema Tuniche.
//
// **Por qué agricultores inventados y no los reales.** Los 34 agricultores
// cargados son empresas que existen. Colgarles una nota agronómica falsa sería
// crear un registro que dice cosas sobre el campo de alguien —y a los tres
// clics nadie distingue esa ficha de una de verdad. Es exactamente lo que pasó
// en el CRM de CDC, y la razón por la que existe `lib/modulos.ts`.
//
// Todo lo que crea este script lleva `demo = TRUE` en su fila, la pantalla lo
// marca, y `--limpiar` lo borra entero sin tocar un solo dato real.
//
// Uso:
//   node scripts/tuniche-demo.mjs            siembra (borra el demo anterior)
//   node scripts/tuniche-demo.mjs --limpiar  solo borra

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

// ─── Limpieza ────────────────────────────────────────────────────────────────
//
// El orden importa: informes y fotos apuntan a visitas, y las visitas a lotes.
// Y **solo se borra lo marcado**: un DELETE sin el WHERE se llevaría los 34
// agricultores reales por delante.

async function limpiar() {
  const fotos = await sql`
    DELETE FROM tuniche_fotos
    WHERE visita_id IN (SELECT id FROM tuniche_visitas WHERE demo = TRUE)
    RETURNING id`;
  const informes = await sql`DELETE FROM tuniche_informes WHERE demo = TRUE RETURNING id`;
  const visitas = await sql`DELETE FROM tuniche_visitas WHERE demo = TRUE RETURNING id`;
  const lotes = await sql`DELETE FROM tuniche_lotes WHERE demo = TRUE RETURNING id`;
  const agr = await sql`DELETE FROM tuniche_agricultores WHERE demo = TRUE RETURNING id`;
  console.log(
    `· borrado: ${agr.length} agricultores, ${lotes.length} lotes, ${visitas.length} visitas, ` +
      `${fotos.length} fotos, ${informes.length} informes`,
  );
}

await limpiar();
if (process.argv.includes("--limpiar")) {
  const reales = await sql`SELECT count(*)::int AS n FROM tuniche_agricultores WHERE demo = FALSE`;
  console.log(`✓ demo limpio. ${reales[0].n} agricultores reales intactos.`);
  process.exit(0);
}

// ─── Fotos ───────────────────────────────────────────────────────────────────
//
// SVG embebido y no una foto de banco de imágenes. Una foto ajena de un maizal
// que no es el de nadie se ve "real" en la pantalla y por lo tanto miente; un
// recuadro que dice FOTO DE DEMOSTRACIÓN no. En una reunión de venta eso además
// juega a favor: nadie se pregunta de qué campo es esa foto.

function foto(etiqueta, tono) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="440">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="${tono[0]}"/><stop offset="1" stop-color="${tono[1]}"/>
</linearGradient></defs>
<rect width="600" height="440" fill="url(#g)"/>
<g fill="#ffffff" opacity="0.22">
${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 68 + 12}" y="250" width="26" height="190" rx="12"/>`).join("")}
</g>
<rect x="0" y="0" width="600" height="64" fill="#16211a" opacity="0.62"/>
<text x="24" y="41" font-family="Helvetica,Arial,sans-serif" font-size="21" fill="#ffffff" letter-spacing="1.5">FOTO DE DEMOSTRACIÓN</text>
<text x="24" y="418" font-family="Helvetica,Arial,sans-serif" font-size="26" fill="#ffffff" font-weight="bold">${etiqueta}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const FOTOS = {
  general: foto("Vista general del lote", ["#4e8f5f", "#2f6f4e"]),
  hembra: foto("Línea hembra", ["#5c9c6b", "#356d4b"]),
  macho: foto("Línea macho", ["#7aa86a", "#4a7c48"]),
  dron: foto("Vuelo de dron", ["#3f7d76", "#245c58"]),
};

// ─── Maestra de demostración ─────────────────────────────────────────────────

const AGRICULTORES = [
  {
    k: "aromos",
    area: "mn",
    razonSocial: "DEMO · Agrícola Los Aromos SpA",
    nombreContacto: "Rodrigo Demo Fuenzalida",
    // Prefijo 9 0000 — no corresponde a un rango móvil chileno en uso. Aun así,
    // enviar está bloqueado por código para toda fila de demo: ver más abajo.
    telefono: "56900000101",
    email: "demo.aromos@example.invalid",
    localidad: "MELIPILLA",
    region: "Región Metropolitana",
    distribuidor: "COOP. AGRICOLA LECHERA SANTIAGO LTDA (CALS)",
    zonalNombre: "Francisco Pinochet",
  },
  {
    k: "peumo",
    area: "mn",
    razonSocial: "DEMO · Sociedad Agrícola El Peumo Ltda.",
    nombreContacto: "Marcela Demo Ibáñez",
    telefono: "56900000102",
    email: "demo.peumo@example.invalid",
    localidad: "TALAGANTE",
    region: "Región Metropolitana",
    distribuidor: "SO AGRICOLTURA",
    zonalNombre: "Francisco Pinochet",
  },
  {
    k: "perdices",
    area: "altue",
    razonSocial: "DEMO · Fundo Las Perdices",
    nombreContacto: "Hernán Demo Cerda",
    telefono: "56900000201",
    email: "demo.perdices@example.invalid",
    localidad: "LONGAVI",
    region: "Región del Maule",
    distribuidor: null,
    zonalNombre: "JOSE CASANOVA",
  },
  {
    k: "rioclaro",
    area: "altue",
    razonSocial: "DEMO · Agrícola Río Claro",
    nombreContacto: "Paula Demo Vergara",
    telefono: "56900000202",
    email: "demo.rioclaro@example.invalid",
    localidad: "VILCHES",
    region: "Región del Maule",
    distribuidor: null,
    zonalNombre: "CARLOS MANCILLA",
  },
];

const CLIENTE_DEMO = "DEMO Seeds International BV";

const LOTES = [
  { k: "mn1", ag: "aromos", area: "mn", codigo: "DEMO-MN-01", temporada: "2026", cultivo: "Maíz",
    variedad: "TUNICHE 2775", hectareas: "12.00", objetivo: "500 bolsas", tipoSemilla: "Silero",
    clienteFinal: "COOP. AGRICOLA LECHERA SANTIAGO LTDA (CALS)", etapaActual: "v6" },
  { k: "mn2", ag: "aromos", area: "mn", codigo: "DEMO-MN-02", temporada: "2026", cultivo: "Maíz",
    variedad: "DRAVA 700", hectareas: "8.00", objetivo: "260 bolsas", tipoSemilla: "Growtech Silo",
    clienteFinal: "COOP. AGRICOLA LECHERA SANTIAGO LTDA (CALS)", etapaActual: "v4" },
  { k: "mn3", ag: "peumo", area: "mn", codigo: "DEMO-MN-03", temporada: "2026", cultivo: "Maíz",
    variedad: "TUNICHE 2711", hectareas: "15.00", objetivo: "420 bolsas", tipoSemilla: "Grano",
    clienteFinal: "SO AGRICOLTURA", etapaActual: "emergencia" },
  { k: "al1", ag: "perdices", area: "altue", codigo: "DEMO-ALT-01", temporada: "2026-2027",
    cultivo: "CABBAGE", variedad: "CCB-27040", relacionHm: "2:2", hectareas: "3.50",
    objetivo: "550 kg/ha", clienteFinal: CLIENTE_DEMO, idase: "119999", etapaActual: "floracion",
    hitos: { fecha_plantacion_hembra: "2026-03-18", fecha_plantacion_macho_1: "2026-03-16",
             establecimiento_hembra: 36800, establecimiento_macho_1: 35200 } },
  { k: "al2", ag: "rioclaro", area: "altue", codigo: "DEMO-ALT-02", temporada: "2026-2027",
    cultivo: "WHITE CABBAGE", variedad: "WH505", relacionHm: "4:2", hectareas: "2.20",
    objetivo: "400 kg/ha", clienteFinal: CLIENTE_DEMO, idase: "119998", etapaActual: "trasplante",
    hitos: { fecha_plantacion_hembra: "2026-03-25", fecha_plantacion_macho_1: "2026-03-25",
             establecimiento_hembra: 38100, establecimiento_macho_1: 38100 } },
];

// ─── Visitas ─────────────────────────────────────────────────────────────────
//
// Escritas como hablaría un zonal por audio: frases a medias, muletillas y el
// vocabulario del rubro. Una demo con prosa de folleto no demuestra nada —lo
// que hay que mostrar es que el sistema entiende cómo habla la gente en la
// camioneta—.
//
// Las notas suben y bajan a propósito: DEMO-MN-03 arrastra un problema de
// emergencia dispareja y su nota lo refleja. Un historial donde todo sale 90%
// no deja ver para qué sirve el historial.

const VISITAS = [
  { lote: "mn1", dias: 96, etapa: "Presiembra", nota: 78,
    t: "Ya, estoy en Los Aromos, el lote uno. Vengo llegando de recorrer, el suelo quedó bien preparado, mullido parejo. Humedad justa para entrar a sembrar la próxima semana. Presión de maleza baja todavía, algo de hoja ancha en la orilla del canal nomás. Le pongo un setenta y ocho de nota. Hay que definir el herbicida de presiembra.",
    datos: { riego: "bien", malezas_presion: "baja", malezas_tipo: ["hoja ancha"], sanidad: "sano",
      comentario: "Suelo mullido parejo, humedad justa. Algo de hoja ancha en la orilla del canal.",
      proximas_acciones: ["Definir herbicida de presiembra", "Sembrar la próxima semana"] },
    resumen: "Suelo bien preparado y con humedad adecuada para sembrar la próxima semana. Presión de maleza baja, localizada en la orilla del canal. Queda definir el herbicida de presiembra.",
    fotos: ["general"] },

  { lote: "mn1", dias: 62, etapa: "Emergencia", nota: 88,
    t: "Los Aromos lote uno. Emergió parejo, a los siete días, muy bueno el color de la planta, verde intenso. Conté como setenta y seis mil plantas por hectárea. No vi insectos. El riego funcionando bien, el pivote andando sin problema. Noventa... no, ponle ochenta y ocho.",
    datos: { riego: "bien", malezas_presion: "baja", sanidad: "sano",
      comentario: "Emergencia a los 7 días, color verde intenso, cerca de 76.000 pl/ha.",
      proximas_acciones: ["Monitorear presión de maleza para el post emergente"] },
    resumen: "Emergencia pareja a los siete días con muy buen color de planta y una población cercana a 76.000 pl/ha. Riego operando sin problemas y sin presencia de insectos.",
    fotos: ["general", "dron"] },

  { lote: "mn1", dias: 28, etapa: "V4", nota: 91,
    t: "Estoy en Los Aromos. Va en V cuatro, se ve parejo y bien plantado. El control de maleza funcionó bien, quedó limpio. Riego sin novedad. Sanidad bien, no vi nada raro. Noventa y uno. Quedamos de aporcar la semana que viene, la altura ideal ahí serían unos veinticinco centímetros.",
    datos: { riego: "bien", malezas_presion: "sin presión", sanidad: "sano",
      comentario: "El control de maleza funcionó bien, el lote quedó limpio.",
      proximas_acciones: ["Aporcar la próxima semana a unos 25 cm"] },
    resumen: "Cultivo en V4, parejo y bien establecido. El control de maleza funcionó y el lote está limpio. Se acordó aporcar la próxima semana a una altura aproximada de 25 cm.",
    fotos: ["general"] },

  { lote: "mn2", dias: 34, etapa: "V4", nota: 74,
    t: "Ya, lote dos de Los Aromos, el del Drava. Acá está más disparejo, hay un sector bajo que se anegó con el riego pasado y ahí la planta quedó chica. Presión de maleza media, hoja angosta principalmente. Sanidad, vi algo de gusano cortador en el sector bajo, poquito pero está. Setenta y cuatro. Hay que revisar el sector bajo y ver el tema del cortador.",
    datos: { riego: "a mejorar", malezas_presion: "media", malezas_tipo: ["hoja angosta"],
      sanidad: "en observación", sanidad_detalle: "Presencia leve de gusano cortador en el sector bajo",
      comentario: "Sector bajo anegado en el riego anterior, planta más chica ahí.",
      proximas_acciones: ["Revisar nivelación del sector bajo", "Monitorear gusano cortador"] },
    resumen: "Lote disparejo: un sector bajo se anegó en el riego anterior y la planta quedó rezagada. Presión media de maleza de hoja angosta y presencia leve de gusano cortador en ese mismo sector. Requiere revisar la nivelación y monitorear la plaga.",
    fotos: ["general", "dron"] },

  { lote: "mn3", dias: 41, etapa: "Emergencia", nota: 62,
    t: "El Peumo. Mira, acá tenemos un problema. La emergencia salió dispareja, hay franjas enteras con fallas, calculo un sesenta por ciento de lo esperado. La siembra quedó muy profunda en el sector norte. Presión de maleza alta ya, hoja ancha y angosta las dos. Sanidad sin problema pero la población está mala. Sesenta y dos. Hay que ir a ver la regulación de la sembradora y evaluar si se resiembra el sector norte.",
    datos: { riego: "bien", malezas_presion: "alta", malezas_tipo: ["hoja ancha", "hoja angosta"],
      sanidad: "sano",
      comentario: "Emergencia dispareja con franjas falladas, cerca del 60% de lo esperado. Siembra muy profunda en el sector norte.",
      proximas_acciones: ["Revisar regulación de la sembradora", "Evaluar resiembra del sector norte", "Aplicar control de maleza urgente"] },
    resumen: "Emergencia despareja con franjas falladas: alrededor del 60% de la población esperada, por siembra demasiado profunda en el sector norte. Presión alta de maleza de hoja ancha y angosta. Requiere revisar la regulación de la sembradora y evaluar resiembra.",
    fotos: ["general", "dron"] },

  { lote: "al1", dias: 55, etapa: "Trasplante", nota: 84,
    t: "Las Perdices, lote uno. Trasplante bien establecido, la hembra quedó en treinta y seis mil ochocientas plantas por hectárea y el macho uno en treinta y cinco mil doscientas. Riego bien, la cinta funcionando pareja. Malezas baja presión. Sanidad de campo buena. Ochenta y cuatro. Saqué foto general, de hembra y de macho.",
    datos: { riego: "bien", malezas_presion: "baja", sanidad: "sano",
      comentario: "Hembra 36.800 pl/ha y macho 1 35.200 pl/ha. Cinta de riego funcionando pareja.",
      proximas_acciones: ["Programar postura de abejas"] },
    resumen: "Trasplante bien establecido: 36.800 pl/ha en hembra y 35.200 pl/ha en macho 1. Riego por cinta operando parejo, baja presión de maleza y campo sano.",
    fotos: ["general", "hembra", "macho"] },

  { lote: "al1", dias: 12, etapa: "Floración", nota: 90,
    t: "Las Perdices otra vez. Ya está en floración, la hembra va en cincuenta por ciento y el macho uno también, así que el nicking va bien sincronizado. Las abejas ya están puestas hace una semana. Riego bien. Malezas sin presión, quedó limpio. Sanidad buena. Noventa.",
    datos: { riego: "bien", malezas_presion: "sin presión", sanidad: "sano",
      comentario: "Hembra y macho 1 en 50% de floración, nicking bien sincronizado. Abejas puestas hace una semana.",
      proximas_acciones: ["Evaluar población a cosecha en la próxima visita"] },
    resumen: "Lote en plena floración con hembra y macho 1 al 50%, lo que indica un nicking bien sincronizado. Abejas puestas hace una semana, campo limpio y sano.",
    fotos: ["general", "hembra", "macho"] },

  { lote: "al2", dias: 47, etapa: "Trasplante", nota: 80,
    t: "Río Claro. El trasplante quedó bueno, treinta y ocho mil cien plantas por hectárea tanto hembra como macho. El riego, hay que mejorarlo, tengo un sector de la cinta con menos presión al final del tendido. Malezas baja. Sanidad bien. Ochenta. Hay que revisar la presión de la cinta.",
    datos: { riego: "a mejorar", malezas_presion: "baja", sanidad: "sano",
      comentario: "38.100 pl/ha en hembra y macho. Menos presión al final del tendido de la cinta.",
      proximas_acciones: ["Revisar presión al final del tendido de la cinta"] },
    resumen: "Trasplante bien logrado con 38.100 pl/ha en hembra y macho. Se detectó menor presión de riego al final del tendido de la cinta, que hay que revisar. Baja presión de maleza y campo sano.",
    fotos: ["general", "hembra", "macho"] },
];

// ─── Siembra ─────────────────────────────────────────────────────────────────

const idsAg = {};
for (const a of AGRICULTORES) {
  const [f] = await sql`
    INSERT INTO tuniche_agricultores
      (area, razon_social, nombre_contacto, telefono, email, localidad, region, distribuidor, zonal_nombre, demo)
    VALUES (${a.area}, ${a.razonSocial}, ${a.nombreContacto}, ${a.telefono}, ${a.email},
            ${a.localidad}, ${a.region}, ${a.distribuidor}, ${a.zonalNombre}, TRUE)
    RETURNING id`;
  idsAg[a.k] = f.id;
}

const idsLote = {};
for (const l of LOTES) {
  const [f] = await sql`
    INSERT INTO tuniche_lotes
      (agricultor_id, area, codigo, temporada, cultivo, variedad, relacion_hm, hectareas,
       objetivo, cliente_final, idase, tipo_semilla, etapa_actual, hitos, demo)
    VALUES (${idsAg[l.ag]}, ${l.area}, ${l.codigo}, ${l.temporada}, ${l.cultivo}, ${l.variedad},
            ${l.relacionHm ?? null}, ${l.hectareas}, ${l.objetivo}, ${l.clienteFinal},
            ${l.idase ?? null}, ${l.tipoSemilla ?? null}, ${l.etapaActual},
            ${JSON.stringify(l.hitos ?? {})}::jsonb, TRUE)
    RETURNING id`;
  idsLote[l.k] = f.id;
}

// El usuario al que se le atribuyen las visitas: el primer admin. En la demo es
// quien está mostrando la pantalla, y así el historial dice un nombre real en
// vez de un "usuario 1" que nadie sabe quién es.
const [admin] = await sql`SELECT id FROM tuniche_usuarios WHERE rol = 'admin' AND activo = TRUE ORDER BY id LIMIT 1`;
if (!admin) {
  console.error("No hay ningún administrador. Crea uno con scripts/tuniche-usuario.mjs.");
  process.exit(1);
}

const creadas = [];
for (const v of VISITAS) {
  const lote = LOTES.find((l) => l.k === v.lote);
  const fecha = new Date(Date.now() - v.dias * 24 * 60 * 60 * 1000);
  const [f] = await sql`
    INSERT INTO tuniche_visitas
      (lote_id, agricultor_id, area, usuario_id, fecha, origen, transcripcion, etapa, datos,
       nota_agronomica, resumen, estado, validada_en, demo)
    VALUES (${idsLote[v.lote]}, ${idsAg[lote.ag]}, ${lote.area}, ${admin.id}, ${fecha},
            'audio', ${v.t}, ${v.etapa}, ${JSON.stringify(v.datos)}::jsonb, ${v.nota},
            ${v.resumen}, 'validada', ${fecha}, TRUE)
    RETURNING id`;
  for (const tipo of v.fotos) {
    await sql`INSERT INTO tuniche_fotos (visita_id, url, tipo) VALUES (${f.id}, ${FOTOS[tipo]}, ${tipo})`;
  }
  creadas.push({ id: f.id, ...v, loteId: idsLote[v.lote], agricultorId: idsAg[lote.ag], fecha, lote });
}

// ─── Informes ────────────────────────────────────────────────────────────────
//
// Tres estados a la vista, porque el repositorio se entiende mirando el ciclo
// completo y no una lista de borradores: uno enviado, uno con visto bueno
// esperando salir, y el resto en borrador.

const ETIQUETAS = {
  riego: "Estado del riego", malezas_presion: "Presión de malezas", malezas_tipo: "Tipo de maleza",
  sanidad: "Sanidad del campo", sanidad_detalle: "Qué se observó",
  comentario: "Comentario", proximas_acciones: "Próximas acciones",
};

function campos(datos) {
  return Object.entries(ETIQUETAS)
    .filter(([k]) => datos[k] != null && String(datos[k]).length)
    .map(([k, etiqueta]) => ({
      etiqueta,
      valor: Array.isArray(datos[k]) ? datos[k].join("; ") : String(datos[k]),
    }));
}

const fmt = (d) =>
  new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);

let n = 0;
for (const v of creadas) {
  const ag = AGRICULTORES.find((a) => a.k === v.lote.ag);
  const fotos = v.fotos.map((t) => ({ url: FOTOS[t], tipo: t }));
  const contenido = {
    agricultor: ag.razonSocial, contacto: ag.nombreContacto, localidad: ag.localidad,
    lote: v.lote.codigo, cultivo: v.lote.cultivo, variedad: v.lote.variedad,
    hectareas: v.lote.hectareas, zonal: "Joaquín Trujillo", fecha: v.fecha.toISOString(),
    etapa: v.etapa, campos: campos(v.datos), notaAgronomica: v.nota, resumen: v.resumen, fotos,
  };

  // Los dos más antiguos ya salieron; el siguiente espera su visto bueno.
  const estado = n === 0 ? "enviado" : n === 1 ? "enviado" : n === 2 ? "aprobado" : "borrador";
  const aprobado = estado !== "borrador";

  await sql`
    INSERT INTO tuniche_informes
      (tipo, area, titulo, estado, visita_id, lote_id, agricultor_id, contenido,
       generado_por, generado_en, aprobado_por, aprobado_en, enviado_por, enviado_en, enviado_a, demo)
    VALUES ('visita', ${v.lote.area}, ${`Visita ${v.lote.codigo} · ${fmt(v.fecha)}`}, ${estado},
            ${v.id}, ${v.loteId}, ${v.agricultorId}, ${JSON.stringify(contenido)}::jsonb,
            ${admin.id}, ${v.fecha},
            ${aprobado ? admin.id : null}, ${aprobado ? v.fecha : null},
            ${estado === "enviado" ? admin.id : null},
            ${estado === "enviado" ? v.fecha : null},
            ${estado === "enviado" ? ag.telefono : null}, TRUE)`;
  n++;
}

// Un mensual del cliente de Altué, con sus dos lotes y las visitas del periodo.
const altue = creadas.filter((v) => v.lote.area === "altue");
const desde = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
const hasta = new Date();
const contenidoMensual = {
  cliente: CLIENTE_DEMO,
  desde: desde.toISOString(),
  hasta: hasta.toISOString(),
  lotes: LOTES.filter((l) => l.area === "altue").map((l) => {
    const suyas = altue.filter((v) => v.lote.k === l.k);
    const notas = suyas.map((v) => v.nota);
    const ag = AGRICULTORES.find((a) => a.k === l.ag);
    return {
      codigo: l.codigo, agricultor: ag.razonSocial, localidad: ag.localidad,
      cultivo: l.cultivo, variedad: l.variedad, hectareas: l.hectareas, objetivo: l.objetivo,
      notaPromedio: notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null,
      visitas: suyas.map((v) => ({
        fecha: v.fecha.toISOString(), zonal: "Joaquín Trujillo", etapa: v.etapa,
        notaAgronomica: v.nota, resumen: v.resumen,
        fotos: v.fotos.map((t) => ({ url: FOTOS[t], tipo: t })),
      })),
    };
  }),
};
const mes = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" }).format(desde);
await sql`
  INSERT INTO tuniche_informes
    (tipo, area, titulo, estado, cliente, periodo_desde, periodo_hasta, contenido,
     generado_por, generado_en, demo)
  VALUES ('mensual', 'altue', ${`${CLIENTE_DEMO} · ${mes}`}, 'borrador', ${CLIENTE_DEMO},
          ${desde}, ${hasta}, ${JSON.stringify(contenidoMensual)}::jsonb, ${admin.id}, ${hasta}, TRUE)`;

const [{ reales }] = await sql`SELECT count(*)::int AS reales FROM tuniche_agricultores WHERE demo = FALSE`;
console.log(`✓ demo sembrado: ${AGRICULTORES.length} agricultores · ${LOTES.length} lotes · ${creadas.length} visitas · ${creadas.length + 1} informes`);
console.log(`  ${reales} agricultores reales intactos.`);
console.log(`  Para quitarlo: node scripts/tuniche-demo.mjs --limpiar`);
