import { redirect } from "next/navigation";

// El motor se mudó a /dashboard360/motor para que todo el flujo de prospección
// —mercado, cola, bandeja, emisores— se vea en una sola consola.
//
// El redirect se queda: hay enlaces guardados y marcadores apuntando acá, y un
// 404 obliga a adivinar dónde quedó la pantalla.
export default function LeadsMovido() {
  redirect("/dashboard360/motor");
}
