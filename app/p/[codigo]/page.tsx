import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Marco from "@/components/pulso/Marco";
import { sesionPorCodigo } from "@/lib/pulso/datos";
import Participante from "./Participante";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pulso IA · adoOps",
  description: "Cinco preguntas, un minuto: el mapa de la IA en esta sala.",
  robots: { index: false, follow: false },
};

/** Lo que abre el QR de la charla: adoops.digital/p/CODIGO. */
export default async function PaginaParticipante({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const s = await sesionPorCodigo(codigo);
  if (!s) notFound();

  return (
    <Marco>
      <header className="nav">
        <div className="wrap">
          <span className="brand"><Image src="/logo.png" alt="adoOps" width={110} height={32} priority /></span>
          <span className="eyebrow" style={{ fontSize: 11 }}>Pulso IA</span>
        </div>
      </header>
      <Participante
        codigo={s.codigo}
        organizacion={s.organizacion}
        relator={s.relator}
        faseInicial={s.fase as "inicio" | "cierre" | "cerrada"}
      />
    </Marco>
  );
}
