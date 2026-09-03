import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import CafecitoBaja from "@/components/CafecitoBaja";
import { db } from "@/db";
import { cafecitoSuscriptores } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dar de baja — Cafecito IA",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

/** Muestra `jo•••@empresa.cl`: confirma la dirección sin exponerla entera. */
function enmascarar(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(2, u.length - 2))}@${d}`;
}

export default async function Baja({ params }: Props) {
  const { token } = await params;

  const [s] = await db
    .select({ email: cafecitoSuscriptores.email, estado: cafecitoSuscriptores.estado })
    .from(cafecitoSuscriptores)
    .where(eq(cafecitoSuscriptores.tokenBaja, token))
    .limit(1);

  return (
    <div style={{ fontFamily: "var(--font-inter), Inter, sans-serif", color: "#0E1D33", background: "#F6F8F9", minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <Link href="/cafecito-ia">
            <Image src="/logo.png" alt="adoOps" width={116} height={35} style={{ objectFit: "contain" }} priority />
          </Link>
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #E9EEF1", borderRadius: 16, padding: "32px 32px 28px", boxShadow: "0 10px 40px rgba(14,29,51,0.06)" }}>
          {!s ? (
            <>
              <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                Este enlace no es válido
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: 0 }}>
                Puede estar incompleto. Escríbenos a{" "}
                <a href="mailto:hola@adoops.digital" style={{ color: "#0B7A4B" }}>hola@adoops.digital</a>{" "}
                y te damos de baja a mano.
              </p>
            </>
          ) : s.estado === "baja" ? (
            <>
              <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                Ya estabas dado de baja
              </h1>
              <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: 0 }}>
                No te estamos escribiendo a {enmascarar(s.email)}.
              </p>
            </>
          ) : (
            <CafecitoBaja token={token} email={enmascarar(s.email)} />
          )}
        </div>
      </div>
    </div>
  );
}
