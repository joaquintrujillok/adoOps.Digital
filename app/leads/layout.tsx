import type { Metadata } from "next";
import "./leads.css";

// Layout raíz del motor de nurturing.
//
// Estilo propio de adoOps —verde, teal y navy medidos sobre su home—, no la
// paleta del CRM de Highend. Los tokens viven en leads.css.

export const metadata: Metadata = {
  title: "Motor de nurturing · adoOps",
  description: "Prospección multicanal con señal verificable",
  robots: { index: false, follow: false },
};

export default function LeadsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="leads-root">{children}</div>;
}
