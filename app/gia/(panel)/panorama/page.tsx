import Link from "next/link";
import { fichasEnVivo } from "@/lib/gia/datos";
import { fmt, totalPersonas } from "@/lib/gia/agregados";
import { arquetipoPorId } from "@/lib/gia/modelo";
import { COBERTURA, COMPARTIDAS, CULTURA, EMPRESA, HALLAZGOS, KPIS, USO_IA } from "@/lib/gia/semilla";

export const dynamic = "force-dynamic";

const COLOR_USO = { verde: "#1F6B45", azul: "#2F5DA8", ambar: "#B7791F", rojo: "#B42318" } as const;

function Anillo({ pct, etiqueta, detalle }: { pct: number; etiqueta: string; detalle: string }) {
  const r = 34;
  const largo = 2 * Math.PI * r;
  return (
    <div className="anillo">
      <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`${etiqueta}: ${pct}%`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e6ece7" strokeWidth="9" />
        <circle cx="44" cy="44" r={r} fill="none" stroke="#1F6B45" strokeWidth="9" strokeLinecap="round" strokeDasharray={largo} strokeDashoffset={largo * (1 - pct / 100)} transform="rotate(-90 44 44)" />
        <text x="44" y="49" textAnchor="middle" className="anillo-n">{pct}%</text>
      </svg>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{etiqueta}</div>
        <div className="small muted">{detalle}</div>
      </div>
    </div>
  );
}

export default async function Panorama() {
  const vivas = await fichasEnVivo();
  const total = totalPersonas(vivas);
  const invitados = EMPRESA.invitados + vivas.length;
  const horasCompartidas = COMPARTIDAS.reduce((s, c) => s + c.h, 0);

  return (
    <>
      <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <div className="small muted">Etapa 1 · Diagnóstico cerrado el {EMPRESA.cierre} · Operaciones, Comercial, Administración y Finanzas</div>
          <h1>Panorama</h1>
        </div>
        <Link href="/gia/flujo" className="btn">Ver cómo se conectan las unidades →</Link>
      </header>

      <section className="bento">
        <div className="card kpi-hero">
          <div className="small" style={{ color: "#cfe8da" }}>Entrevistas completas</div>
          <div className="kpi" style={{ fontSize: 56, color: "#fff" }}>{fmt(total)}</div>
          <div className="small" style={{ color: "#cfe8da" }}>de {fmt(invitados)} invitados · {Math.round((total / invitados) * 100)}% de cobertura</div>
          <div className="barra" style={{ background: "rgba(255,255,255,0.18)", marginTop: "auto" }}><span style={{ width: `${(total / invitados) * 100}%`, background: "#9fd9b8" }} /></div>
        </div>
        {[
          { l: "Tareas levantadas", v: fmt(KPIS.tareas), n: `${fmt(KPIS.repetitivas)} se repiten` },
          { l: "Horas repetitivas", v: fmt(KPIS.horasRepetitivas), n: "h/mes en las 3 gerencias" },
          { l: "Se repiten entre unidades", v: fmt(horasCompartidas), n: `h/mes en ${COMPARTIDAS.length} tareas compartidas` },
          { l: "Casos de uso", v: String(KPIS.casos), n: `${KPIS.quickWins} quick wins` },
        ].map((k) => (
          <div key={k.l} className="card kpi-tile">
            <div className="small muted">{k.l}</div>
            <div className="kpi">{k.v}</div>
            <div className="small muted">{k.n}</div>
          </div>
        ))}
      </section>

      {vivas.length > 0 && (
        <section className="card en-vivo">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
            <h2 className="vivo">Entrevistas de hoy</h2>
            <span className="small muted">Se suman a las {EMPRESA.entrevistas} de la empresa demo</span>
          </div>
          <div className="feed">
            {vivas.slice(0, 6).map((f) => (
              <Link key={f.id} href={`/gia/personas/${f.id}`} className="feed-item">
                <span className="avatar">{f.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{f.nombre}</strong>
                  <span className="small muted">{f.cargo}</span>
                </span>
                <span className="pill t-verde" style={{ marginLeft: "auto" }}>{arquetipoPorId(f.analisis.perfil.principal)?.nombre} · N{f.analisis.perfil.madurez}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="row">
        <div className="card">
          <h2>Cobertura por gerencia</h2>
          <div className="anillos">
            {COBERTURA.map((c) => (
              <Anillo key={c.gerencia} pct={Math.round((c.entrevistas / c.invitados) * 100)} etiqueta={c.gerencia} detalle={`${c.entrevistas} de ${c.invitados}`} />
            ))}
          </div>
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
          <span className="small muted">Diagnóstico cultural · con sus palabras</span>
        </div>
        <div className="grid" style={{ ["--min" as string]: "220px", gap: 12 }}>
          {CULTURA.map((c) => (
            <figure key={c.t} className={`cita-card t-${c.tono}`}>
              <div className="kpi" style={{ fontSize: 32 }}>{c.v}</div>
              <figcaption style={{ fontSize: 14 }}>{c.t}</figcaption>
              <blockquote>{c.q}</blockquote>
            </figure>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Hallazgos principales</h2>
        <div className="hallazgos">
          {HALLAZGOS.map((h) => (
            <div key={h.tag} className="hallazgo">
              <span className={`pill t-${h.tono}`}>{h.tag}</span>
              <span>{h.texto}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
