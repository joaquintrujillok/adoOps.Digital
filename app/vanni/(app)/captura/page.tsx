import QRCode from "qrcode";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { vanniCapturas, vanniPromociones } from "@/db/vanni";
import Barras from "@/components/vanni/Barras";
import SubirBaseMaestra from "@/components/vanni/SubirBaseMaestra";
import { borrarPromocionAction, guardarPromocionAction } from "@/lib/vanni/backoffice.actions";
import { capturasPorSucursal, embudoCaptura, sucursalesConocidas } from "@/lib/vanni/captura";
import { fechaHora, miles, pct } from "@/lib/vanni/formato";
import { formatoRut } from "@/lib/vanni/rut";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const ORIGEN_TEL: Record<string, string> = { confirmado: "Confirmó el de la base", nuevo: "Nuevo (la base no tenía)", corregido: "Corrigió el de la base" };

export default async function Captura() {
  const [e, sucs, porSucursal, promos, recientes] = await Promise.all([
    embudoCaptura(),
    sucursalesConocidas(),
    capturasPorSucursal(),
    db.select().from(vanniPromociones).orderBy(asc(vanniPromociones.orden), asc(vanniPromociones.id)),
    db.select().from(vanniCapturas).orderBy(desc(vanniCapturas.createdAt)).limit(30),
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
          <p>QR en cada sucursal: el cliente ingresa su RUT, ve su descuento, confirma o deja su WhatsApp y llega al bot. Así la base gana teléfonos y permiso para contactar.</p>
        </div>
        <a className="vn-btn vn-btn-sec" href="/vanni/descuento" target="_blank" rel="noreferrer">Ver el formulario</a>
      </div>

      {!numero && (
        <p className="vn-aviso" style={{ marginBottom: 14 }}>
          Falta <b>VANNI_WHATSAPP_NUMERO</b> (el número de WhatsApp de Vanni, formato 569XXXXXXXX). Sin él, el formulario funciona pero el botón final no puede abrir WhatsApp.
        </p>
      )}

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16 }}>
        <div className="vn-kpi"><label>Base maestra</label><b>{miles(e.base)}</b><span>{pct(e.baseConTelefono, e.base)} con teléfono</span></div>
        <div className="vn-kpi"><label>Ingresaron su RUT</label><b>{miles(e.ingresos)}</b><span>{pct(e.encontrados, e.ingresos)} estaba en la base</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Dejaron o confirmaron teléfono</label><b>{miles(e.completadas)}</b><span>{pct(e.completadas, e.ingresos)} de los que ingresaron</span></div>
        <div className="vn-kpi"><label>Aceptaron ofertas</label><b>{miles(e.consentimiento)}</b><span>{pct(e.consentimiento, e.completadas)} de los que completaron</span></div>
        <div className="vn-kpi"><label>Llegaron a WhatsApp</label><b>{miles(e.whatsapp)}</b><span>{pct(e.whatsapp, e.completadas)} de los que completaron</span></div>
      </div>

      <div className="vn-grid vn-grid-2" style={{ marginBottom: 16 }}>
        <section className="vn-card">
          <h2>Teléfonos obtenidos</h2>
          <p className="vn-sub">Qué pasó con el teléfono de cada cliente que completó el formulario</p>
          <div style={{ marginTop: 8 }}>
            <Barras
              anchoNombre={190}
              filas={[
                { nombre: "Confirmó el de la base", valor: e.confirmados, etiqueta: miles(e.confirmados) },
                { nombre: "Nuevo: la base no tenía", valor: e.nuevos, etiqueta: miles(e.nuevos) },
                { nombre: "Corrigió el de la base", valor: e.corregidos, etiqueta: miles(e.corregidos) },
              ].filter((f) => e.completadas > 0)}
            />
          </div>
        </section>
        <section className="vn-card">
          <h2>Por sucursal</h2>
          <p className="vn-sub">RUT ingresados y cuántos llegaron a WhatsApp</p>
          <div style={{ marginTop: 8 }}>
            <Barras anchoNombre={120} filas={porSucursal.map((s) => ({ nombre: s.sucursal, valor: s.ingresos, etiqueta: miles(s.ingresos), dato: <span>{s.whatsapp} a WhatsApp</span> }))} />
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
          <p className="vn-sub" style={{ marginBottom: 10 }}>Lo que el bot le cuenta a quien llega desde el QR. Solo aparecen los activos.</p>
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

      <section className="vn-card">
        <h2>Últimas capturas</h2>
        <div className="vn-scroll" style={{ marginTop: 8 }}>
          <table className="vn-tabla">
            <thead><tr><th>Cuándo</th><th>RUT</th><th>Sucursal</th><th>En la base</th><th>Teléfono</th><th>Ofertas</th><th>WhatsApp</th></tr></thead>
            <tbody>
              {recientes.map((c) => (
                <tr key={c.id}>
                  <td>{fechaHora(c.createdAt)}</td>
                  <td>{formatoRut(c.rut)}</td>
                  <td>{c.sucursal ?? "—"}</td>
                  <td>{c.encontrado ? <span className="vn-chip vn-chip-teal">Sí</span> : <span className="vn-chip">No</span>}</td>
                  <td>{c.origenTelefono ? ORIGEN_TEL[c.origenTelefono] : <span style={{ color: "var(--vn-muted)" }}>No completó</span>}</td>
                  <td>{c.completadaAt ? (c.consentimiento ? "Aceptó" : "No") : "—"}</td>
                  <td>{c.whatsappAt ? <span className="vn-chip vn-chip-teal">Llegó</span> : "—"}</td>
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
