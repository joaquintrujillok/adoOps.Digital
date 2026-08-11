"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemNav = {
  href: string;
  etiqueta: string;
  icono: string;
  /** Contador que se pinta a la derecha (alertas abiertas, mensajes por revisar). */
  badge?: number;
};

export type GrupoNav = { titulo: string; items: ItemNav[] };

export default function Nav({ grupos }: { grupos: GrupoNav[] }) {
  const pathname = usePathname() ?? "";

  const activo = (href: string) =>
    href === "/crm" ? pathname === "/crm" : pathname.startsWith(href);

  return (
    <nav className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#5c6672]">
            {g.titulo}
          </div>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className="crm-nav-link"
                  data-activo={activo(it.href)}
                >
                  <span aria-hidden className="w-4 text-center">
                    {it.icono}
                  </span>
                  <span className="flex-1">{it.etiqueta}</span>
                  {typeof it.badge === "number" && it.badge > 0 && (
                    <span className="crm-num rounded-full bg-[#d03b3b] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {it.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
