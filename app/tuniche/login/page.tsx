import { redirect } from "next/navigation";
import LoginForm from "@/components/tuniche/LoginForm";
import { sesionVigente } from "@/lib/tuniche/auth.actions";

export const dynamic = "force-dynamic";

export default async function LoginTuniche({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Con sesión viva, esta pantalla no tiene nada que ofrecer.
  //
  // Se pregunta por la sesión **vigente** y no por la cookie: alguien a quien
  // acaban de desactivar todavía tiene una cookie firmada y válida, y creerle
  // acá lo mandaría de vuelta al sistema, que a su vez lo mandaría al login.
  // Ese es el rebote infinito, y el único lugar donde se corta es este.
  if (await sesionVigente()) redirect("/tuniche");

  const { from } = await searchParams;
  const destino = from?.startsWith("/tuniche") ? from : "/tuniche";

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <div
            className="text-[24px] font-semibold tracking-[-0.02em]"
            style={{ color: "var(--tun-ink)" }}
          >
            Semillas <span style={{ color: "var(--tun-brand)" }}>Tuniche</span>
          </div>
          <div
            className="mt-1 text-[11px] font-medium uppercase tracking-[0.28em]"
            style={{ color: "var(--tun-muted)" }}
          >
            Visitas a campo
          </div>
          <p className="mt-3 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
            Entra con tu cuenta para ver tus agricultores y sus visitas.
          </p>
        </div>

        <div className="tun-tarjeta p-6">
          <LoginForm from={destino} />
        </div>

        <p className="mt-5 text-center text-[12px]" style={{ color: "var(--tun-muted)" }}>
          ¿Sin acceso o clave perdida? Pídesela a quien administra el sistema: puede
          generarte una nueva.
        </p>
      </div>
    </div>
  );
}
