import Link from "next/link";
import { notFound } from "next/navigation";
import Entrevista from "@/components/gia/Entrevista";
import { EMPRESA, invitadoPorCodigo } from "@/lib/gia/semilla";

export const dynamic = "force-dynamic";

/** El link personal de la entrevista: /gia/e/CODIGO. El link dice quién es la persona. */
export default async function EntrevistaPersonal({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const invitado = invitadoPorCodigo(codigo);
  if (!invitado) notFound();

  return (
    <div className="gia-oscuro">
      <div className="contenedor">
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href="/gia" className="sora" style={{ textDecoration: "none", fontWeight: 600, fontSize: 16 }}>
            ← adoOps · Entrevista de levantamiento
          </Link>
          <span className="tenue small">{EMPRESA.nombre} (demo)</span>
        </header>
        <Entrevista invitado={invitado} />
      </div>
    </div>
  );
}
