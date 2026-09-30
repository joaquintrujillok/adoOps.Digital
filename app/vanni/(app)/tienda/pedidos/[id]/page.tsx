import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vanniPedidoItems, vanniPedidos, vanniProductos } from "@/db/vanni";
import { cambiarEstadoPedidoAction } from "@/lib/vanni/backoffice.actions";
import { ESTADO_PEDIDO } from "@/lib/vanni/etiquetas";
import { clp, fechaHora, miles } from "@/lib/vanni/formato";
import { linkDePago, urlBoleta } from "@/lib/vanni/pedidos";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

/** El recorrido después del pago, en orden. Cada paso es un botón que avisa al cliente. */
const RECORRIDO = ["pagado", "preparacion", "despachado", "en_camino", "llega_hoy", "entregado"] as const;

export default async function DetallePedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await db.select().from(vanniPedidos).where(eq(vanniPedidos.id, Number(id)));
  if (!p) notFound();
  const items = await db
    .select({ i: vanniPedidoItems, stockHoy: vanniProductos.stock, sku: vanniProductos.sku })
    .from(vanniPedidoItems)
    .leftJoin(vanniProductos, eq(vanniProductos.id, vanniPedidoItems.productoId))
    .where(eq(vanniPedidoItems.pedidoId, p.id));
  const unidades = items.reduce((s, x) => s + x.i.cantidad, 0);
  const paso = RECORRIDO.indexOf(p.estado as (typeof RECORRIDO)[number]);
  const cuando = new Map((p.historial ?? []).map((h) => [h.estado, h.at]));

  return (
    <>
      <div className="vn-top">
        <div>
          <p style={{ marginBottom: 4 }}><Link href="/vanni/tienda/pedidos" style={{ color: "var(--vn-teal)" }}>← Cotizaciones y pedidos</Link></p>
          <h1>Pedido {p.codigo} <span className={`vn-chip ${ESTADO_PEDIDO[p.estado]?.clase ?? ""}`}>{ESTADO_PEDIDO[p.estado]?.texto}</span></h1>
          <p>
            {p.nombreCliente ?? "Cliente"} · <Link href={`/vanni/tienda/pedidos?q=${p.telefono}`} style={{ color: "var(--vn-teal)" }}>{formatoTelefono(p.telefono)}</Link> ·{" "}
            {p.direccion ?? "Sin dirección de despacho"} · cotizado el {fechaHora(p.createdAt)}
          </p>
        </div>
        {p.pagadoAt && (
          <div className="vn-top-acciones">
            <a href={urlBoleta(p.tokenPago)} target="_blank" rel="noreferrer" className="vn-btn vn-btn-sec">Ver boleta</a>
          </div>
        )}
      </div>
      {p.simulado && <p className="vn-aviso" style={{ marginBottom: 14 }}>Pedido del simulador: los avisos de estado se registran pero no salen por WhatsApp.</p>}

      <section className="vn-card" style={{ marginBottom: 16 }}>
        <h2>Despacho</h2>
        <p className="vn-sub" style={{ marginBottom: 12 }}>
          {p.estado === "pendiente_pago"
            ? "Cotización enviada: los pasos se activan cuando el cliente paga con su link."
            : p.estado === "cancelado"
              ? "Pedido cancelado."
              : "Cada botón cambia el estado y le avisa al cliente por WhatsApp."}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {RECORRIDO.map((e, i) => {
            const hecho = paso >= i;
            const disponible = paso >= 0 && i === paso + 1;
            return hecho || !disponible ? (
              <div key={e} className={`vn-chip ${hecho ? "vn-chip-teal" : ""}`} style={{ padding: "10px 14px", opacity: hecho ? 1 : 0.55 }}>
                {hecho ? "✓ " : ""}{ESTADO_PEDIDO[e].texto}
                {cuando.get(e) && <span style={{ fontWeight: 400 }}> · {fechaHora(cuando.get(e)!)}</span>}
              </div>
            ) : (
              <form key={e} action={cambiarEstadoPedidoAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="estado" value={e} />
                <button className="vn-btn">{ESTADO_PEDIDO[e].texto} · avisar</button>
              </form>
            );
          })}
          {p.estado !== "cancelado" && p.estado !== "entregado" && (
            <form action={cambiarEstadoPedidoAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="estado" value="cancelado" />
              <button className="vn-btn vn-btn-sec">Cancelar pedido</button>
            </form>
          )}
        </div>
      </section>

      <section className="vn-card">
        <h2>Detalle</h2>
        <div className="vn-scroll">
          <table className="vn-tabla" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Producto</th><th className="vn-num">Unidades</th><th className="vn-num">Precio</th><th className="vn-num">Subtotal</th>
                <th className="vn-num">Stock al cotizar</th><th className="vn-num">Stock hoy</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ i, stockHoy, sku }) => (
                <tr key={i.id}>
                  <td>{i.nombre}{sku && <div style={{ fontSize: 12.5, color: "var(--vn-muted)" }}>SKU {sku}</div>}</td>
                  <td className="vn-num">{miles(i.cantidad)}</td>
                  <td className="vn-num">{clp(i.precio)}</td>
                  <td className="vn-num">{clp(i.precio * i.cantidad)}</td>
                  <td className="vn-num">{i.stockAlCotizar === null ? "—" : miles(i.stockAlCotizar)}</td>
                  <td className="vn-num">{stockHoy === null ? "—" : miles(stockHoy)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td className="vn-num" style={{ fontWeight: 700 }}>{miles(unidades)}</td>
                <td></td>
                <td className="vn-num" style={{ fontWeight: 700 }}>{clp(p.total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="vn-ayuda" style={{ marginTop: 10 }}>
          El stock se descuenta al pagar. Link de pago:{" "}
          <a href={linkDePago(p.tokenPago)} target="_blank" rel="noreferrer" style={{ color: "var(--vn-teal)" }}>{linkDePago(p.tokenPago)}</a>
        </p>
      </section>
    </>
  );
}
