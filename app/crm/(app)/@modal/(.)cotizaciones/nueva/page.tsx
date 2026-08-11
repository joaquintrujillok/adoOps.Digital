// Cotizar sin salir de donde uno estaba.
//
// Ruta interceptada sobre `/crm/cotizaciones/nueva`. Es la que más gana con el
// modal: se cotiza en el mostrador, con el cliente enfrente, y las tres entradas
// al armador —la cartera, la ficha del contacto y la lista de cotizaciones— son
// justo las pantallas a las que hay que volver después. Recargando o llegando
// por un link pegado se pinta la página completa.
//
// Al crear, `accionCrearCotizacion` redirige a la cotización recién hecha: esa
// navegación resuelve el slot del modal a `default.tsx` y el modal se cierra
// solo, sin que haya que coordinarlo desde acá.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crmContacts } from "@/db/crm";
import Modal from "@/components/crm/Modal";
import ArmadorCotizacion from "@/components/crm/ArmadorCotizacion";
import { requireSession } from "@/lib/crm/auth.actions";

export const dynamic = "force-dynamic";

const BOUTIQUES = ["Alonso de Córdova", "Casa Costanera", "Viña del Mar"];

export default async function NuevaCotizacionModal({
  searchParams,
}: {
  searchParams: Promise<{ contacto?: string; error?: string }>;
}) {
  await requireSession();
  const { contacto, error } = await searchParams;

  // Si viene desde la ficha de un cliente, el formulario llega con sus datos:
  // volver a teclear el teléfono de alguien que ya está en la base es la forma
  // más rápida de terminar con dos fichas de la misma persona.
  const contactoInicial = contacto
    ? (
        await db
          .select({
            id: crmContacts.id,
            nombre: crmContacts.nombre,
            telefono: crmContacts.telefono,
          })
          .from(crmContacts)
          .where(eq(crmContacts.id, Number(contacto)))
          .limit(1)
      )[0] ?? null
    : null;

  return (
    <Modal
      titulo="Nueva cotización"
      bajada="Tres datos y las piezas. El teléfono se captura desde el primer minuto."
      ancho="ancho"
    >
      <ArmadorCotizacion
        boutiques={BOUTIQUES}
        contactoInicial={contactoInicial}
        error={error}
      />
    </Modal>
  );
}
