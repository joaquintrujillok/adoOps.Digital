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
        {/* Wordmark tipográfico y no el PNG del logo, por una razón práctica:
            el archivo de la marca es claro sobre transparente —hecho para el
            hero oscuro de su sitio— y sobre este fondo blanco desaparecería.
            En la barra lateral, que sí es negra, se usa el PNG. */}
        <div className="mb-7 text-center">
          <div className="text-[22px] font-semibold uppercase tracking-[0.18em] text-[var(--crm-ink)]">
            High<span className="text-[var(--crm-brand)]">end</span>
          </div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--crm-muted)]">
            Chile · CRM
          </div>
          <p className="mt-3 text-[13px] text-[var(--crm-ink-2)]">
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
