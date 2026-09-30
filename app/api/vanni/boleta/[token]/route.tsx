import { ImageResponse } from "next/og";
import { clp } from "@/lib/vanni/formato";
import { pedidoPorToken } from "@/lib/vanni/pedidos";
import { formatoTelefono } from "@/lib/vanni/telefono";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

// Boleta de un pedido pagado, como imagen: es lo que le llega al cliente por
// WhatsApp después de "Pago recibido". Es de DEMOSTRACIÓN y lo dice: no hay
// folio del SII ni RUT emisor, porque el pago también es simulado. La abre
// WaSender sin sesión; la protege el mismo token del link de pago.

const ANCHO = 900;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const encontrado = await pedidoPorToken(token);
  if (!encontrado || !encontrado.pedido.pagadoAt) return new Response("No encontrada", { status: 404 });
  const { pedido, items } = encontrado;

  const unidades = items.reduce((s, i) => s + i.cantidad, 0);
  const neto = Math.round(pedido.total / 1.19);
  const iva = pedido.total - neto;
  const fecha = pedido.pagadoAt!.toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago",
  });
  const alto = 760 + items.length * 64;

  const fila = { display: "flex", width: "100%", padding: "14px 0", borderBottom: "1px solid #e4dfd4", fontSize: 24 } as const;
  const col = (w: number, derecha = false) => ({ display: "flex", width: w, justifyContent: derecha ? "flex-end" : "flex-start" }) as const;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fdfcfa", color: "#1b2a2f", padding: "48px 56px", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori solo entiende <img> */}
          <img src={`${SITE_URL}/clientes/vanni-logo.png`} width={214} height={84} alt="Vanni" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", border: "3px solid #17705b", borderRadius: 12, padding: "12px 20px", color: "#17705b" }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>BOLETA ELECTRÓNICA</div>
            <div style={{ display: "flex", fontSize: 22 }}>{`N° ${String(pedido.id).padStart(6, "0")}`}</div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 20, background: "#f6e7db", color: "#8a3b12", borderRadius: 10, padding: "10px 16px", fontSize: 20 }}>
          Documento de demostración, sin validez tributaria
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, fontSize: 22, color: "#3f4d53", gap: 4 }}>
          <div style={{ display: "flex" }}>{`Pedido ${pedido.codigo} · pagado el ${fecha}`}</div>
          <div style={{ display: "flex" }}>{`Cliente: ${pedido.nombreCliente ?? "Cliente"} · ${formatoTelefono(pedido.telefono)}`}</div>
          <div style={{ display: "flex" }}>{`Despacho: ${pedido.direccion ?? "retiro en sucursal"}`}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>
          <div style={{ ...fila, fontWeight: 700, borderBottom: "2px solid #1b2a2f", fontSize: 22 }}>
            <div style={col(430)}>Producto</div>
            <div style={col(90, true)}>Unid.</div>
            <div style={col(130, true)}>Precio</div>
            <div style={col(138, true)}>Subtotal</div>
          </div>
          {items.map((i) => (
            <div key={i.id} style={fila}>
              <div style={{ ...col(430), fontSize: 20, paddingRight: 12 }}>{i.nombre.length > 60 ? `${i.nombre.slice(0, 58)}…` : i.nombre}</div>
              <div style={col(90, true)}>{String(i.cantidad)}</div>
              <div style={col(130, true)}>{clp(i.precio)}</div>
              <div style={col(138, true)}>{clp(i.precio * i.cantidad)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignSelf: "flex-end", width: 420, marginTop: 24, fontSize: 24, gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Unidades</span><span>{String(unidades)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Neto</span><span>{clp(neto)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>IVA 19%</span><span>{clp(iva)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700, borderTop: "2px solid #1b2a2f", paddingTop: 8, marginTop: 4 }}>
            <span>Total</span><span>{clp(pedido.total)}</span>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", fontSize: 20, color: "#5a6570" }}>
          Pagado con link de pago por WhatsApp · Precios de demostración
        </div>
      </div>
    ),
    { width: ANCHO, height: alto },
  );
}
