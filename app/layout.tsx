import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import Preloader from "@/components/Preloader";
import "./globals.css";

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

const BASE_URL = "https://adoops.digital";

export const metadata: Metadata = {
  title: "adoOps — Adoptamos IA. Operamos IA. Escalamos IA.",
  description:
    "Transformamos organizaciones mediante estrategias de adopción, agentes inteligentes, talento especializado y programas de desarrollo para convertir la IA en una capacidad real de negocio.",
  metadataBase: new URL(BASE_URL),
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
      </body>
    </html>
  );
}
