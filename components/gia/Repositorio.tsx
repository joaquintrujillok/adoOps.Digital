"use client";

// El repositorio de documentos del CoE, con forma de biblioteca: carpetas a la
// izquierda, búsqueda y vista en cuadrícula o lista al centro, y la vista
// previa del documento elegido a la derecha (secciones, dueño, versión,
// estado). Arriba, lo que hay que leer primero.
//
// Los documentos son de la empresa demo. El contenido completo de cada uno se
// escribe con el cliente en la etapa 1; acá se muestra su ficha y su índice.

import { useMemo, useState } from "react";
import { CARPETAS, DOCS, type CarpetaDoc, type DocRepo } from "@/lib/gia/semilla";

const ESTADO: Record<DocRepo["estado"], [string, string]> = {
  publicado: ["Publicado", "verde"],
  revision: ["En revisión", "ambar"],
  borrador: ["Borrador", "gris"],
};

const TIPO: Record<DocRepo["tipo"], { t: string; color: string; fondo: string }> = {
  doc: { t: "Documento", color: "#2F5DA8", fondo: "#E5ECF8" },
  hoja: { t: "Planilla", color: "#1F8A55", fondo: "#E3F1E8" },
  pres: { t: "Presentación", color: "#B7791F", fondo: "#FFF1D6" },
  video: { t: "Video", color: "#B42318", fondo: "#FDE8E6" },
};

function IconoTipo({ tipo, size = 18 }: { tipo: DocRepo["tipo"]; size?: number }) {
  const c = TIPO[tipo].color;
  if (tipo === "video") return <svg width={size} height={size} viewBox="0 0 24 24" fill={c} aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
  if (tipo === "hoja") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 10h16M4 15h16M10 4v16" /></svg>;
  if (tipo === "pres") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4M8 20h8" /></svg>;
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>;
}

/** Una miniatura de hoja: líneas que sugieren el documento sin inventar su texto. */
function Hoja({ d }: { d: DocRepo }) {
  return (
    <div className="hoja" style={{ ["--c" as string]: TIPO[d.tipo].color, ["--f" as string]: TIPO[d.tipo].fondo }}>
      <div className="hoja-cab"><IconoTipo tipo={d.tipo} size={14} /></div>
      <div className="hoja-t">{d.t}</div>
      {d.secciones.slice(0, 3).map((s) => <div key={s} className="hoja-l"><span />{s}</div>)}
    </div>
  );
}

export default function Repositorio() {
  const [carpeta, setCarpeta] = useState<CarpetaDoc | "todo">("todo");
  const [q, setQ] = useState("");
  const [vista, setVista] = useState<"grilla" | "lista">("grilla");
  const [sel, setSel] = useState<string>(DOCS[0].id);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    return DOCS.filter((d) => (carpeta === "todo" || d.carpeta === carpeta) && (!t || `${d.t} ${d.resumen} ${d.etiquetas.join(" ")}`.toLowerCase().includes(t)));
  }, [carpeta, q]);
  const doc = DOCS.find((d) => d.id === sel) ?? null;
  const destacados = DOCS.filter((d) => d.destacado);

  return (
    <div className="repo">
      <aside className="repo-carpetas" aria-label="Carpetas">
        <button type="button" className="carpeta" aria-pressed={carpeta === "todo"} onClick={() => setCarpeta("todo")}>
          <span>Todo el repositorio</span><span className="cnt">{DOCS.length}</span>
        </button>
        {CARPETAS.map((c) => (
          <button key={c.id} type="button" className="carpeta" aria-pressed={carpeta === c.id} onClick={() => setCarpeta(c.id)}>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span>{c.t}</span>
              <span className="small muted" style={{ fontWeight: 400 }}>{c.d}</span>
            </span>
            <span className="cnt">{DOCS.filter((d) => d.carpeta === c.id).length}</span>
          </button>
        ))}
        <div className="repo-nota small muted">Cada documento tiene un dueño y una versión. Lo que está en revisión se marca hasta que el comité lo aprueba.</div>
      </aside>

      <div className="repo-centro">
        <div className="repo-barra">
          <div className="buscador">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <label className="sr-only" htmlFor="repo-q">Buscar en el repositorio</label>
            <input id="repo-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar políticas, guías, plantillas…" />
          </div>
          <div className="seg seg-sm" role="tablist" aria-label="Vista">
            <button type="button" role="tab" aria-selected={vista === "grilla"} onClick={() => setVista("grilla")}>Cuadrícula</button>
            <button type="button" role="tab" aria-selected={vista === "lista"} onClick={() => setVista("lista")}>Lista</button>
          </div>
        </div>

        {carpeta === "todo" && !q && (
          <div className="empieza">
            <div className="empieza-t">
              <span className="sora" style={{ fontWeight: 600 }}>Empieza aquí</span>
              <span className="small muted">Lo mínimo que toda persona debería leer</span>
            </div>
            <div className="empieza-docs">
              {destacados.map((d, i) => (
                <button key={d.id} type="button" className={`empieza-doc ${sel === d.id ? "sel" : ""}`} onClick={() => setSel(d.id)}>
                  <span className="empieza-n">{i + 1}</span>
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{d.t}</span>
                    <span className="small muted">{d.dueno} · v{d.version}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="small muted">{filtrados.length} {filtrados.length === 1 ? "documento" : "documentos"}{carpeta !== "todo" ? ` en ${CARPETAS.find((c) => c.id === carpeta)?.t}` : ""}</div>

        {filtrados.length === 0 ? (
          <div className="repo-vacio">No encontramos documentos con “{q}”. Prueba con otra palabra o pídelo al asesor del CoE.</div>
        ) : vista === "grilla" ? (
          <div className="repo-grilla">
            {filtrados.map((d) => (
              <button key={d.id} type="button" className={`doc-tarjeta ${sel === d.id ? "sel" : ""}`} onClick={() => setSel(d.id)} aria-pressed={sel === d.id}>
                <Hoja d={d} />
                <span className="doc-t">{d.t}</span>
                <span className="doc-meta">
                  <span className={`pill t-${ESTADO[d.estado][1]}`}>{ESTADO[d.estado][0]}</span>
                  <span className="small muted">Act. {d.actualizado}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="repo-lista" role="list">
            {filtrados.map((d) => (
              <button key={d.id} type="button" role="listitem" className={`doc-fila ${sel === d.id ? "sel" : ""}`} onClick={() => setSel(d.id)}>
                <span className="doc-ico-l" style={{ background: TIPO[d.tipo].fondo }}><IconoTipo tipo={d.tipo} /></span>
                <span className="doc-fila-t">{d.t}<span className="small muted">{CARPETAS.find((c) => c.id === d.carpeta)?.t} · {d.dueno} · v{d.version}</span></span>
                <span className="small muted col-fecha">{d.actualizado}</span>
                <span className={`pill t-${ESTADO[d.estado][1]}`}>{ESTADO[d.estado][0]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <aside className="repo-preview" aria-live="polite" aria-label="Vista previa del documento">
        {doc ? (
          <>
            <div className="prev-cab" style={{ background: TIPO[doc.tipo].fondo }}>
              <span className="prev-ico"><IconoTipo tipo={doc.tipo} size={22} /></span>
              <span className="small" style={{ color: TIPO[doc.tipo].color, fontWeight: 600 }}>{TIPO[doc.tipo].t} · {CARPETAS.find((c) => c.id === doc.carpeta)?.t}</span>
            </div>
            <div className="prev-cuerpo">
              <div className="sora" style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>{doc.t}</div>
              <p style={{ margin: 0, color: "var(--g-suave)", fontSize: 14 }}>{doc.resumen}</p>
              <div className="prev-etq">
                <span className={`pill t-${ESTADO[doc.estado][1]}`}>{ESTADO[doc.estado][0]}</span>
                {doc.etiquetas.map((e) => <span key={e} className="pill t-gris">{e}</span>)}
              </div>
              <div>
                <div className="ctx-t">Contenido</div>
                <ol className="prev-indice">{doc.secciones.map((s) => <li key={s}>{s}</li>)}</ol>
              </div>
              <dl className="prev-datos">
                <div><dt>Dueño</dt><dd>{doc.dueno}</dd></div>
                <div><dt>Versión</dt><dd>v{doc.version}</dd></div>
                <div><dt>Actualizado</dt><dd>{doc.actualizado}</dd></div>
                <div><dt>Lecturas</dt><dd>{doc.lecturas}</dd></div>
              </dl>
              <button type="button" className="btn" style={{ width: "100%" }} disabled title="En la demo se muestra la ficha; el documento se escribe con el cliente">Abrir documento</button>
              <div className="small muted" style={{ textAlign: "center" }}>En la demo se muestra la ficha; el documento completo se escribe con el cliente.</div>
            </div>
          </>
        ) : (
          <div className="small muted" style={{ padding: 20 }}>Elige un documento para ver su ficha.</div>
        )}
      </aside>
    </div>
  );
}
