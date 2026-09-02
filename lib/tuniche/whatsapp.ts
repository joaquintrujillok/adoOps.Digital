// La entrada por WhatsApp: de un audio en la camioneta a una visita estructurada.
//
// **El flujo completo, y por qué cada paso está donde está.**
//
//   1. Llega un mensaje  →  ¿de quién? El número es la identidad. Si no está
//      registrado, esto NO es un mensaje de Tuniche y se devuelve el control.
//   2. Audio             →  se desencripta, se transcribe, y se estructura
//                           contra la plantilla del área de esa persona.
//   3. Se guarda PENDIENTE y se le devuelve el borrador por WhatsApp.
//   4. La persona responde "OK"  →  recién ahí entra al historial.
//   5. Manda fotos       →  se pegan a su última visita.
//
// **El paso 4 es el que hace que esto sea confiable en vez de mágico.** Un
// sistema que guarda lo que la IA entendió sin que nadie mire produce basura
// estructurada, que es peor que un audio: el audio al menos se nota que hay que
// escucharlo. Una ficha con seis campos llenos parece verificada.

import { put } from "@vercel/blob";
import { transcribeFromUrl } from "@/lib/stt";
import {
  decryptAudio,
  decryptDocument,
  decryptImage,
  extractText,
  sendText,
  type WaIncomingMessage,
} from "@/lib/wasender";
import type { AreaId } from "./areas";
import { nombreArea } from "./areas";
import { VISITA } from "./plantillas";
import { extraerVisita, type LoteCandidato } from "./extraccion";
import { refrescarFotos } from "./informes";
import { usuarioPorTelefono } from "./usuarios";
import type { TunicheUsuario } from "@/db/tuniche";
import {
  agricultorDeLote,
  asignarLote,
  crearVisita,
  guardarFoto,
  guardarFotoPendiente,
  adjuntarPendientes,
  lotesCandidatos,
  descartar,
  ultimaPendiente,
  ultimaPendienteSinLote,
  ultimaVisita,
  validar,
} from "./visitas";
import { alcanceDe } from "./session";

/**
 * Responde por WhatsApp, salvo en modo simulado.
 *
 * `TUNICHE_WHATSAPP_SIMULADO=1` deja todo el flujo igual —se transcribe, se
 * estructura y se guarda— pero no sale ningún mensaje: se registra en consola.
 * Es la misma idea que `CRM_WHATSAPP_ALLOWLIST` en el CRM, y sirve para lo
 * mismo: durante la puesta a punto uno corre el flujo veinte veces, y veinte
 * mensajes al teléfono de alguien enseñan a ignorar los mensajes del sistema.
 *
 * **En producción la variable no va.** Sin ella, se manda de verdad.
 */
export async function enviarWhatsApp(telefono: string, texto: string): Promise<void> {
  if (process.env.TUNICHE_WHATSAPP_SIMULADO === "1") {
    console.log(`[tuniche · simulado → +${telefono}]\n${texto}\n`);
    return;
  }
  await sendText(telefono, texto);
}

/**
 * El modelo de transcripción de Tuniche.
 *
 * `gpt-transcribe` es el que OpenAI recomienda hoy para transcribir habla
 * grabada en su idioma original, que es exactamente el caso: un zonal hablando
 * español de Chile desde una camioneta.
 *
 * **Pesa más que el modelo de extracción, y es contraintuitivo.** Si acá
 * "Agrícola La Martina" se transcribe como "agrícola la martilla", ninguna
 * mejora aguas abajo lo recupera: el error ya se cometió. Se deja en una
 * variable para poder volver atrás sin desplegar.
 */
const MODELO_STT = process.env.TUNICHE_STT_MODEL || "gpt-transcribe";

const CONFIRMACIONES = ["ok", "okay", "oka", "listo", "validar", "validado", "confirmo", "confirmar", "si", "sí", "👍", "✅"];

/**
 * Descartar SÍ se puede desde WhatsApp, y corregir no. No es una omisión.
 *
 * El audio equivocado —cortado, el micrófono apretado sin querer— se manda desde
 * el teléfono y se nota segundos después. Obligar a entrar al sistema para eso es
 * fricción justo donde duele, y el resultado sería una bandeja llena de basura
 * que nadie limpia.
 *
 * Corregir es otra cosa. Hacerlo por audio obligaría a adivinar qué campo se está
 * corrigiendo, manejar correcciones parciales y mantener estado de conversación
 * — tres formas de que el sistema entienda mal una corrección, que es peor que el
 * error original porque nadie vuelve a revisarla.
 */
const DESCARTES = ["no", "descartar", "descarta", "descártala", "borrar", "eliminar", "anular", "❌"];

/** La URL a la que se manda a la gente a corregir. */
const URL_SISTEMA = process.env.TUNICHE_URL || "https://www.adoops.digital/tuniche/visitas";

/** Normaliza para comparar: minúsculas, sin tildes y sin signos. */
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Interpreta la respuesta del zonal como uno de sus lotes.
 *
 * Acepta el número de la lista, el código, o cualquier trozo distintivo de la
 * variedad —"el de la 2775" resuelve TUNICHE 2775—. Devuelve null si calzan
 * varios: entre dos lotes de la misma variedad, elegir uno sería adivinar, que
 * es lo mismo que este flujo evita más arriba.
 */
function elegirLote(texto: string, lotes: LoteCandidato[]): LoteCandidato | null {
  const t = normalizar(texto);
  if (!t || lotes.length === 0) return null;

  // "2" o "el 2" — la posición en la lista que se le mandó.
  const soloNumero = t.match(/^(?:el |la |lote )?([1-9])\.?$/);
  if (soloNumero) {
    const i = Number(soloNumero[1]) - 1;
    return lotes[i] ?? null;
  }

  const calzan = lotes.filter((l) => {
    const codigo = normalizar(l.codigo);
    if (codigo && t.includes(codigo)) return true;
    // De la variedad se prueban sus piezas: "TUNICHE 2775" calza con "2775",
    // que es como lo dice alguien hablando.
    const piezas = normalizar(l.variedad ?? "").split(" ").filter((x) => x.length >= 3);
    return piezas.some((x) => t.includes(x));
  });
  return calzan.length === 1 ? calzan[0] : null;
}

/** ¿El texto se parece a un intento de elegir, aunque no haya calzado? */
function pareceIntentoDeElegir(texto: string, lotes: LoteCandidato[]): boolean {
  const t = normalizar(texto);
  if (/^\d{1,2}$/.test(t)) return true;
  if (/(lote|el de|la de|variedad|codigo)/.test(t)) return true;
  // Un número suelto que se parece a una variedad: probablemente quiso elegir y
  // se equivocó de dígito.
  return lotes.some((l) => /\d{3,}/.test(t) && /\d{3,}/.test(normalizar(l.variedad ?? "")));
}

/** El área contra la que se estructura un audio de esta persona. */
function areaDe(u: TunicheUsuario): AreaId | null {
  // Un jefe o un zonal tienen área. Un admin no —cruza las dos— y por eso
  // declara desde cuál está probando en su pantalla de cuenta. Sin ninguna de
  // las dos no hay plantilla, y sin plantilla no hay qué preguntarle al audio.
  return ((u.area ?? u.areaAudio) as AreaId | null) ?? null;
}

/** El alcance de filas de un usuario, para elegir entre sus lotes. */
function alcanceDeUsuario(u: TunicheUsuario) {
  return alcanceDe({
    userId: u.id,
    username: u.username,
    nombre: u.nombre,
    rol: u.rol as "admin" | "jefe" | "zonal",
    area: (u.area as AreaId | null) ?? null,
    debeCambiarClave: u.debeCambiarClave,
  });
}

// ─── El borrador que vuelve por WhatsApp ─────────────────────────────────────

/**
 * El mensaje de vuelta.
 *
 * Se arma recorriendo `VISITA`, no escribiendo las líneas a mano: agregar un
 * campo a la plantilla lo agrega también acá. Escrito a mano, el mensaje se
 * queda corto al primer cambio y el zonal valida un resumen que no muestra todo
 * lo que se guardó — que es la peor forma de romper esto, porque nadie lo nota.
 */
function borrador(params: {
  lote: string | null;
  agricultor: string | null;
  loteMencionado: string | null;
  etapa: string | null;
  datos: Record<string, unknown>;
  nota: number | null;
  candidatos: { codigo: string; variedad: string | null }[];
}): string {
  const L: string[] = ["📋 *Visita registrada*"];

  if (params.lote) {
    L.push(`• Lote: ${params.lote}${params.agricultor ? ` — ${params.agricultor}` : ""}`);
  } else if (params.candidatos.length > 1) {
    // Se identificó al agricultor pero tiene varios lotes. Decir "no encontré
    // nada" cuando sí se supo de quién es el campo hace parecer inútil un
    // sistema que entendió casi todo — y deja al zonal sin saber qué falta.
    L.push(`• ⚠️ ${params.agricultor} tiene ${params.candidatos.length} lotes y no dijiste cuál:`);
    params.candidatos.forEach((c, i) => {
      L.push(`     *${i + 1}.* ${c.codigo}${c.variedad ? ` · ${c.variedad}` : ""}`);
    });
    L.push("     Responde con el número, el código o la variedad.");
  } else {
    L.push(
      params.loteMencionado
        ? `• ⚠️ Lote: no encontré «${params.loteMencionado}» en tu lista. Queda sin asignar.`
        : "• ⚠️ Lote: no mencionaste cuál. Queda sin asignar.",
    );
  }
  if (params.etapa) L.push(`• Etapa: ${params.etapa}`);

  for (const c of VISITA) {
    if (c.id === "etapa" || c.tipo === "fotos" || c.id === "nota_agronomica") continue;
    const v = params.datos[c.id];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      L.push(`• ${c.etiqueta}: ${v.join("; ")}`);
    } else if (String(v).trim()) {
      L.push(`• ${c.etiqueta}: ${v}`);
    }
  }

  if (params.nota != null) L.push(`• Nota agronómica: ${params.nota}%`);

  L.push("");
  // Las dos únicas cosas que se pueden hacer desde acá, arriba y explícitas.
  // La versión anterior cerraba con "corrígelo en el sistema" en la última
  // línea, donde nadie la lee, y dejaba la duda de si se podía corregir por
  // WhatsApp respondiendo cualquier cosa.
  L.push("Responde *OK* para guardarla, o *NO* para descartarla.");
  L.push("");
  L.push(`Desde WhatsApp solo puedo guardar o descartar. Para *corregir* algo, entra al sistema:`);
  L.push(URL_SISTEMA);
  return L.join("\n");
}

// ─── Piezas del flujo ────────────────────────────────────────────────────────

async function procesarTranscripcion(
  u: TunicheUsuario,
  area: AreaId,
  p: { transcripcion: string; origen: "audio" | "texto"; waMessageId: string; audioUrl: string | null },
): Promise<void> {
  const alcance = alcanceDeUsuario(u);
  const lotes = await lotesCandidatos(alcance, area);

  const extraida = await extraerVisita({
    transcripcion: p.transcripcion,
    area,
    lotes,
  });

  // **Si el agricultor tiene un solo lote, la ambigüedad no existe.** El modelo
  // devuelve null cuando no puede elegir entre varios, y eso está bien; pero
  // cuando hay uno solo no había nada que elegir, y dejar la visita huérfana
  // sería tirar información que sí estaba completa.
  let loteId = extraida.loteId;
  if (!loteId && extraida.agricultorId) {
    const suyos = lotes.filter((l) => l.agricultorId === extraida.agricultorId);
    if (suyos.length === 1) loteId = suyos[0].id;
  }

  const elegido = lotes.find((l) => l.id === loteId) ?? null;
  const agricultorId = loteId ? await agricultorDeLote(loteId) : extraida.agricultorId;
  // Los lotes del agricultor que sí se identificó, para poder preguntar cuál.
  const candidatos = agricultorId
    ? lotes.filter((l) => l.agricultorId === agricultorId)
    : [];

  const visitaId = await crearVisita({
    loteId,
    agricultorId,
    area,
    usuarioId: u.id,
    origen: p.origen,
    waMessageId: p.waMessageId,
    audioUrl: p.audioUrl,
    transcripcion: p.transcripcion,
    etapa: extraida.etapa,
    // El nombre que dijo el zonal se guarda aunque no haya calzado con un lote.
    // Es lo único que permite corregir a mano después sin volver a oír el audio.
    datos: { ...extraida.datos, _loteMencionado: extraida.loteMencionado ?? undefined },
    notaAgronomica: extraida.notaAgronomica,
    resumen: extraida.resumen,
  });

  // Las fotos que llegaron mientras se procesaba el audio ya tienen dónde ir.
  const recogidas = await adjuntarPendientes(u.id, visitaId);

  await enviarWhatsApp(
    u.telefono!,
    borrador({
      lote: elegido?.codigo ?? null,
      agricultor: elegido?.agricultor ?? candidatos[0]?.agricultor ?? null,
      loteMencionado: extraida.loteMencionado,
      candidatos,
      etapa: extraida.etapa,
      datos: extraida.datos,
      nota: extraida.notaAgronomica,
    }) +
      // Se dice cuántas entraron. Una foto que se guarda sin avisar es, para
      // quien la mandó, indistinguible de una que se perdió.
      (recogidas
        ? `\n\n📷 Le pegué ${recogidas} foto${recogidas > 1 ? "s" : ""} que habías mandado.`
        : ""),
  );
}

/**
 * Copia la foto a almacenamiento propio.
 *
 * La URL que devuelve WaSender vive una hora. Guardarla tal cual produciría un
 * historial que se ve completo hoy y muestra recuadros rotos el mes que viene,
 * justo cuando alguien lo abre para mostrarle a un agricultor lo que pasó en su
 * campo — que es el único momento en que este sistema tiene que funcionar.
 */
async function copiarFoto(urlTemporal: string, carpeta: string, msgId: string): Promise<string> {
  const res = await fetch(urlTemporal);
  if (!res.ok) throw new Error(`No se pudo descargar la foto: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (res.headers.get("content-type") ?? "image/jpeg").includes("png") ? "png" : "jpg";
  const { url } = await put(`tuniche/${carpeta}/${msgId}.${ext}`, buf, {
    access: "public",
    contentType: res.headers.get("content-type") ?? "image/jpeg",
  });
  return url;
}

// ─── Punto de entrada ────────────────────────────────────────────────────────

/**
 * Procesa un mensaje si viene de alguien de Tuniche.
 *
 * Devuelve `true` si lo tomó. `false` significa "este número no es de Tuniche",
 * y quien llama sigue con lo suyo — hoy, la demo de TorreControl, que comparte
 * el mismo número de WhatsApp. **El número es el único discriminador**, y es el
 * correcto: no depende de que alguien recuerde decir una palabra clave.
 */
export async function procesarMensajeTuniche(msg: WaIncomingMessage): Promise<boolean> {
  const telefono = msg.key.cleanedSenderPn || msg.key.remoteJid || "";
  const u = await usuarioPorTelefono(telefono);
  if (!u || !u.telefono) return false;

  try {
    const area = areaDe(u);
    if (!area) {
      await enviarWhatsApp(
        u.telefono,
        "Tu cuenta no tiene un área asignada, así que no sé contra qué plantilla estructurar tu visita.\n\n" +
          `Entra al sistema y elígela en *Mi cuenta* (${nombreArea("mn")} o ${nombreArea("altue")}).`,
      );
      return true;
    }

    const texto = extractText(msg);

    // 1) "OK" — valida la pendiente más reciente.
    if (texto && CONFIRMACIONES.includes(texto.toLowerCase())) {
      const pendiente = await ultimaPendiente(u.id);
      if (!pendiente) {
        await enviarWhatsApp(u.telefono, "No tienes ninguna visita esperando validación. Mándame el audio de tu recorrido.");
        return true;
      }
      await validar(pendiente.id);
      await enviarWhatsApp(
        u.telefono,
        pendiente.loteId
          ? "✅ Visita validada. Ya está en el historial del agricultor."
          : "✅ Visita validada, pero quedó *sin lote asignado*. Asígnaselo en el sistema o no va a aparecer en el historial de nadie.",
      );
      return true;
    }

    // 1b) "NO" — descarta la pendiente más reciente.
    if (texto && DESCARTES.includes(texto.toLowerCase())) {
      const pendiente = await ultimaPendiente(u.id);
      if (!pendiente) {
        await enviarWhatsApp(u.telefono, "No tienes ninguna visita esperando validación, así que no hay nada que descartar.");
        return true;
      }
      await descartar(pendiente.id);
      await enviarWhatsApp(
        u.telefono,
        "🗑️ Visita descartada. No entra al historial de nadie.\n\n" +
          `Si fue un error, la puedes recuperar en el sistema: ${URL_SISTEMA}`,
      );
      return true;
    }

    // 1c) Elegir el lote cuando se supo el agricultor y no cuál de sus lotes.
    //
    // **Se resuelve en código, sin volver a llamar al modelo.** Es una pregunta
    // cerrada con dos o tres respuestas posibles: comparar cadenas es exacto,
    // barato e instantáneo, y no puede alucinar un lote que no estaba en la
    // lista. Mandarla al modelo sería reintroducir incertidumbre en el único
    // paso donde ya no la hay.
    //
    // El límite de largo es la guarda contra el falso positivo: un reporte de
    // terreno de verdad no cabe en cuarenta caracteres, así que un texto largo
    // sigue de largo y se trata como una visita nueva aunque mencione una
    // variedad.
    if (texto && texto.length <= 40) {
      const huerfana = await ultimaPendienteSinLote(u.id);
      if (huerfana?.agricultorId) {
        const suyos = (await lotesCandidatos(alcanceDeUsuario(u), area)).filter(
          (l) => l.agricultorId === huerfana.agricultorId,
        );
        const elegido = elegirLote(texto, suyos);

        if (elegido) {
          await asignarLote(huerfana.id, elegido.id);
          await enviarWhatsApp(
            u.telefono,
            `✅ Lote asignado: *${elegido.codigo}*${elegido.variedad ? ` · ${elegido.variedad}` : ""} — ${elegido.agricultor}\n\n` +
              "Responde *OK* para guardarla en el historial del agricultor.",
          );
          return true;
        }
        // Solo se avisa si el texto PARECÍA un intento de elegir. Si no se
        // parece en nada, se deja seguir: puede ser el inicio de otro reporte, y
        // secuestrar cualquier mensaje corto sería peor que no ayudar.
        if (pareceIntentoDeElegir(texto, suyos)) {
          await enviarWhatsApp(
            u.telefono,
            `No pude identificar cuál de los ${suyos.length} lotes es. Responde con el número, el código completo o la variedad:\n` +
              suyos.map((l, i) => `*${i + 1}.* ${l.codigo}${l.variedad ? ` · ${l.variedad}` : ""}`).join("\n"),
          );
          return true;
        }
      }
    }

    // 2) Foto — se pega a la última visita de esta persona.
    //
    // Entran las dos formas: la imagen normal y la mandada **como documento**,
    // que es lo que hace la gente para que WhatsApp no le recomprima la foto —
    // el caso de las de dron. Antes esas llegaban y se ignoraban en silencio,
    // que es la peor manera de perder una foto: nadie se entera.
    const comoImagen = Boolean(msg.message?.imageMessage);
    const comoDocumento =
      Boolean(msg.message?.documentMessage) &&
      /^image\//i.test(msg.message?.documentMessage?.mimetype ?? "");

    if (comoImagen || comoDocumento) {
      const visita = await ultimaVisita(u.id);
      const temporal = comoImagen ? await decryptImage(msg) : await decryptDocument(msg);
      if (!temporal) {
        await enviarWhatsApp(u.telefono, "⚠️ No pude descargar la foto. ¿La reenvías?");
        return true;
      }

      // El pie decide el tipo: en Altué se pide general, de hembra y de macho.
      const pie = (
        msg.message?.imageMessage?.caption ??
        msg.message?.documentMessage?.caption ??
        msg.message?.documentMessage?.fileName ??
        ""
      ).toLowerCase();
      const tipo = pie.includes("hembra")
        ? "hembra"
        : pie.includes("macho")
          ? "macho"
          : pie.includes("dron") || pie.includes("drone")
            ? "dron"
            : "general";

      // **La foto puede llegar antes que su visita, y es lo normal.** Quien está
      // en terreno graba el audio y manda las fotos enseguida: para él es un
      // solo gesto. Pero el audio tarda en transcribirse y estructurarse, así
      // que las fotos aterrizan cuando la visita todavía no existe. Se guardan
      // aparte y `procesarTranscripcion` las recoge al crearla.
      if (!visita) {
        const urlPend = await copiarFoto(temporal, `pendientes/${u.id}`, msg.key.id);
        await guardarFotoPendiente({ usuarioId: u.id, url: urlPend, tipo, waMessageId: msg.key.id });
        await enviarWhatsApp(
          u.telefono,
          `📷 Foto guardada (${tipo}). La pego a la visita apenas termine de procesar tu audio.`,
        );
        return true;
      }

      const url = await copiarFoto(temporal, `visitas/${visita.id}`, msg.key.id);
      await guardarFoto({ visitaId: visita.id, url, tipo, waMessageId: msg.key.id });

      // Si el informe ya estaba generado, la foto tiene que entrar igual: el
      // snapshot se congela, pero congelarlo sin las fotos que venían en camino
      // sería mandarle al agricultor un informe al que le faltan justo las
      // imágenes de su campo.
      const efecto = await refrescarFotos(visita.id);
      const cola = {
        "sin-informe": "",
        actualizado: "\n\nTambién quedó dentro del informe.",
        "visto-bueno-retirado":
          "\n\n⚠️ El informe ya tenía visto bueno y se retiró: lo aprobado no incluía esta foto. Hay que volver a aprobarlo.",
        "ya-enviado":
          "\n\n⚠️ El informe de esta visita ya se le envió al agricultor, así que esta foto NO va en él.",
      }[efecto];

      await enviarWhatsApp(u.telefono, `📷 Foto guardada (${tipo}) en tu última visita.${cola}`);
      return true;
    }

    // 3) Audio — el camino principal.
    if (msg.message?.audioMessage) {
      await enviarWhatsApp(u.telefono, "🎧 Recibí tu audio, lo estoy procesando…");
      const publica = await decryptAudio(msg);
      if (!publica) {
        await enviarWhatsApp(u.telefono, "⚠️ No pude descargar el audio. ¿Lo reenvías?");
        return true;
      }
      const transcripcion = await transcribeFromUrl(publica, `${msg.key.id}.ogg`, MODELO_STT);
      if (!transcripcion) {
        await enviarWhatsApp(u.telefono, "⚠️ No pude entender el audio. ¿Lo reenvías?");
        return true;
      }
      await procesarTranscripcion(u, area, {
        transcripcion,
        origen: "audio",
        waMessageId: msg.key.id,
        audioUrl: publica,
      });
      return true;
    }

    // 4) Texto libre — el mismo camino, sin transcribir.
    if (texto) {
      await procesarTranscripcion(u, area, {
        transcripcion: texto,
        origen: "texto",
        waMessageId: msg.key.id,
        audioUrl: null,
      });
      return true;
    }

    return true;
  } catch (err) {
    console.error("tuniche/whatsapp:", err);
    try {
      await enviarWhatsApp(u.telefono, "⚠️ Tuve un problema procesando tu mensaje. Intentémoslo de nuevo.");
    } catch {
      /* si tampoco se puede responder, el registro de arriba es lo que queda */
    }
    return true;
  }
}
