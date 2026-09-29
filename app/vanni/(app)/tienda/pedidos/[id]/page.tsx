import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { VANNI_ESTADOS_PEDIDO, vanniPedidoItems, vanniPedidos } from "@/db/vanni";
import { cambiarEstadoPedidoAction } from "@/lib/vanni/backoffice.actions";
import { ESTADO_PEDIDO } from "@/lib/vanni/etiquetas";
import { clp, fechaHora } from "@/lib/vanni/formato";
import { linkDePago } from "@/lib/vanni/pedidos";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

/** El siguiente paso natural, para ofrecerlo como botón principal. */
const SIGUIENTE: Record<string, string> = {
  pagado: "preparacion",
  preparacion: "despachado",
  despachado: "en_camino",
  en_camino: "entregado",
};

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await db.select().from(vanniPedidos).where(eq(vanniPedidos.id, Number(id)));
  if (!p) notFound();
  const items = await db.select().from(vanniPedidoItems).where(eq(vanniPedidoItems.pedidoId, p.id));
  const siguiente = SIGUIENTE[p.estado];

  return (
    <>
      <div className="vn-top">
        <div>
          <p style={{ marginBottom: 4 }}><Link href="/vanni/tienda/pedidos" style={{ color: "var(--vn-teal)" }}>← Pedidos</Link></p>
          <h1>Pedido {p.codigo} <span className={`vn-chip ${ESTADO_PEDIDO[p.estado]?.clase ?? ""}`}>{ESTADO_PEDIDO[p.estado]?.texto}</span></h1>
          <p>{p.nombreCliente ?? "Cliente"} · {formatoTelefono(p.telefono)} · {p.direccion ?? "Sin dirección de despacho"}</p>
        </div>
        <div className="vn-top-acciones">
          {siguiente && (
            <form action={cambiarEstadoPedidoAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="estado" value={siguiente} />
              <button className="vn-btn">Marcar “{ESTADO_PEDIDO[siguiente].texto}” y avisar</button>
            </form>
          )}
        </div>
      </div>
      {p.simulado && <p className="vn-aviso" style={{ marginBottom: 14 }}>Pedido del simulador: los avisos de estado se registran pero no salen por WhatsApp.</p>}

      <div className="vn-grid vn-grid-2">
        <section className="vn-card">
          <h2>Detalle</h2>
          <table className="vn-tabla" style={{ marginTop: 8 }}>
            <thead><tr><th>Producto</th><th className="vn-num">Cant.</th><th className="vn-num">Precio</th><th className="vn-num">Subtotal</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}><td>{i.nombre}</td><td className="vn-num">{i.cantidad}</td><td className="vn-num">{clp(i.precio)}</td><td className="vn-num">{clp(i.precio * i.cantidad)}</td></tr>
              ))}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>Total</td><td className="vn-num" style={{ fontWeight: 700 }}>{clp(p.total)}</td></tr>
            </tbody>
          </table>
          <p className="vn-ayuda" style={{ marginTop: 10 }}>Link de pago: <a href={linkDePago(p.tokenPago)} target="_blank" rel="noreferrer" style={{ color: "var(--vn-teal)" }}>{linkDePago(p.tokenPago)}</a></p>
        </section>
        <section className="vn-card">
          <h2>Seguimiento</h2>
          <ol style={{ margin: "10px 0 14px 18px", display: "grid", gap: 4 }}>
            {(p.historial ?? []).map((h, i) => <li key={i}><b>{ESTADO_PEDIDO[h.estado]?.texto ?? h.estado}</b> · {fechaHora(h.at)}</li>)}
          </ol>
          <form action={cambiarEstadoPedidoAction} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="id" value={p.id} />
            <select name="estado" defaultValue={p.estado} className="vn-select">
              {VANNI_ESTADOS_PEDIDO.map((e) => <option key={e} value={e}>{ESTADO_PEDIDO[e].texto}</option>)}
            </select>
            <button className="vn-btn vn-btn-sec">Cambiar y avisar</button>
          </form>
          <p className="vn-ayuda" style={{ marginTop: 8 }}>El cliente recibe un WhatsApp con cada cambio.</p>
        </section>
      </div>
    </>
  );
}
