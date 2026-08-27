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
  decryptImage,
  extractText,
  sendText,
  type WaIncomingMessage,
} from "@/lib/wasender";
import type { AreaId } from "./areas";
import { nombreArea } from "./areas";
import { VISITA } from "./plantillas";
import { extraerVisita } from "./extraccion";
import { usuarioPorTelefono } from "./usuarios";
import type { TunicheUsuario } from "@/db/tuniche";
import {
  agricultorDeLote,
  crearVisita,
  guardarFoto,
  lotesCandidatos,
  ultimaPendiente,
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
}): string {
  const L: string[] = ["📋 *Visita registrada*"];

  if (params.lote) {
    L.push(`• Lote: ${params.lote}${params.agricultor ? ` — ${params.agricultor}` : ""}`);
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
  L.push("Responde *OK* para guardarla en el historial del agricultor.");
  L.push("Si algo está mal, corrígelo en el sistema antes de validar.");
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

  const elegido = lotes.find((l) => l.id === extraida.loteId) ?? null;
  const agricultorId = extraida.loteId ? await agricultorDeLote(extraida.loteId) : null;

  await crearVisita({
    loteId: extraida.loteId,
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

  await enviarWhatsApp(
    u.telefono!,
    borrador({
      lote: elegido?.codigo ?? null,
      agricultor: elegido?.agricultor ?? null,
      loteMencionado: extraida.loteMencionado,
      etapa: extraida.etapa,
      datos: extraida.datos,
      nota: extraida.notaAgronomica,
    }),
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
async function copiarFoto(urlTemporal: string, visitaId: number, msgId: string): Promise<string> {
  const res = await fetch(urlTemporal);
  if (!res.ok) throw new Error(`No se pudo descargar la foto: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (res.headers.get("content-type") ?? "image/jpeg").includes("png") ? "png" : "jpg";
  const { url } = await put(`tuniche/visitas/${visitaId}/${msgId}.${ext}`, buf, {
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

    // 2) Foto — se pega a la última visita de esta persona.
    if (msg.message?.imageMessage) {
      const visita = await ultimaVisita(u.id);
      if (!visita) {
        await enviarWhatsApp(u.telefono, "Recibí la foto, pero todavía no hay una visita a la cual pegarla. Mándame primero el audio.");
        return true;
      }
      const temporal = await decryptImage(msg);
      if (!temporal) {
        await enviarWhatsApp(u.telefono, "⚠️ No pude descargar la foto. ¿La reenvías?");
        return true;
      }
      const url = await copiarFoto(temporal, visita.id, msg.key.id);
      // El pie de foto decide el tipo: en Altué se pide general, hembra y macho.
      const pie = (msg.message.imageMessage.caption ?? "").toLowerCase();
      const tipo = pie.includes("hembra")
        ? "hembra"
        : pie.includes("macho")
          ? "macho"
          : pie.includes("dron") || pie.includes("drone")
            ? "dron"
            : "general";
      await guardarFoto({ visitaId: visita.id, url, tipo, waMessageId: msg.key.id });
      await enviarWhatsApp(u.telefono, `📷 Foto guardada (${tipo}) en tu última visita.`);
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
