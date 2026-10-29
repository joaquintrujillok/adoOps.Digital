import { ANIOS, ESCENARIOS, ROADMAP } from "@/lib/gia/semilla";

const ESTILO = {
  verde: { background: "var(--g-verde)", color: "#fff", borderColor: "var(--g-verde)" },
  oscuro: { background: "var(--g-tinta)", color: "#fff", borderColor: "var(--g-tinta)" },
  blanco: {},
} as const;

export default function HojaDeRuta() {
  return (
    <>
      <header>
        <div className="small muted">Etapa 1 corta de diagnóstico; etapa 2 larga de implementación</div>
        <h1>Hoja de ruta 12 · 24 · 36 meses</h1>
      </header>

      <section className="grid" style={{ ["--min" as string]: "240px", gap: 14 }}>
        {ROADMAP.map((r) => (
          <div key={r.q} className="card" style={{ ...ESTILO[r.estilo], gap: 10 }}>
            <span className="small" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.85 }}>{r.q}</span>
            <span className="sora" style={{ fontSize: 20, fontWeight: 600 }}>{r.t}</span>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              {r.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
            <span className="small" style={{ marginTop: "auto", opacity: 0.85 }}>Hito: {r.h}</span>
          </div>
        ))}
      </section>

      <section className="grid" style={{ ["--min" as string]: "280px", gap: 16 }}>
        {ESCENARIOS.map((e) => (
          <div key={e.k} className="card" style={ESTILO[e.estilo]}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span className="small" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.85 }}>{e.k}</span>
              <span className="pill" style={{ background: e.estilo === "blanco" ? "var(--g-verde-cl)" : "rgba(255,255,255,0.16)", color: e.estilo === "blanco" ? "var(--g-verde-osc)" : "#fff" }}>{e.tag}</span>
            </div>
            <span className="sora" style={{ fontSize: 21, fontWeight: 600 }}>{e.t}</span>
            <span className="small" style={{ opacity: 0.9 }}>{e.d}</span>
            <div>
              <div className="kpi">{e.p}</div>
              <div className="small" style={{ opacity: 0.85 }}>{e.pn}</div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
              {e.inc.map((i) => <li key={i}>{i}</li>)}
            </ul>
            <span className="small" style={{ marginTop: "auto", opacity: 0.85 }}>{e.no}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Inversión por año</h2>
        <div className="tabla">
          <table>
            <thead><tr><th>Modalidad</th><th>Año 1</th><th>Año 2</th><th>Año 3</th></tr></thead>
            <tbody>
              {ANIOS.map((a) => (
                <tr key={a.m}><td style={{ fontWeight: 500 }}>{a.m}</td><td>{a.a}</td><td>{a.b}</td><td>{a.c}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted">Valores referenciales en UF, sin IVA. Licencias y consumo de modelos aparte.</div>
      </section>
    </>
  );
}
