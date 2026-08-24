import type { Metadata } from "next";
import "./dashboard360.css";

// Layout mínimo de Dashboard360. La autenticación y el shell viven en
// (app)/layout.tsx para que /dashboard360/login quede fuera de la barrera y no
// entre en un bucle de redirección consigo mismo.

export const metadata: Metadata = {
  title: "Dashboard360 · adoOps",
  description: "Panel de control de rendimiento comercial: ads, email y redes en una sola vista",
  robots: { index: false, follow: false },
};

export default function Dashboard360RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="d360-root">{children}</div>;
}
