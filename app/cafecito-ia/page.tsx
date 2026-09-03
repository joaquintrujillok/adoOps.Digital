import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import CafecitoForm from "@/components/CafecitoForm";
import { db } from "@/db";
import { cafecitoEdiciones } from "@/db/schema";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cafecito IA — El boletín de inteligencia artificial de adoOps",
  description:
    "Lo que pasó en IA, cada dos días y en cinco minutos. Lanzamientos, movimientos de industria y qué significan para tu operación. Lunes, miércoles y viernes.",
  alternates: { canonical: "/cafecito-ia" },
  openGraph: {
    title: "Cafecito IA — El boletín de IA de adoOps",
    description:
      "Lo que pasó en IA, cada dos días y en cinco minutos. Lunes, miércoles y viernes.",
    url: "/cafecito-ia",
    type: "website",
  },
};

const fechaLarga = (slug: string) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${slug}T12:00:00Z`));

export default async function CafecitoIA() {
  const ediciones = await db
    .select({
      slug: cafecitoEdiciones.slug,
      titulo: cafecitoEdiciones.titulo,
      bajada: cafecitoEdiciones.bajada,
      lectura: cafecitoEdiciones.lectura,
    })
    .from(cafecitoEdiciones)
    .where(eq(cafecitoEdiciones.publicada, true))
    .orderBy(desc(cafecitoEdiciones.slug))
    .limit(50);

  const [ultima, ...anteriores] = ediciones;

  return (
    <div style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: "#0E1D33", background: "#FFFFFF" }}>
      {/* NAV */}
      <header style={{ position: "fixed", top: 0, left: 0, width: "100%", height: 64, zIndex: 50, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid #E9EEF1" }}>
        <nav style={{ maxWidth: 1100, height: "100%", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ display: "flex", alignItems: "center" }}>
            <Image src="/logo.png" alt="adoOps" width={116} height={35} style={{ objectFit: "contain" }} priority />
          </a>
          <a href="#suscribirse" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", background: "#20C463", color: "#06281A", fontSize: 13.5, fontWeight: 600, padding: "9px 18px", borderRadius: 999, boxShadow: "0 4px 14px rgba(32,196,99,0.28)" }}>
            Suscribirme
          </a>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ background: "radial-gradient(120% 90% at 75% 0%,#0F2A40 0%,#0A1828 48%,#081320 100%)", color: "#EAF1F4", padding: "126px 24px 76px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(32,196,99,0.12)", border: "1px solid rgba(46,212,119,0.28)", color: "#7BE9AE", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", padding: "7px 14px", borderRadius: 999, marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ED477" }} />
            Lunes, miércoles y viernes · 9:00
          </div>

          <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: "clamp(40px,6vw,60px)", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 20px", color: "#FFFFFF" }}>
            Cafecito{" "}
            <span style={{ background: "linear-gradient(120deg,#2ED477,#0E8A82)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>IA</span>
          </h1>

          <p style={{ fontSize: 19, lineHeight: 1.6, color: "#A9BBC7", margin: "0 0 32px", maxWidth: 600 }}>
            La industria de la IA se mueve más rápido de lo que alcanzas a leer.
            Cada dos días destilamos lo que pasó en algo que se lee en cinco
            minutos: qué salió, qué cambió de precio y qué significa para tu
            operación.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, fontSize: 13.5, color: "#8FA6B6" }}>
            <span><strong style={{ color: "#EAF1F4", fontWeight: 600 }}>2 ediciones</strong> · dirección y builder</span>
            <span><strong style={{ color: "#EAF1F4", fontWeight: 600 }}>5 min</strong> de lectura</span>
            <span><strong style={{ color: "#EAF1F4", fontWeight: 600 }}>0</strong> relleno</span>
          </div>
        </div>
      </section>

      {/* SUSCRIPCIÓN */}
      <section id="suscribirse" style={{ background: "#F6F8F9", borderBottom: "1px solid #E9EEF1", padding: "52px 24px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", background: "#FFFFFF", border: "1px solid #E9EEF1", borderRadius: 16, padding: "30px 30px 26px", boxShadow: "0 10px 40px rgba(14,29,51,0.06)" }}>
          <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 7px", letterSpacing: "-0.02em" }}>
            Recíbelo en tu correo
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5C6B79", margin: "0 0 22px" }}>
            Dos ediciones, mismo material, distinto foco. Elige la que se parezca
            a tu trabajo.
          </p>
          <CafecitoForm />
        </div>
      </section>

      {/* EDICIONES */}
      <section style={{ padding: "56px 24px 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {ediciones.length === 0 ? (
            <p style={{ fontSize: 15.5, color: "#5C6B79", textAlign: "center", padding: "30px 0" }}>
              La primera edición sale muy pronto. Suscríbete arriba y te llega apenas esté.
            </p>
          ) : (
            <>
              <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "#0E1D33", margin: "0 0 22px", paddingBottom: 10, borderBottom: "2px solid #20C463", display: "inline-block" }}>
                Última edición
              </h2>

              <Link
                href={`/cafecito-ia/${ultima.slug}`}
                style={{ display: "block", textDecoration: "none", color: "inherit", border: "1px solid #E9EEF1", borderRadius: 14, padding: "26px 28px", marginBottom: 44, background: "linear-gradient(180deg,#FFFFFF,#FBFDFC)" }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", fontSize: 12.5, color: "#8394A2", marginBottom: 11 }}>
                  <span style={{ textTransform: "capitalize" }}>{fechaLarga(ultima.slug)}</span>
                  {ultima.lectura && <><span>·</span><span>{ultima.lectura}</span></>}
                </div>
                <h3 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 25, lineHeight: 1.28, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
                  {ultima.titulo}
                </h3>
                {ultima.bajada && (
                  <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#5C6B79", margin: "0 0 14px" }}>{ultima.bajada}</p>
                )}
                <span style={{ fontSize: 14.5, fontWeight: 600, color: "#0B7A4B" }}>Leer la edición →</span>
              </Link>

              {anteriores.length > 0 && (
                <>
                  <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "#0E1D33", margin: "0 0 4px", paddingBottom: 10, borderBottom: "2px solid #20C463", display: "inline-block" }}>
                    Ediciones anteriores
                  </h2>
                  <div>
                    {anteriores.map((e) => (
                      <Link
                        key={e.slug}
                        href={`/cafecito-ia/${e.slug}`}
                        style={{ display: "block", textDecoration: "none", color: "inherit", padding: "20px 0", borderBottom: "1px solid #EEF2F4" }}
                      >
                        <div style={{ fontSize: 12.5, color: "#8394A2", marginBottom: 6, textTransform: "capitalize" }}>
                          {fechaLarga(e.slug)}{e.lectura ? ` · ${e.lectura}` : ""}
                        </div>
                        <div style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 18, lineHeight: 1.35, letterSpacing: "-0.015em" }}>
                          {e.titulo}
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {/* PIE */}
      <footer style={{ background: "#0A1828", color: "#8FA6B6", padding: "40px 24px", textAlign: "center", fontSize: 13.5 }}>
        <Image src="/logo.png" alt="adoOps" width={104} height={31} style={{ objectFit: "contain", marginBottom: 14, filter: "brightness(0) invert(1)", opacity: 0.9 }} />
        <p style={{ margin: "0 0 6px" }}>Cafecito IA es el boletín de inteligencia artificial de adoOps.</p>
        <p style={{ margin: 0 }}>
          <a href="/" style={{ color: "#7BE9AE", textDecoration: "none" }}>Conocer adoOps</a>
        </p>
      </footer>
    </div>
  );
}
