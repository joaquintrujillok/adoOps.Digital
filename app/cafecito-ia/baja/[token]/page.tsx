import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import CafecitoBaja from "@/components/CafecitoBaja";
import { db } from "@/db";
import { cafecitoSuscriptores } from "@/db/schema";
import Sitio from "../../../_web/Sitio";

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
    <Sitio foco>
      <main id="top" className="cf-foco">
        <div className="cf-tarjeta">
          {!s ? (
            <>
              <h1>Este enlace no es válido</h1>
              <p className="cf-txt" style={{ margin: 0 }}>
                Puede estar incompleto. Escríbenos a{" "}
                <a href="mailto:hola@adoops.digital">hola@adoops.digital</a>{" "}
                y te damos de baja a mano.
              </p>
            </>
          ) : s.estado === "baja" ? (
            <>
              <h1>Ya estabas dado de baja</h1>
              <p className="cf-txt" style={{ margin: 0 }}>
                No te estamos escribiendo a {enmascarar(s.email)}.
              </p>
            </>
          ) : (
            <CafecitoBaja token={token} email={enmascarar(s.email)} />
          )}
        </div>
      </main>
    </Sitio>
  );
}
