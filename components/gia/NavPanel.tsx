"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMPRESA } from "@/lib/gia/semilla";

const ITEMS: [string, string][] = [
  ["Inicio", "/gia"],
  ["Panorama", "/gia/panorama"],
  ["Procesos y casos", "/gia/procesos"],
  ["Personas", "/gia/personas"],
  ["Lineamientos", "/gia/lineamientos"],
  ["Gemini y agentes", "/gia/gemini"],
  ["CoE as a Service", "/gia/coe"],
  ["Hoja de ruta", "/gia/hoja-de-ruta"],
];

export default function NavPanel() {
  const ruta = usePathname();
  return (
    <nav className="gia-nav" aria-label="Back office">
      <Link href="/gia" className="marca">adoOps</Link>
      <div className="empresa">{EMPRESA.nombre} · demo</div>
      {ITEMS.map(([label, href]) => {
        const activo = href === "/gia" ? ruta === href : ruta === href || ruta.startsWith(href + "/");
        return (
          <Link key={href} href={href} className="item" aria-current={activo ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
      <Link href="/gia/entrevista" className="item cta">Entrevistarme</Link>
    </nav>
  );
}
