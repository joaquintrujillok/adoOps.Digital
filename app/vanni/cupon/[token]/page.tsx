import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import FormCanje from "@/components/vanni/FormCanje";
import { sesionVigente } from "@/lib/vanni/auth.actions";
import { sucursalesConocidas } from "@/lib/vanni/captura";
import { cuponPorToken, estadoEfectivo, qrSvg, urlCupon } from "@/lib/vanni/cupones";
import { clp, fechaHora } from "@/lib/vanni/formato";
import { formatoRut } from "@/lib/vanni/rut";

export const dynamic = "force-dynamic";

// La ficha del cupón: es lo que abre su QR.
//
// Sin sesión la ve el cliente: su descuento y su QR para mostrar en caja.
// Con sesión (cualquier cuenta del backoffice, incluida la de caja) aparece el
// formulario de canje. La misma URL sirve a los dos, así la caja no necesita
// una app aparte: escanea con la cámara del teléfono y listo.

export const metadata: Metadata = { title: "Cupón Vanni", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b2a2f" };

const ESTADO: Record<string, { texto: string; clase: string }> = {
  vigente: { texto: "Vigente", clase: "vn-chip-teal" },
  canjeado: { texto: "Canjeado", clase: "vn-chip-oscuro" },
  vencido: { texto: "Vencido", clase: "vn-chip-rojo" },
  anulado: { texto: "Anulado", clase: "vn-chip-rojo" },
};

export default async function Cupon({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cupon = await cuponPorToken(token);
  if (!cupon) notFound();
  const [sesion, svg] = await Promise.all([sesionVigente(), qrSvg(urlCupon(token), 230)]);
  const estado = estadoEfectivo(cupon);
  const vence = cupon.venceAt.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Santiago" });
  const nombre = (cupon.nombre ?? "").trim().split(/\s+/)[0];

  return (
    <div className="vn-qr">
      <div className="vn-qr-cabecera">
        <Image src="/clientes/vanni-logo.png" alt="Vanni" width={220} height={86} priority />
      </div>

      <div className="vn-card vn-qr-card vn-cupon" style={{ opacity: estado === "vigente" ? 1 : 0.85 }}>
        <span className="vn-cupon-etiqueta">Cupón Vanni{nombre ? ` · ${nombre}` : ""}</span>
        <b className="vn-cupon-descuento">{cupon.descuento}</b>
        <span className={`vn-chip ${ESTADO[estado].clase}`} style={{ fontSize: 14, padding: "4px 12px" }}>{ESTADO[estado].texto}</span>
        {estado === "vigente" && <div className="vn-cupon-qr" dangerouslySetInnerHTML={{ __html: svg }} />}
        <div className="vn-cupon-codigo">{cupon.codigo}</div>
        {estado === "vigente" && <p>Muéstralo en caja en cualquier sucursal Vanni. Vence el {vence}.</p>}
        {estado === "canjeado" && <p>Canjeado el {fechaHora(cupon.canjeadoAt)}{cupon.sucursalCanje ? ` en ${cupon.sucursalCanje}` : ""}.</p>}
        {estado === "vencido" && <p>Venció el {vence}.</p>}
      </div>

      {!sesion && estado === "vigente" && (
        <Link href={`/vanni/login?from=/vanni/cupon/${token}`} className="vn-qr-pie" style={{ textDecoration: "underline" }}>
          ¿Eres de la tienda? Inicia sesión para canjear
        </Link>
      )}

      {sesion && (
        <div className="vn-card vn-qr-card">
          <h2 style={{ fontSize: 18 }}>Canje en caja</h2>
          <p style={{ fontSize: 14 }}>
            RUT {formatoRut(cupon.rut)}
            {cupon.nombre ? ` · ${cupon.nombre}` : ""} · emitido {fechaHora(cupon.createdAt)}
          </p>
          {estado === "vigente" ? (
            <FormCanje token={token} sucursales={await sucursalesConocidas()} />
          ) : estado === "canjeado" ? (
            <p className="vn-aviso">
              Ya canjeado{cupon.sucursalCanje ? ` en ${cupon.sucursalCanje}` : ""} el {fechaHora(cupon.canjeadoAt)}
              {cupon.boleta ? ` · boleta ${cupon.boleta}` : ""}{cupon.montoCompra ? ` · ${clp(cupon.montoCompra)}` : ""}
              <br /><b>No lo apliques de nuevo.</b>
            </p>
          ) : (
            <p className="vn-aviso vn-aviso-rojo">Este cupón no se puede canjear: está {ESTADO[estado].texto.toLowerCase()}.</p>
          )}
          <Link href="/vanni/canje" className="vn-qr-link">Canjear otro cupón</Link>
        </div>
      )}
    </div>
  );
}
