"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initSitio } from "./animaciones";

/**
 * Monta `animaciones.js` sobre el armazón que renderiza `Sitio`.
 *
 * Depende de la ruta y no de `[]`: al navegar entre dos ediciones de Cafecito
 * el armazón no se desmonta —es el mismo segmento con otro parámetro—, y sin
 * volver a montar, el contenido nuevo se queda sin revelado por scroll.
 */
export default function Comportamiento() {
  const ruta = usePathname();
  useEffect(() => {
    const raiz = document.getElementById("v2root");
    if (!raiz) return;
    return initSitio(raiz);
  }, [ruta]);
  return null;
}
