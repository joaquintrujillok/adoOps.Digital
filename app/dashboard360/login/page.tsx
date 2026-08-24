import { redirect } from "next/navigation";
import LoginForm from "@/components/dashboard360/LoginForm";
import { getSession } from "@/lib/dashboard360/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Con sesión viva, la pantalla de login no tiene nada que ofrecer.
  if (await getSession()) redirect("/dashboard360");

  const { from } = await searchParams;
  const destino = from?.startsWith("/dashboard360") ? from : "/dashboard360";

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        {/* Wordmark tipográfico y no el PNG: el logo de adoOps está pensado
            para el hero oscuro de la home y sobre este fondo claro pierde peso.
            En la barra lateral, que sí es navy, se usa el PNG. */}
        <div className="mb-7 text-center">
          <div className="text-[22px] font-semibold lowercase tracking-[-0.02em] text-[var(--d360-ink)]">
            ado<span className="text-[var(--d360-brand)]">Ops</span>
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--d360-muted)]">
            Dashboard 360
          </div>
          <p className="mt-3 text-[13px] text-[var(--d360-ink-2)]">
            Ingresa con tu cuenta para entrar al panel de rendimiento.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-6 shadow-[0_1px_3px_rgba(11,21,35,0.06)]">
          <LoginForm from={destino} />
        </div>

        <p className="mt-5 text-center text-[12px] text-[var(--d360-muted)]">
          ¿Perdiste el acceso? Escríbele a quien administra la plataforma.
        </p>
      </div>
    </div>
  );
}
