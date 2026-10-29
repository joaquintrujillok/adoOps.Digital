"use client";

// El flujo entre unidades: cómo se mueve el trabajo hoy, según las entrevistas.
//
// Es la pantalla que explica para qué sirve el levantamiento más allá del perfil
// de cada persona. Arriba, las tareas que se repiten entre unidades; abajo, los
// flujos. Al elegir una tarea se iluminan todos los pasos donde aparece, en los
// tres flujos a la vez: así se ve que el informe de Recepción y el de Trade
// marketing son la misma tarea en áreas que no se hablan, y que un solo agente
// puede servir a las dos.

import { useState } from "react";
import { SOLUCIONES } from "@/lib/gia/modelo";
import { COMPARTIDAS, FLUJOS, type CompartidaId } from "@/lib/gia/semilla";

const TONO: Record<CompartidaId, string> = { consolidar: "ambar", doble: "morado", consultas: "azul", minutas: "verde" };
const ETIQUETA: Record<CompartidaId, string> = { consolidar: "Consolida planillas", doble: "Digita dos veces", consultas: "Consultas repetidas", minutas: "Minutas" };

export default function Flujo() {
  const [sel, setSel] = useState<CompartidaId | null>("consolidar");
  const actual = COMPARTIDAS.find((c) => c.id === sel);

  return (
    <>
      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Lo que se repite entre unidades</h2>
          <span className="small muted">Elige una tarea para ver dónde aparece en los flujos</span>
        </div>
        <div className="grid" style={{ ["--min" as string]: "230px", gap: 12 }}>
          {COMPARTIDAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`compartida t-${TONO[c.id]}`}
              aria-pressed={sel === c.id}
              onClick={() => setSel(sel === c.id ? null : c.id)}
            >
              <span className="sora" style={{ fontWeight: 600, fontSize: 15 }}>{c.t}</span>
              <span className="small">{c.unidades.length} unidades · {c.personas} personas</span>
              <span className="kpi" style={{ fontSize: 24 }}>{c.h.toLocaleString("es-CL")} h/mes</span>
            </button>
          ))}
        </div>
        {actual && (
          <div className="t-gris" style={{ borderRadius: 10, padding: "14px 16px", color: "var(--g-tinta)", display: "flex", flexDirection: "column", gap: 4 }}>
            <div><strong>{actual.t}.</strong> {actual.d}</div>
            <div className="small">Aparece en: {actual.unidades.join(" · ")}</div>
            <div className="small"><strong>Un solo caso para todas:</strong> {actual.propuesta} <span className={`pill t-${TONO[actual.id]}`}>{SOLUCIONES[actual.solucion]}</span></div>
          </div>
        )}
      </section>

      {FLUJOS.map((f) => (
        <section key={f.id} className="card">
          <div>
            <h2>{f.t}</h2>
            <div className="small muted">{f.d}</div>
          </div>
          <div className="flujo" role="list">
            {f.pasos.map((p, i) => {
              const encendido = sel ? p.compartidas.includes(sel) : false;
              const apagado = sel !== null && !encendido;
              return (
                <div key={p.unidad + i} className="flujo-tramo" role="listitem">
                  <div className={`paso ${p.externa ? "externo" : ""} ${encendido ? `on t-borde-${TONO[sel!]}` : ""} ${apagado ? "off" : ""}`}>
                    <div className="small muted">{p.gerencia}{p.personas ? ` · ${p.personas} personas` : ""}</div>
                    <div className="sora" style={{ fontWeight: 600, fontSize: 16 }}>{p.unidad}</div>
                    <div className="small">{p.hace}</div>
                    {p.manual && (
                      <div className="a-mano">
                        <div><strong>A mano:</strong> {p.manual.texto}</div>
                        {p.manual.cita && <div style={{ fontStyle: "italic", marginTop: 4 }}>“{p.manual.cita}”</div>}
                        <div className="quien">{p.manual.quien}</div>
                      </div>
                    )}
                    {p.compartidas.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.compartidas.map((c) => <span key={c} className={`pill t-${TONO[c]}`} style={{ fontSize: 11 }}>{ETIQUETA[c]}</span>)}
                      </div>
                    )}
                  </div>
                  {p.entrega && i < f.pasos.length - 1 && (
                    <div className="flecha" aria-label={`entrega ${p.entrega}`}>
                      <span>{p.entrega}</span>
                      <svg width="28" height="14" viewBox="0 0 28 14" aria-hidden="true"><path d="M0 7h24M18 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="small muted" style={{ margin: 0 }}>
        Las cajas punteadas son externas a la empresa. En rojo, lo que hoy se hace a mano o fuera del sistema, con la persona y la pregunta de la entrevista donde se dijo.
      </p>
    </>
  );
}
