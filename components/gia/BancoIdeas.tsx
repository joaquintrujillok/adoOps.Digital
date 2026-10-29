"use client";

// El banco de ideas: las personas proponen, votan y el CoE evalúa.
//
// Forma de tablero de votación (lista con la caja de votos a la izquierda,
// ordenar por votos o recientes, filtrar por estado) y, al lado, el roadmap por
// estado y cómo funciona. Los votos ordenan pero no deciden: el CoE prioriza
// con las horas estimadas y el nivel de autonomía, y eso se dice en pantalla.
//
// En la demo, votar y proponer viven solo en esta pantalla (estado del
// navegador): nada se guarda en la base, y el formulario lo avisa.

import { useMemo, useState } from "react";
import { ESTADOS_IDEA, IDEAS, type EstadoIdea, type Idea } from "@/lib/gia/semilla";

const AREAS = ["Recepción", "Planta", "Mantenimiento", "Relación con productores", "Ventas", "Trade marketing", "Contabilidad", "Remuneraciones"];
const estadoDe = (e: EstadoIdea) => ESTADOS_IDEA.find((x) => x.id === e)!;

export default function BancoIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>(IDEAS);
  const [votadas, setVotadas] = useState<Set<string>>(new Set());
  const [orden, setOrden] = useState<"votos" | "recientes">("votos");
  const [filtro, setFiltro] = useState<EstadoIdea | "todas">("todas");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [nueva, setNueva] = useState({ t: "", problema: "", area: AREAS[0], horas: "" });

  const lista = useMemo(() => {
    const base = ideas.filter((i) => filtro === "todas" || i.estado === filtro);
    // "Recientes" = el orden en que llegaron: las propuestas en la demo van primero.
    return orden === "votos" ? [...base].sort((a, b) => b.votos - a.votos) : base;
  }, [ideas, filtro, orden]);

  const totalVotos = ideas.reduce((s, i) => s + i.votos, 0);
  const horas = ideas.filter((i) => i.estado !== "nueva").reduce((s, i) => s + (i.horas ?? 0), 0);

  function votar(id: string) {
    const ya = votadas.has(id);
    setIdeas((xs) => xs.map((i) => (i.id === id ? { ...i, votos: i.votos + (ya ? -1 : 1) } : i)));
    setVotadas((s) => {
      const n = new Set(s);
      if (ya) n.delete(id); else n.add(id);
      return n;
    });
  }

  function proponer(e: React.FormEvent) {
    e.preventDefault();
    if (!nueva.t.trim()) return;
    const h = Number(nueva.horas);
    const idea: Idea = {
      id: `n${Date.now()}`,
      t: nueva.t.trim(),
      problema: nueva.problema.trim() || "Sin descripción.",
      area: nueva.area,
      autor: "Tú",
      votos: 1,
      comentarios: 0,
      horas: Number.isFinite(h) && h > 0 ? Math.round(h) : null,
      capa: "Por definir",
      estado: "nueva",
      hace: "ahora",
    };
    setIdeas((xs) => [idea, ...xs]);
    setVotadas((s) => new Set(s).add(idea.id));
    setNueva({ t: "", problema: "", area: AREAS[0], horas: "" });
    setForm(false);
    setOrden("recientes");
    setFiltro("todas");
    setAbierta(idea.id);
  }

  return (
    <div className="ideas">
      <div className="ideas-centro">
        <div className="ideas-barra">
          <div className="seg seg-sm" role="tablist" aria-label="Ordenar">
            <button type="button" role="tab" aria-selected={orden === "votos"} onClick={() => setOrden("votos")}>Más votadas</button>
            <button type="button" role="tab" aria-selected={orden === "recientes"} onClick={() => setOrden("recientes")}>Recientes</button>
          </div>
          <div className="filtros-estado" aria-label="Filtrar por estado">
            <button type="button" aria-pressed={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</button>
            {ESTADOS_IDEA.map((e) => (
              <button key={e.id} type="button" aria-pressed={filtro === e.id} onClick={() => setFiltro(e.id)}>{e.t}</button>
            ))}
          </div>
          <button type="button" className="btn" onClick={() => setForm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Proponer idea
          </button>
        </div>

        {form && (
          <form className="card form-idea" onSubmit={proponer}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <h2>Nueva idea</h2>
              <button type="button" className="b-cerrar" onClick={() => setForm(false)} aria-label="Cerrar">×</button>
            </div>
            <label>¿Qué te gustaría que hiciera la IA?
              <input value={nueva.t} onChange={(e) => setNueva({ ...nueva, t: e.target.value })} required maxLength={140} placeholder="Ej.: que arme el resumen del informe de calidad" />
            </label>
            <label>¿Qué problema resuelve hoy?
              <textarea value={nueva.problema} onChange={(e) => setNueva({ ...nueva, problema: e.target.value })} maxLength={400} placeholder="Cuéntalo con una cifra si puedes: cuántas horas, cuántas veces." />
            </label>
            <div className="form-fila">
              <label>Área
                <select value={nueva.area} onChange={(e) => setNueva({ ...nueva, area: e.target.value })}>
                  {AREAS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <label>Horas al mes que ahorraría (aprox.)
                <input inputMode="numeric" value={nueva.horas} onChange={(e) => setNueva({ ...nueva, horas: e.target.value.replace(/\D/g, "") })} placeholder="Ej.: 20" />
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              <button type="submit" className="btn">Publicar idea</button>
              <span className="small muted">En la demo, la idea queda solo en esta pantalla.</span>
            </div>
          </form>
        )}

        <div className="ideas-lista">
          {lista.map((i) => {
            const e = estadoDe(i.estado);
            const ya = votadas.has(i.id);
            const open = abierta === i.id;
            return (
              <article key={i.id} className={`idea ${open ? "open" : ""}`}>
                <button type="button" className={`voto ${ya ? "on" : ""}`} onClick={() => votar(i.id)} aria-pressed={ya} aria-label={`${ya ? "Quitar voto" : "Votar"}: ${i.t}. ${i.votos} votos`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
                  <span>{i.votos}</span>
                </button>
                <div className="idea-cuerpo">
                  <button type="button" className="idea-t" onClick={() => setAbierta(open ? null : i.id)} aria-expanded={open}>{i.t}</button>
                  <div className="idea-meta">
                    <span className={`pill t-${e.tono}`}>{e.t}</span>
                    <span>{i.area}</span>
                    <span>·</span>
                    <span>{i.autor}, {i.hace}</span>
                    <span className="idea-com">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
                      {i.comentarios}
                    </span>
                  </div>
                  {open && (
                    <div className="idea-detalle">
                      <div><span className="muted small">El problema hoy</span><p>{i.problema}</p></div>
                      <div className="idea-datos">
                        <div><span className="muted small">Ahorro estimado</span><strong>{i.horas ? `${i.horas} h/mes` : "Por estimar"}</strong></div>
                        <div><span className="muted small">Capa probable</span><strong>{i.capa}</strong></div>
                        <div><span className="muted small">Quién evalúa</span><strong>CoE, en 2 semanas</strong></div>
                      </div>
                      <ol className="idea-camino" aria-label="Estado de la idea">
                        {ESTADOS_IDEA.map((x, k) => {
                          const idx = ESTADOS_IDEA.findIndex((y) => y.id === i.estado);
                          return <li key={x.id} className={k < idx ? "hecho" : k === idx ? "actual" : ""}><span />{x.t}</li>;
                        })}
                      </ol>
                    </div>
                  )}
                </div>
                {i.horas && <div className="idea-horas"><strong>{i.horas}</strong><span>h/mes</span></div>}
              </article>
            );
          })}
          {lista.length === 0 && <div className="repo-vacio">No hay ideas en este estado todavía.</div>}
        </div>
      </div>

      <aside className="ideas-lado">
        <div className="card" style={{ gap: 12 }}>
          <div className="ideas-stats">
            <div><strong>{ideas.length}</strong><span>ideas</span></div>
            <div><strong>{totalVotos}</strong><span>votos</span></div>
            <div><strong>{horas}</strong><span>h/mes en curso</span></div>
          </div>
        </div>
        <div className="card" style={{ gap: 10 }}>
          <h2>Roadmap</h2>
          {ESTADOS_IDEA.map((e) => {
            const n = ideas.filter((i) => i.estado === e.id).length;
            return (
              <button key={e.id} type="button" className="road-fila" onClick={() => setFiltro(e.id)}>
                <span className={`road-dot t-${e.tono}`} />
                <span style={{ flex: 1, textAlign: "left" }}>{e.t}</span>
                <span className="road-barra"><i className={`t-${e.tono}`} style={{ width: `${(n / ideas.length) * 100}%` }} /></span>
                <strong>{n}</strong>
              </button>
            );
          })}
        </div>
        <div className="card" style={{ gap: 10 }}>
          <h2>Cómo funciona</h2>
          <ol className="como">
            <li><strong>Propones</strong> el problema con una cifra.</li>
            <li><strong>Tu equipo vota</strong> lo que más le sirve.</li>
            <li><strong>El CoE evalúa</strong> en 2 semanas: horas, datos y nivel de autonomía.</li>
            <li><strong>Se construye</strong> y se mide el ahorro real.</li>
          </ol>
          <div className="small muted">Los votos ordenan la lista, pero no deciden solos: el CoE prioriza por impacto y riesgo.</div>
        </div>
      </aside>
    </div>
  );
}
