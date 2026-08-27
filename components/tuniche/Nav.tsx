"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ItemNav {
  href: string;
  etiqueta: string;
  icono: string;
}

/**
 * El menú. Marca el activo comparando el pathname, y lo hace por igualdad
 * cuando el href es la raíz del módulo: con `startsWith`, `/tuniche` quedaría
 * encendido en todas las pantallas y el menú dejaría de decir dónde estás.
 */
export default function Nav({ items }: { items: ItemNav[] }) {
  const ruta = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((it) => {
        const activo =
          it.href === "/tuniche" ? ruta === "/tuniche" : ruta.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className="tun-nav-link" data-activo={activo}>
            <span aria-hidden className="w-4 text-center">
              {it.icono}
            </span>
            {it.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
