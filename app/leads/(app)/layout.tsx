import Link from "next/link";
import { requireSession } from "@/lib/crm/auth.actions";

// Cada request revalida la sesión. Un motor que dice "0 pendientes" cuando hay
// 40 esperando es peor que no decir nada.
export const dynamic = "force-dynamic";

const SECCIONES = [
  { href: "/leads", etiqueta: "Motor" },
  { href: "/leads/prospectos", etiqueta: "Prospectos" },
  { href: "/leads/cargar", etiqueta: "Cargar" },
];

export default async function LeadsAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireSession();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--leads-border)] bg-[var(--leads-navy)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3.5">
          <Link href="/leads" className="flex items-center gap-2">
            <span className="leads-punto" aria-hidden />
            <span
              className="text-[15px] font-semibold tracking-tight text-white"
              style={{ fontFamily: "var(--font-sora), sans-serif" }}
            >
              ado<span className="text-[var(--leads-accent)]">Ops</span>
              <span className="ml-2 font-normal text-[#9db0bf]">nurturing</span>
            </span>
          </Link>

          <nav className="flex items-center gap-5">
            {SECCIONES.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="text-[13px] text-[#9db0bf] transition-colors hover:text-[var(--leads-accent)]"
              >
                {s.etiqueta}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-[13px] text-[#5c7184]">
            <Link href="/crm" className="transition-colors hover:text-[#9db0bf]">
              CRM
            </Link>
            <span className="text-[#9db0bf]">{sesion.nombre}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-9">{children}</main>
    </div>
  );
}
