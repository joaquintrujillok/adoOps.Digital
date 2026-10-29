import Link from "next/link";
import { EMPRESA } from "@/lib/gia/semilla";

/** La portada del demo: tres caminos, igual que el mockup de inicio. */
export default function InicioGia() {
  return (
    <div style={{ padding: "40px 16px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="sora" style={{ width: 36, height: 36, borderRadius: 10, background: "var(--g-verde)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>a</div>
            <div className="sora" style={{ fontWeight: 600, fontSize: 18 }}>
              adoOps <span className="muted" style={{ fontWeight: 500 }}>· Gobierno y adopción de IA</span>
            </div>
          </div>
          <span className="pill t-ambar" style={{ border: "1px solid #f0d9a8", fontWeight: 500 }}>Entorno demo · empresa y datos ficticios</span>
        </header>

        <section style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
          <p className="eyebrow" style={{ margin: 0 }}>Caso de referencia</p>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.1 }}>Usar IA con tranquilidad: primero las personas, después los agentes.</h1>
          <p style={{ margin: 0, fontSize: 19, color: "var(--g-suave)" }}>
            Un agente de voz entrevista a cada colaborador en 5 minutos. Levantamos cómo vive el cambio, qué tareas repite y cómo usa la IA hoy, y lo convertimos en una mirada de toda la organización: sus procesos, cómo se conectan las unidades y dónde la IA ahorra tiempo.
          </p>
        </section>

        <section className="grid" style={{ ["--min" as string]: "300px", gap: 24 }}>
          <Link href="/gia/entrevista" className="card" style={{ textDecoration: "none", color: "#fff", background: "var(--g-verde)", borderColor: "var(--g-verde)", minHeight: 240 }}>
            <span className="small" style={{ color: "#cfe8da" }}>Paso 1 · La entrevista</span>
            <span className="sora" style={{ fontWeight: 600, fontSize: 24 }}>Vívelo: entrevístate ahora</span>
            <span style={{ fontSize: 16, color: "#e6f3ec" }}>
              Cuatro preguntas por voz sobre tu trabajo. Cada persona entra con su propio link y al final revisa lo que el agente entendió.
            </span>
            <span style={{ marginTop: "auto", fontWeight: 600 }}>Empezar entrevista →</span>
          </Link>
          <Link href="/gia/panorama" className="card" style={{ textDecoration: "none", color: "inherit", minHeight: 240 }}>
            <span className="small muted">Paso 2 · Etapa 1, levantamiento</span>
            <span className="sora" style={{ fontWeight: 600, fontSize: 24 }}>La organización, vista desde sus personas</span>
            <span style={{ fontSize: 16, color: "var(--g-suave)" }}>
              {EMPRESA.nombre} (empresa demo), {EMPRESA.entrevistas} entrevistas: resultados totales y por persona, cómo se conectan las tareas entre unidades y dónde agentizar.
            </span>
            <span style={{ marginTop: "auto", fontWeight: 600, color: "var(--g-verde)" }}>Abrir back office →</span>
          </Link>
          <Link href="/gia/coe" className="card" style={{ textDecoration: "none", color: "inherit", minHeight: 240 }}>
            <span className="small muted">Paso 3 · Etapa 2, CoE</span>
            <span className="sora" style={{ fontWeight: 600, fontSize: 24 }}>El CoE que queda funcionando</span>
            <span style={{ fontSize: 16, color: "var(--g-suave)" }}>Estándares, documentos, videos paso a paso y un asesor que te dice si algo se puede hacer y cómo.</span>
            <span style={{ marginTop: "auto", fontWeight: 600, color: "var(--g-verde)" }}>Ver el CoE →</span>
          </Link>
        </section>

        <section className="grid" style={{ ["--min" as string]: "220px" }}>
          {[
            ["Levantamiento por voz", "Entrevistas a toda la capa organizacional, sin encuestas largas."],
            ["Liderado desde Personas", "Un cambio tecnológico que parte por la cultura, los miedos y las capacidades."],
            ["Lineamientos y protocolos", "Qué se puede hacer, con qué datos, dónde se guarda y a quién se escala."],
            ["Valor medible", "Horas recuperables por caso y por capa, partiendo por el Gemini que ya está pagado."],
          ].map(([t, d]) => (
            <div key={t} style={{ padding: 20, borderRadius: 12, background: "#e8efe9" }}>
              <div className="sora" style={{ fontWeight: 600, fontSize: 15 }}>{t}</div>
              <div style={{ fontSize: 14, color: "var(--g-suave)", marginTop: 6 }}>{d}</div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
