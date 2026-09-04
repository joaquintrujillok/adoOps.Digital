import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import CafecitoForm from "@/components/CafecitoForm";
import { edicionAnterior, traerEdicion } from "@/lib/cafecito/consultas";
import { markdownAHtml } from "@/lib/cafecito/markdown";
import styles from "../cafecito.module.css";
import { SITE_URL as BASE } from "@/lib/site";

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


const fechaLarga = (slug: string) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${slug}T12:00:00Z`));

export default async function Edicion({ params }: Props) {
  const { slug } = await params;
  const e = await traerEdicion(slug);
  if (!e) notFound();

  const anterior = await edicionAnterior(e.slug);

  return (
    <div style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: "#0E1D33", background: "#FFFFFF" }}>
      <header style={{ position: "fixed", top: 0, left: 0, width: "100%", height: 64, zIndex: 50, background: "rgba(255,255,255,0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid #E9EEF1" }}>
        <nav style={{ maxWidth: 900, height: "100%", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/cafecito-ia" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none" }}>
            <Image src="/logo.png" alt="adoOps" width={102} height={31} style={{ objectFit: "contain" }} priority />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#43566A", borderLeft: "1px solid #DCE3E7", paddingLeft: 11 }}>
              Cafecito IA
            </span>
          </Link>
          <a href="#suscribirse" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", background: "#20C463", color: "#06281A", fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 999 }}>
            Suscribirme
          </a>
        </nav>
      </header>

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

      <article style={{ maxWidth: 700, margin: "0 auto", padding: "104px 24px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 11, alignItems: "center", fontSize: 13, color: "#8394A2", marginBottom: 14 }}>
          <span style={{ textTransform: "capitalize" }}>{fechaLarga(e.slug)}</span>
          {e.lectura && <><span>·</span><span>{e.lectura}</span></>}
        </div>

        <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(30px,4.4vw,42px)", lineHeight: 1.16, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
          {e.titulo}
        </h1>

        {e.bajada && (
          <p style={{ fontSize: 18.5, lineHeight: 1.58, color: "#5C6B79", margin: "0 0 34px", paddingBottom: 26, borderBottom: "1px solid #E9EEF1" }}>
            {e.bajada}
          </p>
        )}

        {/* El HTML lo produce nuestro conversor sobre contenido escapado; no hay
            ruta por la que el cuerpo pueda inyectar etiquetas. */}
        <div className={styles.prosa} dangerouslySetInnerHTML={{ __html: markdownAHtml(e.contenido) }} />
      </article>

      <section id="suscribirse" style={{ maxWidth: 700, margin: "48px auto 0", padding: "0 24px" }}>
        <div style={{ background: "#F6F8F9", border: "1px solid #E9EEF1", borderRadius: 16, padding: "28px 28px 24px" }}>
          <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 21, margin: "0 0 7px", letterSpacing: "-0.02em" }}>
            ¿Te sirvió? Recíbelo cada dos días
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5C6B79", margin: "0 0 20px" }}>
            Lunes, miércoles y viernes a las 9 de la mañana, en la versión que se
            parezca a tu trabajo.
          </p>
          <CafecitoForm compacto />
        </div>
      </section>

      <nav style={{ maxWidth: 700, margin: "36px auto 0", padding: "0 24px 64px", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <Link href="/cafecito-ia" style={{ fontSize: 14.5, fontWeight: 600, color: "#0B7A4B", textDecoration: "none" }}>
          ← Todas las ediciones
        </Link>
        {anterior && (
          <Link href={`/cafecito-ia/${anterior.slug}`} style={{ fontSize: 14.5, fontWeight: 600, color: "#0B7A4B", textDecoration: "none", textAlign: "right", maxWidth: 380 }}>
            Edición anterior →
          </Link>
        )}
      </nav>

      <footer style={{ background: "#0A1828", color: "#8FA6B6", padding: "36px 24px", textAlign: "center", fontSize: 13.5 }}>
        <p style={{ margin: 0 }}>
          Cafecito IA · <a href="/" style={{ color: "#7BE9AE", textDecoration: "none" }}>adoOps</a>
        </p>
      </footer>
    </div>
  );
}
