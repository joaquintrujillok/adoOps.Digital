// API pública de la entrevista de levantamiento (/gia/entrevista). No tiene
// sesión: la credencial es el token que vive en el navegador de quien responde.
//
// GET  ?t=TOKEN           estado de la entrevista, para retomar si recarga
// POST JSON  { accion: "iniciar", nombre, cargo, gerencia }      → { token }
// POST form  accion=responder, token, tema, ronda, audio | texto, segundos
//                                                → { transcripcion }
// POST JSON  { accion: "repreguntar", token, tema }              → { repregunta }
// POST JSON  { accion: "terminar", token }                       → { analisis }
// POST JSON  { accion: "confirmar", token }                      → { id }
//
// Transcribir y repreguntar son dos llamadas y no una a propósito: así la
// pantalla puede decir con verdad en qué paso está ("transcribiendo", "viendo si
// falta algo") y mostrar lo que se escuchó antes de que llegue la repregunta.
//
// Cada llamada cuesta tokens de OpenAI y la ruta es pública, así que los topes
// van acá: tamaño del audio, largo del texto y cantidad de turnos.

import { NextResponse } from "next/server";
import { GERENCIAS, temaPorId } from "@/lib/gia/modelo";
import { analizar, modeloAnalisis, repreguntar, transcribir } from "@/lib/gia/ia";
import {
  MAX_TURNOS,
  crearEntrevista,
  entrevistaPorToken,
  guardarTurno,
  marcarEstado,
  tokenValido,
  turnosDe,
} from "@/lib/gia/datos";

export const dynamic = "force-dynamic";
// El análisis con un modelo de razonamiento puede tardar bastante más que una
// transcripción. 120 s es el mismo techo que usa el cron más largo del repo.
export const maxDuration = 120;

const SIN_CACHE = { "Cache-Control": "no-store" };
const MAX_AUDIO = 20 * 1024 * 1024; // 5 min de opus/webm o m4a con holgura; la API acepta hasta 25 MB
const MAX_TEXTO = 3000;

const error = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status, headers: SIN_CACHE });

export async function GET(req: Request) {
  const t = new URL(req.url).searchParams.get("t");
  if (!tokenValido(t)) return error("Solicitud inválida.");
  const e = await entrevistaPorToken(t);
  if (!e) return error("No existe esa entrevista.", 404);
  const turnos = await turnosDe(e.id);
  return NextResponse.json(
    { estado: e.estado, nombre: e.nombre, cargo: e.cargo, gerencia: e.gerencia, turnos, analisis: e.analisis, id: e.id },
    { headers: SIN_CACHE },
  );
}

export async function POST(req: Request) {
  const tipo = req.headers.get("content-type") || "";
  if (tipo.startsWith("multipart/form-data")) return responder(await req.formData());

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("Solicitud inválida.");
  }

  if (body.accion === "iniciar") {
    const nombre = String(body.nombre ?? "").trim().slice(0, 80);
    const cargo = String(body.cargo ?? "").trim().slice(0, 160);
    const gerencia = String(body.gerencia ?? "").trim();
    if (nombre.length < 2 || cargo.length < 2) return error("Falta tu nombre o tu cargo.");
    if (!(GERENCIAS as readonly string[]).includes(gerencia)) return error("Elige una gerencia.");
    const token = await crearEntrevista({ nombre, cargo, gerencia });
    return NextResponse.json({ token }, { headers: SIN_CACHE });
  }

  if (!tokenValido(body.token)) return error("Solicitud inválida.");
  const e = await entrevistaPorToken(body.token);
  if (!e) return error("No existe esa entrevista.", 404);

  if (body.accion === "terminar") {
    if (e.estado === "lista" || e.estado === "confirmada") return NextResponse.json({ analisis: e.analisis }, { headers: SIN_CACHE });
    const turnos = await turnosDe(e.id);
    if (turnos.length < 2) return error("Responde al menos dos temas antes de terminar.");
    await marcarEstado(e.id, { estado: "analizando", error: null });
    try {
      const analisis = await analizar(e, turnos);
      await marcarEstado(e.id, { estado: "lista", analisis, modelo: modeloAnalisis() });
      return NextResponse.json({ analisis }, { headers: SIN_CACHE });
    } catch (err) {
      console.error("[gia] análisis falló", err);
      await marcarEstado(e.id, { estado: "error", error: String(err).slice(0, 500) });
      return error("No pudimos armar tu ficha. Intenta de nuevo en un momento.", 502);
    }
  }

  if (body.accion === "repreguntar") {
    // Lee la respuesta guardada en vez de recibirla: el navegador no puede
    // hacer que el modelo repregunte sobre algo que la persona no dijo.
    const tema = temaPorId(String(body.tema ?? ""));
    if (!tema) return error("Tema desconocido.");
    const turno = (await turnosDe(e.id)).find((t) => t.tema === tema.id && t.ronda === 0);
    if (!turno) return error("Todavía no respondes ese tema.");
    const repregunta = await repreguntar(tema.id, turno.transcripcion);
    return NextResponse.json({ repregunta }, { headers: SIN_CACHE });
  }

  if (body.accion === "confirmar") {
    if (e.estado !== "lista" && e.estado !== "confirmada") return error("La ficha todavía no está lista.");
    if (e.estado === "lista") await marcarEstado(e.id, { estado: "confirmada", confirmadaEn: new Date() });
    return NextResponse.json({ id: e.id }, { headers: SIN_CACHE });
  }

  return error("Acción desconocida.");
}

async function responder(form: FormData) {
  const token = form.get("token");
  if (!tokenValido(token)) return error("Solicitud inválida.");
  const e = await entrevistaPorToken(token);
  if (!e) return error("No existe esa entrevista.", 404);
  if (e.estado !== "en_curso" && e.estado !== "error") return error("Esta entrevista ya terminó.");

  const tema = temaPorId(String(form.get("tema") ?? ""));
  const ronda = Number(form.get("ronda")) === 1 ? 1 : 0;
  if (!tema) return error("Tema desconocido.");

  // La pregunta de la ronda 1 la escribió el modelo y viaja desde el navegador.
  // Se guarda solo como contexto de la transcripción; se recorta por si acaso.
  const pregunta = ronda === 0 ? tema.pregunta : String(form.get("pregunta") ?? "").slice(0, 300) || "Repregunta";

  const previos = await turnosDe(e.id);
  const reemplaza = previos.some((p) => p.tema === tema.id && p.ronda === ronda);
  if (!reemplaza && previos.length >= MAX_TURNOS) return error("La entrevista ya tiene todas sus respuestas.");

  const segundosCrudos = Number(form.get("segundos"));
  const segundos = Number.isFinite(segundosCrudos) && segundosCrudos > 0 ? Math.round(segundosCrudos) : null;

  let transcripcion = "";
  let canal: "voz" | "texto" = "voz";
  const audio = form.get("audio");
  if (audio instanceof File && audio.size > 0) {
    if (audio.size > MAX_AUDIO) return error("El audio es demasiado largo. Intenta con una respuesta de menos de 5 minutos.");
    try {
      transcripcion = await transcribir(audio, pregunta);
    } catch (err) {
      console.error("[gia] transcripción falló", err);
      return error("No pudimos escuchar bien tu respuesta. Intenta de nuevo o escríbela.", 502);
    }
  } else {
    transcripcion = String(form.get("texto") ?? "").trim().slice(0, MAX_TEXTO);
    canal = "texto";
  }
  if (!transcripcion) return error("No escuchamos nada. Intenta de nuevo, un poco más cerca del micrófono.");

  await guardarTurno(e.id, { tema: tema.id, ronda, pregunta, transcripcion, canal, segundos });
  return NextResponse.json({ transcripcion }, { headers: SIN_CACHE });
}
