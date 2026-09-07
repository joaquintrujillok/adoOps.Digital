import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Preloader from "@/components/Preloader";
import "./globals.css";
import { SITE_URL as BASE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});


// cover: habilita env(safe-area-inset-*) en iPhone (tab bar de la consola /mix)
export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "adoOps — Adoptamos IA. Operamos IA. Escalamos IA.",
  description:
    "Transformamos organizaciones mediante estrategias de adopción, agentes inteligentes, talento especializado y programas de desarrollo para convertir la IA en una capacidad real de negocio.",
  metadataBase: new URL(BASE_URL),
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "adoOps — Plataforma de adopción de IA",
    description:
      "Adoptamos IA. Operamos IA. Escalamos IA. Convertimos la Inteligencia Artificial en una capacidad real de negocio.",
    type: "website",
    url: BASE_URL,
    siteName: "adoOps",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "adoOps" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "adoOps — Plataforma de adopción de IA",
    description:
      "Adoptamos IA. Operamos IA. Escalamos IA. Convertimos la Inteligencia Artificial en una capacidad real de negocio.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${sora.variable}`}>
      <body style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
        <Preloader />
        {children}
        {/*
          Analítica de Vercel, no GA4, y a propósito: no usa cookies ni
          identificadores personales, así que no necesita banner de
          consentimiento —relevante porque el boletín puede atraer lectores
          europeos— y los bloqueadores de anuncios no la omiten, así que los
          números vienen completos.

          El adaptador es `/next` y no `/react`. El de react solo registra la
          primera vista: no mira el router. Este usa `usePathname` y
          `useSearchParams`, así que cuenta también las navegaciones del lado
          del cliente, que en este sitio son la mayoría —del archivo a una
          edición se llega sin recargar—.
        */}
        <Analytics />
      </body>
    </html>
  );
}
