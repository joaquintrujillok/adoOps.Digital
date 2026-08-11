import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crmContacts } from "@/db/crm";
import { PageHeader } from "@/components/crm/ui";
import ArmadorCotizacion from "@/components/crm/ArmadorCotizacion";
import { requireSession } from "@/lib/crm/auth.actions";

export const dynamic = "force-dynamic";

const BOUTIQUES = ["Alonso de Córdova", "Casa Costanera", "Viña del Mar"];

export default async function NuevaCotizacion({
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
    <>
      <PageHeader
        titulo="Nueva cotización"
        bajada="Tres datos y las piezas. El teléfono se captura desde el primer minuto: es lo que permite seguir la venta después."
      />
      <div className="max-w-3xl">
        <ArmadorCotizacion
          boutiques={BOUTIQUES}
          contactoInicial={contactoInicial}
          error={error}
        />
      </div>
    </>
  );
}
