import Link from "next/link";
import Entrevista from "@/components/gia/Entrevista";
import { EMPRESA } from "@/lib/gia/semilla";

export const dynamic = "force-dynamic";

export default function PaginaEntrevista() {
  return (
    <div className="gia-oscuro">
      <div className="contenedor">
        <header style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <Link href="/gia" className="sora" style={{ textDecoration: "none", fontWeight: 600, fontSize: 16 }}>
            ← adoOps · Entrevista de levantamiento
          </Link>
          <span className="tenue small">{EMPRESA.nombre} (demo)</span>
        </header>
        <Entrevista />
      </div>
    </div>
  );
}
