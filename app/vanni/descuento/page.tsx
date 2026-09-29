import type { Metadata, Viewport } from "next";
import Image from "next/image";
import FormDescuento from "@/components/vanni/FormDescuento";

export const dynamic = "force-dynamic";

// Página pública del QR de sala. Sin sesión: la abre un cliente en su celular.
// La sucursal viaja en el QR (?s=Centro) para saber dónde se captó a cada uno.

export const metadata: Metadata = {
  title: "Tu descuento Vanni",
  description: "Ingresa tu RUT y activa tu descuento por WhatsApp.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b2a2f" };

export default async function Descuento({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const sucursal = s ? s.replace(/[^\p{L}\p{N} .-]/gu, "").slice(0, 60) || null : null;
  return (
    <div className="vn-qr">
      <div className="vn-qr-cabecera">
        <Image src="/clientes/vanni-logo.png" alt="Vanni" width={180} height={71} priority />
      </div>
      <FormDescuento sucursal={sucursal} />
      <p className="vn-qr-pie">Tus datos se usan solo para aplicar tu descuento y, si lo aceptas, enviarte ofertas.</p>
    </div>
  );
}
