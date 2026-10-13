import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./v2.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

/**
 * /v2 es la vista previa del rediseño de la portada. Vive al lado de la portada
 * actual para poder mostrarla y compararla sin tocar producción; cuando se
 * apruebe, su contenido reemplaza a `app/page.tsx` y esta ruta desaparece.
 *
 * `index: false` porque es una copia de la portada con otro diseño: indexada,
 * compite con la portada real por las mismas búsquedas.
 */
export const metadata: Metadata = {
  title: "adoOps — Rediseño (vista previa)",
  description:
    "Vista previa del rediseño de adoops.digital. Adoptamos IA. Operamos IA. Escalamos IA.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/" },
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className={plexMono.variable}>{children}</div>;
}
