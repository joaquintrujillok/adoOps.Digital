import { notFound } from "next/navigation";
import BotonPagar from "@/components/vanni/BotonPagar";
import { clp } from "@/lib/vanni/formato";
import { pedidoPorToken, sucursalDeRetiro } from "@/lib/vanni/pedidos";

export const dynamic = "force-dynamic";

// Página de pago que abre el cliente desde el link de WhatsApp. Es simulada:
// no hay pasarela, el botón marca el pedido como pagado y dispara el aviso por
// WhatsApp. Lo dice en pantalla para que nadie crea que pagó de verdad.

export default async function Pagar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const encontrado = await pedidoPorToken(token);
  if (!encontrado) notFound();
  const { pedido, items } = encontrado;
  // Pagado es tener fecha de pago: una reserva de pickup no está pagada hasta que paga.
  const pagado = Boolean(pedido.pagadoAt);

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div className="vn-display" style={{ fontSize: 26, fontWeight: 600 }}>Vanni</div>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--vn-teal)", fontWeight: 600 }}>Pago de pedido</div>
        </div>
        <div className="vn-card" style={{ display: "grid", gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>Pedido {pedido.codigo}</h1>
            {pedido.nombreCliente && <p style={{ color: "var(--vn-muted)" }}>{pedido.nombreCliente}</p>}
          </div>
          <table className="vn-tabla">
            <tbody>
              {items.map((i) => (
                <tr key={i.id}><td>{i.nombre} <span style={{ color: "var(--vn-muted)" }}>× {i.cantidad}</span></td><td className="vn-num">{clp(i.precio * i.cantidad)}</td></tr>
              ))}
              <tr><td style={{ fontWeight: 700 }}>Total</td><td className="vn-num" style={{ fontWeight: 700 }}>{clp(pedido.total)}</td></tr>
            </tbody>
          </table>
          {pedido.direccion && <p style={{ fontSize: 14 }}><b>{sucursalDeRetiro(pedido.direccion) ? "Retiro:" : "Despacho:"}</b> {sucursalDeRetiro(pedido.direccion) ?? pedido.direccion}</p>}
          {pedido.estado === "cancelado" ? (
            <p className="vn-aviso vn-aviso-rojo">Este pedido fue cancelado.</p>
          ) : pagado ? (
            <p className="vn-aviso vn-aviso-teal">✅ Pago recibido. {sucursalDeRetiro(pedido.direccion) ? `Te avisaremos por WhatsApp cuando esté listo para retirar en ${sucursalDeRetiro(pedido.direccion)}.` : "Te avisaremos por WhatsApp cada paso del despacho."}</p>
          ) : (
            <BotonPagar token={token} total={clp(pedido.total)} />
          )}
          <p className="vn-ayuda" style={{ textAlign: "center" }}>Demostración: no se realiza ningún cobro real.</p>
        </div>
      </div>
    </div>
  );
}
