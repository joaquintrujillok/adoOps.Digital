import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./vanni.css";

// Layout raíz de Vanni: fuentes y tokens. La sesión y la navegación viven en
// `(app)/layout.tsx`, para que /vanni/login y /vanni/pagar queden fuera de la
// barrera (el login no puede exigir sesión, y el pago lo abre un cliente final).

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-vn-display", display: "swap" });
const cuerpo = DM_Sans({ subsets: ["latin"], variable: "--font-vn-body", display: "swap" });

export const metadata: Metadata = {
  title: "Vanni · Reactivación y tienda WhatsApp",
  description: "Backoffice del piloto de reactivación de clientes y de la tienda por WhatsApp de Vanni Chile.",
  robots: { index: false, follow: false },
};

export default function VanniRootLayout({ children }: { children: React.ReactNode }) {
  return <div className={`vanni-root ${display.variable} ${cuerpo.variable}`}>{children}</div>;
}
