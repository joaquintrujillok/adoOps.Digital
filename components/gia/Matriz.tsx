"use client";

import { useState } from "react";
import { ARQUETIPOS, NIVELES, campoDe, type ArquetipoId } from "@/lib/gia/modelo";
import type { CeldaMatriz } from "@/lib/gia/agregados";

function tono(v: number): [string, string] {
  if (v >= 35) return ["#1F6B45", "#FFFFFF"];
  if (v >= 20) return ["#4F9A72", "#FFFFFF"];
  if (v >= 10) return ["#A9D3BB", "#13221A"];
  if (v > 0) return ["#DCEFE3", "#13221A"];
  return ["#F4F6F3", "#4B5B52"];
}

function lectura(nivel: number): string {
  if (nivel <= 2) return "Necesitan primero reglas claras y un caso cercano a su trabajo.";
  if (nivel >= 4) return "Candidatos a champions y a construir agentes con el CoE.";
  return "Listos para Gemini con buenas prácticas y quick wins de su unidad.";
}

export default function Matriz({ matriz, total }: { matriz: Record<ArquetipoId, CeldaMatriz[]>; total: number }) {
  const [sel, setSel] = useState<{ a: ArquetipoId; n: number }>({ a: "practico", n: 1 });
  const arq = ARQUETIPOS.find((a) => a.id === sel.a)!;
  const celda = matriz[sel.a][sel.n];
  const v = celda.base + celda.vivo;

  return (
    <section className="card">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <h2>Matriz arquetipo × madurez de uso</h2>
        <span className="small muted">{total.toLocaleString("es-CL")} personas · toca una celda</span>
      </div>
      <div className="tabla">
        <div className="matriz" aria-label="Personas por arquetipo y nivel de madurez">
          <span />
          {NIVELES.map((n) => <span key={n.n} className="cab">{n.n} {n.nombre}</span>)}
          <span className="cab">Total</span>
          {ARQUETIPOS.map((a) => {
            const fila = matriz[a.id];
            return (
              <div key={a.id} style={{ display: "contents" }}>
                <div className="arq">
                  <strong>{a.nombre}</strong>
                  <span>{a.descripcion}</span>
                </div>
                {fila.map((c, i) => {
                  const total = c.base + c.vivo;
                  const [bg, fg] = tono(total);
                  return (
                    <button
                      key={i}
                      type="button"
                      className="celda"
                      style={{ background: bg, color: fg }}
                      aria-pressed={sel.a === a.id && sel.n === i}
                      aria-label={`${a.nombre}, nivel ${i + 1}: ${total} personas${c.vivo ? `, ${c.vivo} de hoy` : ""}`}
                      onClick={() => setSel({ a: a.id, n: i })}
                    >
                      {total}
                      {c.vivo > 0 && <span className="mas">+{c.vivo}</span>}
                    </button>
                  );
                })}
                <div className="total">{fila.reduce((s, c) => s + c.base + c.vivo, 0)}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="t-gris" style={{ borderRadius: 10, padding: "14px 16px", fontSize: 14, color: "var(--g-tinta)" }}>
        <strong>{arq.nombre}</strong> en {NIVELES[sel.n].nombre.toLowerCase()}: {v} personas{celda.vivo ? ` (${celda.vivo} entrevistadas hoy)` : ""}. {lectura(sel.n + 1)}{" "}
        <span className="muted">Campo {campoDe(arq.id).nombre} → ruta {campoDe(arq.id).ruta}. Aporta: {arq.aporta}</span>
      </div>
    </section>
  );
}
