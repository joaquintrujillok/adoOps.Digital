import AsesorCoe from "@/components/gia/AsesorCoe";
import { IDEAS, REPOSITORIO } from "@/lib/gia/semilla";

export default function Coe() {
  return (
    <>
      <header>
        <div className="small muted">Repositorio, buenas prácticas, asesor y banco de ideas: el CoE operado por adoOps</div>
        <h1>CoE as a Service</h1>
      </header>

      <AsesorCoe />

      <section className="row">
        <div className="card">
          <h2>Repositorio</h2>
          {REPOSITORIO.map((r) => (
            <div key={r.t} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderTop: "1px solid var(--g-linea2)", paddingTop: 10 }}>
              <span>{r.t}</span><span className="pill t-gris">{r.k}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Banco de ideas</h2>
          {IDEAS.map((i) => (
            <div key={i.t} style={{ borderTop: "1px solid var(--g-linea2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              <span>{i.t}</span>
              <span className="small muted">{i.area} · {i.votos} votos · <span className={`pill t-${i.estado === "Aprobada" ? "verde" : i.estado === "Nueva" ? "gris" : "ambar"}`}>{i.estado}</span></span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
