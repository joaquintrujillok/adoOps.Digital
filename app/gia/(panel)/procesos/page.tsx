import Procesos from "@/components/gia/Procesos";
import { CUADRANTES, KPIS } from "@/lib/gia/semilla";

export default function PaginaProcesos() {
  return (
    <>
      <header>
        <div className="small muted">Lo que la organización hace, medido desde las entrevistas</div>
        <h1>Procesos y casos de uso</h1>
      </header>

      <Procesos />

      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Priorización: impacto vs esfuerzo</h2>
          <span className="small muted">{KPIS.casos} casos · se muestran los primeros 10</span>
        </div>
        <div className="grid" style={{ ["--min" as string]: "240px", gap: 14 }}>
          {CUADRANTES.map((q) => (
            <div key={q.titulo} className={`t-${q.tono}`} style={{ borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="sora" style={{ fontWeight: 600, fontSize: 15 }}>{q.titulo}</div>
              {q.items.map((i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "var(--g-tinta)" }}>{i}</div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
