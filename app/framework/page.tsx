import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ClosingAnimation from "@/components/ClosingAnimation";
import styles from "./framework.module.css";

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

export default function FrameworkPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <Link className={styles.logoLink} href="/">
            <Image src="/logo.png" alt="adoOps" width={120} height={36} priority />
          </Link>
          <div className={styles.navLinks}>
            <Link className={styles.navLink} href="/">Inicio</Link>
            <a className={`${styles.navLink} ${styles.navLinkActive}`} href="#pilares">Framework</a>
            <a className={styles.navLink} href="#agentops">AgentOps</a>
            <a className={styles.navLink} href="#resultados">Resultados</a>
            <Link className={styles.navCta} href="/#contacto">
              <span className={styles.desktopCta}>Solicitar Assessment</span>
              <span className={styles.mobileCta}>Contactar</span>
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.dotPattern} />
          <div className={styles.heroInner}>
            <div>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowDot} />
                adoOps AI Adoption Framework™
              </div>
              <h1 className={styles.title}>
                De la experimentación a una organización <span className={styles.gradientText}>AI-First</span>
              </h1>
              <p className={styles.heroLead}>
                Un modelo integral para adoptar Inteligencia Artificial de forma segura, gobernada y orientada a resultados, convirtiendo iniciativas aisladas en capacidades organizacionales escalables.
              </p>
              <div className={styles.heroActions}>
                <a className={styles.primaryCta} href="#pilares">Explorar el Framework →</a>
                <Link className={styles.secondaryCta} href="/#contacto">Evaluar mi organización</Link>
              </div>
            </div>

            <div className={styles.frameworkMap} aria-label="Estructura del AI Adoption Framework">
              {frameworkSteps.map(([number, title, question]) => (
                <div className={styles.mapRow} key={number}>
                  <span className={styles.mapNumber}>{number}</span>
                  <div>
                    <div className={styles.mapTitle}>{title}</div>
                    <div className={styles.mapQuestion}>{question}</div>
                  </div>
                  <span className={styles.mapArrow}>→</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionSoft}`}>
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div className={styles.sectionLabel}>Principios fundamentales</div>
              <h2 className={styles.sectionTitle}>La adopción de IA es una transformación organizacional</h2>
              <p className={styles.sectionCopy}>
                El framework conecta estrategia, gobierno, datos, tecnología, personas y ejecución para asegurar que cada agente implementado genere impacto sostenible.
              </p>
            </div>
            <div className={styles.principles}>
              {principles.map((principle, index) => (
                <article className={styles.principle} key={principle.title}>
                  <span className={styles.principleNumber}>0{index + 1}</span>
                  <h3>{principle.title}</h3>
                  <p>{principle.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} id="pilares">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div className={styles.sectionLabel}>Estructura del Framework</div>
              <h2 className={styles.sectionTitle}>Cinco pilares para construir valor de izquierda a derecha</h2>
              <p className={styles.sectionCopy}>
                Cada pilar resuelve una pregunta crítica y habilita al siguiente. El resultado es una capacidad de IA gobernada, operable y escalable.
              </p>
            </div>

            <div className={styles.pillars}>
              {pillars.map((pillar, index) => (
                <article className={styles.pillar} key={pillar.name}>
                  <div className={styles.pillarLead}>
                    <div>
                      <div className={styles.pillarIndex}>PILAR 0{index + 1}</div>
                      <h3 className={styles.pillarName}>{pillar.name}</h3>
                      <div className={styles.pillarQuestion}>{pillar.question}</div>
                    </div>
                    <p className={styles.pillarDescription}>{pillar.description}</p>
                  </div>
                  <div className={styles.pillarContent}>
                    <div className={styles.componentGrid}>
                      {pillar.components.map(([title, items]) => (
                        <div className={styles.component} key={title as string}>
                          <h4>{title}</h4>
                          <ul>
                            {(items as string[]).map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                    <aside className={styles.deliverables}>
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

        <section className={`${styles.section} ${styles.sectionDark}`} id="agentops">
          <div className={styles.dotPattern} />
          <div className={styles.container} style={{ position: "relative" }}>
            <div className={styles.sectionIntro}>
              <div className={styles.sectionLabel}>Impacto vs. Factibilidad</div>
              <h2 className={styles.sectionTitle}>No todos los agentes generan el mismo valor</h2>
              <p className={styles.sectionCopy}>
                Las oportunidades se priorizan por impacto esperado, factibilidad, riesgo y velocidad para capturar valor.
              </p>
            </div>
            <p className={styles.agentIntro}>
              El portafolio equilibra productividad individual, automatización de procesos y experiencias de cliente.
            </p>
            <div className={styles.matrix}>
              {agentCategories.map((agent) => (
                <article className={styles.agentCard} key={agent.name}>
                  <div className={styles.agentCategory}>{agent.category}</div>
                  <h3>{agent.name}</h3>
                  <p>{agent.copy}</p>
                  <div className={styles.examples}>
                    {agent.examples.map((example) => <span className={styles.example} key={example}>{example}</span>)}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.sectionSoft}`} id="resultados">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div className={styles.sectionLabel}>Resultado esperado</div>
              <h2 className={styles.sectionTitle}>Una organización preparada para operar y escalar IA</h2>
              <p className={styles.sectionCopy}>
                Al finalizar el framework, la experimentación se convierte en un sistema de capacidades, decisiones y ejecución sostenibles.
              </p>
            </div>
            <div className={styles.outcomes}>
              {outcomes.map((outcome) => (
                <div className={styles.outcome} key={outcome}>
                  <span className={styles.check}>✓</span>
                  <span>{outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.claim}>
          <div className={styles.claimInner}>
            <div className={styles.sectionLabel}>adoOps AI Adoption Framework™</div>
            <h2>“Transformamos iniciativas aisladas de Inteligencia Artificial en capacidades organizacionales escalables.”</h2>
            <Link className={styles.primaryCta} href="/#contacto">Solicitar un Assessment →</Link>
          </div>
        </section>

        <ClosingAnimation />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div>
            <Image src="/logo.png" alt="adoOps" width={120} height={36} style={{ filter: "brightness(0) invert(1)" }} />
            <p className={styles.footerDescription}>Adoptamos IA. Operamos IA. Escalamos IA. Convertimos la Inteligencia Artificial en una capacidad real de negocio.</p>
          </div>
          <div>
            <div className={styles.footerTitle}>Framework</div>
            <div className={styles.footerLinks}>
              <a href="#pilares">Cinco pilares</a>
              <a href="#agentops">AgentOps</a>
              <a href="#resultados">Resultados</a>
            </div>
          </div>
          <div>
            <div className={styles.footerTitle}>Empresa</div>
            <div className={styles.footerLinks}>
              <Link href="/">Inicio</Link>
              <Link href="/#resultados">Impacto</Link>
              <Link href="/#contacto">Contacto</Link>
            </div>
          </div>
          <div>
            <div className={styles.footerTitle}>Contacto</div>
            <div className={styles.footerLinks}>
              <a href="mailto:hola@adoops.ai">hola@adoops.ai</a>
              <Link className={styles.footerCta} href="/#contacto">Solicitar Assessment →</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 adoOps. Todos los derechos reservados.</span>
          <span>Adoptamos IA. Operamos IA. Escalamos IA.</span>
        </div>
      </footer>
    </div>
  );
}
