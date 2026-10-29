"use client";

// El flujo entre unidades, en dos vistas.
//
// **Mapa de conexiones** (Sankey): unidades → tareas que se repiten → capa de
// agentización, con el ancho de cada cinta en horas al mes. Es la imagen que
// explica para qué sirve el levantamiento más allá del perfil de cada persona:
// áreas que no se hablan hacen la misma tarea, y una sola solución sirve a
// todas. Se dibuja a mano en SVG: son 12 unidades, 4 tareas y 4 capas, y una
// librería de gráficos agregaría más peso que el diagrama entero.
//
// **Cómo se mueve el trabajo**: los procesos paso a paso, como el flujo del
// levantamiento del JPL. Lienzo con nodos y conectores; al elegir un nodo, el
// panel lateral muestra lo que se hace a mano y la cita de quien lo dijo.
//
// Las dos vistas comparten la tarea elegida: lo que se ilumina en el mapa se
// ilumina en los procesos.

import { useMemo, useState } from "react";
import { SOLUCIONES } from "@/lib/gia/modelo";
import { CAPAS, COMPARTIDAS, FLUJOS, GERENCIA_DE, type CompartidaId, type PasoFlujo } from "@/lib/gia/semilla";

const COLOR: Record<CompartidaId, string> = { consolidar: "#C99A2E", doble: "#6B5BC4", consultas: "#2F5DA8", minutas: "#1F8A55" };
const CORTO: Record<CompartidaId, string> = { consolidar: "Consolidar planillas", doble: "Digitar dos veces", consultas: "Consultas repetidas", minutas: "Minutas" };
const fmt = (n: number) => n.toLocaleString("es-CL");

type Foco = { tipo: "tarea"; id: CompartidaId } | { tipo: "unidad"; id: string } | null;

export default function Flujo() {
  const [vista, setVista] = useState<"mapa" | "procesos">("mapa");
  const [foco, setFoco] = useState<Foco>({ tipo: "tarea", id: "consolidar" });

  const tareaFoco = foco?.tipo === "tarea" ? foco.id : null;

  return (
    <>
      <div className="seg" role="tablist" aria-label="Vista del flujo">
        <button type="button" role="tab" aria-selected={vista === "mapa"} onClick={() => setVista("mapa")}>Mapa de conexiones</button>
        <button type="button" role="tab" aria-selected={vista === "procesos"} onClick={() => setVista("procesos")}>Cómo se mueve el trabajo</button>
      </div>

      <div className="tareas-chips" aria-label="Tareas que se repiten entre unidades">
        {COMPARTIDAS.map((c) => (
          <button
            key={c.id}
            type="button"
            className="tarea-chip"
            aria-pressed={tareaFoco === c.id}
            style={{ ["--c" as string]: COLOR[c.id] }}
            onClick={() => setFoco(tareaFoco === c.id ? null : { tipo: "tarea", id: c.id })}
          >
            <span className="punto" />
            <span className="nombre">{CORTO[c.id]}</span>
            <span className="horas">{fmt(c.h)} h/mes</span>
          </button>
        ))}
      </div>

      {vista === "mapa" ? <Mapa foco={foco} setFoco={setFoco} /> : <Procesos tarea={tareaFoco} alVerMapa={(id) => { setFoco({ tipo: "tarea", id }); setVista("mapa"); }} />}
    </>
  );
}

// ─── Mapa de conexiones (Sankey) ───────────────────────────────────────────────

const W = 1000;
const H = 540;
const X_UNI = 210;
const X_TAR = 500;
const X_CAP = 760;
const ANCHO_NODO = 12;
const SEP = 10;

function Mapa({ foco, setFoco }: { foco: Foco; setFoco: (f: Foco) => void }) {
  const geo = useMemo(() => {
    const unidades = Object.keys(GERENCIA_DE).map((u) => ({
      u,
      g: GERENCIA_DE[u],
      h: COMPARTIDAS.reduce((s, c) => s + (c.reparto[u] ?? 0), 0),
    })).filter((x) => x.h > 0);
    const total = unidades.reduce((s, x) => s + x.h, 0);
    const k = (H - SEP * (unidades.length - 1)) / total;

    // Columna de unidades.
    let y = 0;
    const nodU = new Map<string, { y: number; alto: number; h: number; g: string; salida: number }>();
    for (const x of unidades) {
      nodU.set(x.u, { y, alto: x.h * k, h: x.h, g: x.g, salida: 0 });
      y += x.h * k + SEP;
    }
    // Columna de tareas y de capas, centradas.
    const centrar = (n: number, suma: number) => (H - (suma * k + (n - 1) * 26)) / 2;
    let yt = centrar(COMPARTIDAS.length, total);
    const nodT = new Map<CompartidaId, { y: number; alto: number; entrada: number }>();
    for (const c of COMPARTIDAS) {
      nodT.set(c.id, { y: yt, alto: c.h * k, entrada: 0 });
      yt += c.h * k + 26;
    }
    // Las capas van en el orden de las tareas que les llegan: así las cintas
    // del segundo tramo no se cruzan.
    const capasUsadas = CAPAS.filter((c) => COMPARTIDAS.some((x) => x.solucion === c.s)).sort(
      (a, b) => COMPARTIDAS.findIndex((x) => x.solucion === a.s) - COMPARTIDAS.findIndex((x) => x.solucion === b.s),
    );
    let yc = centrar(capasUsadas.length, total);
    const nodC = new Map<string, { y: number; alto: number; n: number; t: string; h: number }>();
    for (const c of capasUsadas) {
      const h = COMPARTIDAS.filter((x) => x.solucion === c.s).reduce((s, x) => s + x.h, 0);
      nodC.set(c.s, { y: yc, alto: h * k, n: c.n, t: c.t, h });
      yc += h * k + 26;
    }

    // Cintas unidad → tarea. Se apilan en el orden de las unidades para que no
    // se crucen más de lo necesario.
    const cintasUT: { u: string; t: CompartidaId; d: string; h: number }[] = [];
    for (const c of COMPARTIDAS) {
      const t = nodT.get(c.id)!;
      for (const x of unidades) {
        const v = c.reparto[x.u];
        if (!v) continue;
        const n = nodU.get(x.u)!;
        const a = v * k;
        cintasUT.push({ u: x.u, t: c.id, h: v, d: cinta(X_UNI + ANCHO_NODO, n.y + n.salida, X_TAR, t.y + t.entrada, a) });
        n.salida += a;
        t.entrada += a;
      }
    }
    // Cintas tarea → capa.
    const usado = new Map<string, number>();
    const cintasTC = COMPARTIDAS.map((c) => {
      const t = nodT.get(c.id)!;
      const cap = nodC.get(c.solucion)!;
      const off = usado.get(c.solucion) ?? 0;
      usado.set(c.solucion, off + t.alto);
      return { t: c.id, d: cinta(X_TAR + ANCHO_NODO, t.y, X_CAP, cap.y + off, t.alto) };
    });
    return { nodU, nodT, nodC, cintasUT, cintasTC };
  }, []);

  const activa = (u: string, t: CompartidaId) =>
    !foco || (foco.tipo === "tarea" ? foco.id === t : foco.id === u);
  const tareaActiva = (t: CompartidaId) =>
    !foco || (foco.tipo === "tarea" ? foco.id === t : (COMPARTIDAS.find((c) => c.id === t)?.reparto[foco.id] ?? 0) > 0);

  const detalle = foco?.tipo === "tarea" ? COMPARTIDAS.find((c) => c.id === foco.id) : null;
  const unidadSel = foco?.tipo === "unidad" ? foco.id : null;

  return (
    <section className="card lienzo-card">
      <div className="lienzo-cab">
        <div>
          <h2>Mapa de conexiones</h2>
          <div className="small muted">Unidades → tareas que se repiten → cómo se abordan. El ancho de cada cinta son horas al mes.</div>
        </div>
        <div className="col-etq small muted" aria-hidden="true"><span>Unidades</span><span>Tareas repetidas</span><span>Capa de agentización</span></div>
      </div>

      <div className="sankey-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="sankey" role="img" aria-label="Mapa de horas al mes que cada unidad dedica a tareas repetidas y la capa de agentización que las aborda">
          {geo.cintasUT.map((c, i) => (
            <path key={i} d={c.d} fill={COLOR[c.t]} className={`cinta ${activa(c.u, c.t) ? "on" : ""}`}>
              <title>{`${c.u} → ${CORTO[c.t]}: ${fmt(c.h)} h/mes`}</title>
            </path>
          ))}
          {geo.cintasTC.map((c) => (
            <path key={c.t} d={c.d} fill={COLOR[c.t]} className={`cinta ${tareaActiva(c.t) ? "on" : ""}`} />
          ))}

          {[...geo.nodU.entries()].map(([u, n]) => (
            <g
              key={u}
              className={`nodo ${unidadSel === u ? "sel" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${u}: ${n.h} horas al mes en tareas repetidas`}
              onClick={() => setFoco(unidadSel === u ? null : { tipo: "unidad", id: u })}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFoco(unidadSel === u ? null : { tipo: "unidad", id: u }); } }}
            >
              <rect x={X_UNI} y={n.y} width={ANCHO_NODO} height={Math.max(2, n.alto)} rx={3} fill="#13221A" />
              <text x={X_UNI - 10} y={n.y + n.alto / 2} textAnchor="end" dominantBaseline="middle" className="etq-u">
                {u}
                <tspan className="etq-h"> {fmt(n.h)} h</tspan>
              </text>
            </g>
          ))}

          {COMPARTIDAS.map((c) => {
            const n = geo.nodT.get(c.id)!;
            return (
              <g
                key={c.id}
                className="nodo"
                role="button"
                tabIndex={0}
                aria-label={`${c.t}: ${c.h} horas al mes`}
                onClick={() => setFoco(foco?.tipo === "tarea" && foco.id === c.id ? null : { tipo: "tarea", id: c.id })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFoco({ tipo: "tarea", id: c.id }); } }}
              >
                <rect x={X_TAR} y={n.y} width={ANCHO_NODO} height={n.alto} rx={3} fill={COLOR[c.id]} />
                <text x={X_TAR + ANCHO_NODO + 8} y={n.y + n.alto / 2 - 8} dominantBaseline="middle" className="etq-t">{CORTO[c.id]}</text>
                <text x={X_TAR + ANCHO_NODO + 8} y={n.y + n.alto / 2 + 10} dominantBaseline="middle" className="etq-h">{fmt(c.h)} h/mes</text>
              </g>
            );
          })}

          {[...geo.nodC.entries()].map(([s, n]) => (
            <g key={s} className="nodo">
              <rect x={X_CAP} y={n.y} width={ANCHO_NODO} height={n.alto} rx={3} fill="#13221A" />
              <text x={X_CAP + ANCHO_NODO + 10} y={n.y + n.alto / 2 - 8} dominantBaseline="middle" className="etq-t">{n.t}</text>
              <text x={X_CAP + ANCHO_NODO + 10} y={n.y + n.alto / 2 + 10} dominantBaseline="middle" className="etq-h">Capa {n.n} · {fmt(n.h)} h/mes</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mapa-detalle" aria-live="polite">
        {detalle ? (
          <>
            <span className="punto-g" style={{ background: COLOR[detalle.id] }} />
            <div style={{ flex: 1 }}>
              <div className="sora" style={{ fontWeight: 600 }}>{detalle.t}</div>
              <div className="small" style={{ color: "var(--g-suave)" }}>{detalle.d} {Object.keys(detalle.reparto).length} unidades, {detalle.personas} personas.</div>
              <div className="small" style={{ marginTop: 4 }}><strong>Un solo caso para todas:</strong> {detalle.propuesta}</div>
            </div>
            <span className="pill t-gris">{SOLUCIONES[detalle.solucion]}</span>
          </>
        ) : unidadSel ? (
          <>
            <span className="punto-g" style={{ background: "#13221A" }} />
            <div style={{ flex: 1 }}>
              <div className="sora" style={{ fontWeight: 600 }}>{unidadSel} · {GERENCIA_DE[unidadSel]}</div>
              <div className="small" style={{ color: "var(--g-suave)" }}>
                {COMPARTIDAS.filter((c) => c.reparto[unidadSel]).map((c) => `${CORTO[c.id]} (${fmt(c.reparto[unidadSel])} h/mes)`).join(" · ")}
              </div>
            </div>
          </>
        ) : (
          <div className="small muted">Toca una unidad o una tarea para ver sus conexiones.</div>
        )}
      </div>
    </section>
  );
}

/** Una cinta del Sankey: dos curvas de Bézier entre dos tramos verticales. */
function cinta(x0: number, y0: number, x1: number, y1: number, alto: number): string {
  const xm = (x0 + x1) / 2;
  return `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1} L${x1},${y1 + alto} C${xm},${y1 + alto} ${xm},${y0 + alto} ${x0},${y0 + alto} Z`;
}

// ─── Cómo se mueve el trabajo (lienzo de procesos) ─────────────────────────────

const INICIALES: Record<string, string> = { Operaciones: "OP", Comercial: "CO", "Administración y Finanzas": "AF", Personas: "PE", Externo: "EX" };

function Procesos({ tarea, alVerMapa }: { tarea: CompartidaId | null; alVerMapa: (id: CompartidaId) => void }) {
  const [idFlujo, setIdFlujo] = useState(FLUJOS[0].id);
  const flujo = FLUJOS.find((f) => f.id === idFlujo)!;
  const [sel, setSel] = useState<number | null>(1);
  const paso: PasoFlujo | null = sel !== null ? flujo.pasos[sel] ?? null : null;

  return (
    <section className="card lienzo-card">
      <div className="lienzo-cab">
        <div>
          <h2>{flujo.t}</h2>
          <div className="small muted">{flujo.d} Según lo contaron las personas entrevistadas.</div>
        </div>
        <div className="seg seg-sm" role="tablist" aria-label="Proceso">
          {FLUJOS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={f.id === idFlujo} onClick={() => { setIdFlujo(f.id); setSel(1); }}>
              {f.t.split(":")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="procesos">
        <div className="lienzo">
          <div className="cadena">
            {flujo.pasos.map((p, i) => {
              const on = tarea ? p.compartidas.includes(tarea) : false;
              const off = tarea !== null && !on;
              return (
                <div key={p.unidad + i} className="tramo">
                  <button
                    type="button"
                    className={`nodo-p ${p.externa ? "externo" : ""} ${on ? "on" : ""} ${off ? "off" : ""} ${sel === i ? "sel" : ""}`}
                    style={on && tarea ? { ["--c" as string]: COLOR[tarea] } : undefined}
                    onClick={() => setSel(i)}
                    aria-pressed={sel === i}
                  >
                    <span className="nodo-cab">
                      <span className="avatar">{INICIALES[p.gerencia] ?? "··"}</span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                        <span className="nodo-t">{p.unidad}</span>
                        <span className="nodo-s">{p.externa ? "Externo" : `${p.personas} personas`}</span>
                      </span>
                    </span>
                    <span className="nodo-d">{p.hace}</span>
                    <span className="nodo-pie">
                      {p.manual && <span className="mano">A mano</span>}
                      {p.compartidas.map((c) => <span key={c} className="dot" style={{ background: COLOR[c] }} title={CORTO[c]} />)}
                    </span>
                  </button>
                  {i < flujo.pasos.length - 1 && (
                    <div className="conector" aria-hidden="true">
                      <svg width="100%" height="12" preserveAspectRatio="none" viewBox="0 0 100 12"><line x1="0" y1="6" x2="94" y2="6" /><path d="M90 1l6 5-6 5" /></svg>
                      {p.entrega && <span className="conector-etq">{p.entrega}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="panel-p" aria-live="polite">
          {paso ? (
            <>
              <div className="cab-panel">
                <div className="small muted">{paso.gerencia}{paso.personas ? ` · ${paso.personas} personas` : ""}</div>
                <div className="sora" style={{ fontSize: 20, fontWeight: 600 }}>{paso.unidad}</div>
                <div>{paso.hace}</div>
              </div>
              {paso.manual ? (
                <div className="a-mano">
                  <div className="small" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Hoy se hace a mano</div>
                  <div style={{ marginTop: 4 }}>{paso.manual.texto}</div>
                  {paso.manual.cita && <blockquote>“{paso.manual.cita}”</blockquote>}
                  <div className="quien">— {paso.manual.quien}</div>
                </div>
              ) : (
                <div className="small muted">Sin trabajo manual reportado en este paso.</div>
              )}
              {paso.compartidas.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {paso.entrega && <div className="small" style={{ marginBottom: 6 }}><span className="muted">Entrega al siguiente:</span> {paso.entrega}</div>}
                  <div className="small muted">Se repite en otras unidades</div>
                  {paso.compartidas.map((c) => (
                    <button key={c} type="button" className="link-tarea" onClick={() => alVerMapa(c)}>
                      <span className="dot" style={{ background: COLOR[c] }} /> {CORTO[c]} <span className="muted">· ver en el mapa →</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="small muted">Elige un paso para ver el detalle.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
