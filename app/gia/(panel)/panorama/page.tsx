import Link from "next/link";
import { fichasEnVivo } from "@/lib/gia/datos";
import { fmt, totalPersonas } from "@/lib/gia/agregados";
import { arquetipoPorId } from "@/lib/gia/modelo";
import { COBERTURA, CULTURA, EMPRESA, HALLAZGOS, KPIS, USO_IA } from "@/lib/gia/semilla";

export const dynamic = "force-dynamic";

const COLOR_USO = { verde: "#1F6B45", azul: "#2F5DA8", ambar: "#B7791F", rojo: "#B42318" } as const;

export default async function Panorama() {
  const vivas = await fichasEnVivo();
  const total = totalPersonas(vivas);
  const invitados = EMPRESA.invitados + vivas.length;

  const kpis = [
    { label: "Entrevistas completas", value: fmt(total), note: `de ${fmt(invitados)} invitados · ${Math.round((total / invitados) * 100)}%` },
    { label: "Tareas levantadas", value: fmt(KPIS.tareas), note: `${fmt(KPIS.repetitivas)} repetitivas` },
    { label: "Horas repetitivas", value: fmt(KPIS.horasRepetitivas), note: "h/mes en las 3 gerencias" },
    { label: "Automatizables", value: fmt(KPIS.horasAutomatizables), note: "h/mes estimadas" },
    { label: "Casos de uso", value: String(KPIS.casos), note: `${KPIS.quickWins} quick wins` },
    { label: "Madurez de lineamientos", value: KPIS.madurezLineamientos, note: "Inicial" },
  ];

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <div className="small muted">Diagnóstico · cierre {EMPRESA.cierre} · Operaciones, Comercial, Administración y Finanzas</div>
          <h1>Panorama</h1>
        </div>
        <Link href="/gia/flujo" className="btn">Ver cómo se conectan las unidades →</Link>
      </header>

      <section className="grid" style={{ ["--min" as string]: "170px", gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.label} className="card" style={{ padding: 18, gap: 6 }}>
            <div className="small muted">{k.label}</div>
            <div className="kpi">{k.value}</div>
            <div className="small muted">{k.note}</div>
          </div>
        ))}
      </section>

      {vivas.length > 0 && (
        <section className="card" style={{ borderColor: "#2E9E63", borderWidth: 2 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            <h2 className="vivo">Entrevistas de hoy</h2>
            <span className="small muted">Se suman a las {EMPRESA.entrevistas} de la empresa demo</span>
          </div>
          {vivas.slice(0, 5).map((f) => (
            <Link key={f.id} href={`/gia/personas/${f.id}`} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, textDecoration: "none", color: "inherit", borderTop: "1px solid var(--g-linea2)", paddingTop: 10 }}>
              <span><strong>{f.nombre}</strong> · <span className="muted">{f.cargo}</span></span>
              <span className="pill t-verde">{arquetipoPorId(f.analisis.perfil.principal)?.nombre} · nivel {f.analisis.perfil.madurez}</span>
            </Link>
          ))}
        </section>
      )}

      <section className="row">
        <div className="card">
          <h2>Cobertura por gerencia</h2>
          {COBERTURA.map((c) => {
            const pct = Math.round((c.entrevistas / c.invitados) * 100);
            return (
              <div key={c.gerencia} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span>{c.gerencia}</span>
                  <span className="muted">{c.entrevistas} de {c.invitados} · {pct}%</span>
                </div>
                <div className="barra"><span style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>
        <div className="card">
          <h2>Uso de IA hoy</h2>
          {USO_IA.map((u) => (
            <div key={u.nombre} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span>{u.nombre}</span>
                <strong>{u.pct}%</strong>
              </div>
              <div className="barra"><span style={{ width: `${u.pct}%`, background: COLOR_USO[u.tono] }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h2>Cómo viven el cambio</h2>
          <span className="small muted">Diagnóstico cultural · lo que dijeron con sus palabras</span>
        </div>
        <div className="grid" style={{ ["--min" as string]: "200px", gap: 12 }}>
          {CULTURA.map((c) => (
            <div key={c.t} className={`t-${c.tono}`} style={{ borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6, color: "var(--g-tinta)" }}>
              <div className="kpi" style={{ fontSize: 26 }}>{c.v}</div>
              <div style={{ fontSize: 14 }}>{c.t}</div>
              <div className="small" style={{ fontStyle: "italic", color: "var(--g-suave)" }}>{c.q}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Hallazgos principales</h2>
        {HALLAZGOS.map((h) => (
          <div key={h.tag} style={{ display: "flex", gap: 14, alignItems: "flex-start", borderTop: "1px solid var(--g-linea2)", paddingTop: 12 }}>
            <span className={`pill t-${h.tono}`}>{h.tag}</span>
            <span>{h.texto}</span>
          </div>
        ))}
      </section>
    </>
  );
}
