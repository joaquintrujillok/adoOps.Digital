import { redirect } from "next/navigation";
import LoginForm from "@/components/vanni/LoginForm";
import { sesionVigente } from "@/lib/vanni/auth.actions";

export const dynamic = "force-dynamic";

export default async function LoginVanni({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  if (await sesionVigente()) redirect("/vanni");
  const { from } = await searchParams;
  const destino = from?.startsWith("/vanni") && !from.startsWith("/vanni/pagar") ? from : "/vanni";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="vn-display" style={{ fontSize: 30, fontWeight: 600 }}>Vanni</div>
          <div style={{ marginTop: 4, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--vn-teal)", fontWeight: 600 }}>
            Reactivación y tienda WhatsApp
          </div>
        </div>
        <div className="vn-card">
          <LoginForm from={destino} />
        </div>
        <p style={{ marginTop: 16, textAlign: "center", fontSize: 13, color: "var(--vn-muted)" }}>
          ¿Sin acceso? Pídele una cuenta a quien administra el backoffice.
        </p>
      </div>
    </div>
  );
}
