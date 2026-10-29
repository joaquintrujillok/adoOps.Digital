"use client";

// La entrevista por voz. Un tema a la vez: el agente lee la pregunta en voz
// alta, la persona graba su respuesta, el servidor la transcribe y decide si
// hace falta una repregunta. Al final se arma la ficha y la persona la confirma.
//
// **Una escena por estado.** La primera versión dejaba la misma pantalla en
// todos los momentos y cambiaba solo una línea de texto ("procesando…"), y quien
// se entrevistaba no sabía si lo estaban escuchando, si se había enviado o si
// tenía que hacer algo. Ahora cada momento tiene su escena y su color:
//
//   pregunta    el agente pregunta (verde) o repregunta (ámbar, con la cita
//               de lo que la persona dijo, para que se note que es distinta)
//   grabando    reloj grande con anillo que cambia de color al acercarse al
//               límite, onda de voz en vivo y pausa
//   procesando  los pasos reales, en orden: enviar (con % de subida),
//               transcribir y revisar si falta algo; y lo que se escuchó
//   analizando  qué se está armando con las respuestas
//
// Los pasos de "procesando" son verdaderos: la subida se mide con XHR y
// transcribir y repreguntar son dos llamadas distintas a la API. No hay barras
// de progreso inventadas.
//
// **Por qué una respuesta grabada por tema y no una conversación continua.**
// Es el patrón del levantamiento del JPL (funcionariosmunipaine), que funciona
// en producción en celulares de gama baja: si una subida falla se reintenta esa
// respuesta, no la entrevista entera. La conversación continua con la API
// Realtime es la fase 2; el servidor ya trabaja sobre transcripciones.
//
// La voz del agente es la del navegador (speechSynthesis): no agrega un
// proveedor ni una llamada más en el camino crítico. Si el navegador no tiene
// voz en español, la pregunta igual está escrita en grande.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { GERENCIAS, NIVELES, TEMAS, arquetipoPorId, type AnalisisGia } from "@/lib/gia/modelo";

type Fase = "datos" | "tema" | "analizando" | "ficha";
type Escena = "pregunta" | "grabando" | "procesando" | "transicion";
type EstadoPaso = "pendiente" | "activo" | "listo";
interface Paso { id: "subir" | "transcribir" | "revisar"; label: string; estado: EstadoPaso; detalle?: string }

const CLAVE = "gia-entrevista-token";
/** Límite duro de una respuesta. Lo normal son 1 o 2 minutos. */
const MAX_SEG = 300;
/** Desde aquí el anillo pasa a ámbar, y en el último medio minuto a rojo. */
const AVISO_SEG = 240;
const FINAL_SEG = 270;
const BARRAS = 28;

function tipoGrabacion(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

function leer(texto: string, alTerminar?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return alTerminar?.();
  const s = window.speechSynthesis;
  s.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  const voces = s.getVoices();
  const voz =
    voces.find((v) => v.lang === "es-CL") ??
    voces.find((v) => v.lang === "es-US" || v.lang === "es-MX" || v.lang.startsWith("es-4")) ??
    voces.find((v) => v.lang.startsWith("es"));
  if (voz) u.voice = voz;
  u.lang = voz?.lang ?? "es-CL";
  u.onend = () => alTerminar?.();
  u.onerror = () => alTerminar?.();
  s.speak(u);
  // Algunos navegadores nunca disparan `onend` (sin voces instaladas, pestaña
  // en segundo plano). Sin este tope la escena quedaría "hablando" para siempre.
  setTimeout(() => alTerminar?.(), Math.min(25000, 1500 + texto.length * 70));
}

function callar() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** POST con XHR para poder medir la subida del audio. fetch no la expone. */
function subir(form: FormData, alSubir: (pct: number) => void, alTerminarSubida: () => void): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/gia");
    x.upload.onprogress = (e) => { if (e.lengthComputable) alSubir(Math.round((e.loaded / e.total) * 100)); };
    x.upload.onload = () => alTerminarSubida();
    x.onload = () => {
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(x.responseText); } catch {}
      resolve({ ok: x.status >= 200 && x.status < 300, json });
    };
    x.onerror = () => reject(new Error("Se cortó la conexión. Revisa tu internet e inténtalo de nuevo."));
    x.send(form);
  });
}

async function postJson(body: Record<string, unknown>) {
  const r = await fetch("/api/gia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, json: json as Record<string, unknown> };
}

/** Un pedazo de lo que la persona dijo, para mostrar sobre la repregunta. */
function extracto(t: string): string {
  const limpio = t.replace(/\s+/g, " ").trim();
  return limpio.length > 140 ? `${limpio.slice(0, 140).replace(/\s\S*$/, "")}…` : limpio;
}

export default function Entrevista() {
  const [fase, setFase] = useState<Fase>("datos");
  const [token, setToken] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [gerencia, setGerencia] = useState<string>(GERENCIAS[0]);

  const [idxTema, setIdxTema] = useState(0);
  const [ronda, setRonda] = useState<0 | 1>(0);
  const [repregunta, setRepregunta] = useState<string | null>(null);
  const [ultimaRespuesta, setUltimaRespuesta] = useState("");
  const [escena, setEscena] = useState<Escena>("pregunta");
  const [hablando, setHablando] = useState(false);
  const [respondidos, setRespondidos] = useState(0);

  const [segundos, setSegundos] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [niveles, setNiveles] = useState<number[]>(() => Array(BARRAS).fill(0.08));

  const [pasos, setPasos] = useState<Paso[]>([]);
  const [escuchado, setEscuchado] = useState<string | null>(null);
  const [transicion, setTransicion] = useState<string>("");

  const [escribir, setEscribir] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisGia | null>(null);
  const [confirmadaId, setConfirmadaId] = useState<number | null>(null);
  const [enviandoDatos, setEnviandoDatos] = useState(false);
  const [segAnalisis, setSegAnalisis] = useState(0);

  const grabador = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const descartar = useRef(false);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const acumulado = useRef(0);
  const desde = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const cuadro = useRef<number | null>(null);

  const tema = TEMAS[idxTema];
  const esRepregunta = ronda === 1 && Boolean(repregunta);
  const preguntaActual = esRepregunta ? repregunta! : tema?.pregunta ?? "";

  // ── Retomar si la persona recarga ──
  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem(CLAVE); } catch {}
    if (!t) return;
    fetch(`/api/gia?t=${encodeURIComponent(t)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setToken(t);
        setNombre(d.nombre);
        if ((d.estado === "lista" || d.estado === "confirmada") && d.analisis) {
          setAnalisis(d.analisis);
          if (d.estado === "confirmada") setConfirmadaId(d.id);
          setFase("ficha");
          return;
        }
        const hechos = new Set<string>((d.turnos as { tema: string }[]).map((x) => x.tema));
        const sig = TEMAS.findIndex((x) => !hechos.has(x.id));
        setRespondidos(hechos.size);
        setIdxTema(sig === -1 ? TEMAS.length - 1 : sig);
        setFase("tema");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => {
      if (reloj.current) clearInterval(reloj.current);
      if (cuadro.current) cancelAnimationFrame(cuadro.current);
      void audioCtx.current?.close();
      callar();
    };
  }, []);

  // El reloj del análisis: dice cuánto lleva, que es lo único honesto que se
  // puede decir de una llamada que no informa avance.
  useEffect(() => {
    if (fase !== "analizando") return;
    const i = setInterval(() => setSegAnalisis((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [fase]);

  const preguntar = useCallback((t: string) => {
    setEscena("pregunta");
    setHablando(true);
    leer(t, () => setHablando(false));
  }, []);

  async function empezar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviandoDatos(true);
    try {
      const { ok, json } = await postJson({ accion: "iniciar", nombre, cargo, gerencia });
      if (!ok) throw new Error(String(json.error || "No pudimos empezar."));
      const t = String(json.token);
      try { localStorage.setItem(CLAVE, t); } catch {}
      setToken(t);
      setFase("tema");
      setHablando(true);
      leer(`Hola ${nombre.split(" ")[0]}. Son ${TEMAS.length} preguntas cortas y no hay respuestas correctas. ${TEMAS[0].pregunta}`, () => setHablando(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos empezar.");
    } finally {
      setEnviandoDatos(false);
    }
  }

  // ── Grabación ──

  function medirVoz(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 128;
      ctx.createMediaStreamSource(stream).connect(an);
      audioCtx.current = ctx;
      const datos = new Uint8Array(an.frequencyBinCount);
      let ultimo = 0;
      const paso = (ts: number) => {
        cuadro.current = requestAnimationFrame(paso);
        if (ts - ultimo < 60) return;
        ultimo = ts;
        an.getByteFrequencyData(datos);
        const n: number[] = [];
        for (let i = 0; i < BARRAS; i++) {
          const v = datos[2 + Math.floor((i / BARRAS) * (datos.length * 0.6))] / 255;
          n.push(Math.max(0.08, Math.min(1, v * 1.4)));
        }
        setNiveles(n);
      };
      cuadro.current = requestAnimationFrame(paso);
    } catch {
      // Sin Web Audio la grabación funciona igual; solo no hay onda.
    }
  }

  function apagarMedidor() {
    if (cuadro.current) cancelAnimationFrame(cuadro.current);
    cuadro.current = null;
    void audioCtx.current?.close();
    audioCtx.current = null;
    setNiveles(Array(BARRAS).fill(0.08));
  }

  const transcurrido = () => acumulado.current + (desde.current ? (Date.now() - desde.current) / 1000 : 0);

  async function grabar() {
    setError(null);
    callar();
    setHablando(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = tipoGrabacion();
      const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      trozos.current = [];
      descartar.current = false;
      rec.ondataavailable = (ev) => { if (ev.data.size) trozos.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        apagarMedidor();
        if (descartar.current) return;
        const blob = new Blob(trozos.current, { type: rec.mimeType || tipo || "audio/webm" });
        void enviar({ audio: blob, segundos: Math.round(transcurrido()) });
      };
      grabador.current = rec;
      rec.start(1000);
      acumulado.current = 0;
      desde.current = Date.now();
      setSegundos(0);
      setPausado(false);
      setEscena("grabando");
      medirVoz(stream);
      reloj.current = setInterval(() => {
        const s = transcurrido();
        setSegundos(s);
        if (s >= MAX_SEG) detener();
      }, 250);
    } catch {
      setError("No pudimos usar el micrófono. Revisa el permiso del navegador, o responde por escrito.");
      setEscribir(true);
    }
  }

  function pausar() {
    const r = grabador.current;
    if (!r) return;
    if (r.state === "recording") {
      r.pause();
      acumulado.current = transcurrido();
      desde.current = 0;
      setPausado(true);
    } else if (r.state === "paused") {
      r.resume();
      desde.current = Date.now();
      setPausado(false);
    }
  }

  function detener() {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    acumulado.current = transcurrido();
    desde.current = 0;
    const r = grabador.current;
    if (r && r.state !== "inactive") r.stop();
  }

  function volverAEmpezar() {
    descartar.current = true;
    detener();
    setEscena("pregunta");
  }

  // ── Envío: los pasos reales ──

  function marcar(id: Paso["id"], estado: EstadoPaso, detalle?: string) {
    setPasos((ps) => ps.map((p) => (p.id === id ? { ...p, estado, detalle: detalle ?? p.detalle } : p)));
  }

  async function enviar(entrada: { audio?: Blob; texto?: string; segundos?: number }) {
    if (!token || !tema) return;
    const conAudio = Boolean(entrada.audio);
    setEscuchado(null);
    setPasos([
      { id: "subir", label: conAudio ? "Enviando tu audio" : "Enviando tu respuesta", estado: "activo" },
      ...(conAudio ? [{ id: "transcribir" as const, label: "Transcribiendo lo que dijiste", estado: "pendiente" as const }] : []),
      ...(ronda === 0 ? [{ id: "revisar" as const, label: "Revisando si falta algo", estado: "pendiente" as const }] : []),
    ]);
    setEscena("procesando");

    const f = new FormData();
    f.set("accion", "responder");
    f.set("token", token);
    f.set("tema", tema.id);
    f.set("ronda", String(ronda));
    if (ronda === 1 && repregunta) f.set("pregunta", repregunta);
    if (entrada.audio) {
      const ext = entrada.audio.type.includes("mp4") ? "m4a" : entrada.audio.type.includes("ogg") ? "ogg" : "webm";
      f.set("audio", entrada.audio, `respuesta.${ext}`);
      f.set("segundos", String(entrada.segundos ?? 0));
    } else {
      f.set("texto", entrada.texto ?? "");
    }

    try {
      const { ok, json } = await subir(
        f,
        (pct) => marcar("subir", "activo", `${pct}%`),
        () => {
          // Con audio, terminar de subir es pasar a transcribir. Con texto no
          // hay paso intermedio: "enviando" sigue activo hasta que se guarde.
          if (!conAudio) return;
          marcar("subir", "listo", "");
          marcar("transcribir", "activo");
        },
      );
      if (!ok) throw new Error(String(json.error || "No pudimos guardar tu respuesta."));
      const dicho = String(json.transcripcion ?? "");
      marcar(conAudio ? "transcribir" : "subir", "listo", conAudio ? undefined : "");
      setEscuchado(dicho);
      setUltimaRespuesta(dicho);
      setTexto("");

      if (ronda === 1) {
        await pausa(1400);
        avanzar();
        return;
      }

      setRespondidos((n) => n + 1);
      marcar("revisar", "activo");
      const r = await postJson({ accion: "repreguntar", token, tema: tema.id });
      const q = r.ok && typeof r.json.repregunta === "string" ? r.json.repregunta : null;
      marcar("revisar", "listo", q ? "Una pregunta más sobre esto" : "Respuesta completa");
      await pausa(1400);
      if (q) {
        setRonda(1);
        setRepregunta(q);
        preguntar(q);
        return;
      }
      avanzar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tu respuesta.");
      setEscena("pregunta");
    }
  }

  function avanzar() {
    setRonda(0);
    setRepregunta(null);
    const sig = idxTema + 1;
    if (sig >= TEMAS.length) {
      void terminar();
      return;
    }
    setTransicion(TEMAS[sig].titulo);
    setEscena("transicion");
    setTimeout(() => {
      setIdxTema(sig);
      preguntar(TEMAS[sig].pregunta);
    }, 1300);
  }

  async function terminar() {
    if (!token) return;
    if (reloj.current) clearInterval(reloj.current);
    callar();
    setError(null);
    setSegAnalisis(0);
    setFase("analizando");
    try {
      const { ok, json } = await postJson({ accion: "terminar", token });
      if (!ok) throw new Error(String(json.error || "No pudimos armar tu ficha."));
      setAnalisis(json.analisis as AnalisisGia);
      setFase("ficha");
      leer("Listo. Esto es lo que entendí de tu trabajo. Revísalo y confírmalo si te representa.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos armar tu ficha.");
      setFase("tema");
      setEscena("pregunta");
    }
  }

  async function confirmar() {
    if (!token) return;
    const { ok, json } = await postJson({ accion: "confirmar", token });
    if (ok) setConfirmadaId(Number(json.id));
    else setError(String(json.error || "No pudimos confirmar."));
  }

  function otraPersona() {
    try { localStorage.removeItem(CLAVE); } catch {}
    window.location.reload();
  }

  // ─── Pantallas ─────────────────────────────────────────────────────────────

  if (fase === "datos") {
    return (
      <div className="ent-centro">
        <form onSubmit={empezar} className="caja ent-datos">
          <div className="orbe orbe-quieto" aria-hidden="true"><span /><span /><span /></div>
          <h1>Cinco minutos sobre tu trabajo</h1>
          <p className="tenue">{TEMAS.length} preguntas en voz alta. Respondes hablando y al final revisas lo que entendimos.</p>
          <div className="ent-campos">
            <label>Tu nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} autoComplete="given-name" />
            </label>
            <label>Tu cargo
              <input value={cargo} onChange={(e) => setCargo(e.target.value)} required minLength={2} maxLength={160} />
            </label>
            <label>Gerencia
              <select value={gerencia} onChange={(e) => setGerencia(e.target.value)}>
                {GERENCIAS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button type="submit" className="b-grande" disabled={enviandoDatos}>{enviandoDatos ? "Preparando…" : "Empezar"}</button>
          <p className="tenue small ent-privacidad">El audio no se guarda: se transcribe y se descarta. Tu perfil sale de lo que dices, nunca de cómo suena tu voz.</p>
        </form>
      </div>
    );
  }

  if (fase === "analizando") {
    return (
      <div className="ent-centro">
        <div className="caja ent-escena">
          <div className="orbe orbe-pensando" aria-hidden="true"><span /><span /><span /></div>
          <h2 className="ent-titulo">Armando tu ficha</h2>
          <p className="tenue" style={{ margin: 0 }}>Estamos leyendo tus respuestas. Suele tardar entre 10 y 30 segundos.</p>
          <ul className="ent-pasos" aria-live="polite">
            {["Tus tareas repetitivas y cuánto tiempo te toman", "Cómo usas la IA hoy y si hay algún riesgo", "Tu perfil de adopción, con la frase tuya que lo respalda"].map((t) => (
              <li key={t} className="activo"><span className="ico" aria-hidden="true" />{t}</li>
            ))}
          </ul>
          <div className="tenue small">{segAnalisis} s</div>
        </div>
      </div>
    );
  }

  if (fase === "ficha" && analisis) {
    const p = arquetipoPorId(analisis.perfil.principal);
    const pot = arquetipoPorId(analisis.perfil.potencial);
    const nivel = NIVELES.find((n) => n.n === analisis.perfil.madurez);
    return (
      <div className="caja" style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <p className="acento small" style={{ margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>Esto entendimos de tu trabajo · revisa y confirma</p>
        <h1 style={{ fontSize: 28 }}>{nombre}</h1>
        <p style={{ margin: 0 }}>{analisis.resumen}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div className="ficha">
            <div className="tenue small">Arquetipo</div>
            <div className="sora" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{p?.nombre}</div>
            <div className="tenue small" style={{ marginTop: 4 }}>{p?.descripcion}{pot ? ` · con potencial ${pot.nombre}` : ""}</div>
          </div>
          <div className="ficha">
            <div className="tenue small">Madurez de uso</div>
            <div className="sora" style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>Nivel {analisis.perfil.madurez} de 5 · {nivel?.nombre}</div>
            <div className="tenue small" style={{ marginTop: 4 }}>{analisis.perfil.porQueMadurez}</div>
          </div>
        </div>

        {analisis.tareas.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Tareas repetitivas detectadas</div>
            {analisis.tareas.map((t) => (
              <div key={t.tarea} className="linea">
                <span>{t.tarea}</span>
                <span className="acento" style={{ whiteSpace: "nowrap" }}>{t.horasMes ? `~${t.horasMes} h/mes` : t.frecuencia}</span>
              </div>
            ))}
          </div>
        )}

        {analisis.perfil.evidencias.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Por qué este perfil</div>
            {analisis.perfil.evidencias.map((e, i) => (
              <div key={i} className="small">
                <span className="acento">{arquetipoPorId(e.arquetipo)?.nombre}</span> · “{e.cita}” <span className="tenue">— {e.lectura}</span>
              </div>
            ))}
          </div>
        )}

        {analisis.alertas.map((a, i) => (
          <div key={i} className="alerta">Alerta de gobierno: {a.texto}</div>
        ))}

        {analisis.ruta && <p style={{ margin: 0 }}><strong>Ruta sugerida:</strong> {analisis.ruta}</p>}
        {error && <div className="error" role="alert">{error}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {confirmadaId ? (
            <Link href={`/gia/personas/${confirmadaId}`} className="b-pri" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", color: "#fff" }}>
              Ver en back office
            </Link>
          ) : (
            <button type="button" className="b-pri" onClick={confirmar}>Confirmar y ver en back office</button>
          )}
          <button type="button" className="b-sec" onClick={otraPersona}>Entrevistar a otra persona</button>
        </div>
      </div>
    );
  }

  // ── fase === "tema" ──

  const progreso = (
    <ol className="ent-progreso" aria-label="Progreso de la entrevista">
      {TEMAS.map((t, i) => {
        const estado = i < idxTema ? "listo" : i === idxTema ? "actual" : "";
        return (
          <li key={t.id} className={estado} aria-current={i === idxTema ? "step" : undefined}>
            <span className="barra-seg" />
            <span className="etq">{t.titulo}</span>
          </li>
        );
      })}
    </ol>
  );

  if (escena === "transicion") {
    return (
      <div className="ent-centro">
        {progreso}
        <div className="caja ent-escena ent-transicion">
          <div className="check-grande" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
          </div>
          <div className="ent-titulo" aria-live="polite">Listo, gracias</div>
          <div className="tenue">Sigue: <strong style={{ color: "#eaf2ec" }}>{transicion}</strong></div>
        </div>
      </div>
    );
  }

  if (escena === "procesando") {
    return (
      <div className="ent-centro">
        {progreso}
        <div className="caja ent-escena">
          <div className="orbe orbe-pensando" aria-hidden="true"><span /><span /><span /></div>
          <ul className="ent-pasos" aria-live="polite">
            {pasos.map((p) => (
              <li key={p.id} className={p.estado}>
                <span className="ico" aria-hidden="true">
                  {p.estado === "listo" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f1a14" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
                </span>
                <span>{p.label}</span>
                {p.detalle && <span className="det">{p.detalle}</span>}
              </li>
            ))}
          </ul>
          {escuchado && (
            <div className="escuchado">
              <div className="acento small">Esto escuchamos</div>
              <p>“{escuchado}”</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (escena === "grabando") {
    const color = segundos >= FINAL_SEG ? "rojo" : segundos >= AVISO_SEG ? "ambar" : "verde";
    const quedan = Math.max(0, MAX_SEG - segundos);
    const r = 108;
    const largo = 2 * Math.PI * r;
    const mensaje = pausado
      ? "En pausa. Sigue cuando quieras."
      : color === "rojo"
        ? `Quedan ${Math.ceil(quedan)} segundos`
        : color === "ambar"
          ? "Te queda un minuto"
          : segundos < 8
            ? "Te escucho. Tómate tu tiempo."
            : "Te escucho";
    return (
      <div className="ent-centro">
        {progreso}
        <div className={`caja ent-escena grabando ${color}`}>
          <div className="ent-recordatorio tenue small">{esRepregunta ? "Repregunta" : `Pregunta ${idxTema + 1}`} · {preguntaActual}</div>
          <div className="reloj" role="timer" aria-live="off">
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <circle cx="120" cy="120" r={r} className="pista" />
              <circle cx="120" cy="120" r={r} className="avance" strokeDasharray={largo} strokeDashoffset={largo * (1 - Math.min(1, segundos / MAX_SEG))} />
            </svg>
            <div className="cifras">
              <div className="t">{mmss(segundos)}</div>
              <div className="de">de {mmss(MAX_SEG)}</div>
            </div>
          </div>
          <div className="onda" aria-hidden="true">
            {niveles.map((v, i) => <span key={i} style={{ transform: `scaleY(${pausado ? 0.08 : v})` }} />)}
          </div>
          <div className="ent-estado" aria-live="polite">{mensaje}</div>
          <div className="ent-controles">
            <button type="button" className="b-redondo" onClick={volverAEmpezar} aria-label="Descartar y volver a la pregunta">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
            <button type="button" className="b-enviar" onClick={detener}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
              Listo, enviar
            </button>
            <button type="button" className="b-redondo" onClick={pausar} aria-label={pausado ? "Seguir grabando" : "Pausar"}>
              {pausado ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              )}
            </button>
          </div>
          <div className="tenue small">Con uno o dos minutos basta. El límite es de {MAX_SEG / 60} minutos.</div>
        </div>
      </div>
    );
  }

  // escena === "pregunta"
  return (
    <div className="ent-centro">
      {progreso}
      <div className={`caja ent-escena ${esRepregunta ? "repregunta" : ""}`}>
        <div className={`orbe ${hablando ? "orbe-hablando" : "orbe-quieto"} ${esRepregunta ? "orbe-ambar" : ""}`} aria-hidden="true"><span /><span /><span /></div>
        {esRepregunta ? (
          <>
            <span className="ent-chip ambar">Repregunta · sobre lo que dijiste</span>
            <blockquote className="cita-previa">“{extracto(ultimaRespuesta)}”</blockquote>
          </>
        ) : (
          <span className="ent-chip">Pregunta {idxTema + 1} de {TEMAS.length} · {tema?.titulo}</span>
        )}
        <h2 className="ent-pregunta" aria-live="polite">{preguntaActual}</h2>
        {!esRepregunta && tema && <p className="tenue small" style={{ margin: 0 }}>{tema.ayuda}</p>}
        <div className="tenue small" aria-live="polite">{hablando ? "El agente está preguntando…" : "Cuando quieras, responde."}</div>

        {escribir ? (
          <form onSubmit={(e) => { e.preventDefault(); if (texto.trim()) void enviar({ texto }); }} className="ent-escribir">
            <label>Tu respuesta
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={3000} />
            </label>
            <button type="submit" className="b-grande" disabled={!texto.trim()}>Enviar respuesta</button>
          </form>
        ) : (
          <button type="button" className="b-grande b-mic" onClick={grabar}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
            Responder
          </button>
        )}

        {error && <div className="error" role="alert">{error}</div>}

        <div className="ent-secundarios">
          <button type="button" className="b-link" onClick={() => preguntar(preguntaActual)}>Repetir pregunta</button>
          <button type="button" className="b-link" onClick={() => setEscribir((v) => !v)}>{escribir ? "Prefiero hablar" : "Prefiero escribir"}</button>
          {esRepregunta && <button type="button" className="b-link" onClick={avanzar}>Saltar repregunta</button>}
          {respondidos >= 2 && <button type="button" className="b-link" onClick={terminar}>Terminar ahora</button>}
        </div>
      </div>
    </div>
  );
}

function pausa(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
