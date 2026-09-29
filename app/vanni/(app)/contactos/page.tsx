import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { vanniContactos } from "@/db/vanni";
import AgregarContacto from "@/components/vanni/AgregarContacto";
import SubirPlanilla from "@/components/vanni/SubirPlanilla";
import { cambiarEstadoContactoAction } from "@/lib/vanni/backoffice.actions";
import { sucursales } from "@/lib/vanni/contactos";
import { clp, miles } from "@/lib/vanni/formato";
import { contactosPorSegmento } from "@/lib/vanni/metricas";
import { SEGMENTOS } from "@/lib/vanni/rfm";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export default async function Contactos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; segmento?: string; datos?: string; pagina?: string }>;
}) {
  const sp = await searchParams;
  const ejemplo = sp.datos === "ejemplo";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  const filtros: SQL[] = [eq(vanniContactos.ejemplo, ejemplo)];
  if (sp.segmento) filtros.push(eq(vanniContactos.segmento, sp.segmento));
  if (sp.q) {
    const q = `%${sp.q.trim()}%`;
    filtros.push(or(ilike(vanniContactos.nombre, q), ilike(vanniContactos.razonSocial, q), ilike(vanniContactos.telefono, q), ilike(vanniContactos.sucursal, q))!);
  }
  const donde = and(...filtros);

  const [filas, [total], resumen, listaSucursales] = await Promise.all([
    db.select().from(vanniContactos).where(donde).orderBy(asc(vanniContactos.segmento), desc(vanniContactos.montoTotal)).limit(POR_PAGINA).offset((pagina - 1) * POR_PAGINA),
    db.select({ n: sql<number>`count(*)::int` }).from(vanniContactos).where(donde),
    contactosPorSegmento(ejemplo),
    sucursales(false),
  ]);
  const porSegmento = new Map(resumen.map((r) => [r.segmento, r]));
  const totalBase = resumen.reduce((s, r) => s + r.n, 0);
  const paginas = Math.max(1, Math.ceil((total?.n ?? 0) / POR_PAGINA));
  const enlace = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const d = { q: sp.q, segmento: sp.segmento, datos: ejemplo ? "ejemplo" : undefined, ...extra };
    for (const [k, v] of Object.entries(d)) if (v) p.set(k, v);
    return `/vanni/contactos?${p}`;
  };

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Contactos y segmentos</h1>
          <p>La base de clientes inactivos. El segmento RFM se calcula contra toda la base cada vez que se carga una planilla.</p>
        </div>
        <div className="vn-top-acciones">
          <Link className={`vn-btn vn-btn-sm ${ejemplo ? "vn-btn-sec" : ""}`} href="/vanni/contactos">Reales</Link>
          <Link className={`vn-btn vn-btn-sm ${ejemplo ? "" : "vn-btn-sec"}`} href="/vanni/contactos?datos=ejemplo">Ejemplo</Link>
        </div>
      </div>

      {!ejemplo && (
        <div className="vn-grid vn-grid-2" style={{ marginBottom: 16 }}>
          <section className="vn-card"><h2>Cargar planilla</h2><p className="vn-sub" style={{ marginBottom: 10 }}>Excel (.xlsx) o CSV. Si el teléfono ya existe, se actualiza; una baja nunca se revierte desde una planilla.</p><SubirPlanilla /></section>
          <section className="vn-card"><h2>Agregar uno por uno</h2><p className="vn-sub" style={{ marginBottom: 10 }}>Sin datos de compra queda como “Sin historial”, y se puede contactar igual.</p><AgregarContacto sucursales={listaSucursales} /></section>
        </div>
      )}
      {ejemplo && <p className="vn-aviso" style={{ marginBottom: 16 }}>Contactos de ejemplo: teléfonos inventados (569000…) que nunca reciben mensajes.</p>}

      <section className="vn-card" style={{ marginBottom: 16 }}>
        <h2>Segmentos RFM</h2>
        <p className="vn-sub">{miles(totalBase)} contactos · Recencia, Frecuencia y Monto puntuados de 1 a 5 por quintiles</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          <Link href={enlace({ segmento: undefined, pagina: undefined })} className={`vn-chip ${!sp.segmento ? "vn-chip-oscuro" : ""}`} style={{ padding: "6px 12px" }}>Todos · {miles(totalBase)}</Link>
          {SEGMENTOS.filter((s) => porSegmento.has(s.nombre)).map((s) => (
            <Link key={s.nombre} href={enlace({ segmento: s.nombre, pagina: undefined })} title={s.descripcion}
              className={`vn-chip ${sp.segmento === s.nombre ? "vn-chip-oscuro" : "vn-chip-teal"}`} style={{ padding: "6px 12px" }}>
              {s.nombre} · {porSegmento.get(s.nombre)!.n}
            </Link>
          ))}
        </div>
      </section>

      <section className="vn-card">
        <form style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {ejemplo && <input type="hidden" name="datos" value="ejemplo" />}
          {sp.segmento && <input type="hidden" name="segmento" value={sp.segmento} />}
          <input name="q" defaultValue={sp.q} placeholder="Buscar por nombre, razón social, teléfono o sucursal" className="vn-input" style={{ maxWidth: 420 }} />
          <button className="vn-btn vn-btn-sec">Buscar</button>
        </form>
        <div className="vn-scroll">
          <table className="vn-tabla">
            <thead>
              <tr><th>Cliente</th><th>Teléfono</th><th>Sucursal</th><th>Segmento</th><th className="vn-num">R·F·M</th><th>Última compra</th><th className="vn-num">Compras</th><th className="vn-num">Monto</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {filas.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.razonSocial || c.nombre || "—"}</b>{c.razonSocial && c.nombre && <div style={{ fontSize: 12.5, color: "var(--vn-muted)" }}>{c.nombre}</div>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatoTelefono(c.telefono)}</td>
                  <td>{c.sucursal ?? "—"}</td>
                  <td><span className="vn-chip vn-chip-teal">{c.segmento}</span></td>
                  <td className="vn-num">{c.rScore ? `${c.rScore}·${c.fScore}·${c.mScore}` : "—"}</td>
                  <td>{c.ultimaCompra ?? "—"}</td>
                  <td className="vn-num">{c.nCompras ?? "—"}</td>
                  <td className="vn-num">{c.montoTotal !== null ? clp(c.montoTotal) : "—"}</td>
                  <td>{c.estado === "baja" ? <span className="vn-chip vn-chip-rojo">Baja</span> : <span className="vn-chip">Activo</span>}</td>
                  <td>
                    {!ejemplo && (
                      <form action={cambiarEstadoContactoAction.bind(null, c.id, c.estado === "baja" ? "activo" : "baja")}>
                        <button className="vn-btn vn-btn-sm vn-btn-sec">{c.estado === "baja" ? "Reactivar" : "Dar de baja"}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filas.length && <p className="vn-vacio">Sin contactos con esos filtros.</p>}
        </div>
        {paginas > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, alignItems: "center" }}>
            {pagina > 1 && <Link className="vn-btn vn-btn-sm vn-btn-sec" href={enlace({ pagina: String(pagina - 1) })}>Anterior</Link>}
            <span style={{ fontSize: 13, color: "var(--vn-muted)" }}>Página {pagina} de {paginas}</span>
            {pagina < paginas && <Link className="vn-btn vn-btn-sm vn-btn-sec" href={enlace({ pagina: String(pagina + 1) })}>Siguiente</Link>}
          </div>
        )}
      </section>
    </>
  );
}
