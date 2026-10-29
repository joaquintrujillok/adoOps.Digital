"use client";

// El asesor del CoE, con forma de chat: preguntas sugeridas, indicador de que
// está escribiendo y respuestas que dicen primero si se puede, después cómo,
// con qué documento lo respalda y a quién escalar.
//
// En la fase 1 las respuestas son preparadas: lo escrito libremente se lleva a
// la sugerida más parecida por palabras clave, y si no calza con ninguna lo dice
// en vez de inventar. Conectarlo a un modelo con los lineamientos del cliente es
// parte de la etapa 2.

import { useEffect, useRef, useState } from "react";
import { CONSULTAS_COE } from "@/lib/gia/semilla";

type Mensaje = { de: "persona"; texto: string } | { de: "asesor"; i: number } | { de: "asesor-nada" };

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

export default function AsesorCoe() {
  const [msgs, setMsgs] = useState<Mensaje[]>([]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState("");
  const fin = useRef<HTMLDivElement | null>(null);

  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [msgs, escribiendo]);

  function preguntar(pregunta: string, i: number) {
    if (escribiendo) return;
    setMsgs((m) => [...m, { de: "persona", texto: pregunta }]);
    setEscribiendo(true);
    setTimeout(() => {
      setEscribiendo(false);
      setMsgs((m) => [...m, i >= 0 ? { de: "asesor", i } : { de: "asesor-nada" }]);
    }, 1100);
  }

  return (
    <section className="card asesor">
      <div className="asesor-cab">
        <span className="asesor-avatar" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" /><path d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" /></svg>
        </span>
        <div>
          <div className="sora" style={{ fontWeight: 600 }}>Asesor del CoE</div>
          <div className="small muted">Responde con los estándares de la empresa y te dice a quién escalar</div>
        </div>
      </div>

      <div className="chat" aria-live="polite">
        {msgs.length === 0 && (
          <div className="chat-vacio">
            <div className="sora" style={{ fontSize: 18, fontWeight: 600 }}>¿Qué quieres hacer con IA?</div>
            <div className="small muted">Pregunta si algo se puede, cómo hacerlo o quién lo aprueba.</div>
          </div>
        )}
        {msgs.map((m, k) => {
          if (m.de === "persona") return <div key={k} className="burbuja yo">{m.texto}</div>;
          if (m.de === "asesor-nada") {
            return (
              <div key={k} className="burbuja ia">
                No tengo una respuesta preparada para eso en esta demo. Prueba con una de las preguntas sugeridas; con el cliente, el asesor responde sobre sus propios estándares.
              </div>
            );
          }
          const c = CONSULTAS_COE[m.i];
          return (
            <div key={k} className="burbuja ia">
              <div className="veredicto">{c.veredicto}</div>
              <span className={`pill t-${c.tono}`}>{c.nivel}</span>
              <div>{c.intro}</div>
              <ol className="pasos-ia">{c.pasos.map((p) => <li key={p}>{p}</li>)}</ol>
              <div className="fuentes">
                {c.fuentes.map((f) => (
                  <span key={f} className="fuente">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>
                    {f}
                  </span>
                ))}
              </div>
              <div className="small"><strong>Escalar a:</strong> {c.escala}</div>
            </div>
          );
        })}
        {escribiendo && <div className="burbuja ia escribiendo" aria-label="El asesor está escribiendo"><span /><span /><span /></div>}
        <div ref={fin} />
      </div>

      <div className="sugeridas">
        {CONSULTAS_COE.map((c, i) => (
          <button key={c.corta} type="button" className="sugerida" onClick={() => preguntar(c.pregunta, i)} disabled={escribiendo}>{c.pregunta}</button>
        ))}
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          const q = texto.trim();
          if (!q) return;
          setTexto("");
          preguntar(q, buscar(q));
        }}
      >
        <label className="sr-only" htmlFor="asesor-q">Tu pregunta</label>
        <input id="asesor-q" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu pregunta…" maxLength={300} />
        <button type="submit" aria-label="Enviar pregunta" disabled={escribiendo || !texto.trim()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </section>
  );
}
