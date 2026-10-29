import AsesorCoe from "@/components/gia/AsesorCoe";
import { DOCUMENTOS, IDEAS, NIVELES_AUTONOMIA, REPOSITORIO, VIDEOS } from "@/lib/gia/semilla";

const ESTADO = {
  listo: ["Publicado", "verde"],
  revision: ["En revisión", "ambar"],
  pendiente: ["Pendiente", "gris"],
} as const;

/** Etapa 2: el CoE que queda funcionando después del levantamiento. */
export default function Coe() {
  return (
    <>
      <header>
        <div className="small muted">Etapa 2 · Lo que queda funcionando después del levantamiento</div>
        <h1>CoE as a Service</h1>
        <p style={{ margin: "8px 0 0", maxWidth: 760, color: "var(--g-suave)" }}>
          Estándares claros, un repositorio con documentos y videos paso a paso, y un asesor que responde si algo se puede hacer, cómo, y a quién escalar.
        </p>
      </header>

      <AsesorCoe />

      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Estándares: quién aprueba qué</h2>
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

      <section className="row">
        <div className="card">
          <h2>Repositorio de documentos</h2>
          {[...DOCUMENTOS.map((d) => ({ t: d.n, k: ESTADO[d.estado] })), ...REPOSITORIO.map((r) => ({ t: r.t, k: [r.k, "gris"] as const }))].map((d) => (
            <div key={d.t} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid var(--g-linea2)", paddingTop: 10 }}>
              <span>{d.t}</span><span className={`pill t-${d.k[1]}`}>{d.k[0]}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Videos paso a paso</h2>
          {VIDEOS.map((v) => (
            <div key={v.t} style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--g-linea2)", paddingTop: 10 }}>
              <span className="video-mini" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
              </span>
              <span style={{ flex: 1 }}>{v.t}</span>
              <span className="small muted" style={{ whiteSpace: "nowrap" }}>{v.min} min · {v.capa}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Banco de ideas</h2>
        {IDEAS.map((i) => (
          <div key={i.t} style={{ borderTop: "1px solid var(--g-linea2)", paddingTop: 10, display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            <span>{i.t}</span>
            <span className="small muted">{i.area} · {i.votos} votos · <span className={`pill t-${i.estado === "Aprobada" ? "verde" : i.estado === "Nueva" ? "gris" : "ambar"}`}>{i.estado}</span></span>
          </div>
        ))}
      </section>
    </>
  );
}
