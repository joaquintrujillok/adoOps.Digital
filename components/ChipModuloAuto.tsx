"use client";

import { usePathname } from "next/navigation";
import ChipModulo from "./ChipModulo";

// La versión para layouts compartidos.
//
// Un layout de servidor no conoce el pathname, y hay uno —el de Dashboard360—
// que envuelve dos módulos con estados distintos: el tablero (interno, lleva
// chip) y el motor de prospección (producción, no lleva). Poner el chip en cada
// página suelta era la alternativa, pero eso reparte por diez archivos una
// decisión que ya vive en `lib/modulos.ts`, y basta olvidarse de una para que la
// pantalla mienta.
//
// Acá el registro decide. En /dashboard360/motor no pinta nada, no porque este
// componente lo excluya sino porque esa fila dice `produccion`.
export default function ChipModuloAuto() {
  return <ChipModulo ruta={usePathname()} />;
}
