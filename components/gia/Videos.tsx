"use client";

// Los videos paso a paso del CoE, con la forma de una plataforma de cursos:
// reproductor protagonista, capítulos al lado y el resto de la biblioteca abajo.
//
// En la demo no hay video grabado: el reproductor avanza por los capítulos y
// muestra cada paso en pantalla, y lo dice ("Vista previa"). Los videos reales
// se graban con el cliente en la etapa 2 y reemplazan esta vista sin cambiar la
// forma de la pantalla.

import { useEffect, useRef, useState } from "react";
import { VIDEOS } from "@/lib/gia/semilla";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** La vista previa corre 12 veces más rápido: un capítulo de un minuto dura 5 s. */
const VELOCIDAD = 12;

export default function Videos() {
  const [id, setId] = useState(VIDEOS[0].id);
  const [t, setT] = useState(0);
  const [play, setPlay] = useState(false);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  const v = VIDEOS.find((x) => x.id === id)!;
  const total = v.pasos.reduce((s, p) => s + p.seg, 0);
  const inicios = v.pasos.map((_, i) => v.pasos.slice(0, i).reduce((s, p) => s + p.seg, 0));
  const actual = Math.max(0, inicios.findLastIndex((x) => x <= t));

  useEffect(() => {
    if (!play) return;
    reloj.current = setInterval(() => {
      setT((x) => {
        const n = x + VELOCIDAD / 4;
        if (n >= total) {
          setPlay(false);
          return total;
        }
        return n;
      });
    }, 250);
    return () => { if (reloj.current) clearInterval(reloj.current); };
  }, [play, total]);

  function elegir(nuevo: string) {
    setId(nuevo);
    setT(0);
    setPlay(false);
  }

  function alternar() {
    if (t >= total) setT(0);
    setPlay((p) => !p);
  }

  return (
    <section className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <h2>Videos paso a paso</h2>
        <span className="small muted">Cortos, de un solo tema, grabados con las personas de cada área</span>
      </div>

      <div className="video-layout">
        <div className="reproductor">
          <div className="pantalla" role="img" aria-label={`Vista previa: ${v.t}`}>
            <span className="pv-badge">Vista previa</span>
            <span className="pv-capa">{v.capa}</span>
            {t === 0 && !play ? (
              <div className="pv-portada">
                <div className="pv-titulo">{v.t}</div>
                <div className="pv-meta">{v.pasos.length} pasos · {mmss(total)}</div>
              </div>
            ) : (
              <div className="pv-paso" key={actual}>
                <div className="pv-n">Paso {actual + 1} de {v.pasos.length}</div>
                <div className="pv-texto">{v.pasos[actual].t}</div>
                <div className="pv-maqueta" aria-hidden="true">
                  <span /><span /><span className="corta" />
                </div>
              </div>
            )}
            {!play && (
              <button type="button" className="pv-play" onClick={alternar} aria-label="Reproducir vista previa">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </button>
            )}
          </div>
          <div className="controles">
            <button type="button" className="ctl" onClick={alternar} aria-label={play ? "Pausar" : "Reproducir"}>
              {play ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <div className="barra-cap" aria-hidden="true">
              {v.pasos.map((p, i) => {
                const lleno = Math.min(1, Math.max(0, (t - inicios[i]) / p.seg));
                return <span key={i} style={{ flex: p.seg }}><i style={{ width: `${lleno * 100}%` }} /></span>;
              })}
            </div>
            <span className="tiempo">{mmss(t)} / {mmss(total)}</span>
          </div>
        </div>

        <ol className="capitulos" aria-label="Contenido del video">
          {v.pasos.map((p, i) => {
            const hecho = t >= inicios[i] + p.seg;
            const en = i === actual && (t > 0 || play);
            return (
              <li key={i}>
                <button type="button" className={`${en ? "en" : ""} ${hecho ? "hecho" : ""}`} onClick={() => { setT(inicios[i]); setPlay(true); }}>
                  <span className="cap-n">{hecho ? "✓" : i + 1}</span>
                  <span className="cap-t">{p.t}</span>
                  <span className="cap-d">{mmss(p.seg)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="biblioteca">
        {VIDEOS.map((x) => {
          const dur = x.pasos.reduce((s, p) => s + p.seg, 0);
          return (
            <button key={x.id} type="button" className={`mini ${x.id === id ? "sel" : ""}`} onClick={() => elegir(x.id)} aria-pressed={x.id === id}>
              <span className="mini-thumb">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                <span className="mini-dur">{mmss(dur)}</span>
              </span>
              <span className="mini-t">{x.t}</span>
              <span className="small muted">{x.capa} · {x.pasos.length} pasos</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
