import { permanentRedirect } from "next/navigation";

// El hilo dejó de tener pantalla propia: vive en la columna del centro de
// `/crm/conversaciones`. La ruta se mantiene solo para que los enlaces viejos
// —marcadores, mensajes internos, un correo con el link pegado— sigan llegando
// al mismo lugar en vez de a un 404.

export default async function HiloWhatsapp({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/crm/conversaciones?hilo=${encodeURIComponent(id)}`);
}
