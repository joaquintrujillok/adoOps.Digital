"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMPRESA } from "@/lib/gia/semilla";

// El back office en las dos etapas de la propuesta. Sin precios ni hoja de ruta
// comercial: esto muestra el diagnóstico y el CoE; lo comercial va en la PPT.
const GRUPOS: { titulo: string; items: [string, string][] }[] = [
  {
    titulo: "Etapa 1 · Levantamiento",
    items: [
      ["Panorama", "/gia/panorama"],
      ["Personas", "/gia/personas"],
      ["Flujo entre unidades", "/gia/flujo"],
      ["Oportunidades", "/gia/oportunidades"],
    ],
  },
  { titulo: "Etapa 2 · CoE", items: [["CoE as a Service", "/gia/coe"]] },
];

export default function NavPanel() {
  const ruta = usePathname();
  return (
    <nav className="gia-nav" aria-label="Back office">
      <Link href="/gia" className="marca">adoOps</Link>
      <div className="empresa">{EMPRESA.nombre} · demo</div>
      {GRUPOS.map((g) => (
        <div key={g.titulo} style={{ display: "contents" }}>
          <div className="grupo">{g.titulo}</div>
          {g.items.map(([label, href]) => {
            const activo = ruta === href || ruta.startsWith(href + "/");
            return (
              <Link key={href} href={href} className="item" aria-current={activo ? "page" : undefined}>
                {label}
              </Link>
            );
          })}
        </div>
      ))}
      <Link href="/gia/entrevista" className="item cta">Entrevistarme</Link>
    </nav>
  );
}
