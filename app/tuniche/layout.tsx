import type { Metadata } from "next";
import "./tuniche.css";

// Layout raíz del Sistema Tuniche.
//
// Deliberadamente mínimo: la sesión y el armazón de navegación viven en
// `(app)/layout.tsx`, para que `/tuniche/login` quede fuera de la barrera y no
// entre en un bucle de redirección consigo mismo. Es el mismo reparto que usa
// Dashboard360 y por la misma razón.

export const metadata: Metadata = {
  title: "Sistema Tuniche",
  description: "Visitas a campo, informes y trazabilidad por agricultor.",
  // Es el sistema interno de otra empresa. No tiene por qué aparecer en Google.
  robots: { index: false, follow: false },
};

export default function TunicheRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="tuniche-root">{children}</div>;
}
