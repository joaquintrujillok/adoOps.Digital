import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import CafecitoForm from "@/components/CafecitoForm";
import { edicionAnterior, slugPorFecha, traerEdicion } from "@/lib/cafecito/consultas";
import { ES_FECHA } from "@/lib/cafecito/slug";
import { markdownAHtml, sinBajadaRepetida } from "@/lib/cafecito/markdown";
import styles from "../cafecito.module.css";
import { SITE_URL as BASE } from "@/lib/site";
import Sitio from "../../_web/Sitio";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = await traerEdicion(slug);
  if (!e) return { title: "Edición no encontrada — Cafecito IA" };

  return {
    title: `${e.titulo} — Cafecito IA`,
    description: e.bajada ?? undefined,
    alternates: { canonical: `/cafecito-ia/${e.slug}` },
    openGraph: {
      title: e.titulo,
      description: e.bajada ?? undefined,
      url: `/cafecito-ia/${e.slug}`,
      type: "article",
      publishedTime: e.publicadaEn.toISOString(),
    },
    twitter: { card: "summary_large_image", title: e.titulo, description: e.bajada ?? undefined },
  };
}


const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${fecha}T12:00:00Z`));

export default async function Edicion({ params }: Props) {
  const { slug } = await params;
  const e = await traerEdicion(slug);

  // Las tres primeras ediciones se publicaron con la fecha como URL y salieron
  // así por correo. Esos enlaces están en bandejas ajenas y no se pueden
  // romper, así que un segmento con forma de fecha se resuelve y se redirige.
  //
  // 301 y no 302: le dice a Google que consolide la autoridad en la URL nueva,
  // que es el motivo de todo el cambio. Un 302 la dejaría repartida entre las
  // dos para siempre.
  if (!e && ES_FECHA.test(slug)) {
    const destino = await slugPorFecha(slug);
    if (destino) permanentRedirect(`/cafecito-ia/${destino}`);
  }

  if (!e) notFound();

  const anterior = await edicionAnterior(e.fecha);

  return (
    <Sitio cta={{ href: "#suscribirse", label: "Suscribirme" }}>
      <main id="top">
        {/*
          JSON-LD. Es lo que convierte estas páginas de "documentos sueltos" en
          artículos noticiosos para Google: habilita la fecha en los resultados y
          la elegibilidad para Noticias y Discover, que el HTML solo no da.

          El contenido sale de la base y ya está serializado por JSON.stringify,
          así que no hay ruta por la que pueda romper el <script>.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: e.titulo.slice(0, 110), // Google ignora titulares más largos
              description: e.bajada ?? undefined,
              datePublished: e.publicadaEn.toISOString(),
              dateModified: e.actualizadaEn.toISOString(),
              inLanguage: "es-CL",
              mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/cafecito-ia/${e.slug}` },
              image: [`${BASE}/cafecito-ia/${e.slug}/opengraph-image`],
              isPartOf: {
                "@type": "Blog",
                name: "Cafecito IA",
                url: `${BASE}/cafecito-ia`,
              },
              author: { "@type": "Organization", name: "adoOps", url: BASE },
              publisher: {
                "@type": "Organization",
                name: "adoOps",
                url: BASE,
                logo: { "@type": "ImageObject", url: `${BASE}/logo.png` },
              },
            }),
          }}
        />

        <article className="cf-articulo">
          <div className="cf-meta">
            <span>{fechaLarga(e.fecha)}</span>
            {e.lectura && <><span>·</span><span>{e.lectura}</span></>}
          </div>

          <h1>{e.titulo}</h1>

          {e.bajada && <p className="cf-bajada">{e.bajada}</p>}

          {/* El HTML lo produce nuestro conversor sobre contenido escapado; no hay
              ruta por la que el cuerpo pueda inyectar etiquetas. */}
          <div className={styles.prosa} dangerouslySetInnerHTML={{ __html: markdownAHtml(sinBajadaRepetida(e.contenido, e.bajada)) }} />
        </article>

        <section id="suscribirse" className="cf-caja-wrap st-ancla">
          <div className="cf-caja">
            <h2>¿Te sirvió? Recíbelo cada dos días</h2>
            <p>
              Lunes, miércoles y viernes a las 9 de la mañana, en la versión que se
              parezca a tu trabajo.
            </p>
            <CafecitoForm compacto />
          </div>
        </section>

        <nav className="cf-pasos" aria-label="Otras ediciones">
          <Link href="/cafecito-ia">← Todas las ediciones</Link>
          {anterior && <Link href={`/cafecito-ia/${anterior.slug}`}>Edición anterior →</Link>}
        </nav>
      </main>
    </Sitio>
  );
}
