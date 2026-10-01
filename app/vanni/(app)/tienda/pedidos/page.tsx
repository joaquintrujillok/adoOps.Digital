import Link from "next/link";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniPedidoItems, vanniPedidos } from "@/db/vanni";
import { ESTADO_PEDIDO } from "@/lib/vanni/etiquetas";
import { clp, fechaHora, miles } from "@/lib/vanni/formato";
import { formatoTelefono, normalizarTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

// Cotizaciones y pedidos de la tienda por WhatsApp. Una cotización es un pedido
// que todavía no se paga: el cliente armó el carrito y recibió el link.

export default async function Pedidos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const busqueda = q.trim();
  const telefono = normalizarTelefono(busqueda);
  const filtro = busqueda
    ? or(
        telefono ? eq(vanniPedidos.telefono, telefono) : undefined,
        ilike(vanniPedidos.codigo, `%${busqueda}%`),
        ilike(vanniPedidos.nombreCliente, `%${busqueda}%`),
      )
    : undefined;

  const unidades = db
    .select({ pedidoId: vanniPedidoItems.pedidoId, n: sql<number>`sum(${vanniPedidoItems.cantidad})::int`.as("n"), productos: sql<number>`count(*)::int`.as("productos") })
    .from(vanniPedidoItems)
    .groupBy(vanniPedidoItems.pedidoId)
    .as("u");

  const [pedidos, [r]] = await Promise.all([
    db
      .select({ p: vanniPedidos, unidades: unidades.n, productos: unidades.productos })
      .from(vanniPedidos)
      .leftJoin(unidades, eq(unidades.pedidoId, vanniPedidos.id))
      .where(filtro)
      .orderBy(desc(vanniPedidos.createdAt))
      .limit(200),
    db
      .select({
        n: sql<number>`count(*)::int`,
        // Confirmada = pagada con link o reservada para retiro (pickup: se paga en la sucursal).
        pagados: sql<number>`count(*) filter (where ${vanniPedidos.estado} not in ('pendiente_pago', 'cancelado'))::int`,
        venta: sql<number>`coalesce(sum(${vanniPedidos.total}) filter (where ${vanniPedidos.estado} not in ('pendiente_pago', 'cancelado')), 0)::int`,
        pendientes: sql<number>`count(*) filter (where ${vanniPedidos.estado} = 'pendiente_pago')::int`,
      })
      .from(vanniPedidos)
      .where(filtro),
  ]);
  const unCliente = telefono && pedidos.length > 0 && pedidos.every((x) => x.p.telefono === telefono);

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Cotizaciones y pedidos</h1>
          <p>Lo que se cotizó y se compró por WhatsApp. Cada cambio de estado le avisa al cliente por el mismo chat.</p>
        </div>
        <form className="vn-top-acciones" style={{ display: "flex", gap: 8 }}>
          <input name="q" defaultValue={busqueda} className="vn-input" placeholder="Teléfono, pedido o nombre" style={{ width: 260 }} />
          <button className="vn-btn vn-btn-sec">Buscar</button>
          {busqueda && <Link href="/vanni/tienda/pedidos" className="vn-btn vn-btn-sec">Ver todos</Link>}
        </form>
      </div>

      {unCliente && (
        <p className="vn-aviso vn-aviso-teal" style={{ marginBottom: 14 }}>
          <b>{pedidos[0].p.nombreCliente ?? "Cliente"}</b> · {formatoTelefono(telefono)} · {pedidos.length} {pedidos.length === 1 ? "cotización" : "cotizaciones"}, {r?.pagados ?? 0} {(r?.pagados ?? 0) === 1 ? "confirmada" : "confirmadas"} por {clp(r?.venta ?? 0)}
        </p>
      )}

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <div className="vn-kpi"><label>Cotizaciones</label><b>{miles(r?.n ?? 0)}</b><span>armadas en el chat</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Confirmadas</label><b>{miles(r?.pagados ?? 0)}</b><span>reservadas para retiro o pagadas</span></div>
        <div className="vn-kpi"><label>Venta confirmada</label><b>{clp(r?.venta ?? 0)}</b><span>precios de demostración</span></div>
        <div className="vn-kpi"><label>Esperando pago</label><b>{miles(r?.pendientes ?? 0)}</b><span>link enviado</span></div>
      </div>
      <section className="vn-card">
        <div className="vn-scroll">
          <table className="vn-tabla">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Teléfono</th><th className="vn-num">Productos</th><th className="vn-num">Unidades</th><th className="vn-num">Total</th><th>Estado</th><th>Cotizado</th></tr></thead>
            <tbody>
              {pedidos.map(({ p, unidades: u, productos }) => (
                <tr key={p.id}>
                  <td><Link href={`/vanni/tienda/pedidos/${p.id}`} style={{ fontWeight: 600, color: "var(--vn-ink)" }}>{p.codigo}</Link>{p.simulado && <> <span className="vn-chip vn-chip-aviso">Simulador</span></>}</td>
                  <td>{p.nombreCliente ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}><Link href={`/vanni/tienda/pedidos?q=${p.telefono}`} style={{ color: "var(--vn-teal)" }}>{formatoTelefono(p.telefono)}</Link></td>
                  <td className="vn-num">{productos ?? 0}</td>
                  <td className="vn-num">{miles(u ?? 0)}</td>
                  <td className="vn-num">{clp(p.total)}</td>
                  <td><span className={`vn-chip ${ESTADO_PEDIDO[p.estado]?.clase ?? ""}`}>{ESTADO_PEDIDO[p.estado]?.texto ?? p.estado}</span></td>
                  <td>{fechaHora(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pedidos.length && (
            <p className="vn-vacio">
              {busqueda ? "No hay cotizaciones que calcen con esa búsqueda." : "Todavía no hay pedidos. Escríbele al número de Vanni lo que quieres comprar, o prueba en el simulador."}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
