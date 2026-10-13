"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import ContactFormV2 from "./ContactFormV2";
import { initV2 } from "./behavior";

/**
 * Landing del rediseño (/v2). El marcado es el del mockup aprobado; el
 * comportamiento (animaciones por scroll, carrusel, contadores, tema) vive en
 * behavior.js y se monta una sola vez sobre este árbol. Nada acá tiene estado
 * de React a propósito: así el DOM que anima behavior.js nunca se re-renderiza
 * por debajo.
 */
export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    return initV2(root);
  }, []);

  return (
    <div className="v2" ref={rootRef} id="v2root">
      <header className="nav">
        <div className="wrap">
          <a className="brand" href="#top" aria-label="adoOps"><Image src="/logo.png" alt="adoOps" width={110} height={32} priority /></a>
          <nav className="v2-nav-links" aria-label="Principal">
            <a href="#pilares">Pilares</a>
            <a href="#impacto">Impacto</a>
            <a href="#casos">Casos</a>
            <Link href="/framework">Framework</Link>
            <Link href="/cafecito-ia">Cafecito IA</Link>
          </nav>
          <div className="nav-right">
            <a className="btn btn-primary btn-sm arrow" href="#contacto">Solicitar Assessment</a>
            <button className="menu-btn" id="menuBtn" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobileMenu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
          </div>
        </div>
      </header>
      <div className="mobile-menu" id="mobileMenu" hidden>
        <div className="wrap">
          <a href="#pilares">Pilares</a>
          <a href="#impacto">Impacto</a>
          <a href="#casos">Casos</a>
          <Link href="/framework">Framework</Link>
          <Link href="/cafecito-ia">Cafecito IA</Link>
          <a href="#contacto">Contacto</a>
        </div>
      </div>
      
      <main id="top">
      
      <section className="hero">
        <div className="hero-dots" id="heroDots" aria-hidden="true"></div>
        <div className="wrap v2-hero-grid">
          <div className="v2-hero-copy">
            <span className="eyebrow rise" style={{animationDelay:'0ms'} as React.CSSProperties}>Plataforma de adopción de IA</span>
            <h1 className="display h-xl" id="heroTitle"><span className="w" style={{animationDelay:'140ms'} as React.CSSProperties}>Adoptamos</span> <span className="w ia" style={{animationDelay:'210ms'} as React.CSSProperties}>IA.</span> <span className="w" style={{animationDelay:'280ms'} as React.CSSProperties}>Operamos</span> <span className="w ia" style={{animationDelay:'350ms'} as React.CSSProperties}>IA.</span> <span className="w" style={{animationDelay:'420ms'} as React.CSSProperties}>Escalamos</span> <span className="w ia" style={{animationDelay:'490ms'} as React.CSSProperties}>IA.</span></h1>
            <p className="lede rise" style={{animationDelay:'560ms'} as React.CSSProperties}>Transformamos organizaciones mediante estrategias de adopción, agentes inteligentes, talento especializado y programas de desarrollo para convertir la Inteligencia Artificial en una capacidad real de negocio.</p>
            <div className="v2-hero-actions rise" style={{animationDelay:'700ms'} as React.CSSProperties}>
              <a className="btn btn-primary arrow" href="#contacto">Solicitar Assessment</a>
              <a className="btn btn-ghost" href="#contacto"><svg viewBox="0 0 24 24" width="17" height="17" style={{stroke:'currentColor',fill:'none',strokeWidth:'1.8',strokeLinecap:'round',strokeLinejoin:'round'} as React.CSSProperties}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>Agendar un Diagnóstico</a>
              <Link className="btn btn-text" href="/cafecito-ia"><svg viewBox="0 0 24 24"><path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v2M10 2v2M14 2v2"/></svg>Leer Cafecito IA <small>· el boletín</small></Link>
            </div>
          </div>
          <div className="ring rise" style={{animationDelay:'420ms'} as React.CSSProperties} aria-hidden="true">
            <svg viewBox="0 0 300 300">
              <defs><path id="ringPath" d="M150,150 m-118,0 a118,118 0 1,1 236,0 a118,118 0 1,1 -236,0"/></defs>
              <circle cx="150" cy="150" r="138" fill="none" stroke="var(--line)" strokeWidth="1"/>
              <circle cx="150" cy="150" r="92" fill="none" stroke="var(--line)" strokeWidth="1"/>
              <g className="spin"><text><textPath href="#ringPath" textLength="734" lengthAdjust="spacing">ADOPTAMOS IA · OPERAMOS IA · ESCALAMOS IA · ADOPTAMOS IA · OPERAMOS IA · ESCALAMOS IA · </textPath></text></g>
              <circle className="pulse" cx="150" cy="150" r="4" fill="var(--accent)"/>
              <circle cx="150" cy="150" r="4" fill="var(--accent)"/>
            </svg>
            <div className="center"><span>AI Adoption</span><b>Framework™</b></div>
          </div>
        </div>
      </section>
      
      <div className="wrap rise" style={{animationDelay:'880ms'} as React.CSSProperties}>
        <div className="kpis">
          <div className="kpi"><b>+85</b><span>agentes en producción</span></div>
          <div className="kpi"><b>−42%</b><span>tiempo de ciclo</span></div>
          <div className="kpi"><b>3.500+</b><span>profesionales formados</span></div>
        </div>
      </div>
      
      <section className="section challenge" id="desafio">
        <div className="grid-bg" aria-hidden="true"></div>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow rv">El desafío</span>
            <h2 className="display h-lg lit" id="statement"><span className="w">La</span> <span className="w">mayoría</span> <span className="w">de</span> <span className="w">las</span> <span className="w">organizaciones</span> <span className="w">aún</span> <span className="w">no</span> <span className="w">captura</span> <span className="w">el</span> <span className="w">potencial</span> <span className="w">real</span> <span className="w">de</span> <span className="w">la</span> <span className="w">IA.</span></h2>
            <p className="lede rv">La tecnología avanza más rápido que la capacidad de las empresas para adoptarla. El resultado: inversión sin retorno y equipos sin rumbo.</p>
          </div>
          <div className="probs rv-group">
            <div className="prob rv"><span className="mark"></span><h3>Casos aislados</h3><p>Pilotos sueltos que nunca escalan al resto de la organización.</p></div>
            <div className="prob rv"><span className="mark"></span><h3>Herramientas sin adopción</h3><p>Licencias compradas que el equipo no incorpora a su día a día.</p></div>
            <div className="prob rv"><span className="mark"></span><h3>Equipos sin capacitación</h3><p>Talento sin las habilidades para operar IA con criterio y seguridad.</p></div>
            <div className="prob rv"><span className="mark"></span><h3>Falta de estrategia</h3><p>Iniciativas reactivas sin una hoja de ruta clara ni dueños definidos.</p></div>
            <div className="prob rv"><span className="mark"></span><h3>Baja integración</h3><p>IA desconectada de los procesos y sistemas reales del negocio.</p></div>
          </div>
        </div>
      </section>
      
      <section className="section" id="pilares" style={{paddingTop:'0'} as React.CSSProperties}>
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow">La solución</span>
            <h2 className="display h-lg">Una plataforma integral para acelerar la adopción de IA.</h2>
            <p className="lede">Cinco pilares que cubren el ciclo completo: del diagnóstico inicial a la operación de agentes a escala.</p>
          </div>
          <div className="carousel">
            <div className="track rv-group" id="track">
              <a className="card rv" href="#contacto">
                <div className="top"><b>01</b><span>Diagnóstico</span></div>
                <div className="art"><svg viewBox="0 0 220 140"><path d="M40 110a70 70 0 0 1 140 0"/><path className="acc" d="M40 110a70 70 0 0 1 98-64"/><circle className="dot-acc" cx="138" cy="46" r="4.5"/><path d="M110 110l28-64"/><circle className="dot" cx="110" cy="110" r="3.5"/><path d="M26 124h168"/><path d="M60 124v8M110 124v8M160 124v8"/></svg></div>
                <h3>Assessment</h3>
                <p>Diagnóstico de madurez en IA. Medimos dónde está su organización y trazamos la hoja de ruta priorizada.</p>
                <span className="more">Conocer más →</span>
              </a>
              <a className="card rv" href="#contacto">
                <div className="top"><b>02</b><span>Agentes</span></div>
                <div className="art"><svg viewBox="0 0 220 140"><circle cx="40" cy="70" r="14"/><path d="M54 70h30"/><path d="M84 70c20 0 20-40 40-40h20M84 70h60M84 70c20 0 20 40 40 40h20"/><rect x="146" y="22" width="52" height="16" rx="3" className="acc"/><rect x="146" y="62" width="52" height="16" rx="3"/><rect x="146" y="102" width="52" height="16" rx="3"/><circle className="dot-acc" cx="84" cy="70" r="4"/></svg></div>
                <h3>AgentOps</h3>
                <p>Diseño, despliegue y operación de agentes inteligentes conectados a sus sistemas.</p>
                <span className="more">Conocer más →</span>
              </a>
              <a className="card rv" href="#contacto">
                <div className="top"><b>03</b><span>Talento</span></div>
                <div className="art"><svg viewBox="0 0 220 140"><circle cx="60" cy="48" r="14"/><path d="M34 104a26 26 0 0 1 52 0"/><circle cx="110" cy="40" r="16" className="acc"/><path d="M82 104a28 28 0 0 1 56 0" className="acc"/><circle cx="160" cy="48" r="14"/><path d="M134 104a26 26 0 0 1 52 0"/><circle className="dot-acc" cx="110" cy="40" r="3"/><path d="M26 120h168"/></svg></div>
                <h3>AI Talent</h3>
                <p>Staffing especializado: perfiles de IA listos para integrarse a sus equipos.</p>
                <span className="more">Conocer más →</span>
              </a>
              <a className="card rv" href="#contacto">
                <div className="top"><b>04</b><span>Formación</span></div>
                <div className="art"><svg viewBox="0 0 220 140"><rect x="16" y="52" width="40" height="36" rx="4"/><rect x="66" y="52" width="40" height="36" rx="4"/><rect x="116" y="52" width="40" height="36" rx="4"/><rect x="166" y="52" width="40" height="36" rx="4" className="acc"/><path d="M56 70h10M106 70h10M156 70h10"/><path className="acc" d="M176 70l6 6 12-12"/><path d="M36 100v14M86 100v14M136 100v14M186 100v14"/><path d="M36 114h150"/></svg></div>
                <h3>AI Academy</h3>
                <p>Programas de formación por rol para que cada equipo opere IA con autonomía.</p>
                <span className="more">Conocer más →</span>
              </a>
              <a className="card rv" href="#contacto">
                <div className="top"><b>05</b><span>Escala</span></div>
                <div className="art"><svg viewBox="0 0 220 140"><path d="M20 112c40 0 60-10 80-36s40-44 100-48"/><path className="acc" d="M190 22l10 6-8 8"/><path d="M20 112h180"/><circle className="dot" cx="60" cy="104" r="3.5"/><circle className="dot" cx="100" cy="80" r="3.5"/><circle className="dot-acc" cx="140" cy="48" r="4.5"/><path d="M60 104v8M100 80v32M140 48v64" strokeDasharray="3 4"/></svg></div>
                <h3>AI Transformation</h3>
                <p>Acompañamiento ejecutivo para escalar la IA como capacidad transversal del negocio.</p>
                <span className="more">Conocer más →</span>
              </a>
            </div>
            <div className="car-nav">
              <button className="car-btn" id="prevBtn" aria-label="Anterior"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
              <div className="dots" id="dots" aria-hidden="true"></div>
              <button className="car-btn" id="nextBtn" aria-label="Siguiente"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button>
            </div>
          </div>
          <div style={{marginTop:'36px'} as React.CSSProperties} className="rv" id="framework"><Link className="btn btn-ghost arrow" href="/framework">Explorar el AI Adoption Framework™</Link></div>
        </div>
      </section>
      
      <section className="section proof" id="impacto" style={{paddingTop:'0'} as React.CSSProperties}>
        <div className="proof-inner" id="proofBlock">
          <div className="proof-gridbg" aria-hidden="true"></div>
          <i className="orb" style={{width:'120px',height:'120px',right:'8%',top:'10%','--t':'16s','--dx':'-30px','--dy':'40px'} as React.CSSProperties} aria-hidden="true"></i>
          <i className="orb" style={{width:'54px',height:'54px',right:'24%',top:'34%','--t':'12s','--dx':'24px','--dy':'-26px'} as React.CSSProperties} aria-hidden="true"></i>
          <i className="orb" style={{width:'210px',height:'210px',right:'-60px',bottom:'28%','--t':'20s','--dx':'-20px','--dy':'-30px'} as React.CSSProperties} aria-hidden="true"></i>
          <div className="proof-wrap">
            <div className="proof-head rv">
              <span className="eyebrow" data-t="Impacto medible"></span>
              <h2 className="two"><span className="l1">Resultados que se miden</span><span className="l2">en el negocio.</span></h2>
            </div>
            <div className="stats rv-group">
              <div className="stat rv"><b data-count="42" data-pre="−" data-suf="%">−42%</b><span>tiempo ahorrado en procesos clave</span></div>
              <div className="stat rv"><b data-count="120" data-suf="+">120+</b><span>procesos automatizados</span></div>
              <div className="stat rv"><b data-count="3500" data-suf="+" data-sep="1">3.500+</b><span>usuarios capacitados</span></div>
              <div className="stat rv"><b data-count="85" data-suf="+">85+</b><span>agentes desplegados</span></div>
              <div className="stat rv"><b data-count="4.8" data-suf="x" data-dec="1">4,8x</b><span>ROI esperado</span></div>
            </div>
            <div className="proof-2">
              <div className="rv">
                <h3 className="two"><span className="l1">La tecnología avanza rápido.</span><span className="l2">La adopción es lo que medimos.</span></h3>
                <p className="sub">Uso real por equipo, tiempo ahorrado y procesos que dejaron de hacerse a mano, visibles desde el primer mes.</p>
                <div className="big"><b data-count="1.2" data-pre="+" data-dec="1" data-lazy="1">+1,2</b><span>puntos de madurez en IA en el primer ciclo del framework: de 2,6 a 3,8 sobre 5.</span></div>
              </div>
              <svg className="chart" id="chart" viewBox="0 0 560 360" aria-hidden="true">
                <path className="ax" d="M40 320H540"/>
                <path className="ax" d="M40 40V320"/>
                <text className="lb" x="40" y="344">MES 1</text><text className="lb" x="505" y="344">MES 12</text>
                <text className="lb" x="8" y="324">2,0</text><text className="lb" x="8" y="60">4,0</text>
                <path className="ln" id="chartLine" d="M60 236 L170 214 L280 162 L390 118 L500 68"/>
                <g id="chartNodes">
                  <ellipse className="sh" cx="60" cy="248" rx="14" ry="8"/><circle className="nd" cx="60" cy="236" r="12"/>
                  <ellipse className="sh" cx="170" cy="226" rx="14" ry="8"/><circle className="nd" cx="170" cy="214" r="12"/>
                  <ellipse className="sh" cx="280" cy="174" rx="14" ry="8"/><circle className="nd" cx="280" cy="162" r="12"/>
                  <ellipse className="sh" cx="390" cy="130" rx="14" ry="8"/><circle className="nd" cx="390" cy="118" r="12"/>
                  <ellipse className="sh" cx="500" cy="80" rx="14" ry="8"/><circle className="nd" cx="500" cy="68" r="12"/>
                </g>
              </svg>
            </div>
            <p className="proof-note">Cifras representativas de referencia. El Assessment estima los valores específicos de su organización.</p>
          </div>
        </div>
      </section>
      
      <section className="section" id="casos">
        <div className="wrap">
          <div className="section-head rv">
            <span className="eyebrow">Casos</span>
            <h2 className="display h-lg">Cada caso empieza por el costo del error.</h2>
            <p className="lede">Qué dolía y qué se construyó, contado desde el proceso. Los nombres se comparten en reunión.</p>
          </div>
          <div className="tabs rv" id="tabs" role="tablist" aria-label="Filtrar casos">
            <button className="tab on" data-f="all" role="tab" aria-selected="true">Todos</button>
            <button className="tab" data-f="agente" role="tab" aria-selected="false">Agentes</button>
            <button className="tab" data-f="sistema" role="tab" aria-selected="false">Sistemas</button>
            <button className="tab" data-f="programa" role="tab" aria-selected="false">Programas</button>
          </div>
          <div className="cases rv-group" id="cases">
            <a className="case rv" href="#contacto" data-t="agente">
              <span className="sec">Certificación · H&amp;S</span>
              <h3>Asistente documental sobre un sistema de gestión integrado<small>Empresa de certificación e inspección · unos 700 documentos normativos</small></h3>
              <p>El costo no era buscar: era responder o actuar con el documento equivocado ante una auditoría. Un agente con reglas responde con documento, sección y versión; repregunta cuando falta un dato; deriva con el caso estructurado; y advierte cuando la fuente fue reemplazada.</p>
              <span className="kind acc">Agente</span>
            </a>
            <a className="case rv" href="#contacto" data-t="agente">
              <span className="sec">Retail · 41 sucursales</span>
              <h3>Agente comercial por WhatsApp<small>Cadena de retail especializado · reactivación, captura en sala y retiro en tienda</small></h3>
              <p>Las consultas quedaban en el teléfono de cada vendedor y nadie recuperaba a los clientes que dejaron de comprar. Un número de la empresa atendido por el agente: campañas de reactivación con aviso al ejecutivo, captura en sala con QR y cupón, y tienda con reserva y retiro en sucursal.</p>
              <span className="kind acc">Agente</span>
            </a>
            <a className="case rv" href="#contacto" data-t="sistema">
              <span className="sec">Agro · Semillas</span>
              <h3>Visitas a campo por audio<small>Semillera · mercado nacional y producción bajo contrato</small></h3>
              <p>La única forma de saber en qué quedó una visita era releer el hilo de WhatsApp seis meses después. El zonal manda un audio desde la camioneta y el sistema lo convierte en un informe estructurado que queda en el historial del agricultor y se le puede enviar. Dos áreas, tres roles, una sola base.</p>
              <span className="kind">Sistema</span>
            </a>
            <a className="case rv" href="#contacto" data-t="programa">
              <span className="sec">Planificación industrial</span>
              <h3>Automatización de procesos con IA<small>Automotriz · equipos de demanda, suministro y planificación</small></h3>
              <p>Horas de consolidar planillas, cruzar bases y preparar reportes. Un programa en cuatro etapas: descubrir, priorizar, ejecutar dos pilotos sobre datos reales y medir las horas liberadas. Un método que el equipo repite solo cuando el programa termina.</p>
              <span className="kind">Programa</span>
            </a>
            <a className="case rv" href="#contacto" data-t="programa">
              <span className="sec">Legal · Contenido</span>
              <h3>Programa editorial en LinkedIn<small>Estudio de abogados · ley de datos personales</small></h3>
              <p>Un perfil publicando 24 veces sobre lo mismo parece una campaña; cuatro voces discutiéndolo desde su especialidad parecen un estudio. Cuatro socios, 24 publicaciones y seis documentos descargables, publicados desde el perfil de cada uno vía API.</p>
              <span className="kind">Programa</span>
            </a>
          </div>
        </div>
      </section>
      
      
      
      <section className="section cta" id="contacto">
        <div className="cta-box rv">
          <div className="cta-copy">
            <span className="eyebrow">Empecemos</span>
            <h2 className="display h-lg">Solicite su Assessment de madurez en IA.</h2>
            <p className="lede">En una sesión de diagnóstico identificamos oportunidades concretas, priorizamos casos de uso y definimos el primer paso hacia una operación con IA real.</p>
            <ul>
              <li>Diagnóstico de madurez con hoja de ruta priorizada.</li>
              <li>Respuesta en menos de 24 horas hábiles.</li>
              <li>Sin compromiso. Confidencialidad garantizada.</li>
            </ul>
          </div>
          <ContactFormV2 />
        </div>
      </section>
      
      </main>
      
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
              <a href="#pilares">Assessment</a>
              <a href="#pilares">AgentOps</a>
              <a href="#pilares">AI Talent</a>
              <a href="#pilares">AI Academy</a>
            </div>
            <div className="foot-col">
              <span className="k">Empresa</span>
              <a href="#top">Nosotros</a>
              <a href="#impacto">Impacto</a>
              <a href="#casos">Casos</a>
              <Link href="/cafecito-ia">Cafecito IA</Link>
              <a href="#contacto">Contacto</a>
            </div>
            <div className="foot-col">
              <span className="k">Contacto</span>
              <div className="copy-row"><code id="mail">hola@adoops.ai</code><button className="copy-btn" id="copyMail" type="button">Copiar</button></div>
              <a className="acc" href="#contacto">Solicitar Assessment →</a>
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
    </div>
  );
}
