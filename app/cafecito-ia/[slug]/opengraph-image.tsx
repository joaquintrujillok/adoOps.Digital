// Imagen OpenGraph por edición.
//
// Sin esto, cada edición compartida en LinkedIn se ve idéntica: todas heredan el
// og.png genérico del sitio. Con el titular impreso en la tarjeta, el link se
// explica solo en el feed, que es donde se decide si alguien hace clic.
//
// Se genera en el borde y se cachea; no vuelve a renderizarse por visita.

import { ImageResponse } from "next/og";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cafecitoEdiciones } from "@/db/schema";

export const alt = "Cafecito IA — el boletín de IA de adoOps";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fechaLarga = (slug: string) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${slug}T12:00:00Z`));

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [e] = await db
    .select({ titulo: cafecitoEdiciones.titulo })
    .from(cafecitoEdiciones)
    .where(and(eq(cafecitoEdiciones.slug, slug), eq(cafecitoEdiciones.publicada, true)))
    .limit(1);

  const titulo = e?.titulo ?? "Cafecito IA";

  // Los titulares varían mucho de largo. Escalar el tipo evita tanto el titular
  // diminuto perdido en el centro como el que se desborda de la tarjeta.
  const tam = titulo.length > 110 ? 46 : titulo.length > 70 ? 54 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "68px 72px",
          background: "linear-gradient(135deg,#0F2A40 0%,#0A1828 55%,#081320 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 13, height: 13, borderRadius: 99, background: "#2ED477" }} />
          <div
            style={{
              fontSize: 21, fontWeight: 700, letterSpacing: 3.4,
              textTransform: "uppercase", color: "#7BE9AE",
            }}
          >
            Cafecito IA
          </div>
        </div>

        <div
          style={{
            display: "flex", fontSize: tam, fontWeight: 800, lineHeight: 1.16,
            letterSpacing: -1.6, color: "#FFFFFF", maxWidth: 1010,
          }}
        >
          {titulo}
        </div>

        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "flex-end",
            borderTop: "2px solid rgba(46,212,119,0.4)", paddingTop: 26,
          }}
        >
          <div style={{ display: "flex", fontSize: 25, color: "#A9BBC7" }}>
            {e ? fechaLarga(slug) : "El boletín de IA de adoOps"}
          </div>
          <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: "#FFFFFF" }}>
            ado<span style={{ color: "#2ED477" }}>Ops</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
