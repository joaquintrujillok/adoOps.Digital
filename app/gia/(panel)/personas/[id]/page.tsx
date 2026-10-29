import Link from "next/link";
import { notFound } from "next/navigation";
import { fichaEnVivo } from "@/lib/gia/datos";
import { ARQUETIPOS, NIVELES, SOLUCIONES, TEMAS, arquetipoPorId, campoDe } from "@/lib/gia/modelo";
import { FICHAS } from "@/lib/gia/semilla";

export const dynamic = "force-dynamic";

const POSTURA = { entusiasta: "Entusiasta", abierta: "Abierta", cauta: "Cauta", preocupada: "Preocupada" } as const;

/** La ficha de una persona: la de una entrevista en vivo (id numérico) o una de ejemplo. */
export default async function FichaPersona({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vivo = /^\d+$/.test(id) ? await fichaEnVivo(Number(id)) : null;
  const ejemplo = vivo ? null : FICHAS.find((f) => f.id === id);
  const f = vivo ?? ejemplo;
  if (!f) notFound();

  const a = f.analisis;
  const principal = arquetipoPorId(a.perfil.principal)!;
  const potencial = arquetipoPorId(a.perfil.potencial);
  const nivel = NIVELES.find((n) => n.n === a.perfil.madurez)!;
  const campo = campoDe(principal.id);
  const max = Math.max(...Object.values(a.perfil.puntos), 1);

  return (
    <>
      <header>
        <div className="small"><Link href="/gia/personas">← Personas</Link></div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8 }}>
          <h1>{f.nombre}</h1>
          {vivo ? <span className="pill t-verde vivo">Entrevista en vivo</span> : <span className="pill t-gris">Ejemplo</span>}
        </div>
        <div className="muted" style={{ marginTop: 4 }}>{f.cargo} · {f.gerencia}</div>
      </header>

      <section className="card"><p style={{ margin: 0, fontSize: 16 }}>{a.resumen}</p></section>

      <section className="row">
        <div className="card">
          <h2>Perfil de adopción</h2>
          <div className="grid" style={{ ["--min" as string]: "180px", gap: 10 }}>
            <div className="t-verde" style={{ borderRadius: 10, padding: 14 }}>
              <div className="small">Arquetipo principal</div>
              <div className="sora" style={{ fontSize: 20, fontWeight: 600 }}>{principal.nombre}</div>
              <div className="small">{principal.descripcion}</div>
            </div>
            <div className="t-azul" style={{ borderRadius: 10, padding: 14 }}>
              <div className="small">Madurez de uso</div>
              <div className="sora" style={{ fontSize: 20, fontWeight: 600 }}>{nivel.n} · {nivel.nombre}</div>
              <div className="small">{a.perfil.porQueMadurez || nivel.criterio}</div>
            </div>
          </div>
          {potencial && <div className="small">Potencial: <strong>{potencial.nombre}</strong> — {potencial.descripcion.toLowerCase()}.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ARQUETIPOS.map((x) => (
              <div key={x.id} style={{ display: "grid", gridTemplateColumns: "110px 1fr 28px", gap: 10, alignItems: "center", fontSize: 13 }}>
                <span>{x.nombre}</span>
                <div className="barra"><span style={{ width: `${(a.perfil.puntos[x.id] / max) * 100}%`, background: x.id === principal.id ? "var(--g-verde)" : "#A9D3BB" }} /></div>
                <span className="muted" style={{ textAlign: "right" }}>{a.perfil.puntos[x.id]}</span>
              </div>
            ))}
          </div>
          <div className="small muted">Reparto de 60 puntos según la evidencia de la entrevista. Ruta del campo {campo.nombre}: {campo.ruta}.</div>
        </div>

        <div className="card">
          <h2>Por qué este perfil</h2>
          {a.perfil.evidencias.length === 0 && <span className="muted">Sin citas suficientes.</span>}
          {a.perfil.evidencias.map((e, i) => (
            <div key={i} style={{ borderTop: "1px solid var(--g-linea2)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              <div className="small"><span className="pill t-verde">{arquetipoPorId(e.arquetipo)?.nombre}</span> <span className="muted">· {TEMAS.find((t) => t.id === e.tema)?.titulo}</span></div>
              <div style={{ fontStyle: "italic" }}>“{e.cita}”</div>
              <div className="small muted">{e.lectura}</div>
            </div>
          ))}
          <div className="small muted">El perfil se basa en lo que la persona dijo y hace, no en su voz. La persona lo revisó antes de confirmarlo.</div>
        </div>
      </section>

      <section className="card">
        <h2>Tareas repetitivas</h2>
        {a.tareas.length === 0 ? <span className="muted">No mencionó tareas repetitivas.</span> : (
          <div className="tabla">
            <table>
              <thead><tr><th>Tarea</th><th>Frecuencia</th><th>h/mes</th><th>Sistemas</th><th>Mejor solución</th></tr></thead>
              <tbody>
                {a.tareas.map((t) => (
                  <tr key={t.tarea}>
                    <td><div style={{ fontWeight: 500 }}>{t.tarea}</div>{t.cita && <div className="small muted" style={{ fontStyle: "italic" }}>“{t.cita}”</div>}</td>
                    <td>{t.frecuencia}</td>
                    <td style={{ fontWeight: 600 }}>{t.horasMes ?? "—"}</td>
                    <td className="muted">{t.sistemas.join(", ") || "—"}</td>
                    <td><span className="pill t-verde">{SOLUCIONES[t.solucion]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="row">
        <div className="card">
          <h2>Uso de IA hoy</h2>
          <div><span className="muted">Herramientas:</span> {a.usoIa.herramientas.join(", ") || "ninguna"}</div>
          <div><span className="muted">Frecuencia:</span> {a.usoIa.frecuencia || "—"}</div>
          <div><span className="muted">Cuenta:</span> {a.usoIa.cuentaCorporativa === null ? "no lo mencionó" : a.usoIa.cuentaCorporativa ? "de la empresa" : "personal"}</div>
          {a.usoIa.verificacion && <div><span className="muted">Cómo revisa:</span> {a.usoIa.verificacion}</div>}
          {a.alertas.map((x, i) => (
            <div key={i} className="t-rojo" style={{ borderRadius: 10, padding: "12px 14px", fontSize: 14 }}>
              <strong>Alerta de gobierno:</strong> {x.texto}{x.cita && <div style={{ fontStyle: "italic", marginTop: 4 }}>“{x.cita}”</div>}
            </div>
          ))}
        </div>
        <div className="card">
          <h2>El cambio</h2>
          <div><span className="pill t-ambar">{POSTURA[a.cambio.postura]}</span></div>
          {a.cambio.cita && <div style={{ fontStyle: "italic" }}>“{a.cambio.cita}”</div>}
          {a.cambio.preocupaciones.length > 0 && <div><span className="muted">Le preocupa:</span> {a.cambio.preocupaciones.join(" · ")}</div>}
          {a.cambio.ideas.length > 0 && <div><span className="muted">Ideas:</span> {a.cambio.ideas.join(" · ")}</div>}
        </div>
      </section>

      {a.ruta && (
        <section className="card" style={{ borderColor: "var(--g-verde)", borderWidth: 2 }}>
          <h2>Ruta sugerida</h2>
          <p style={{ margin: 0 }}>{a.ruta}</p>
        </section>
      )}
    </>
  );
}
