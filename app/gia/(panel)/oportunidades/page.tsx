import Link from "next/link";
import { fmt } from "@/lib/gia/agregados";
import { CAPAS, COMPARTIDAS, KPIS, PROCESOS } from "@/lib/gia/semilla";

// Las oportunidades ordenadas por capa de agentización, en horas. Sin precios a
// propósito: esta pantalla muestra el diagnóstico; la propuesta comercial va en
// la presentación, no en la plataforma.

export default function Oportunidades() {
  const ahorroTotal = PROCESOS.reduce((s, p) => s + p.ahorro, 0);
  const horasTotal = PROCESOS.reduce((s, p) => s + p.h, 0);

  return (
    <>
      <header>
        <div className="small muted">Etapa 1 · Qué se puede abordar, con qué capa y cuánto tiempo se recupera</div>
        <h1>Oportunidades de agentización</h1>
      </header>

      <section className="grid" style={{ ["--min" as string]: "200px", gap: 14 }}>
        {[
          { l: "Horas repetitivas", v: fmt(KPIS.horasRepetitivas), n: "h/mes en las 3 gerencias" },
          { l: "Automatizables", v: fmt(KPIS.horasAutomatizables), n: "h/mes en toda la empresa" },
          { l: "En los 8 primeros casos", v: fmt(ahorroTotal), n: `h/mes recuperables de ${fmt(horasTotal)}` },
          { l: "Equivale a", v: `≈ ${Math.round(ahorroTotal / 160)}`, n: "personas a jornada completa" },
        ].map((k) => (
          <div key={k.l} className="card" style={{ padding: 18, gap: 6 }}>
            <div className="small muted">{k.l}</div>
            <div className="kpi">{k.v}</div>
            <div className="small muted">{k.n}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Cómo se reparte el tiempo recuperable</h2>
          <span className="small muted">De lo más simple (sin TI) a lo más integrado</span>
        </div>
        <div className="apilada" role="img" aria-label={CAPAS.map((c) => `${c.t}: ${PROCESOS.filter((p) => p.s === c.s).reduce((x, p) => x + p.ahorro, 0)} h/mes`).join(", ")}>
          {CAPAS.map((c) => {
            const h = PROCESOS.filter((p) => p.s === c.s).reduce((x, p) => x + p.ahorro, 0);
            return <span key={c.s} className={`t-${c.tono}`} style={{ flex: h }}><strong>{c.n}</strong> {Math.round((h / ahorroTotal) * 100)}%</span>;
          })}
        </div>
        <div className="leyenda">
          {CAPAS.map((c) => (
            <span key={c.s}><i className={`t-${c.tono}`} />Capa {c.n} · {c.t}</span>
          ))}
        </div>
      </section>

      {CAPAS.map((c) => {
        const procesos = PROCESOS.filter((p) => p.s === c.s);
        const compartidas = COMPARTIDAS.filter((x) => x.solucion === c.s);
        const ahorro = procesos.reduce((s, p) => s + p.ahorro, 0);
        return (
          <section key={c.s} className="card capa">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
              <span className={`capa-n t-${c.tono}`}>{c.n}</span>
              <div style={{ flex: "1 1 300px" }}>
                <h2>{c.t}</h2>
                <div className="small" style={{ color: "var(--g-suave)" }}>{c.d}</div>
                <div className="small muted" style={{ marginTop: 2 }}>Lo construye o aprueba: {c.quien}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="kpi" style={{ fontSize: 26, color: "var(--g-verde)" }}>{fmt(ahorro)} h/mes</div>
                <div className="small muted">recuperables</div>
              </div>
            </div>
            <div className="tabla">
              <table>
                <thead><tr><th>Caso</th><th>Unidad</th><th>Personas</th><th>Hoy</th><th>Se recupera</th></tr></thead>
                <tbody>
                  {procesos.map((p) => (
                    <tr key={p.p}>
                      <td style={{ fontWeight: 500 }}>{p.p}</td>
                      <td className="muted">{p.u}</td>
                      <td>{p.n}</td>
                      <td>{p.h} h/mes</td>
                      <td style={{ fontWeight: 600, color: "var(--g-verde)" }}>{p.ahorro} h/mes</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {compartidas.map((x) => (
              <div key={x.id} className="t-gris small" style={{ borderRadius: 10, padding: "10px 14px", color: "var(--g-tinta)" }}>
                <strong>Sirve también entre unidades:</strong> {x.t.toLowerCase()} en {Object.keys(x.reparto).join(", ")}.{" "}
                <Link href="/gia/flujo">Ver en el flujo →</Link>
              </div>
            ))}
          </section>
        );
      })}

      <p className="small muted" style={{ margin: 0 }}>
        Horas estimadas a partir de lo que cada persona declaró en su entrevista. Se recalculan con la medición de los pilotos.
      </p>
    </>
  );
}
