import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { crmAlerts, crmWaMessages } from "@/db/crm";
import Nav, { type GrupoNav } from "@/components/crm/Nav";
import { logoutAction, requireSession } from "@/lib/crm/auth.actions";
import { leer, CLAVES } from "@/lib/crm/settings";

// Cada request revalida la sesión y los contadores del menú; un CRM que muestra
// "3 alertas" cuando hay 11 es peor que no mostrar el número.
export const dynamic = "force-dynamic";

async function contadores() {
  const [alertas, porRevisar] = await Promise.all([
    db.select({ id: crmAlerts.id }).from(crmAlerts).where(eq(crmAlerts.estado, "abierta")),
    db
      .select({ id: crmWaMessages.id })
      .from(crmWaMessages)
      .where(
        and(
          eq(crmWaMessages.direccion, "out"),
          inArray(crmWaMessages.estado, ["draft", "retenido", "failed"]),
        ),
      ),
  ]);
  return { alertas: alertas.length, whatsapp: porRevisar.length };
}

export default async function CrmAppLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  /**
   * Slot paralelo de los modales. Lo llenan las rutas interceptoras de
   * `@modal/`; en cualquier otra ruta resuelve a `@modal/default.tsx`, que no
   * pinta nada.
   */
  modal: React.ReactNode;
}) {
  const sesion = await requireSession();
  const [{ alertas, whatsapp }, empresa] = await Promise.all([
    contadores(),
    leer(CLAVES.empresa),
  ]);

  const grupos: GrupoNav[] = [
    {
      titulo: "Día a día",
      items: [
        { href: "/crm", etiqueta: "Visión general", icono: "◉" },
        { href: "/crm/contactos", etiqueta: "Contactos", icono: "▣" },
        { href: "/crm/conversaciones", etiqueta: "Conversaciones", icono: "✆", badge: whatsapp },
        { href: "/crm/cotizaciones", etiqueta: "Cotizaciones", icono: "▤" },
        { href: "/crm/oportunidades", etiqueta: "Oportunidades", icono: "◆" },
      ],
    },
    {
      titulo: "Análisis",
      items: [
        { href: "/crm/pipeline", etiqueta: "Pipeline y KPIs", icono: "▥" },
        { href: "/crm/reportes", etiqueta: "Reportes", icono: "▦" },
        { href: "/crm/inteligencia", etiqueta: "Alertas y acciones", icono: "◈", badge: alertas },
        { href: "/crm/segmentos", etiqueta: "Segmentos y recompra", icono: "◍" },
        { href: "/crm/marketing", etiqueta: "Marketing y origen", icono: "◎" },
      ],
    },
    {
      titulo: "Catálogo y ajustes",
      items: [
        { href: "/crm/productos", etiqueta: "Catálogo e inventario", icono: "◇" },
        { href: "/crm/configuracion", etiqueta: "Configuración", icono: "⚙" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="crm-no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-[var(--crm-sidebar)] px-3 py-5 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Link href="/crm" className="mb-6 flex items-center gap-2 px-3">
            <span className="text-[17px] font-semibold text-white">
              ado<span className="text-[#2bdc6e]">Ops</span>
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9aa3ad]">
              CRM
            </span>
          </Link>
          <Nav grupos={grupos} />
        </div>

        <div className="border-t border-white/10 pt-3">
          <div className="px-3 pb-2">
            <div className="truncate text-[13px] font-medium text-[#e8ecf1]">
              {sesion.nombre}
            </div>
            <div className="text-[11px] capitalize text-[#5c6672]">
              {sesion.rol} · {empresa}
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="crm-nav-link w-full text-left">
              <span aria-hidden className="w-4 text-center">
                ⎋
              </span>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Navegación de pantalla chica: barra superior con los módulos en scroll. */}
      <div className="min-w-0 flex-1">
        <div className="crm-no-print sticky top-0 z-20 flex items-center gap-3 overflow-x-auto border-b border-[var(--crm-grid)] bg-[var(--crm-sidebar)] px-4 py-2.5 lg:hidden">
          <Link href="/crm" className="shrink-0 text-[15px] font-semibold text-white">
            ado<span className="text-[#2bdc6e]">Ops</span>
          </Link>
          {grupos
            .flatMap((g) => g.items)
            .map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="shrink-0 text-[13px] text-[#9aa3ad] hover:text-white"
              >
                {it.etiqueta}
              </Link>
            ))}
        </div>

        <main className="mx-auto max-w-[1400px] px-5 py-7 lg:px-8">{children}</main>
      </div>
      {modal}
    </div>
  );
}
