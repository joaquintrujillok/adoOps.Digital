import Image from "next/image";
import HeroCanvas from "@/components/HeroCanvas";
import AnimatedCounter from "@/components/AnimatedCounter";
import ContactForm from "@/components/ContactForm";
import ClosingAnimation from "@/components/ClosingAnimation";

const iconMask = (icon: string) =>
  `url('https://unpkg.com/lucide-static@latest/icons/${icon}.svg') center/contain no-repeat` as const;

export default function Home() {
  return (
    <div style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: "#0E1D33", background: "#FFFFFF", overflowX: "hidden" }}>

      {/* NAV */}
      <header className="site-header" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: 64, zIndex: 50, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid #E9EEF1" }}>
        <nav className="site-nav" style={{ maxWidth: 1200, height: "100%", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <a href="#top" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <Image className="nav-logo" src="/logo.png" alt="adoOps" width={120} height={36} style={{ objectFit: "contain" }} priority />
          </a>
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <a className="nav-link" href="/framework" style={{ textDecoration: "none", color: "#43566A", fontSize: 14, fontWeight: 500 }}>Framework</a>
            <a className="nav-link" href="#solucion" style={{ textDecoration: "none", color: "#43566A", fontSize: 14, fontWeight: 500 }}>Pilares</a>
            <a className="nav-link" href="#resultados" style={{ textDecoration: "none", color: "#43566A", fontSize: 14, fontWeight: 500 }}>Impacto</a>
            <a className="nav-link" href="#contacto" style={{ textDecoration: "none", color: "#43566A", fontSize: 14, fontWeight: 500 }}>Contacto</a>
            <a className="nav-cta" href="#contacto" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, background: "#20C463", color: "#06281A", fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 999, boxShadow: "0 4px 14px rgba(32,196,99,0.28)" }}>
              <span className="nav-cta-desktop">Solicitar Assessment</span>
              <span className="nav-cta-mobile">Contactar</span>
            </a>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="hero-section" id="top" style={{ position: "relative", background: "radial-gradient(120% 90% at 80% 0%,#0F2A40 0%,#0A1828 45%,#081320 100%)", color: "#EAF1F4", padding: "128px 24px 84px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,0.05) 1px,transparent 0)", backgroundSize: "34px 34px", opacity: 0.5, pointerEvents: "none" }} />
        <div className="hero-grid" style={{ maxWidth: 1200, margin: "0 auto", position: "relative", display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)", gap: 48, alignItems: "center" }}>
          <div className="hero-copy">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(32,196,99,0.12)", border: "1px solid rgba(46,212,119,0.28)", color: "#7BE9AE", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", padding: "7px 14px", borderRadius: 999, marginBottom: 26 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ED477", animation: "pulseDot 2s infinite" }} />
              Plataforma de adopción de IA
            </div>
            <h1 className="hero-title" style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(40px,5.2vw,62px)", lineHeight: 1.04, letterSpacing: "-0.03em", margin: "0 0 22px", color: "#FFFFFF" }}>
              Adoptamos <span style={{ background: "linear-gradient(120deg,#2ED477,#0E8A82)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>IA</span>.<br />
              Operamos <span style={{ background: "linear-gradient(120deg,#2ED477,#0E8A82)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>IA</span>.<br />
              Escalamos <span style={{ background: "linear-gradient(120deg,#2ED477,#0E8A82)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>IA</span>.
            </h1>
            <p className="hero-description" style={{ fontSize: 18, lineHeight: 1.6, color: "#A9BBC7", maxWidth: 540, margin: "0 0 34px", fontWeight: 400 }}>
              Transformamos organizaciones mediante estrategias de adopción, agentes inteligentes, talento especializado y programas de desarrollo para convertir la Inteligencia Artificial en una capacidad real de negocio.
            </p>
            <div className="hero-actions" style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 40 }}>
              <a href="#contacto" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#20C463", color: "#06281A", fontFamily: "var(--font-inter), Inter, sans-serif", fontSize: 15, fontWeight: 600, padding: "14px 26px", border: "none", borderRadius: 999, textDecoration: "none", boxShadow: "0 8px 26px rgba(32,196,99,0.32)" }}>
                Solicitar Assessment
                <span style={{ display: "block", width: 17, height: 17, background: "#06281A", WebkitMask: iconMask("arrow-right"), mask: iconMask("arrow-right") }} />
              </a>
              <a href="#contacto" style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.06)", color: "#EAF1F4", fontFamily: "var(--font-inter), Inter, sans-serif", fontSize: 15, fontWeight: 600, padding: "14px 24px", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 999, textDecoration: "none" }}>
                <span style={{ display: "block", width: 17, height: 17, background: "#EAF1F4", WebkitMask: iconMask("calendar"), mask: iconMask("calendar") }} />
                Agendar un Diagnóstico
              </a>
            </div>
            <div className="hero-stats" style={{ display: "flex", flexWrap: "wrap", gap: 30 }}>
              <div className="hero-stat"><div style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 24, color: "#FFFFFF" }}>+85</div><div style={{ fontSize: 12.5, color: "#8094A2" }}>agentes en producción</div></div>
              <div className="hero-stat-divider" style={{ width: 1, background: "rgba(255,255,255,0.12)" }} />
              <div className="hero-stat"><div style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 24, color: "#FFFFFF" }}>−42%</div><div style={{ fontSize: 12.5, color: "#8094A2" }}>tiempo de ciclo</div></div>
              <div className="hero-stat-divider" style={{ width: 1, background: "rgba(255,255,255,0.12)" }} />
              <div className="hero-stat"><div style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 24, color: "#FFFFFF" }}>3.500+</div><div style={{ fontSize: 12.5, color: "#8094A2" }}>profesionales formados</div></div>
            </div>
          </div>

          <div className="hero-visual" style={{ position: "relative", height: 480 }}>
            <HeroCanvas />
            <div className="animate-float hero-agent-card" style={{ position: "absolute", top: 34, right: 8, display: "flex", alignItems: "center", gap: 11, background: "rgba(12,28,42,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(46,212,119,0.25)", borderRadius: 14, padding: "13px 16px", boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(46,212,119,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ display: "block", width: 18, height: 18, background: "#2ED477", WebkitMask: iconMask("bot"), mask: iconMask("bot") }} />
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>Agente · Operaciones</div>
                <div style={{ fontSize: 11.5, color: "#7BE9AE", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2ED477", animation: "pulseDot 1.8s infinite" }} />
                  Activo · 14 tareas
                </div>
              </div>
            </div>
            <div className="animate-float2 hero-maturity-card" style={{ position: "absolute", bottom: 42, left: 0, background: "rgba(12,28,42,0.72)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 18px", boxShadow: "0 16px 40px rgba(0,0,0,0.35)" }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8094A2", marginBottom: 4 }}>Madurez en IA</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 26, color: "#FFFFFF" }}>3.8</span>
                <span style={{ fontSize: 13, color: "#7BE9AE" }}>/ 5 · +1.2</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="content-section challenge-section" style={{ scrollMarginTop: 80, background: "#F6F8F9", padding: "88px 24px", borderBottom: "1px solid #EAEFF2" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-heading" style={{ maxWidth: 760, margin: "0 auto 52px", textAlign: "center" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0E8A82", marginBottom: 16 }}>El desafío</div>
            <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.12, letterSpacing: "-0.025em", margin: "0 0 16px", color: "#0E1D33" }}>
              La mayoría de las organizaciones aún no captura el potencial real de la IA.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5C6B79", margin: 0 }}>La tecnología avanza más rápido que la capacidad de las empresas para adoptarla. El resultado: inversión sin retorno y equipos sin rumbo.</p>
          </div>
          <div className="challenge-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
            {[
              { icon: "boxes", title: "Casos aislados", desc: "Pilotos sueltos que nunca escalan al resto de la organización." },
              { icon: "unplug", title: "Herramientas sin adopción", desc: "Licencias compradas que el equipo no incorpora a su día a día." },
              { icon: "graduation-cap", title: "Equipos sin capacitación", desc: "Talento sin las habilidades para operar IA con criterio y seguridad." },
              { icon: "compass", title: "Falta de estrategia", desc: "Iniciativas reactivas sin una hoja de ruta clara ni dueños definidos." },
              { icon: "workflow", title: "Baja integración", desc: "IA desconectada de los procesos y sistemas reales del negocio." },
            ].map(({ icon, title, desc }) => (
              <div className="challenge-card" key={title} style={{ background: "#FFFFFF", border: "1px solid #EAEFF2", borderRadius: 14, padding: 22 }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: "#F1F4F6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <span style={{ display: "block", width: 20, height: 20, background: "#697A88", WebkitMask: iconMask(icon), mask: iconMask(icon) }} />
                </span>
                <h3 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 15.5, margin: "0 0 7px", color: "#0E1D33" }}>{title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: "#697A88", margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section className="content-section solution-section" id="solucion" style={{ scrollMarginTop: 80, background: "#FFFFFF", padding: "90px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="section-heading" style={{ maxWidth: 720, margin: "0 auto 56px", textAlign: "center" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0E8A82", marginBottom: 16 }}>La solución</div>
            <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.12, letterSpacing: "-0.025em", margin: "0 0 16px", color: "#0E1D33" }}>
              Una plataforma integral para acelerar la adopción de IA
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5C6B79", margin: 0 }}>Cinco pilares que cubren el ciclo completo: del diagnóstico inicial a la operación de agentes a escala.</p>
          </div>
          <div className="solution-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 18 }}>
            {[
              { num: "01", icon: "gauge", title: "Assessment", desc: "Diagnóstico de madurez en IA. Medimos dónde está su organización y trazamos la hoja de ruta priorizada.", dark: false },
              { num: "02", icon: "bot", title: "AgentOps", desc: "Diseño, despliegue y operación de agentes inteligentes conectados a tus sistemas.", dark: false },
              { num: "03", icon: "users", title: "AI Talent", desc: "Staffing especializado: perfiles de IA listos para integrarse a tus equipos.", dark: false },
              { num: "04", icon: "book-open", title: "AI Academy", desc: "Programas de formación por rol para que cada equipo opere IA con autonomía.", dark: false },
              { num: "05", icon: "trending-up", title: "AI Transformation", desc: "Acompañamiento ejecutivo para escalar la IA como capacidad transversal del negocio.", dark: true },
            ].map(({ num, icon, title, desc, dark }) => (
              <div className="solution-card" key={title} style={{ position: "relative", background: dark ? "#0E1D33" : "#FFFFFF", border: `1px solid ${dark ? "#0E1D33" : "#E9EEF1"}`, borderRadius: 16, padding: "26px 22px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <span style={{ width: 46, height: 46, borderRadius: 12, background: dark ? "linear-gradient(135deg,#20C463,#0E8A82)" : "linear-gradient(135deg,rgba(32,196,99,0.14),rgba(14,138,130,0.12))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ display: "block", width: 23, height: 23, background: dark ? "#06281A" : "#0E8A82", WebkitMask: iconMask(icon), mask: iconMask(icon) }} />
                  </span>
                  <span style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: 13, color: dark ? "#41566B" : "#C2D0CC" }}>{num}</span>
                </div>
                <h3 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 17, margin: "0 0 9px", color: dark ? "#FFFFFF" : "#0E1D33" }}>{title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.55, color: dark ? "#9DB0BF" : "#697A88", margin: "0 0 18px", flex: 1 }}>{desc}</p>
                <a href="#contacto" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: dark ? "#2ED477" : "#0E8A82", textDecoration: "none" }}>
                  Conocer más
                  <span style={{ display: "block", width: 14, height: 14, background: dark ? "#2ED477" : "#0E8A82", WebkitMask: iconMask("arrow-right"), mask: iconMask("arrow-right") }} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="content-section results-section" id="resultados" style={{ scrollMarginTop: 80, position: "relative", background: "radial-gradient(120% 120% at 15% 0%,#0F2A40 0%,#0A1828 50%,#081320 100%)", color: "#EAF1F4", padding: "90px 24px", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px,rgba(255,255,255,0.04) 1px,transparent 0)", backgroundSize: "34px 34px", opacity: 0.6, pointerEvents: "none" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", position: "relative" }}>
          <div className="section-heading" style={{ maxWidth: 680, margin: "0 auto 54px", textAlign: "center" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7BE9AE", marginBottom: 16 }}>Impacto medible</div>
            <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.12, letterSpacing: "-0.025em", margin: 0, color: "#FFFFFF" }}>
              Resultados que se miden en el negocio
            </h2>
          </div>
          <div className="results-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 18 }}>
            {[
              { prefix: "−", target: 42, suffix: "%", dec: 0, label: "Tiempo ahorrado en procesos clave", highlight: true },
              { prefix: "", target: 120, suffix: "+", dec: 0, label: "Procesos automatizados", highlight: false },
              { prefix: "", target: 3500, suffix: "+", dec: 0, label: "Usuarios capacitados", highlight: false },
              { prefix: "", target: 85, suffix: "+", dec: 0, label: "Agentes desplegados", highlight: false },
              { prefix: "", target: 4.8, suffix: "x", dec: 1, label: "ROI esperado", highlight: true },
            ].map(({ prefix, target, suffix, dec, label, highlight }, i) => (
              <div className="result-card" key={i} style={{ background: highlight ? "linear-gradient(135deg,rgba(32,196,99,0.16),rgba(14,138,130,0.12))" : "rgba(255,255,255,0.04)", border: `1px solid ${highlight ? "rgba(46,212,119,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 16, padding: "28px 22px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: "clamp(34px,3.8vw,48px)", lineHeight: 1, color: highlight ? "#2ED477" : "#FFFFFF", marginBottom: 12 }}>
                  {prefix}<AnimatedCounter target={target} decimals={dec} />{suffix}
                </div>
                <div style={{ fontSize: 13, color: "#A9BBC7", lineHeight: 1.4 }}>{label}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#62788A", margin: "26px 0 0" }}>
            Cifras representativas de referencia. El Assessment estima los valores específicos de su organización.
          </p>
        </div>
      </section>

      {/* CONTACTO */}
      <section className="content-section contact-section" id="contacto" style={{ scrollMarginTop: 80, background: "#F6F8F9", padding: "90px 24px" }}>
        <div className="contact-grid" style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,0.9fr) minmax(0,1.1fr)", gap: 52, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#0E8A82", marginBottom: 16 }}>Empecemos</div>
            <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(28px,3.4vw,38px)", lineHeight: 1.12, letterSpacing: "-0.025em", margin: "0 0 18px", color: "#0E1D33" }}>
              Solicite su Assessment de madurez en IA
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#5C6B79", margin: "0 0 30px" }}>
              En una sesión de diagnóstico identificamos oportunidades concretas, priorizamos casos de uso y definimos el primer paso hacia una operación con IA real.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { icon: "gauge", text: "Diagnóstico de madurez con hoja de ruta priorizada" },
                { icon: "clock", text: "Respuesta en menos de 24 horas hábiles" },
                { icon: "shield-check", text: "Sin compromiso. Confidencialidad garantizada" },
              ].map(({ icon, text }) => (
                <div key={icon} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(32,196,99,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ display: "block", width: 18, height: 18, background: "#0E8A82", WebkitMask: iconMask(icon), mask: iconMask(icon) }} />
                  </span>
                  <span style={{ fontSize: 14, color: "#334456" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="contact-form-shell" style={{ background: "#FFFFFF", border: "1px solid #EAEFF2", borderRadius: 18, padding: 32, boxShadow: "0 18px 44px rgba(14,29,51,0.07)" }}>
            <ContactForm />
          </div>
        </div>
      </section>

      <ClosingAnimation />

      {/* FOOTER */}
      <footer className="site-footer" style={{ background: "#081320", color: "#9DB0BF", padding: "56px 24px 32px" }}>
        <div className="footer-grid" style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 40, paddingBottom: 40, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div style={{ marginBottom: 14 }}>
              <Image src="/logo.png" alt="adoOps" width={120} height={36} style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }} />
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#7E91A0", margin: 0, maxWidth: 280 }}>
              Adoptamos IA. Operamos IA. Escalamos IA. Convertimos la Inteligencia Artificial en una capacidad real de negocio.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C7184", marginBottom: 16 }}>Plataforma</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <a href="/framework" style={{ textDecoration: "none", color: "#9DB0BF", fontSize: 13.5 }}>AI Adoption Framework™</a>
              {["Assessment", "AgentOps", "AI Talent"].map((item) => (
                <a key={item} href="#solucion" style={{ textDecoration: "none", color: "#9DB0BF", fontSize: 13.5 }}>{item}</a>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C7184", marginBottom: 16 }}>Empresa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <a href="#top" style={{ textDecoration: "none", color: "#9DB0BF", fontSize: 13.5 }}>Nosotros</a>
              <a href="#resultados" style={{ textDecoration: "none", color: "#9DB0BF", fontSize: 13.5 }}>Impacto</a>
              <a href="#contacto" style={{ textDecoration: "none", color: "#9DB0BF", fontSize: 13.5 }}>Contacto</a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5C7184", marginBottom: 16 }}>Contacto</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <a href="mailto:hola@adoops.ai" style={{ textDecoration: "none", color: "#9DB0BF", fontSize: 13.5 }}>hola@adoops.ai</a>
              <a href="#contacto" style={{ textDecoration: "none", color: "#2ED477", fontSize: 13.5, fontWeight: 600 }}>Solicitar Assessment →</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom" style={{ maxWidth: 1200, margin: "24px auto 0", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 12.5, color: "#5C7184" }}>
          <span>© 2026 adoOps. Todos los derechos reservados.</span>
          <span>Adoptamos IA. Operamos IA. Escalamos IA.</span>
        </div>
      </footer>
    </div>
  );
}
