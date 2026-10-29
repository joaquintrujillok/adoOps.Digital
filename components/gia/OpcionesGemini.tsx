"use client";

import { useState } from "react";
import { OPCIONES_GEMINI } from "@/lib/gia/semilla";

export default function OpcionesGemini() {
  const [sel, setSel] = useState(2);
  const o = OPCIONES_GEMINI[sel];
  return (
    <>
      <section className="grid" style={{ ["--min" as string]: "260px", gap: 16 }}>
        {OPCIONES_GEMINI.map((x, i) => (
          <button
            key={x.t}
            type="button"
            onClick={() => setSel(i)}
            aria-pressed={i === sel}
            className="card"
            style={{ textAlign: "left", borderWidth: 2, borderColor: i === sel ? "var(--g-verde)" : "var(--g-linea)" }}
          >
            <span className="small" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: i === 2 ? "var(--g-verde)" : "var(--g-gris)" }}>{x.tag}</span>
            <span className="sora" style={{ fontSize: 19, fontWeight: 600 }}>{x.t}</span>
            <span className="small" style={{ color: "var(--g-suave)" }}>{x.d}</span>
            <span style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 12px", fontSize: 14, marginTop: "auto" }}>
              <span className="muted">Horas cubiertas</span><strong>{x.h}</strong>
              <span className="muted">Valor anual</span><strong>{x.v}</strong>
              <span className="muted">Costo anual</span><strong>{x.c}</strong>
              <span className="muted">Beneficio neto</span><strong style={{ color: "var(--g-verde)" }}>{x.r}</strong>
            </span>
          </button>
        ))}
      </section>
      <section className="card">
        <h2>{o.t}: qué resuelve y qué no</h2>
        {o.det.map((d) => (
          <div key={d} style={{ borderTop: "1px solid var(--g-linea2)", paddingTop: 10 }}>{d}</div>
        ))}
      </section>
    </>
  );
}
