import Link from "next/link";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { vanniCampanas, vanniContactos, vanniOportunidades, vanniUsuarios } from "@/db/vanni";
import { actualizarOportunidadAction } from "@/lib/vanni/backoffice.actions";
import { ESTADO_OPORTUNIDAD } from "@/lib/vanni/etiquetas";
import { fechaHora } from "@/lib/vanni/formato";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

export default async function PorLlamar({ searchParams }: { searchParams: Promise<{ estado?: string; datos?: string }> }) {
  const sp = await searchParams;
  const ejemplo = sp.datos === "ejemplo";
  const filtros: SQL[] = [eq(vanniOportunidades.ejemplo, ejemplo)];
  if (sp.estado) filtros.push(eq(vanniOportunidades.estado, sp.estado));

  const [filas, conteo] = await Promise.all([
    db
      .select({ o: vanniOportunidades, c: vanniContactos, campana: vanniCampanas.nombre, ejecutiva: vanniUsuarios.nombre })
      .from(vanniOportunidades)
      .innerJoin(vanniContactos, eq(vanniContactos.id, vanniOportunidades.contactoId))
      .leftJoin(vanniCampanas, eq(vanniCampanas.id, vanniOportunidades.campanaId))
      .leftJoin(vanniUsuarios, eq(vanniUsuarios.id, vanniOportunidades.ejecutivaId))
      .where(and(...filtros))
      // Primero lo que espera llamada, y dentro de eso lo más antiguo: el que
      // lleva más tiempo esperando es el que se está enfriando.
      .orderBy(sql`${vanniOportunidades.estado} = 'por_llamar' desc`, asc(vanniOportunidades.createdAt))
      .limit(200),
    db
      .select({ estado: vanniOportunidades.estado, n: sql<number>`count(*)::int` })
      .from(vanniOportunidades)
      .where(eq(vanniOportunidades.ejemplo, ejemplo))
      .groupBy(vanniOportunidades.estado)
      .orderBy(desc(sql`count(*)`)),
  ]);
  const enlace = (estado?: string) => {
    const p = new URLSearchParams();
    if (estado) p.set("estado", estado);
    if (ejemplo) p.set("datos", "ejemplo");
    return `/vanni/oportunidades?${p}`;
  };

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Por llamar</h1>
          <p>Clientes que respondieron con interés (o con un reclamo). Cada uno le llegó a la ejecutiva por WhatsApp y correo; acá se registra cómo avanza.</p>
        </div>
        <div className="vn-top-acciones">
          <Link className={`vn-btn vn-btn-sm ${ejemplo ? "vn-btn-sec" : ""}`} href="/vanni/oportunidades">Reales</Link>
          <Link className={`vn-btn vn-btn-sm ${ejemplo ? "" : "vn-btn-sec"}`} href="/vanni/oportunidades?datos=ejemplo">Ejemplo</Link>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href={enlace()} className={`vn-chip ${!sp.estado ? "vn-chip-oscuro" : ""}`} style={{ padding: "6px 12px" }}>Todas</Link>
        {Object.entries(ESTADO_OPORTUNIDAD).map(([k, v]) => {
          const n = conteo.find((c) => c.estado === k)?.n ?? 0;
          return <Link key={k} href={enlace(k)} className={`vn-chip ${sp.estado === k ? "vn-chip-oscuro" : v.clase}`} style={{ padding: "6px 12px" }}>{v.texto} · {n}</Link>;
        })}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {filas.map(({ o, c, campana, ejecutiva }) => (
          <section key={o.id} className="vn-card" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 18 }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 17 }}>{c.razonSocial || c.nombre || "Cliente sin nombre"}</h2>
                <span className={`vn-chip ${ESTADO_OPORTUNIDAD[o.estado]?.clase ?? ""}`}>{ESTADO_OPORTUNIDAD[o.estado]?.texto}</span>
                {o.tipo === "reclamo" && <span className="vn-chip vn-chip-rojo">Reclamo</span>}
                <span className="vn-chip vn-chip-teal">{c.segmento}</span>
              </div>
              <p style={{ marginTop: 4, fontSize: 14 }}>
                <a href={`tel:+${c.telefono}`} style={{ color: "var(--vn-teal)", fontWeight: 600 }}>{formatoTelefono(c.telefono)}</a>
                {" · "}<a href={`https://wa.me/${c.telefono}`} target="_blank" rel="noreferrer" style={{ color: "var(--vn-teal)" }}>WhatsApp</a>
                {c.nombre && c.razonSocial ? ` · ${c.nombre}` : ""}{c.sucursal ? ` · Sucursal ${c.sucursal}` : ""}
              </p>
              {o.interes && <p style={{ marginTop: 8 }}><b>Le interesa:</b> {o.interes}</p>}
              {o.resumen && <p style={{ marginTop: 4, color: "var(--vn-ink-2)" }}><b>Resumen:</b> {o.resumen}</p>}
              <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--vn-muted)" }}>
                {campana ?? "Sin campaña"} · Llegó {fechaHora(o.createdAt)} · {ejecutiva ?? "Sin ejecutiva asignada"}
                {o.notificadaAt ? " · Aviso enviado" : ""} · <Link href={`/vanni/conversaciones/${c.telefono}`} style={{ color: "var(--vn-teal)" }}>Ver conversación</Link>
              </p>
            </div>
            <form action={actualizarOportunidadAction} style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <input type="hidden" name="id" value={o.id} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label className="vn-label">Estado</label>
                  <select name="estado" defaultValue={o.estado} className="vn-select">
                    {Object.entries(ESTADO_OPORTUNIDAD).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
                  </select>
                </div>
                <div>
                  <label className="vn-label">Monto cotizado ($)</label>
                  <input name="monto" defaultValue={o.montoCotizado ?? ""} inputMode="numeric" className="vn-input" />
                </div>
              </div>
              <div><label className="vn-label">Notas</label><textarea name="notas" defaultValue={o.notas ?? ""} className="vn-textarea" style={{ minHeight: 56 }} /></div>
              <div><button className="vn-btn vn-btn-sm">Guardar</button></div>
            </form>
          </section>
        ))}
        {!filas.length && <p className="vn-card vn-vacio">No hay oportunidades con ese filtro.</p>}
      </div>
    </>
  );
}
