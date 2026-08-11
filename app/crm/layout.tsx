import type { Metadata } from "next";
import "./crm.css";

// Layout mínimo del CRM. La autenticación y el shell viven en (app)/layout.tsx
// para que /crm/login quede fuera de la barrera y no entre en un bucle de
// redirección consigo mismo.

export const metadata: Metadata = {
  title: "CRM · adoOps",
  description: "CRM comercial de adoOps",
  robots: { index: false, follow: false },
};

export default function CrmRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="crm-root">{children}</div>;
}
