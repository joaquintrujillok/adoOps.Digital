"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface GrupoNav {
  titulo: string;
  items: { href: string; etiqueta: string; contador?: number }[];
}

export default function Nav({ grupos }: { grupos: GrupoNav[] }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/vanni" ? ruta === "/vanni" : ruta.startsWith(href));
  return (
    <nav className="vn-nav" aria-label="Secciones">
      {grupos.map((g) => (
        <div key={g.titulo} className="vn-nav-grupo" style={{ marginBottom: 14 }}>
          <div className="vn-nav-titulo">{g.titulo}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={activo(i.href) ? "page" : undefined}>
              <span>{i.etiqueta}</span>
              {i.contador ? <span className="vn-chip vn-chip-teal">{i.contador}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
