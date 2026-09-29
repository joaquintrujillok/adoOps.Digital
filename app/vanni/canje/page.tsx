import type { Metadata, Viewport } from "next";
import Image from "next/image";
import BuscarCupon from "@/components/vanni/BuscarCupon";
import { logoutAction, requireSesion } from "@/lib/vanni/auth.actions";

export const dynamic = "force-dynamic";

// La pantalla de la caja. Normalmente no hace falta: el cajero escanea el QR del
// cliente con la cámara y se abre la ficha del cupón. Esto es para cuando el QR
// no se puede leer (pantalla rota, poca batería): se escribe el código corto.

export const metadata: Metadata = { title: "Canje de cupones · Vanni", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b2a2f" };

export default async function Canje() {
  const s = await requireSesion();
  return (
    <div className="vn-qr">
      <div className="vn-qr-cabecera">
        <Image src="/clientes/vanni-logo.png" alt="Vanni" width={180} height={71} priority />
      </div>
      <div className="vn-card vn-qr-card">
        <h1 className="vn-qr-titulo">Canjear cupón</h1>
        <p>Escanea el QR del cliente con la cámara del teléfono, o escribe el código que aparece bajo el QR.</p>
        <BuscarCupon />
      </div>
      <form action={logoutAction} className="vn-qr-pie">
        {s.nombre} · <button className="vn-qr-link" style={{ fontSize: 12.5 }}>Cerrar sesión</button>
      </form>
    </div>
  );
}
