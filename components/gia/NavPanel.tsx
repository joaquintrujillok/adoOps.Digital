"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EMPRESA } from "@/lib/gia/semilla";

// El back office en las dos etapas de la propuesta. Sin precios ni hoja de ruta
// comercial: esto muestra el diagnóstico y el CoE; lo comercial va en la PPT.

const ICONOS: Record<string, React.ReactNode> = {
  panorama: <path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z" />,
  personas: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.6c1.3.6 2.2 2 2.6 4.4" /></>,
  flujo: <><circle cx="5" cy="6" r="2.2" /><circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="12" r="2.2" /><path d="M7.2 6c5 0 5 6 9.6 6M7.2 18c5 0 5-6 9.6-6" /></>,
  oportunidades: <><path d="M4 19h16" /><path d="M7 15l4-4 3 3 5-6" /><path d="M15 8h4v4" /></>,
  repositorio: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  ideas: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  coe: <><path d="M4 6.5 12 3l8 3.5-8 3.5z" /><path d="M7 8.3V13c0 1.7 2.2 3 5 3s5-1.3 5-3V8.3" /><path d="M20 6.5V12" /></>,
};

const GRUPOS: { n: number; titulo: string; items: [string, string, string][] }[] = [
  {
    n: 1,
    titulo: "Levantamiento",
    items: [
      ["Panorama", "/gia/panorama", "panorama"],
      ["Personas", "/gia/personas", "personas"],
      ["Flujo entre unidades", "/gia/flujo", "flujo"],
      ["Oportunidades", "/gia/oportunidades", "oportunidades"],
    ],
  },
  {
    n: 2,
    titulo: "Centro de Excelencia",
    items: [
      ["CoE as a Service", "/gia/coe", "coe"],
      ["Repositorio", "/gia/repositorio", "repositorio"],
      ["Banco de ideas", "/gia/ideas", "ideas"],
    ],
  },
];

export default function NavPanel() {
  const ruta = usePathname();
  return (
    <nav className="gia-nav" aria-label="Back office">
      <Link href="/gia" className="marca">
        <span className="logo">a</span>
        <span>
          <span className="marca-t">adoOps</span>
          <span className="marca-s">{EMPRESA.nombre}</span>
        </span>
      </Link>
      {GRUPOS.map((g) => (
        <div key={g.titulo} className="nav-grupo">
          <div className="grupo"><span className="etapa">{g.n}</span>{g.titulo}</div>
          {g.items.map(([label, href, icono]) => {
            const activo = ruta === href || ruta.startsWith(href + "/");
            return (
              <Link key={href} href={href} className="item" aria-current={activo ? "page" : undefined}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[icono]}</svg>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}
      <Link href="/gia/entrevista" className="cta">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        Entrevistarme
      </Link>
      <div className="nav-pie">Entorno demo · empresa ficticia</div>
    </nav>
  );
}
