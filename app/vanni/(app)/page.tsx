import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vanniCampanas } from "@/db/vanni";
import Barras from "@/components/vanni/Barras";
import { cargarEjemploAction, borrarEjemploAction } from "@/lib/vanni/backoffice.actions";
import { miles, pct, renderPlantilla } from "@/lib/vanni/formato";
import { embudo, hayDatos, porSegmento, porSucursal, porVariante } from "@/lib/vanni/metricas";
import { SEGMENTOS } from "@/lib/vanni/rfm";

export const dynamic = "force-dynamic";

export default async function Resumen({
  searchParams,
}: {
  searchParams: Promise<{ datos?: string; campana?: string }>;
}) {
  const sp = await searchParams;
  const [hayReales, hayEjemplo] = await Promise.all([hayDatos(false), hayDatos(true)]);
  // Por defecto, lo real. Si todavía no hay nada real y sí hay ejemplo, el ejemplo.
  const ejemplo = sp.datos === "ejemplo" || (sp.datos !== "reales" && !hayReales && hayEjemplo);
  const campanas = await db
    .select({ id: vanniCampanas.id, nombre: vanniCampanas.nombre })
    .from(vanniCampanas)
    .where(eq(vanniCampanas.ejemplo, ejemplo))
    .orderBy(desc(vanniCampanas.id));
  const campanaId = Number(sp.campana) || null;
  const f = { ejemplo, campanaId };

  const [e, segs, sucs, vars] = await Promise.all([embudo(f), porSegmento(f), porSucursal(f), porVariante(f)]);

  if (!hayReales && !hayEjemplo) {
    return (
      <>
        <div className="vn-top"><div><h1>Resumen</h1><p>Todavía no hay contactos cargados.</p></div></div>
        <div className="vn-card" style={{ display: "grid", gap: 12, maxWidth: 620 }}>
          <h2>Para empezar</h2>
          <p>Carga la base de clientes inactivos (Excel o CSV) y crea una campaña. Si quieres ver el tablero antes, carga los datos de ejemplo: quedan marcados y se borran de un botón.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="vn-btn" href="/vanni/contactos">Cargar base de contactos</Link>
            <form action={cargarEjemploAction}><button className="vn-btn vn-btn-sec">Cargar datos de ejemplo</button></form>
          </div>
        </div>
      </>
    );
  }

  const orden = new Map<string, number>(SEGMENTOS.map((s, i) => [s.nombre, i]));
  const desc_ = new Map<string, string>(SEGMENTOS.map((s) => [s.nombre, s.descripcion]));
  const segOrdenados = [...segs].filter((s) => s.enviados > 0).sort((a, b) => (orden.get(a.segmento) ?? 99) - (orden.get(b.segmento) ?? 99));
  const tasaMax = Math.max(0.01, ...segOrdenados.map((s) => s.interesados / Math.max(1, s.enviados)));
  const ganadora = [...vars].sort((a, b) => b.interesados / Math.max(1, b.enviados) - a.interesados / Math.max(1, a.enviados))[0];

  const promoGanadora = ganadora
    ? (await db.select({ p: vanniCampanas.promocion }).from(vanniCampanas).where(eq(vanniCampanas.id, ganadora.campanaId)))[0]?.p
    : null;

  const url = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const d = { datos: ejemplo ? "ejemplo" : "reales", campana: campanaId ? String(campanaId) : null, ...extra };
    for (const [k, v] of Object.entries(d)) if (v) p.set(k, v);
    return `/vanni?${p}`;
  };

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Resumen</h1>
          <p>Cómo se movilizaron los clientes inactivos, por segmento RFM, sucursal y mensaje.</p>
        </div>
        <div className="vn-top-acciones">
          <Link className={`vn-btn vn-btn-sm ${ejemplo ? "vn-btn-sec" : ""}`} href={url({ datos: "reales", campana: null })}>Datos reales</Link>
          <Link className={`vn-btn vn-btn-sm ${ejemplo ? "" : "vn-btn-sec"}`} href={url({ datos: "ejemplo", campana: null })}>Datos de ejemplo</Link>
          {campanas.length > 1 && (
            <form style={{ display: "flex", gap: 6 }}>
              <input type="hidden" name="datos" value={ejemplo ? "ejemplo" : "reales"} />
              <select name="campana" defaultValue={campanaId ?? ""} className="vn-select" style={{ width: 220 }}>
                <option value="">Todas las campañas</option>
                {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <button className="vn-btn vn-btn-sm vn-btn-sec">Ver</button>
            </form>
          )}
        </div>
      </div>

      {ejemplo && (
        <div className="vn-aviso" style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span><b>Datos de ejemplo.</b> No son resultados: sirven para mostrar el tablero. Ningún contacto de ejemplo recibe mensajes.</span>
          {hayEjemplo && <form action={borrarEjemploAction}><button className="vn-btn vn-btn-sm vn-btn-sec">Borrar datos de ejemplo</button></form>}
        </div>
      )}

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16 }}>
        <div className="vn-kpi"><label>Enviados</label><b>{miles(e.enviados)}</b><span>{e.errores ? `${e.errores} con error · ` : ""}{pct(e.entregados, e.enviados)} entregados</span></div>
        <div className="vn-kpi"><label>Respondieron</label><b>{miles(e.respondieron)}</b><span>{pct(e.respondieron, e.enviados)} de enviados</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Interesados</label><b>{miles(e.interesados)}</b><span>{pct(e.interesados, e.enviados)} de enviados</span></div>
        <div className="vn-kpi"><label>Contactados por ejecutiva</label><b>{miles(e.contactados)}</b><span>{e.porLlamar} por llamar</span></div>
        <div className="vn-kpi"><label>En cotización</label><b>{miles(e.cotizando)}</b><span>{pct(e.cotizando, e.enviados)} de enviados · {e.bajas} bajas</span></div>
      </div>

      <div className="vn-grid vn-grid-3">
        <section className="vn-card">
          <h2>Movilización por segmento RFM</h2>
          <p className="vn-sub">Tasa de interés sobre enviados en cada segmento</p>
          <div style={{ marginTop: 10 }}>
            <Barras
              maximo={tasaMax}
              filas={segOrdenados.map((s) => ({
                nombre: s.segmento,
                detalle: desc_.get(s.segmento),
                valor: s.interesados / Math.max(1, s.enviados),
                etiqueta: pct(s.interesados, s.enviados),
                dato: (<><b>{s.interesados}</b> interesados<br /><span>{s.cotizando} en cotización</span></>),
              }))}
            />
          </div>
        </section>

        <section className="vn-card">
          <h2>Interesados por sucursal</h2>
          <p className="vn-sub">Y cuántos ya están cotizando</p>
          <div style={{ marginTop: 10 }}>
            <Barras
              anchoNombre={110}
              filas={sucs.filter((s) => s.interesados > 0).map((s) => ({
                nombre: s.sucursal,
                valor: s.interesados,
                etiqueta: String(s.interesados),
                dato: <span>{s.cotizando} cotiz.</span>,
              }))}
            />
          </div>
        </section>

        <section className="vn-card">
          <h2>Mensaje que más convirtió</h2>
          {ganadora && ganadora.enviados > 0 ? (
            <>
              <div style={{ background: "var(--vn-teal-soft)", borderRadius: 12, padding: "12px 14px", margin: "12px 0" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--vn-teal-dark)", letterSpacing: ".04em", textTransform: "uppercase" }}>
                  Variante {ganadora.codigo} · {pct(ganadora.interesados, ganadora.enviados)} de interés
                </div>
                <p style={{ marginTop: 6, fontSize: 14.5 }}>
                  “{renderPlantilla(ganadora.plantilla, { nombre: "Carolina", promocion: promoGanadora ?? "la promoción", categoria: "bandejas y blondas", sucursal: "Centro" })}”
                </p>
              </div>
              <Barras
                apilado
                maximo={Math.max(0.01, ...vars.map((v) => v.interesados / Math.max(1, v.enviados)))}
                filas={vars.map((v) => ({
                  nombre: `${v.codigo} · ${v.nombre}`,
                  valor: v.interesados / Math.max(1, v.enviados),
                  etiqueta: pct(v.interesados, v.enviados),
                  suave: v !== ganadora,
                }))}
              />
            </>
          ) : (
            <p className="vn-vacio">Aparece cuando una campaña tenga envíos.</p>
          )}
        </section>
      </div>

      {!hayEjemplo && hayReales && (
        <p style={{ marginTop: 18, fontSize: 13, color: "var(--vn-muted)" }}>
          ¿Necesitas mostrar el tablero con volumen?{" "}
          <form action={cargarEjemploAction} style={{ display: "inline" }}>
            <button style={{ background: "none", border: "none", color: "var(--vn-teal)", fontWeight: 600, cursor: "pointer", padding: 0 }}>Cargar datos de ejemplo</button>
          </form>{" "}(quedan separados de los reales).
        </p>
      )}
    </>
  );
}
