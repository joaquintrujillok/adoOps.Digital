"use client";

// El asesor del CoE, con forma de asistente de IA.
//
// Dos columnas: la conversación y, al lado, el contexto de la última respuesta
// (en qué nivel de autonomía cae, quién aprueba, qué documentos la respaldan).
// La respuesta se ordena siempre igual: primero el veredicto, con color e ícono
// (sí · con revisión · no), después los pasos, las fuentes y a quién escalar, y
// al pie lo que la persona puede hacer a continuación.
//
// En la fase 1 las respuestas son preparadas: lo escrito libremente se lleva a
// la sugerida más parecida por palabras clave, y si no calza con ninguna lo dice
// en vez de inventar. Conectarlo a un modelo con los estándares del cliente es
// parte de la etapa 2.

import { useEffect, useRef, useState } from "react";
import { CONSULTAS_COE, NIVELES_AUTONOMIA } from "@/lib/gia/semilla";

type Mensaje = { de: "persona"; texto: string } | { de: "asesor"; i: number } | { de: "asesor-nada" };

const CATEGORIA = ["¿Se puede?", "¿Puedo usar…?", "¿Cómo lo hago?"];

function buscar(texto: string): number {
  const t = texto.toLowerCase();
  let mejor = -1;
  let puntos = 0;
  CONSULTAS_COE.forEach((c, i) => {
    const p = c.claves.filter((k) => t.includes(k)).length;
    if (p > puntos) { puntos = p; mejor = i; }
  });
  return mejor;
}

function Icono({ tipo }: { tipo: "si" | "condicionado" | "no" }) {
  if (tipo === "si") return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
  if (tipo === "no") return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>;
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 7v6M12 17h.01" /></svg>;
}

const Chispa = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" /><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" /></svg>
);

/** Muestra el texto de a poco, como un asistente que escribe. */
function Escribe({ texto, alTerminar }: { texto: string; alTerminar?: () => void }) {
  const [n, setN] = useState(0);
  const avisado = useRef(false);
  useEffect(() => {
    const reducido = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const i = setInterval(() => setN((x) => (reducido ? texto.length : Math.min(texto.length, x + 3))), 18);
    return () => clearInterval(i);
  }, [texto]);
  useEffect(() => {
    if (n >= texto.length && !avisado.current) {
      avisado.current = true;
      alTerminar?.();
    }
  }, [n, texto.length, alTerminar]);
  return <>{texto.slice(0, n)}</>;
}

function Respuesta({ i, ultima }: { i: number; ultima: boolean }) {
  const c = CONSULTAS_COE[i];
  const [listo, setListo] = useState(!ultima);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <div className="resp">
      <div className={`veredicto-banda v-${c.tipo}`}>
        <span className="v-ico"><Icono tipo={c.tipo} /></span>
        <div>
          <div className="v-titulo">{c.veredicto}</div>
          <div className="v-nivel">{c.nivel}</div>
        </div>
      </div>
      <p className="resp-intro">{listo ? c.intro : <Escribe texto={c.intro} alTerminar={() => setListo(true)} />}</p>
      {listo && (
        <>
          <ol className="pasos-linea">
            {c.pasos.map((p, k) => (
              <li key={p} style={{ animationDelay: `${k * 90}ms` }}>
                <span className="pl-n">{k + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <div className="resp-pie">
            <div className="fuentes">
              <span className="small muted">Basado en</span>
              {c.fuentes.map((f) => (
                <span key={f} className="fuente">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                  {f}
                </span>
              ))}
            </div>
            <div className="acciones">
              {c.acciones.map((a, k) => (
                <button key={a} type="button" className={k === 0 ? "acc acc-pri" : "acc"} onClick={() => setAviso(a)}>{a}</button>
              ))}
              <span className="feedback" aria-label="¿Te sirvió?">
                <button type="button" aria-label="Me sirvió"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-8c1.7 0 3 1.3 3 3v3h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" /></svg></button>
                <button type="button" aria-label="No me sirvió"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: "rotate(180deg)" }}><path d="M7 11v9H4v-9zM7 11l4-8c1.7 0 3 1.3 3 3v3h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" /></svg></button>
              </span>
            </div>
            {aviso && (
              <div className="small muted" role="status">
                “{aviso}” queda disponible cuando el CoE está en marcha con el cliente (etapa 2).
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function AsesorCoe() {
  const [msgs, setMsgs] = useState<Mensaje[]>([]);
  const [pensando, setPensando] = useState(false);
  const [texto, setTexto] = useState("");
  const fin = useRef<HTMLDivElement | null>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs, pensando]);

  const ultimaRespuesta = [...msgs].reverse().find((m): m is { de: "asesor"; i: number } => m.de === "asesor");
  const ctx = ultimaRespuesta ? CONSULTAS_COE[ultimaRespuesta.i] : null;

  function preguntar(pregunta: string, i: number) {
    if (pensando) return;
    setMsgs((m) => [...m, { de: "persona", texto: pregunta }]);
    setPensando(true);
    setTimeout(() => {
      setPensando(false);
      setMsgs((m) => [...m, i >= 0 ? { de: "asesor", i } : { de: "asesor-nada" }]);
    }, 1300);
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    if (!q) return;
    setTexto("");
    preguntar(q, buscar(q));
  }

  const compositor = (
    <form className="compositor" onSubmit={enviar}>
      <label className="sr-only" htmlFor="asesor-q">Tu pregunta</label>
      <input id="asesor-q" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Pregunta si algo se puede, cómo hacerlo o quién lo aprueba…" maxLength={300} autoComplete="off" />
      <button type="submit" aria-label="Enviar pregunta" disabled={pensando || !texto.trim()}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
      </button>
    </form>
  );

  return (
    <section className="card asesor2">
      <div className="as-chat">
        <div className="as-cab">
          <span className="as-avatar"><Chispa /></span>
          <div style={{ flex: 1 }}>
            <div className="sora" style={{ fontWeight: 600 }}>Asesor del CoE</div>
            <div className="small muted"><span className="en-linea" /> Responde con los estándares de Valle Sur</div>
          </div>
          {msgs.length > 0 && <button type="button" className="as-nueva" onClick={() => setMsgs([])}>Nueva conversación</button>}
        </div>

        {msgs.length === 0 ? (
          <div className="as-inicio">
            <span className="as-orbe"><Chispa size={28} /></span>
            <h3 className="sora">¿Qué quieres hacer con IA?</h3>
            <p className="muted">Te digo si se puede, cómo hacerlo paso a paso y a quién escalar.</p>
            {compositor}
            <div className="as-sugerencias">
              {CONSULTAS_COE.map((c, i) => (
                <button key={c.corta} type="button" onClick={() => preguntar(c.pregunta, i)}>
                  <span className="as-cat">{CATEGORIA[i] ?? "Pregunta"}</span>
                  <span>{c.pregunta}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="as-hilo" aria-live="polite">
              {msgs.map((m, k) => {
                if (m.de === "persona") return <div key={k} className="msg-yo">{m.texto}</div>;
                return (
                  <div key={k} className="msg-ia">
                    <span className="as-avatar sm"><Chispa size={14} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="msg-meta">Asesor del CoE</div>
                      {m.de === "asesor" ? (
                        <Respuesta i={m.i} ultima={k === msgs.length - 1} />
                      ) : (
                        <div className="resp">
                          <p className="resp-intro">No tengo una respuesta preparada para eso en esta demo. Prueba con una de las sugerencias; con el cliente, el asesor responde sobre sus propios estándares.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {pensando && (
                <div className="msg-ia">
                  <span className="as-avatar sm"><Chispa size={14} /></span>
                  <div className="pensando">
                    <span className="brillo">Revisando los estándares del CoE…</span>
                  </div>
                </div>
              )}
              <div ref={fin} />
            </div>
            <div className="as-pie">
              <div className="as-chips">
                {CONSULTAS_COE.map((c, i) => (
                  <button key={c.corta} type="button" onClick={() => preguntar(c.pregunta, i)} disabled={pensando}>{c.corta}</button>
                ))}
              </div>
              {compositor}
            </div>
          </>
        )}
      </div>

      <aside className="as-ctx" aria-label="Contexto de la respuesta">
        <div className="small muted" style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Contexto</div>
        <div>
          <div className="ctx-t">Nivel de autonomía</div>
          <ol className="niveles-ctx">
            {NIVELES_AUTONOMIA.map((n, k) => {
              const on = ctx?.nivelN === k + 1;
              return (
                <li key={n.k} className={on ? `on t-${n.tono}` : ""}>
                  <span className="nc-n">{k + 1}</span>
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{n.t}</span>
                    <span className="small" style={{ opacity: 0.8 }}>Aprueba: {n.a}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          {ctx && ctx.nivelN === null && <div className="small muted" style={{ marginTop: 8 }}>Esta respuesta es de política de uso, no de un caso nuevo.</div>}
        </div>
        {ctx ? (
          <>
            <div>
              <div className="ctx-t">A quién escalar</div>
              <div className="ctx-escala">{ctx.escala === "no requiere" ? "No requiere escalar" : ctx.escala}</div>
            </div>
            <div>
              <div className="ctx-t">Documentos citados</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ctx.fuentes.map((f) => (
                  <div key={f} className="doc-card">
                    <span className="doc-ico" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg></span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="small muted">Cuando hagas una pregunta, acá verás en qué nivel cae, quién aprueba y qué documentos respaldan la respuesta.</div>
        )}
      </aside>
    </section>
  );
}
