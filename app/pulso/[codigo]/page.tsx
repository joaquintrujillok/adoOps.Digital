import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import Marco from "@/components/pulso/Marco";
import { estadoSala } from "@/lib/pulso/datos";
import { url } from "@/lib/site";
import Pantalla from "./Pantalla";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pulso IA · en vivo",
  robots: { index: false, follow: false },
};

/**
 * La pantalla que se proyecta en la charla. Pública a propósito —se abre en el
 * computador de la sala sin iniciar sesión— y por eso solo muestra lo agregado:
 * puntos sin nombre, conteos y las tareas tal como se escribieron.
 */
export default async function PaginaPantalla({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const sala = await estadoSala(codigo);
  if (!sala) notFound();

  const enlace = url(`/p/${sala.codigo}`);
  const qr = await QRCode.toString(enlace, { type: "svg", margin: 0, color: { dark: "#0E1D33", light: "#FFFFFF" } });

  return (
    <Marco>
      <Pantalla inicial={sala} qr={qr} enlace={enlace.replace(/^https?:\/\/(www\.)?/, "")} />
    </Marco>
  );
}
