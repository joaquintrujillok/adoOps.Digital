import type { Metadata } from "next";
import Link from "next/link";
import Sitio from "../_web/Sitio";

export const metadata: Metadata = {
  title: "AI Adoption Framework™ | adoOps",
  description:
    "El adoOps AI Adoption Framework™ transforma iniciativas aisladas de Inteligencia Artificial en capacidades organizacionales escalables.",
  openGraph: {
    title: "adoOps AI Adoption Framework™",
    description:
      "De la experimentación a una organización AI-First: gobierno, fundamentos, agentes, operación y escala.",
    url: "/framework",
  },
};

const frameworkSteps = [
  ["01", "AI Governance", "¿Quién decide?"],
  ["02", "AI Foundation", "¿Sobre qué construimos?"],
  ["03", "AgentOps", "¿Dónde generamos impacto?"],
  ["04", "AI Operations", "¿Cómo operamos IA?"],
  ["05", "AI Scale", "¿Cómo escalamos?"],
];

const principles = [
  {
    title: "La IA no es un proyecto tecnológico",
    copy: "La adopción exitosa requiere cambios coordinados en estrategia, procesos, capacidades, cultura y gobierno.",
  },
  {
    title: "Los agentes son una consecuencia",
    copy: "Antes de implementar agentes, la organización debe establecer las capacidades que permitan operarlos de forma segura y escalable.",
  },
  {
    title: "El valor se construye de izquierda a derecha",
    copy: "La organización evoluciona desde la gobernanza y preparación hasta el impacto medible y el escalamiento.",
  },
];

const pillars = [
  {
    name: "AI Governance",
    question: "¿Quién decide?",
    description:
      "Construye la estructura de gobierno que permite adoptar IA de forma segura, controlada y alineada con el negocio.",
    components: [
      ["Estrategia IA", ["Visión AI-First", "Objetivos estratégicos", "Casos de uso prioritarios", "KPIs de transformación"]],
      ["Gobierno IA", ["Comité IA", "Roles y responsabilidades", "Modelo de toma de decisiones", "Gestión de riesgos"]],
      ["Gobierno de Datos", ["Propiedad de datos", "Calidad de datos", "Catálogo de información", "Accesos y permisos"]],
      ["Ciberseguridad y Compliance", ["Seguridad de modelos", "Protección de datos", "Riesgos regulatorios", "Uso responsable"]],
    ],
    deliverables: ["Modelo de Gobierno IA", "Políticas IA", "Matriz RACI", "Framework de riesgos"],
  },
  {
    name: "AI Foundation",
    question: "¿Sobre qué construimos?",
    description:
      "Prepara la base tecnológica, de datos y conocimiento necesaria para habilitar agentes inteligentes.",
    components: [
      ["Arquitectura", ["Arquitectura objetivo", "Sistemas involucrados", "Integraciones críticas", "APIs disponibles"]],
      ["Data Readiness", ["Fuentes de datos", "Calidad", "Integración", "Disponibilidad"]],
      ["Knowledge Layer", ["Documentación", "Procesos", "Bases de conocimiento", "Información corporativa"]],
      ["Plataformas", ["LLMs", "Herramientas IA", "Automatización", "Observabilidad"]],
    ],
    deliverables: ["Arquitectura objetivo", "Mapa de sistemas", "Data Readiness Assessment", "Knowledge Inventory"],
  },
  {
    name: "AgentOps",
    question: "¿Dónde generamos impacto?",
    description:
      "Identifica, prioriza e implementa agentes de acuerdo con el valor esperado y la factibilidad de ejecución.",
    components: [
      ["Descubrimiento", ["Procesos candidatos", "Pain points", "Oportunidades de automatización", "Usuarios impactados"]],
      ["Priorización", ["Impacto esperado", "Factibilidad técnica", "Riesgo", "Time-to-value"]],
      ["Diseño", ["Objetivo del agente", "Flujos de trabajo", "Integraciones", "Human-in-the-Loop"]],
      ["Implementación", ["MVP", "Pruebas", "Despliegue", "Medición de valor"]],
    ],
    deliverables: ["Mapa de oportunidades IA", "Backlog de agentes", "Priorización por impacto", "Business Cases"],
  },
  {
    name: "AI Operations",
    question: "¿Cómo operamos IA?",
    description:
      "Establece las capacidades necesarias para administrar agentes de forma confiable una vez que llegan a producción.",
    components: [
      ["Observabilidad", ["Uso", "Costos", "Rendimiento", "Adopción"]],
      ["Calidad", ["Precisión", "Hallucination control", "Testing", "Evaluación continua"]],
      ["Human-in-the-Loop", ["Supervisión humana", "Escalamiento", "Aprobaciones", "Excepciones"]],
      ["Seguridad", ["Auditoría", "Trazabilidad", "Control de accesos", "Gestión de incidentes"]],
    ],
    deliverables: ["Modelo AgentOps", "KPIs operacionales", "Dashboard ejecutivo", "Modelo de monitoreo"],
  },
  {
    name: "AI Scale",
    question: "¿Cómo escalamos?",
    description:
      "Transforma iniciativas exitosas en capacidades organizacionales permanentes y reutilizables.",
    components: [
      ["AI Academy", ["Formación ejecutiva", "Formación profesional", "Certificaciones internas", "Comunidades"]],
      ["Change Management", ["Gestión del cambio", "Comunicación", "Adopción", "Nuevas formas de trabajo"]],
      ["AI Center of Excellence", ["Estándares", "Mejores prácticas", "Reutilización", "Gobierno transversal"]],
      ["Roadmap Evolutivo", ["Quick Wins", "MVPs", "Escalamiento", "Innovación continua"]],
    ],
    deliverables: ["Plan de adopción", "Roadmap 12 meses", "Modelo de capacidades", "Centro de excelencia IA"],
  },
];

const agentCategories = [
  {
    category: "Categoría A",
    name: "Productivity Agents",
    copy: "Incrementan la productividad individual y potencian el trabajo cotidiano.",
    examples: ["Copiloto corporativo", "Asistente documental", "Generador de reportes"],
  },
  {
    category: "Categoría B",
    name: "Process Agents",
    copy: "Automatizan procesos internos completos y coordinan tareas entre áreas.",
    examples: ["RRHH", "Compras", "Finanzas", "Operaciones"],
  },
  {
    category: "Categoría C",
    name: "Customer Agents",
    copy: "Transforman experiencias que impactan directamente clientes e ingresos.",
    examples: ["Ventas", "Atención", "Marketing", "Customer Success"],
  },
];

const outcomes = [
  "Gobierno IA definido",
  "Datos preparados para IA",
  "Arquitectura habilitada",
  "Portafolio priorizado de agentes",
  "Modelo AgentOps operativo",
  "Capacidades internas para escalar IA",
  "Roadmap evolutivo de transformación",
];

const ret = (ms: number) => ({ animationDelay: `${ms}ms` }) as React.CSSProperties;

export default function FrameworkPage() {
  return (
    <Sitio>
      <main id="top">
        <section className="hero st-hero">
          <div className="hero-dots" id="heroDots" aria-hidden="true"></div>
          <div className="wrap v2-hero-grid fw-hero-grid">
            <div className="v2-hero-copy">
              <span className="eyebrow rise" style={ret(0)}>adoOps AI Adoption Framework™</span>
              <h1 className="display h-xl" id="heroTitle">
                <span className="w" style={ret(140)}>De</span> <span className="w" style={ret(190)}>la</span> <span className="w" style={ret(240)}>experimentación</span> <span className="w" style={ret(290)}>a</span> <span className="w" style={ret(340)}>una</span> <span className="w" style={ret(390)}>organización</span> <span className="w ia" style={ret(440)}>AI-First</span>
              </h1>
              <p className="lede rise" style={ret(560)}>
                Un modelo integral para adoptar Inteligencia Artificial de forma segura, gobernada y orientada a resultados, convirtiendo iniciativas aisladas en capacidades organizacionales escalables.
              </p>
              <div className="v2-hero-actions rise" style={ret(700)}>
                <a className="btn btn-primary arrow" href="#pilares">Explorar el Framework</a>
                <Link className="btn btn-ghost" href="/#contacto">Evaluar mi organización</Link>
              </div>
            </div>

            <ol className="fw-mapa rise" style={ret(420)} aria-label="Estructura del AI Adoption Framework">
              {frameworkSteps.map(([number, title, question]) => (
                <li key={number}>
                  <span className="st-num">{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <small>{question}</small>
                  </div>
                  <i aria-hidden="true">→</i>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section challenge">
          <div className="grid-bg" aria-hidden="true"></div>
          <div className="wrap">
            <div className="section-head rv">
              <span className="eyebrow">Principios fundamentales</span>
              <h2 className="display h-lg">La adopción de IA es una transformación organizacional</h2>
              <p className="lede">
                El framework conecta estrategia, gobierno, datos, tecnología, personas y ejecución para asegurar que cada agente implementado genere impacto sostenible.
              </p>
            </div>
            <div className="probs fw-tres rv-group">
              {principles.map((principle, index) => (
                <article className="prob rv" key={principle.title}>
                  <span className="st-num">0{index + 1}</span>
                  <h3>{principle.title}</h3>
                  <p>{principle.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section st-ancla" id="pilares" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="section-head rv">
              <span className="eyebrow">Estructura del Framework</span>
              <h2 className="display h-lg">Cinco pilares para construir valor de izquierda a derecha</h2>
              <p className="lede">
                Cada pilar resuelve una pregunta crítica y habilita al siguiente. El resultado es una capacidad de IA gobernada, operable y escalable.
              </p>
            </div>

            <div className="fw-pilares">
              {pillars.map((pillar, index) => (
                <article className="fw-pilar rv" key={pillar.name}>
                  <div className="fw-pilar-cab">
                    <span className="idx">PILAR 0{index + 1}</span>
                    <h3>{pillar.name}</h3>
                    <span className="q">{pillar.question}</span>
                    <p>{pillar.description}</p>
                  </div>
                  <div>
                    <div className="fw-comps">
                      {pillar.components.map(([title, items]) => (
                        <div className="fw-comp" key={title as string}>
                          <h4>{title}</h4>
                          <ul>
                            {(items as string[]).map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <aside className="fw-entregables">
                      <h4>Entregables</h4>
                      <ul>
                        {pillar.deliverables.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    </aside>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section proof st-ancla" id="agentops" style={{ paddingTop: 0 }}>
          <div className="proof-inner">
            <div className="proof-gridbg" aria-hidden="true"></div>
            <i className="orb" style={{ width: "120px", height: "120px", right: "8%", top: "10%", "--t": "16s", "--dx": "-30px", "--dy": "40px" } as React.CSSProperties} aria-hidden="true"></i>
            <i className="orb" style={{ width: "54px", height: "54px", right: "24%", top: "30%", "--t": "12s", "--dx": "24px", "--dy": "-26px" } as React.CSSProperties} aria-hidden="true"></i>
            <div className="proof-wrap">
              <div className="proof-head rv">
                <span className="eyebrow" data-t="Impacto vs. Factibilidad"></span>
                <h2 className="two"><span className="l1">No todos los agentes</span><span className="l2">generan el mismo valor</span></h2>
                <p className="fw-sub">
                  Las oportunidades se priorizan por impacto esperado, factibilidad, riesgo y velocidad para capturar valor.
                </p>
                <p className="fw-sub">
                  El portafolio equilibra productividad individual, automatización de procesos y experiencias de cliente.
                </p>
              </div>
              <div className="fw-agentes rv-group">
                {agentCategories.map((agent) => (
                  <article className="fw-agente rv" key={agent.name}>
                    <span className="cat">{agent.category}</span>
                    <h3>{agent.name}</h3>
                    <p>{agent.copy}</p>
                    <div className="fw-chips">
                      {agent.examples.map((example) => <span key={example}>{example}</span>)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section st-ancla" id="resultados">
          <div className="wrap">
            <div className="section-head rv">
              <span className="eyebrow">Resultado esperado</span>
              <h2 className="display h-lg">Una organización preparada para operar y escalar IA</h2>
              <p className="lede">
                Al finalizar el framework, la experimentación se convierte en un sistema de capacidades, decisiones y ejecución sostenibles.
              </p>
            </div>
            <ul className="fw-resultados rv">
              {outcomes.map((outcome) => (
                <li key={outcome}>
                  <b aria-hidden="true">✓</b>
                  <span>{outcome}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section cta" style={{ paddingTop: 0 }}>
          <div className="cta-box fw-cierre rv">
            <div className="cta-copy">
              <span className="eyebrow">adoOps AI Adoption Framework™</span>
              <h2 className="display h-lg">“Transformamos iniciativas aisladas de Inteligencia Artificial en capacidades organizacionales escalables.”</h2>
              <Link className="btn btn-primary arrow" href="/#contacto">Solicitar un Assessment</Link>
            </div>
          </div>
        </section>
      </main>
    </Sitio>
  );
}
