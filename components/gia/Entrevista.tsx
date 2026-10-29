"use client";

// La entrevista por voz. Un tema a la vez: el agente lee la pregunta en voz
// alta, la persona graba su respuesta, el servidor la transcribe y decide si
// hace falta una repregunta. Al final se arma la ficha y la persona la confirma.
//
// **Por qué una respuesta grabada por tema y no una conversación continua.**
// Es el patrón del levantamiento del JPL (funcionariosmunipaine), que funciona
// en producción en celulares de gama baja y con mala señal: si una subida
// falla se reintenta esa respuesta, no la entrevista entera. La conversación
// continua con la API Realtime es la fase 2; el servidor ya trabaja sobre
// transcripciones, así que lo que cambiaría es solo este componente.
//
// La voz del agente es la del navegador (speechSynthesis): no agrega un
// proveedor ni una llamada más en el camino crítico. Si el navegador no tiene
// voz en español, la pregunta igual está escrita en pantalla.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ARQUETIPOS,
  GERENCIAS,
  NIVELES,
  TEMAS,
  arquetipoPorId,
  type AnalisisGia,
} from "@/lib/gia/modelo";

type Fase = "datos" | "tema" | "analizando" | "ficha";
type Paso = "pregunta" | "grabando" | "enviando";
interface Linea { quien: "agente" | "persona"; texto: string }

const CLAVE = "gia-entrevista-token";
const MAX_SEG = 180;

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
  const voz = voces.find((v) => v.lang === "es-CL") ?? voces.find((v) => v.lang.startsWith("es-4") || v.lang === "es-US" || v.lang === "es-MX") ?? voces.find((v) => v.lang.startsWith("es"));
  if (voz) u.voice = voz;
  u.lang = voz?.lang ?? "es-CL";
  u.rate = 1;
  u.onend = () => alTerminar?.();
  u.onerror = () => alTerminar?.();
  s.speak(u);
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
  const [paso, setPaso] = useState<Paso>("pregunta");
  const [hablando, setHablando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [log, setLog] = useState<Linea[]>([]);
  const [respondidos, setRespondidos] = useState(0);
  const [escribir, setEscribir] = useState(false);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisGia | null>(null);
  const [confirmadaId, setConfirmadaId] = useState<number | null>(null);
  const [enviandoDatos, setEnviandoDatos] = useState(false);

  const grabador = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicio = useRef(0);
  const finLog = useRef<HTMLDivElement | null>(null);

  const tema = TEMAS[idxTema];
  const preguntaActual = ronda === 1 && repregunta ? repregunta : tema?.pregunta ?? "";

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
        const lineas: Linea[] = [];
        for (const x of d.turnos as { pregunta: string; transcripcion: string }[]) {
          lineas.push({ quien: "agente", texto: x.pregunta }, { quien: "persona", texto: x.transcripcion });
        }
        setLog(lineas);
        setRespondidos(hechos.size);
        setIdxTema(sig === -1 ? TEMAS.length - 1 : sig);
        setFase("tema");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    finLog.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [log]);

  // Algunos navegadores cargan las voces tarde; pedirlas una vez las calienta.
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => {
      if (reloj.current) clearInterval(reloj.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const preguntar = useCallback((t: string) => {
    setLog((l) => [...l, { quien: "agente", texto: t }]);
    setHablando(true);
    leer(t, () => setHablando(false));
  }, []);

  async function empezar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviandoDatos(true);
    try {
      const r = await fetch("/api/gia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "iniciar", nombre, cargo, gerencia }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No pudimos empezar.");
      try { localStorage.setItem(CLAVE, d.token); } catch {}
      setToken(d.token);
      setFase("tema");
      preguntar(`Hola ${nombre.split(" ")[0]}. Son seis temas cortos y no hay respuestas correctas. ${TEMAS[0].pregunta}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos empezar.");
    } finally {
      setEnviandoDatos(false);
    }
  }

  async function grabar() {
    setError(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setHablando(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = tipoGrabacion();
      const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      trozos.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) trozos.current.push(ev.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(trozos.current, { type: rec.mimeType || tipo || "audio/webm" });
        void enviar({ audio: blob });
      };
      grabador.current = rec;
      rec.start();
      inicio.current = Date.now();
      setSegundos(0);
      setPaso("grabando");
      reloj.current = setInterval(() => {
        const s = Math.round((Date.now() - inicio.current) / 1000);
        setSegundos(s);
        if (s >= MAX_SEG) detener();
      }, 500);
    } catch {
      setError("No pudimos usar el micrófono. Revisa el permiso del navegador o responde por escrito.");
      setEscribir(true);
    }
  }

  function detener() {
    if (reloj.current) clearInterval(reloj.current);
    reloj.current = null;
    if (grabador.current?.state === "recording") grabador.current.stop();
  }

  async function enviar(entrada: { audio?: Blob; texto?: string }) {
    if (!token || !tema) return;
    setPaso("enviando");
    const f = new FormData();
    f.set("accion", "responder");
    f.set("token", token);
    f.set("tema", tema.id);
    f.set("ronda", String(ronda));
    if (ronda === 1 && repregunta) f.set("pregunta", repregunta);
    if (entrada.audio) {
      const ext = entrada.audio.type.includes("mp4") ? "m4a" : entrada.audio.type.includes("ogg") ? "ogg" : "webm";
      f.set("audio", entrada.audio, `respuesta.${ext}`);
      f.set("segundos", String(Math.round((Date.now() - inicio.current) / 1000)));
    } else {
      f.set("texto", entrada.texto ?? "");
    }
    try {
      const r = await fetch("/api/gia", { method: "POST", body: f });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No pudimos guardar tu respuesta.");
      setLog((l) => [...l, { quien: "persona", texto: d.transcripcion }]);
      setTexto("");
      if (ronda === 0) setRespondidos((n) => n + 1);
      if (ronda === 0 && d.repregunta) {
        setRonda(1);
        setRepregunta(d.repregunta);
        setPaso("pregunta");
        preguntar(d.repregunta);
        return;
      }
      avanzar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tu respuesta.");
      setPaso("pregunta");
    }
  }

  function avanzar() {
    setRonda(0);
    setRepregunta(null);
    setPaso("pregunta");
    const sig = idxTema + 1;
    if (sig >= TEMAS.length) {
      void terminar();
      return;
    }
    setIdxTema(sig);
    preguntar(TEMAS[sig].pregunta);
  }

  async function terminar() {
    if (!token) return;
    if (reloj.current) clearInterval(reloj.current);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setError(null);
    setFase("analizando");
    try {
      const r = await fetch("/api/gia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "terminar", token }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No pudimos armar tu ficha.");
      setAnalisis(d.analisis);
      setFase("ficha");
      leer("Listo. Esto es lo que entendí de tu trabajo. Revísalo y confírmalo si te representa.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos armar tu ficha.");
      setFase("tema");
    }
  }

  async function confirmar() {
    if (!token) return;
    const r = await fetch("/api/gia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "confirmar", token }),
    });
    const d = await r.json();
    if (r.ok) setConfirmadaId(d.id);
    else setError(d.error || "No pudimos confirmar.");
  }

  function otraPersona() {
    try { localStorage.removeItem(CLAVE); } catch {}
    window.location.reload();
  }

  // ─── Pantallas ─────────────────────────────────────────────────────────────

  if (fase === "datos") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
        <form onSubmit={empezar} className="caja" style={{ flex: "999 1 520px", display: "flex", flexDirection: "column", gap: 18 }}>
          <p className="acento small" style={{ margin: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>Antes de partir</p>
          <h1 style={{ fontSize: 28 }}>Una conversación de unos 10 minutos sobre tu trabajo</h1>
          <p className="tenue" style={{ margin: 0 }}>
            El agente te hará seis preguntas en voz alta y tú respondes hablando. Al final verás lo que entendió y podrás confirmarlo.
          </p>
          <label>Tu nombre (como quieras aparecer)
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
          {error && <div className="error" role="alert">{error}</div>}
          <div>
            <button type="submit" className="b-pri" disabled={enviandoDatos}>{enviandoDatos ? "Preparando…" : "Empezar entrevista"}</button>
          </div>
        </form>
        <aside className="caja" style={{ flex: "1 1 280px", display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
          <h2 style={{ fontSize: 17 }}>Cómo cuidamos lo que dices</h2>
          <p className="tenue" style={{ margin: 0 }}>Tu voz se transcribe y el audio no se guarda.</p>
          <p className="tenue" style={{ margin: 0 }}>Tu perfil sale de lo que haces y cómo trabajas, nunca de tu tono de voz o tu forma de hablar.</p>
          <p className="tenue" style={{ margin: 0 }}>Cada conclusión viene con la frase tuya que la respalda, y puedes revisarla antes de confirmar.</p>
          <p className="tenue" style={{ margin: 0 }}>Este es un entorno de demostración: tus respuestas se borran después de la reunión.</p>
        </aside>
      </div>
    );
  }

  if (fase === "analizando") {
    return (
      <div className="caja" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "48px 24px", textAlign: "center" }}>
        <div className="mic hablando" aria-hidden="true"><span className="anillo" /><span className="nucleo" /></div>
        <h2 style={{ fontSize: 22 }}>Armando tu ficha…</h2>
        <p className="tenue" style={{ margin: 0, maxWidth: 520 }}>Estamos leyendo tus respuestas para ordenar tus tareas, tu uso de IA y tu perfil de adopción. Toma menos de un minuto.</p>
      </div>
    );
  }

  if (fase === "ficha" && analisis) {
    const p = arquetipoPorId(analisis.perfil.principal);
    const pot = arquetipoPorId(analisis.perfil.potencial);
    const nivel = NIVELES.find((n) => n.n === analisis.perfil.madurez);
    return (
      <div className="caja" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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

  // fase === "tema"
  const ocupado = paso !== "pregunta";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "stretch" }}>
      <section className="caja" style={{ flex: "999 1 560px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <button
            type="button"
            className={`mic ${paso === "grabando" ? "grabando" : hablando ? "hablando" : ""}`}
            onClick={paso === "grabando" ? detener : grabar}
            disabled={paso === "enviando" || escribir}
            aria-label={paso === "grabando" ? "Terminar mi respuesta" : "Grabar mi respuesta"}
          >
            <span className="anillo" />
            <span className="nucleo">
              {paso === "grabando" ? (
                <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="#fff" /></svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              )}
            </span>
          </button>
          <div className="sora" style={{ fontSize: 20, fontWeight: 600 }} aria-live="polite">
            {paso === "grabando" ? "Te escucho… toca para terminar" : paso === "enviando" ? "Procesando tu respuesta…" : hablando ? "El agente está preguntando" : "Toca el micrófono para responder"}
          </div>
          <div className="tenue small">
            {paso === "grabando" ? `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")} · máximo 3 minutos · ` : ""}
            Tema {idxTema + 1} de {TEMAS.length}: {tema?.titulo}{ronda === 1 ? " · repregunta" : ""}
          </div>
        </div>

        <div className="ficha" style={{ fontSize: 17, lineHeight: 1.5 }}>
          <div className="acento small" style={{ marginBottom: 6 }}>Agente</div>
          {preguntaActual}
          {ronda === 0 && tema && <div className="tenue small" style={{ marginTop: 8 }}>{tema.ayuda}</div>}
        </div>

        {escribir && (
          <form
            onSubmit={(e) => { e.preventDefault(); if (texto.trim()) void enviar({ texto }); }}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <label>Tu respuesta
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={3000} disabled={ocupado} />
            </label>
            <div><button type="submit" className="b-cla" disabled={ocupado || !texto.trim()}>Enviar respuesta</button></div>
          </form>
        )}

        {error && <div className="error" role="alert">{error}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          <button type="button" className="b-sec" onClick={() => preguntar(preguntaActual)} disabled={ocupado}>Repetir pregunta</button>
          {ronda === 1 && <button type="button" className="b-sec" onClick={avanzar} disabled={ocupado}>Saltar repregunta</button>}
          <button type="button" className="b-cla" onClick={terminar} disabled={ocupado || respondidos < 2}>Terminar entrevista</button>
        </div>
        <div style={{ textAlign: "center" }}>
          <button type="button" className="b-link" onClick={() => setEscribir((v) => !v)} disabled={paso === "grabando"}>
            {escribir ? "Prefiero hablar" : "Prefiero escribir"}
          </button>
        </div>

        {log.length > 0 && (
          <details>
            <summary className="tenue small" style={{ cursor: "pointer", minHeight: 44, display: "flex", alignItems: "center" }}>Ver la conversación ({log.length} mensajes)</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 15, marginTop: 8 }}>
              {log.map((l, i) => (
                <div key={i} className={l.quien === "agente" ? "acento" : ""}><strong>{l.quien === "agente" ? "Agente" : nombre || "Tú"}</strong> · {l.texto}</div>
              ))}
              <div ref={finLog} />
            </div>
          </details>
        )}
      </section>

      <aside className="caja" style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="sora" style={{ fontWeight: 600, fontSize: 17 }}>Temas de la conversación</div>
        {TEMAS.map((t, i) => (
          <div key={t.id} className={`tema ${i < idxTema ? "ok" : i === idxTema ? "actual" : ""}`}>
            <span className="n">{i < idxTema ? "✓" : i + 1}</span>
            <span className="l">{t.titulo}</span>
          </div>
        ))}
        <div className="tenue small" style={{ marginTop: "auto" }}>
          Tu voz se transcribe y el audio no se guarda. El perfil se arma con lo que dices, no con cómo suena tu voz.
        </div>
        <div className="tenue small">
          Arquetipos posibles: {ARQUETIPOS.map((a) => a.nombre).join(", ")}.
        </div>
      </aside>
    </div>
  );
}
