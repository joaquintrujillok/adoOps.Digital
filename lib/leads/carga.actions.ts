"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/crm/auth.actions";
import { importarEmpresas, type ResultadoImportacion } from "./ingesta";
import type { LeadOrigen } from "@/db/leads";

export interface EstadoCarga {
  error?: string;
  resultado?: ResultadoImportacion;
}

// Un CSV de 200 empresas pesa ~30 KB. El techo está para que un archivo
// equivocado —el zip del SII, por ejemplo— falle rápido y con un mensaje claro
// en vez de tumbar la función por memoria.
const MAX_BYTES = 5 * 1024 * 1024;

const ORIGENES: LeadOrigen[] = ["sii", "chilecompra", "prospeo", "fullenrich", "linkedin", "csv", "manual"];

export async function cargarCsvAction(
  _prev: EstadoCarga,
  formData: FormData,
): Promise<EstadoCarga> {
  await requireSession();

  const archivo = formData.get("archivo") as File | null;
  if (!archivo || archivo.size === 0) return { error: "Elige un archivo CSV" };
  if (archivo.size > MAX_BYTES) {
    return { error: `El archivo pesa ${(archivo.size / 1e6).toFixed(1)} MB y el máximo son 5 MB` };
  }

  const origen = String(formData.get("origen") ?? "csv") as LeadOrigen;
  if (!ORIGENES.includes(origen)) return { error: "Origen no reconocido" };

  let texto: string;
  try {
    texto = await archivo.text();
  } catch {
    return { error: "No pude leer el archivo. ¿Es un CSV de verdad?" };
  }

  try {
    const resultado = await importarEmpresas(texto, { origen });
    revalidatePath("/leads");
    revalidatePath("/leads/prospectos");
    return { resultado };
  } catch (e) {
    // El mensaje real va al log; al usuario se le dice qué pasó sin filtrar la
    // estructura de la base.
    console.error("[leads] carga CSV falló", e);
    return { error: "La importación falló a mitad de camino. Revisa el log." };
  }
}
