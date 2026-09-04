import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import CafecitoPerfil from "@/components/CafecitoPerfil";
import { db } from "@/db";
import { cafecitoSuscriptores } from "@/db/schema";

// Nada de esto se cachea ni se indexa: es una página personal por token.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirma tu suscripción — Cafecito IA",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: "#0E1D33", background: "#F6F8F9", minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <Link href="/cafecito-ia">
            <Image src="/logo.png" alt="adoOps" width={116} height={35} style={{ objectFit: "contain" }} priority />
          </Link>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E9EEF1", borderRadius: 16, padding: "32px 32px 28px", boxShadow: "0 10px 40px rgba(14,29,51,0.06)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default async function Confirmar({ params }: Props) {
  const { token } = await params;

  const [s] = await db
    .select()
    .from(cafecitoSuscriptores)
    .where(eq(cafecitoSuscriptores.tokenConfirmacion, token))
    .limit(1);

  if (!s) {
    return (
      <Marco>
        <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Este enlace no es válido
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: "0 0 22px" }}>
          Puede que ya lo hayas usado o que esté incompleto. Vuelve a suscribirte
          y te mandamos uno nuevo.
        </p>
        <a href="/cafecito-ia#suscribirse" style={{ display: "inline-flex", background: "#20C463", color: "#06281A", fontSize: 15, fontWeight: 600, padding: "13px 26px", borderRadius: 10, textDecoration: "none" }}>
          Ir a suscribirme
        </a>
      </Marco>
    );
  }

  const vencido =
    s.estado === "pendiente" && s.confirmacionExpiraEn && s.confirmacionExpiraEn < new Date();

  if (vencido) {
    return (
      <Marco>
        <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          El enlace venció
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: "0 0 22px" }}>
          Los enlaces de confirmación duran 7 días. Vuelve a dejar tu correo y te
          llega uno nuevo al instante.
        </p>
        <a href="/cafecito-ia#suscribirse" style={{ display: "inline-flex", background: "#20C463", color: "#06281A", fontSize: 15, fontWeight: 600, padding: "13px 26px", borderRadius: 10, textDecoration: "none" }}>
          Pedir otro enlace
        </a>
      </Marco>
    );
  }

  const yaConfirmado = s.estado === "confirmado";

  return (
    <Marco>
      <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 700, fontSize: 26, margin: "0 0 9px", letterSpacing: "-0.025em", lineHeight: 1.25 }}>
        {yaConfirmado ? "Ajusta tu cafecito" : "¿Cómo lo tomas?"}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: "0 0 26px" }}>
        {yaConfirmado
          ? "Ya estás suscrito. Desde acá puedes cambiar de taza o corregir tus datos cuando quieras."
          : "Correo confirmado. Ahora elige el tamaño de tu taza y cuéntanos brevemente a qué te dedicas, para afinar lo que te llega."}
      </p>

      <CafecitoPerfil
        token={token}
        tazaActual={s.taza}
        datos={{ nombre: s.nombre, empresa: s.empresa, rol: s.rol, telefono: s.telefono }}
      />
    </Marco>
  );
}
