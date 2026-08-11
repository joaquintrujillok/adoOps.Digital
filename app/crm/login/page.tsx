import { redirect } from "next/navigation";
import LoginForm from "@/components/crm/LoginForm";
import { getSession } from "@/lib/crm/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // Con sesión viva, la pantalla de login no tiene nada que ofrecer.
  if (await getSession()) redirect("/crm");

  const { from } = await searchParams;
  const destino = from?.startsWith("/crm") ? from : "/crm";

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <div className="text-[22px] font-semibold text-[var(--crm-ink)]">
            ado<span className="text-[var(--crm-brand)]">Ops</span>{" "}
            <span className="font-normal text-[var(--crm-ink-2)]">CRM</span>
          </div>
          <p className="mt-1.5 text-[13px] text-[var(--crm-ink-2)]">
            Ingresa con tu cuenta para entrar al CRM comercial.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-6 shadow-[0_1px_3px_rgba(11,11,11,0.06)]">
          <LoginForm from={destino} />
        </div>

        <p className="mt-5 text-center text-[12px] text-[var(--crm-muted)]">
          ¿Perdiste el acceso? Escríbele a quien administra la plataforma.
        </p>
      </div>
    </div>
  );
}
