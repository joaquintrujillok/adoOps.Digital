import type { Metadata } from "next";
import Link from "next/link";
import CafecitoForm from "@/components/CafecitoForm";
import Sitio from "../_web/Sitio";
import { TAZAS, type CafecitoTaza } from "@/db/cafecito";
import { listarEdiciones } from "@/lib/cafecito/consultas";
import { mascara, type NombreIcono } from "@/lib/cafecito/iconos";
import {
  CUANTAS_TAZAS, PROMESA, RANGO_LECTURA_CORTO, TAZAS_EN_PROSA, TAZAS_ORDEN,
} from "@/lib/cafecito/copy";
import { SITE_URL as BASE } from "@/lib/site";

export const revalidate = 300;

/** Mismo ícono que en el selector del formulario, para que se reconozcan. */
const ICONO_TAZA: Record<CafecitoTaza, NombreIcono> = {
  expreso_directivo: "briefcase",
  expreso_builder: "terminal",
  flat_white: "book-open",
};

export const metadata: Metadata = {
  title: "Cafecito IA — El boletín de inteligencia artificial de adoOps",
  description:
    `${PROMESA} Lanzamientos, movimientos de industria y qué significan para tu operación. Lunes, miércoles y viernes.`,
  alternates: {
    canonical: "/cafecito-ia",
    types: { "application/rss+xml": "/cafecito-ia/rss.xml" },
  },
  openGraph: {
    title: "Cafecito IA — El boletín de IA de adoOps",
    description: `${PROMESA} Lunes, miércoles y viernes.`,
    url: "/cafecito-ia",
    type: "website",
  },
};


const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));

export default async function CafecitoIA() {
  const ediciones = await listarEdiciones();

  const [ultima, ...anteriores] = ediciones;

  return (
    <Sitio cta={{ href: "#suscribirse", label: "Suscribirme" }}>
      <main id="top">
        {/*
          JSON-LD del índice: declara Cafecito IA como una publicación periódica y
          enlaza sus ediciones. Es lo que le permite a Google entender el conjunto,
          no solo cada página por separado.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Blog",
              name: "Cafecito IA",
              description: PROMESA,
              url: `${BASE}/cafecito-ia`,
              inLanguage: "es-CL",
              publisher: {
                "@type": "Organization",
                name: "adoOps",
                url: BASE,
                logo: { "@type": "ImageObject", url: `${BASE}/logo.png` },
              },
              // `author` e `image` los pidió la Prueba de resultados enriquecidos
              // el 07-09-2026: sin ellos marcaba dos problemas no críticos por
              // entrada. Son opcionales —el elemento ya era válido— pero Google
              // los usa para armar el resultado enriquecido, y acá no cuestan
              // nada: los datos ya estaban a mano.
              blogPost: ediciones.slice(0, 10).map((e) => ({
                "@type": "BlogPosting",
                headline: e.titulo.slice(0, 110),
                url: `${BASE}/cafecito-ia/${e.slug}`,
                // ISO con zona, no `e.fecha`. Esa columna es un date pelado
                // (`2026-09-03`) y schema.org pide fecha-hora: sin zona, Google
                // la interpreta a su criterio y en una publicación diaria eso
                // corre las ediciones un día.
                datePublished: e.publicadaEn.toISOString(),
                image: [`${BASE}/cafecito-ia/${e.slug}/opengraph-image`],
                author: { "@type": "Organization", name: "adoOps", url: BASE },
                inLanguage: "es-CL",
              })),
            }),
          }}
        />

        {/* HERO */}
        <section className="hero st-hero">
          <div className="hero-dots" id="heroDots" aria-hidden="true"></div>
          <div className="wrap">
            <div className="v2-hero-copy">
              <span className="eyebrow rise" style={{ animationDelay: "0ms" }}>Lunes, miércoles y viernes · 9:00</span>
              <h1 className="display h-xl" id="heroTitle">
                <span className="w" style={{ animationDelay: "140ms" }}>Cafecito</span>{" "}
                <span className="w ia" style={{ animationDelay: "210ms" }}>IA</span>
              </h1>
              <p className="lede rise" style={{ animationDelay: "420ms" }}>
                La industria de la IA se mueve más rápido de lo que alcanzas a leer.
                Cada dos días destilamos lo que pasó en algo que se lee {RANGO_LECTURA_CORTO.replace("–", " a ")}
                —según la taza que elijas—: qué salió, qué cambió de precio y qué
                significa para tu operación.
              </p>
            </div>
          </div>
        </section>

        <div className="wrap rise" style={{ animationDelay: "600ms" }}>
          <div className="kpis">
            <div className="kpi"><b>{CUANTAS_TAZAS} ediciones</b><span>dirección, builder y completa</span></div>
            <div className="kpi"><b>{RANGO_LECTURA_CORTO}</b><span>de lectura</span></div>
            <div className="kpi"><b>0</b><span>relleno</span></div>
          </div>
        </div>

        {/* SUSCRIPCIÓN */}
        <section className="section cta st-ancla" id="suscribirse">
          <div className="cta-box rv">
            <div className="cta-copy">
              <h2 className="display h-lg">Recíbelo en tu correo</h2>
              <p className="lede">
                {TAZAS_EN_PROSA}. Mismo material, distinto foco y distinto largo:
                eliges cuál te llega cuando confirmes el correo.
              </p>
            </div>
            <div className="cf-suscribir">
              {/* Las tres tazas, por nombre y con sus minutos.
                  Antes no aparecían en toda la portada: el flat white —la más
                  completa— solo se descubría al abrir el formulario de
                  perfilamiento, o sea después de suscribirse. La opción más valiosa
                  era invisible justo donde se decide.
                  Todo sale de `TAZAS`; acá no hay ningún texto que mantener. */}
              <ul className="cf-tazas">
                {TAZAS_ORDEN.map((valor) => {
                  const t = TAZAS[valor];
                  return (
                    <li key={valor}>
                      <span aria-hidden className="cf-ico">
                        <i style={mascara(ICONO_TAZA[valor], "var(--ink-2)")} />
                      </span>
                      <span>
                        <span className="cf-taza-nom">
                          {t.nombre}
                          <span className="cf-min">{t.minutos}</span>
                        </span>
                        <span className="cf-taza-det">{t.detalle}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <CafecitoForm />
            </div>
          </div>
        </section>

        {/* EDICIONES */}
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            {ediciones.length === 0 ? (
              <p className="cf-vacio">
                La primera edición sale muy pronto. Suscríbete arriba y te llega apenas esté.
              </p>
            ) : (
              <>
                <h2 className="eyebrow cf-rotulo rv">Última edición</h2>

                <Link href={`/cafecito-ia/${ultima.slug}`} className="cf-ultima rv">
                  <div className="cf-meta">
                    <span>{fechaLarga(ultima.fecha)}</span>
                    {ultima.lectura && <><span>·</span><span>{ultima.lectura}</span></>}
                  </div>
                  <h3>{ultima.titulo}</h3>
                  {ultima.bajada && <p>{ultima.bajada}</p>}
                  <span className="more">Leer la edición →</span>
                </Link>

                {anteriores.length > 0 && (
                  <>
                    <h2 className="eyebrow cf-rotulo rv">Ediciones anteriores</h2>
                    <div className="cf-lista">
                      {anteriores.map((e) => (
                        <Link key={e.slug} href={`/cafecito-ia/${e.slug}`} className="cf-fila">
                          <span className="cf-meta">
                            <span>{fechaLarga(e.fecha)}</span>
                            {e.lectura && <><i aria-hidden="true">·</i><span>{e.lectura}</span></>}
                          </span>
                          <span className="t">{e.titulo}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <p className="cf-nota">
              Cafecito IA es el boletín de inteligencia artificial de adoOps.{" "}
              <Link href="/">Conocer adoOps</Link>
            </p>
          </div>
        </section>
      </main>
    </Sitio>
  );
}
