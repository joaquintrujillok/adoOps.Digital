import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniPedidos } from "@/db/vanni";
import { ESTADO_PEDIDO } from "@/lib/vanni/etiquetas";
import { clp, fechaHora, miles } from "@/lib/vanni/formato";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

export default async function Pedidos() {
  const [pedidos, [r]] = await Promise.all([
    db.select().from(vanniPedidos).orderBy(desc(vanniPedidos.createdAt)).limit(200),
    db
      .select({
        n: sql<number>`count(*)::int`,
        pagados: sql<number>`count(*) filter (where ${vanniPedidos.pagadoAt} is not null)::int`,
        venta: sql<number>`coalesce(sum(${vanniPedidos.total}) filter (where ${vanniPedidos.pagadoAt} is not null), 0)::int`,
        pendientes: sql<number>`count(*) filter (where ${vanniPedidos.estado} = 'pendiente_pago')::int`,
      })
      .from(vanniPedidos),
  ]);

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Pedidos</h1>
          <p>Lo que se compró por WhatsApp. Cada cambio de estado le avisa al cliente por el mismo chat: pago, preparación, despacho, en camino y entrega.</p>
        </div>
      </div>
      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16, gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <div className="vn-kpi"><label>Pedidos</label><b>{miles(r?.n ?? 0)}</b><span>creados en el chat</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Pagados</label><b>{miles(r?.pagados ?? 0)}</b><span>con el link de pago</span></div>
        <div className="vn-kpi"><label>Venta pagada</label><b>{clp(r?.venta ?? 0)}</b><span>precios de demostración</span></div>
        <div className="vn-kpi"><label>Esperando pago</label><b>{miles(r?.pendientes ?? 0)}</b><span>link enviado</span></div>
      </div>
      <section className="vn-card">
        <div className="vn-scroll">
          <table className="vn-tabla">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Teléfono</th><th className="vn-num">Total</th><th>Estado</th><th>Creado</th></tr></thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/vanni/tienda/pedidos/${p.id}`} style={{ fontWeight: 600, color: "var(--vn-ink)" }}>{p.codigo}</Link>{p.simulado && <> <span className="vn-chip vn-chip-aviso">Simulador</span></>}</td>
                  <td>{p.nombreCliente ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatoTelefono(p.telefono)}</td>
                  <td className="vn-num">{clp(p.total)}</td>
                  <td><span className={`vn-chip ${ESTADO_PEDIDO[p.estado]?.clase ?? ""}`}>{ESTADO_PEDIDO[p.estado]?.texto ?? p.estado}</span></td>
                  <td>{fechaHora(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!pedidos.length && <p className="vn-vacio">Todavía no hay pedidos. Escríbele al número de Vanni lo que quieres comprar, o prueba en el simulador.</p>}
        </div>
      </section>
    </>
  );
}
