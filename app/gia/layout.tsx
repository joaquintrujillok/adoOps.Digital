import type { Metadata } from "next";
import ChipModulo from "@/components/ChipModulo";
import "@/components/gia/gia.css";

// Gobierno y adopción de IA: el levantamiento por voz del CoE as a Service.
// Es un demo que se abre por link en una reunión; ver la fila "gia" en
// `lib/modulos.ts` para qué datos hay adentro.

export const metadata: Metadata = {
  title: "Gobierno y adopción de IA · adoOps",
  description: "Levantamiento por voz, perfil de adopción y hoja de ruta del CoE de IA.",
  robots: { index: false, follow: false },
};

export default function LayoutGia({ children }: { children: React.ReactNode }) {
  return (
    <div className="gia">
      {children}
      <ChipModulo id="gia" />
    </div>
  );
}
