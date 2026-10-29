import { redirect } from "next/navigation";
import { INVITADOS } from "@/lib/gia/semilla";

// En el producto cada persona entra por su propio link (/gia/e/CODIGO). Esta
// ruta queda para los enlaces de la demo y manda al primer invitado.
export default function PaginaEntrevista() {
  redirect(`/gia/e/${INVITADOS[0].codigo}`);
}
