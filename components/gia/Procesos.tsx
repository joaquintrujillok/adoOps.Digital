"use client";

import { useState } from "react";
import { SOLUCIONES } from "@/lib/gia/modelo";
import { PROCESOS, type SolucionSemilla } from "@/lib/gia/semilla";

const TONO: Record<SolucionSemilla, string> = { gemini: "azul", gem: "morado", agente_proceso: "verde", agente_datos: "ambar" };
const FILTROS = ["Todas", "Operaciones", "Comercial", "Administración y Finanzas"];

export default function Procesos() {
  const [filtro, setFiltro] = useState("Todas");
  const filas = PROCESOS.filter((p) => filtro === "Todas" || p.g === filtro);
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FILTROS.map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={f === filtro} onClick={() => setFiltro(f)}>{f}</button>
        ))}
      </div>
      <section className="card" style={{ gap: 4 }}>
        <h2 style={{ marginBottom: 12 }}>Procesos con más horas repetitivas</h2>
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Proceso</th><th>Unidad</th><th>Personas</th><th>h/mes</th><th>Mejor solución</th></tr>
            </thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.p}>
                  <td style={{ fontWeight: 500 }}>{r.p}</td>
                  <td className="muted">{r.u}</td>
                  <td>{r.n}</td>
                  <td style={{ fontWeight: 600 }}>{r.h}</td>
                  <td><span className={`pill t-${TONO[r.s]}`}>{SOLUCIONES[r.s]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
