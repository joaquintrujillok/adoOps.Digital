import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Mono } from "next/font/google";
import Comportamiento from "./Comportamiento";
import "./sitio.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  /** El botón verde de la barra. Cafecito lo cambia por "Suscribirme". */
  cta?: { href: string; label: string };
  /**
   * Páginas de un solo propósito (confirmar, dar de baja): barra con el logo y
   * nada más, y un pie de una línea. Quien llega desde un correo a darse de baja
   * no vino a ver el menú.
   */
  foco?: boolean;
};

/**
 * El armazón de la web pública: barra, menú móvil y pie, con el diseño aprobado
 * en /v2. La portada, /framework y todo /cafecito-ia se renderizan dentro.
 *
 * Los estilos van todos bajo `.v2` (ver sitio.css) y el comportamiento —tema,
 * revelado por scroll, la red del pie— lo monta `Comportamiento` sobre este
 * árbol. Nada acá tiene estado de React a propósito: así el DOM que anima
 * animaciones.js nunca se re-renderiza por debajo.
 *
 * Los enlaces a secciones de la portada van con `/#…` y no con `#…` para que
 * sirvan igual desde una interior.
 *
 * Ojo con los nombres de clase nuevos: Tailwind genera utilidades por el solo
 * hecho de aparecer en el JSX (`ring` puso el sello del hero en un recuadro).
 * Las de las interiores llevan prefijo (`fw-`, `cf-`, `st-`) por eso.
 */
export default function Sitio({ children, cta = { href: "/#contacto", label: "Solicitar Assessment" }, foco = false }: Props) {
  return (
    <div className={`v2 ${plexMono.variable}`} id="v2root">
      <header className="nav">
        <div className="wrap">
          <Link className="brand" href={foco ? "/cafecito-ia" : "/#top"} aria-label="adoOps"><Image src="/logo.png" alt="adoOps" width={110} height={32} priority /></Link>
          {!foco && (
            <>
              <nav className="v2-nav-links" aria-label="Principal">
                <Link href="/#pilares">Pilares</Link>
                <Link href="/#impacto">Impacto</Link>
                <Link href="/#casos">Casos</Link>
                <Link href="/framework">Framework</Link>
                <Link href="/cafecito-ia">Cafecito IA</Link>
              </nav>
              <div className="nav-right">
                <Link className="btn btn-primary btn-sm arrow" href={cta.href}>{cta.label}</Link>
                <button className="menu-btn" id="menuBtn" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobileMenu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
              </div>
            </>
          )}
        </div>
      </header>
      {!foco && (
        <div className="mobile-menu" id="mobileMenu" hidden>
          <div className="wrap">
            <Link href="/#pilares">Pilares</Link>
            <Link href="/#impacto">Impacto</Link>
            <Link href="/#casos">Casos</Link>
            <Link href="/framework">Framework</Link>
            <Link href="/cafecito-ia">Cafecito IA</Link>
            <Link href="/#contacto">Contacto</Link>
          </div>
        </div>
      )}

      {children}

      {foco ? (
        <footer className="st-pie-foco">
          <div className="wrap">
            <div className="foot-bottom">
              <span>© 2026 adoOps. Todos los derechos reservados.</span>
              <div className="links">
                <Link href="/cafecito-ia">Cafecito IA</Link>
                <button className="theme-btn" id="themeBtn" type="button"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg><span id="themeLabel">Modo oscuro</span></button>
              </div>
            </div>
          </div>
        </footer>
      ) : (
        <footer>
          <div className="wrap">
            <div className="foot-grid">
              <div className="foot-brand">
                <Image src="/logo.png" alt="adoOps" width={110} height={32} className="logo-foot" />
                <p>Adoptamos IA · Operamos IA · Escalamos IA</p>
                <p className="muted" style={{fontFamily:'var(--body)',fontSize:'13.5px'} as React.CSSProperties}>Convertimos la Inteligencia Artificial en una capacidad real de negocio.</p>
              </div>
              <div className="foot-col">
                <span className="k">Plataforma</span>
                <Link href="/framework">AI Adoption Framework™</Link>
                <Link href="/#pilares">Assessment</Link>
                <Link href="/#pilares">AgentOps</Link>
                <Link href="/#pilares">AI Talent</Link>
                <Link href="/#pilares">AI Academy</Link>
              </div>
              <div className="foot-col">
                <span className="k">Empresa</span>
                <Link href="/#top">Nosotros</Link>
                <Link href="/#impacto">Impacto</Link>
                <Link href="/#casos">Casos</Link>
                <Link href="/cafecito-ia">Cafecito IA</Link>
                <Link href="/#contacto">Contacto</Link>
              </div>
              <div className="foot-col">
                <span className="k">Contacto</span>
                <div className="copy-row"><code id="mail">hola@adoops.ai</code><button className="copy-btn" id="copyMail" type="button">Copiar</button></div>
                <Link className="acc" href="/#contacto">Solicitar Assessment →</Link>
              </div>
            </div>
            <canvas className="skyline" id="skyline" aria-hidden="true"></canvas>
            <div className="foot-bottom">
              <span>© 2026 adoOps. Todos los derechos reservados.</span>
              <div className="links">
                <span>Adoptamos IA. Operamos IA. Escalamos IA.</span>
                <button className="theme-btn" id="themeBtn" type="button"><svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg><span id="themeLabel">Modo oscuro</span></button>
              </div>
            </div>
          </div>
        </footer>
      )}
      <Comportamiento />
    </div>
  );
}
