import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { urlWhatsAppSala } from "@/lib/vanni/captura";

export const dynamic = "force-dynamic";

// El QR de la sala apunta acá (?s=Centro) y de acá se va a WhatsApp con el
// mensaje ya escrito. No hay formulario: el RUT y el permiso los pide el bot, y
// el número llega solo porque es el del teléfono que escribe.
//
// El QR impreso no apunta directo a wa.me para poder cambiar el número o el
// texto sin reimprimir afiches, y para que la sucursal viaje en el mensaje.

export const metadata: Metadata = {
  title: "Tu descuento Vanni",
  description: "Escríbenos por WhatsApp y obtén tu cupón de descuento para usar en tienda.",
  robots: { index: false, follow: false },
};

export default async function Descuento({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const sucursal = s ? s.replace(/[^\p{L}\p{N} .-]/gu, "").slice(0, 60) || null : null;
  const destino = urlWhatsAppSala(sucursal);
  if (destino) redirect(destino);

  return (
    <div className="vn-qr">
      <div className="vn-qr-cabecera">
        <Image src="/clientes/vanni-logo.png" alt="Vanni" width={220} height={86} priority />
      </div>
      <div className="vn-card vn-qr-card">
        <p className="vn-qr-titulo">Pronto disponible</p>
        <p>El canal de WhatsApp de Vanni todavía no está activo. Pregunta en caja por tu descuento.</p>
      </div>
    </div>
  );
}
