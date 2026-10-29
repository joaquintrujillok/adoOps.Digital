"use client";

import { useState } from "react";
import { CONSULTAS_COE } from "@/lib/gia/semilla";

/**
 * El asesor del CoE con respuestas preparadas. En la fase 1 no es un chat
 * real: muestra cómo respondería el agente asesor con los lineamientos de la
 * empresa. Conectarlo a un modelo es parte de la etapa 2.
 */
export default function AsesorCoe() {
  const [sel, setSel] = useState(0);
  const c = CONSULTAS_COE[sel];
  return (
    <section className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <h2>Asesor del CoE</h2>
        <span className="small muted">Responde con los lineamientos de la empresa y dice cuándo escalar</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CONSULTAS_COE.map((q, i) => (
          <button key={q.corta} type="button" className="chip" aria-pressed={i === sel} onClick={() => setSel(i)}>{q.corta}</button>
        ))}
      </div>
      <div style={{ alignSelf: "flex-end", maxWidth: 560, background: "var(--g-tinta)", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "12px 16px" }}>{c.pregunta}</div>
      <div className="t-gris" style={{ maxWidth: 680, borderRadius: "14px 14px 14px 4px", padding: 16, display: "flex", flexDirection: "column", gap: 10, color: "var(--g-tinta)" }}>
        <span className={`pill t-${c.tono}`} style={{ alignSelf: "flex-start" }}>{c.nivel}</span>
        <div>{c.intro}</div>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
          {c.pasos.map((p) => <li key={p}>{p}</li>)}
        </ol>
        <div className="small"><strong>Escala a:</strong> {c.escala}</div>
      </div>
    </section>
  );
}
