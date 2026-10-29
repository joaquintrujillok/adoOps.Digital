import { DIMENSIONES, DOCUMENTOS, NIVELES_AUTONOMIA } from "@/lib/gia/semilla";

const ESTADO = {
  listo: ["Listo", "verde"],
  revision: ["En revisión", "ambar"],
  pendiente: ["Pendiente", "gris"],
} as const;

export default function Lineamientos() {
  return (
    <>
      <header>
        <div className="small muted">Las primeras reglas del juego: qué se puede hacer, con qué datos y a quién se escala</div>
        <h1>Lineamientos y protocolos</h1>
      </header>

      <section className="row">
        <div className="card">
          <h2>Madurez por dimensión</h2>
          {DIMENSIONES.map((d) => {
            const color = d.s >= 2 ? "#1F6B45" : d.s >= 1.5 ? "#B7791F" : "#B42318";
            return (
              <div key={d.n} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{d.n}</span><strong>{d.s.toFixed(1).replace(".", ",")} / 5</strong>
                </div>
                <div className="barra"><span style={{ width: `${(d.s / 5) * 100}%`, background: color }} /></div>
              </div>
            );
          })}
          <div className="small muted">Metodología propia de adoOps, adaptada de los marcos de madurez de IA más usados. No es una certificación.</div>
        </div>
        <div className="card">
          <h2>Documentos de la etapa 1</h2>
          {DOCUMENTOS.map((d) => {
            const [label, tono] = ESTADO[d.estado];
            return (
              <div key={d.n} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid var(--g-linea2)", paddingTop: 10 }}>
                <span>{d.n}</span><span className={`pill t-${tono}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Autonomía gobernada: quién aprueba qué</h2>
          <span className="small muted">El negocio construye; TI y Seguridad aprueban lo que escala</span>
        </div>
        <div className="grid" style={{ ["--min" as string]: "220px", gap: 12 }}>
          {NIVELES_AUTONOMIA.map((n) => (
            <div key={n.k} className={`t-${n.tono}`} style={{ borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="small" style={{ fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{n.k}</div>
              <div className="sora" style={{ fontWeight: 600, fontSize: 17 }}>{n.t}</div>
              <div style={{ fontSize: 14, color: "var(--g-tinta)" }}>{n.d}</div>
              <div className="small" style={{ marginTop: "auto", color: "var(--g-tinta)" }}><strong>Aprueba:</strong> {n.a}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
