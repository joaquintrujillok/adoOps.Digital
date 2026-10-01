import QRCode from "qrcode";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { vanniCapturas, vanniCupones, vanniPromociones } from "@/db/vanni";
import Barras from "@/components/vanni/Barras";
import SubirBaseMaestra from "@/components/vanni/SubirBaseMaestra";
import { borrarPromocionAction, guardarPromocionAction } from "@/lib/vanni/backoffice.actions";
import { capturasPorSucursal, embudoCaptura, sucursalesConocidas } from "@/lib/vanni/captura";
import { embudoCupones, estadoEfectivo } from "@/lib/vanni/cupones";
import { clpCompacto, fechaHora, miles, pct } from "@/lib/vanni/formato";
import { formatoRut } from "@/lib/vanni/rut";
import { formatoTelefono } from "@/lib/vanni/telefono";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const ORIGEN_TEL: Record<string, string> = { confirmado: "Igual al de la base", nuevo: "Nuevo (la base no tenía)", corregido: "Distinto al de la base" };

export default async function Captura() {
  const [e, sucs, porSucursal, promos, recientes, c, cupones] = await Promise.all([
    embudoCaptura(),
    sucursalesConocidas(),
    capturasPorSucursal(),
    db.select().from(vanniPromociones).orderBy(asc(vanniPromociones.orden), asc(vanniPromociones.id)),
    db.select().from(vanniCapturas).orderBy(desc(vanniCapturas.createdAt)).limit(30),
    embudoCupones(),
    db.select().from(vanniCupones).orderBy(desc(vanniCupones.createdAt)).limit(30),
  ]);

  // Un QR por sucursal más uno general. El SVG sale de QRCode, no de una entrada
  // del usuario: la sucursal va codificada en la URL.
  const destinos = [{ nombre: "General", url: `${SITE_URL}/vanni/descuento` }, ...sucs.map((s) => ({ nombre: s, url: `${SITE_URL}/vanni/descuento?s=${encodeURIComponent(s)}` }))];
  const qrs = await Promise.all(
    destinos.map(async (d) => ({ ...d, svg: await QRCode.toString(d.url, { type: "svg", margin: 1, width: 180, color: { dark: "#1b2a2f", light: "#fdfcfa" } }) })),
  );
  const numero = process.env.VANNI_WHATSAPP_NUMERO?.replace(/\D/g, "");

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Captura en tienda</h1>
          <p>Fase 1: QR en cada sucursal → abre el WhatsApp de Vanni con el mensaje ya escrito → el bot pide permiso para ofertas y el RUT → entrega un <b>cupón con QR</b> que se canjea en caja. El número llega solo: es el del teléfono que escribe. La base gana teléfonos y permiso para contactar, sin depender del e-commerce.</p>
        </div>
        <div className="vn-top-acciones">
          <a className="vn-btn vn-btn-sec" href="/vanni/descuento" target="_blank" rel="noreferrer">Probar el QR</a>
          <a className="vn-btn vn-btn-sec" href="/vanni/canje" target="_blank" rel="noreferrer">Pantalla de caja</a>
        </div>
      </div>

      {!numero && (
        <p className="vn-aviso" style={{ marginBottom: 14 }}>
          Falta <b>VANNI_WHATSAPP_NUMERO</b> (el número de WhatsApp de Vanni, formato 569XXXXXXXX). Sin él, el QR de la sala no puede abrir WhatsApp.
        </p>
      )}

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16 }}>
        <div className="vn-kpi"><label>Base maestra</label><b>{miles(e.base)}</b><span>{pct(e.baseConTelefono, e.base)} con teléfono</span></div>
        <div className="vn-kpi"><label>Dieron su RUT</label><b>{miles(e.ingresos)}</b><span>{pct(e.encontrados, e.ingresos)} estaba en la base</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Recibieron su cupón</label><b>{miles(e.completadas)}</b><span>por WhatsApp, con su número</span></div>
        <div className="vn-kpi"><label>Aceptaron ofertas</label><b>{miles(e.consentimiento)}</b><span>{pct(e.consentimiento, e.completadas)} de los que completaron</span></div>
        <div className="vn-kpi"><label>Números nuevos</label><b>{miles(e.nuevos)}</b><span>que la base no tenía</span></div>
      </div>

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <div className="vn-kpi"><label>Cupones emitidos</label><b>{miles(c.emitidos)}</b><span>uno vigente por RUT</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Canjeados en caja</label><b>{miles(c.canjeados)}</b><span>{pct(c.canjeados, c.emitidos)} de los emitidos</span></div>
        <div className="vn-kpi"><label>Vigentes sin usar</label><b>{miles(c.vigentes)}</b><span>{c.vencidos ? `${c.vencidos} vencidos` : "ninguno vencido"}</span></div>
        <div className="vn-kpi" title="Suma de los montos que la caja registró al canjear"><label>Venta con cupón</label><b>{clpCompacto(c.montoCanjeado)}</b><span>según lo registrado en caja</span></div>
      </div>

      <div className="vn-grid vn-grid-2" style={{ marginBottom: 16 }}>
        <section className="vn-card">
          <h2>Teléfonos obtenidos</h2>
          <p className="vn-sub">El número de WhatsApp de cada cliente que pidió su cupón, comparado con la base</p>
          <div style={{ marginTop: 8 }}>
            <Barras
              anchoNombre={190}
              filas={[
                { nombre: "Igual al de la base", valor: e.confirmados, etiqueta: miles(e.confirmados) },
                { nombre: "Nuevo: la base no tenía", valor: e.nuevos, etiqueta: miles(e.nuevos) },
                { nombre: "Distinto (no se reemplaza)", valor: e.corregidos, etiqueta: miles(e.corregidos) },
              ].filter((f) => e.completadas > 0)}
            />
          </div>
        </section>
        <section className="vn-card">
          <h2>Por sucursal</h2>
          <p className="vn-sub">RUT recibidos por WhatsApp en cada sala</p>
          <div style={{ marginTop: 8 }}>
            <Barras anchoNombre={120} filas={porSucursal.map((s) => ({ nombre: s.sucursal, valor: s.ingresos, etiqueta: miles(s.ingresos), dato: <span>{s.completadas} con cupón</span> }))} />
          </div>
        </section>
      </div>

      <div className="vn-grid vn-grid-2" style={{ marginBottom: 16 }}>
        <section className="vn-card">
          <h2>Base maestra de clientes</h2>
          <p className="vn-sub" style={{ marginBottom: 10 }}>La base de Vanni por RUT, con el descuento de cada cliente.</p>
          <SubirBaseMaestra />
        </section>
        <section className="vn-card">
          <h2>Descuentos vigentes</h2>
          <p className="vn-sub" style={{ marginBottom: 10 }}>El primero activo es el descuento del cupón para quien no está en la base maestra.</p>
          <div style={{ display: "grid", gap: 8 }}>
            {promos.map((p) => (
              <form key={p.id} action={guardarPromocionAction} className="vn-promo-fila">
                <input type="hidden" name="id" value={p.id} />
                <input name="titulo" defaultValue={p.titulo} className="vn-input" aria-label="Título" />
                <input name="detalle" defaultValue={p.detalle ?? ""} placeholder="Detalle" className="vn-input" aria-label="Detalle" />
                <input name="orden" defaultValue={p.orden} className="vn-input" style={{ width: 56 }} aria-label="Orden" title="Orden" />
                <label title="Activa"><input type="checkbox" name="activa" defaultChecked={p.activa} /></label>
                <button className="vn-btn vn-btn-sm vn-btn-sec">Guardar</button>
                <button formAction={borrarPromocionAction.bind(null, p.id)} className="vn-btn vn-btn-sm vn-btn-sec" title="Eliminar">✕</button>
              </form>
            ))}
            <form action={guardarPromocionAction} className="vn-promo-fila">
              <input name="titulo" placeholder="Nuevo descuento, ej: 15% en bandejas y blondas" className="vn-input" required />
              <input name="detalle" placeholder="Detalle, ej: hasta el 31 de octubre" className="vn-input" />
              <input name="orden" defaultValue={promos.length + 1} className="vn-input" style={{ width: 56 }} aria-label="Orden" />
              <input type="hidden" name="activa" value="on" />
              <button className="vn-btn vn-btn-sm">Agregar</button>
            </form>
          </div>
        </section>
      </div>

      <section className="vn-card" style={{ marginBottom: 16 }}>
        <h2>QR para imprimir</h2>
        <p className="vn-sub">Uno por sucursal (así se sabe dónde se captó a cada cliente) y uno general. Clic derecho → guardar imagen, o imprime esta página.</p>
        <div className="vn-qrs">
          {qrs.map((q) => (
            <figure key={q.nombre} className="vn-qr-fig">
              <div dangerouslySetInnerHTML={{ __html: q.svg }} />
              <figcaption><b>{q.nombre}</b><span>{q.url.replace("https://", "")}</span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="vn-card" style={{ marginBottom: 16 }}>
        <h2>Últimos cupones</h2>
        <div className="vn-scroll" style={{ marginTop: 8 }}>
          <table className="vn-tabla">
            <thead><tr><th>Código</th><th>RUT</th><th>Descuento</th><th>Estado</th><th>Canje</th><th className="vn-num">Monto</th><th>Emitido</th></tr></thead>
            <tbody>
              {cupones.map((x) => {
                const est = estadoEfectivo(x);
                return (
                  <tr key={x.id}>
                    <td><a href={`/vanni/cupon/${x.token}`} target="_blank" rel="noreferrer" style={{ color: "var(--vn-teal)", fontWeight: 600 }}>{x.codigo}</a></td>
                    <td>{formatoRut(x.rut)}</td>
                    <td>{x.descuento}</td>
                    <td><span className={`vn-chip ${est === "canjeado" ? "vn-chip-teal" : est === "vigente" ? "" : "vn-chip-rojo"}`}>{est}</span></td>
                    <td>{x.canjeadoAt ? `${x.sucursalCanje ?? ""} · ${fechaHora(x.canjeadoAt)}` : "—"}</td>
                    <td className="vn-num">{x.montoCompra ? clpCompacto(x.montoCompra) : "—"}</td>
                    <td>{fechaHora(x.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!cupones.length && <p className="vn-vacio">Todavía no se emite ningún cupón.</p>}
        </div>
      </section>

      <section className="vn-card">
        <h2>Últimas capturas</h2>
        <div className="vn-scroll" style={{ marginTop: 8 }}>
          <table className="vn-tabla">
            <thead><tr><th>Cuándo</th><th>RUT</th><th>WhatsApp</th><th>Sucursal</th><th>En la base</th><th>Opt-in ofertas</th><th>Número vs. base</th></tr></thead>
            <tbody>
              {recientes.map((c) => (
                <tr key={c.id}>
                  <td>{fechaHora(c.createdAt)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatoRut(c.rut)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{c.telefono ? formatoTelefono(c.telefono) : "—"}</td>
                  <td>{c.sucursal ?? "—"}</td>
                  <td>{c.encontrado ? <span className="vn-chip vn-chip-teal">Sí</span> : <span className="vn-chip">No</span>}</td>
                  <td>
                    {!c.completadaAt ? (
                      <span style={{ color: "var(--vn-muted)" }}>No completó</span>
                    ) : c.consentimiento ? (
                      <span className="vn-chip vn-chip-teal">✓ Aceptó</span>
                    ) : (
                      <span className="vn-chip">No aceptó</span>
                    )}
                  </td>
                  <td>{c.origenTelefono ? ORIGEN_TEL[c.origenTelefono] : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recientes.length && <p className="vn-vacio">Todavía nadie escaneó un QR.</p>}
        </div>
      </section>
    </>
  );
}
