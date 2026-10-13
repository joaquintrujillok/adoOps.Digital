import { redirect } from "next/navigation";

/**
 * /v2 fue la vista previa del rediseño. Aprobado, pasó a ser la portada; esta
 * ruta queda solo para que el enlace que se compartió durante la revisión no
 * termine en un 404.
 */
export default function V2() {
  redirect("/");
}
