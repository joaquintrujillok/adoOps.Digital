import AsesorCoe from "@/components/gia/AsesorCoe";
import Videos from "@/components/gia/Videos";
import Link from "next/link";
import { DOCS, IDEAS, NIVELES_AUTONOMIA } from "@/lib/gia/semilla";

/** Etapa 2: el CoE que queda funcionando después del levantamiento. */
export default function Coe() {
  return (
    <>
      <header>
        <div className="small muted">Etapa 2 · Lo que queda funcionando después del levantamiento</div>
        <h1>CoE as a Service</h1>
        <p style={{ margin: "8px 0 0", maxWidth: 760, color: "var(--g-suave)" }}>
          Un asesor que responde si algo se puede hacer y cómo, videos paso a paso, estándares claros, el repositorio de documentos y el banco de ideas.
        </p>
      </header>

      <AsesorCoe />

      <Videos />

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
        <Link href="/gia/repositorio" className="card puerta">
          <span className="small muted">Módulo</span>
          <span className="sora" style={{ fontSize: 20, fontWeight: 600 }}>Repositorio de documentos</span>
          <span style={{ color: "var(--g-suave)" }}>{DOCS.length} documentos entre políticas, estándares, guías, plantillas y casos.</span>
          <span style={{ marginTop: "auto", fontWeight: 600, color: "var(--g-verde)" }}>Abrir repositorio →</span>
        </Link>
        <Link href="/gia/ideas" className="card puerta">
          <span className="small muted">Módulo</span>
          <span className="sora" style={{ fontSize: 20, fontWeight: 600 }}>Banco de ideas</span>
          <span style={{ color: "var(--g-suave)" }}>{IDEAS.length} ideas y {IDEAS.reduce((s, i) => s + i.votos, 0)} votos. Las personas proponen y el CoE evalúa.</span>
          <span style={{ marginTop: "auto", fontWeight: 600, color: "var(--g-verde)" }}>Ver ideas →</span>
        </Link>
      </section>
    </>
  );
}
