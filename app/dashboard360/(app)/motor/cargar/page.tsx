import { PageHeader } from "@/components/dashboard360/ui";
import FormularioCarga from "@/components/leads/FormularioCarga";

export const dynamic = "force-dynamic";

export default function Cargar() {
  return (
    <>
      <PageHeader
        titulo="Cargar prospectos"
        bajada="El archivo que produce scripts/fase0_sii.py muestra. Cada dato entra con su procedencia: el email de la columna prospeo_email se guarda como venido de Prospeo, no como 'csv'."
      />
      <FormularioCarga />
    </>
  );
}
