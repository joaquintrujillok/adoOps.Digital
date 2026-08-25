import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Informes } from "@/db/dashboard360";
import Nav, { type GrupoNav } from "@/components/dashboard360/Nav";
import { logoutAction, requireSession } from "@/lib/dashboard360/auth.actions";
import { disponible, emisoresConProblema, sinResponder } from "@/lib/dashboard360/motor";

// Cada request revalida la sesión y los contadores del menú. Un tablero que
// dice "todo al día" cuando hay dos fuentes caídas es peor que no decir nada.
export const dynamic = "force-dynamic";

async function contadores() {
  const [problemas, borradores, hayMotor, responder, emisores] = await Promise.all([
    db
      .select({ id: d360Fuentes.id })
      .from(d360Fuentes)
      .where(inArray(d360Fuentes.estado, ["error", "pendiente"])),
    db
      .select({ id: d360Informes.id })
      .from(d360Informes)
      .where(eq(d360Informes.estado, "borrador")),
    disponible(),
    sinResponder(),
    emisoresConProblema(),
  ]);
  return {
    fuentes: problemas.length,
    informes: borradores.length,
    hayMotor,
    responder,
    emisores,
  };
}

export default async function Dashboard360AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireSession();
  const { fuentes, informes, hayMotor, responder, emisores } = await contadores();

  const grupos: GrupoNav[] = [
    {
      titulo: "Rendimiento",
      items: [
        { href: "/dashboard360", etiqueta: "Panel 360", icono: "◉" },
        { href: "/dashboard360/canales", etiqueta: "Canales", icono: "▥" },
      ],
    },
    {
      // El mercado va antes que el informe: es el dato que enmarca todo lo
      // demás. Un costo por lead no significa nada sin saber de qué universo
      // salieron esos leads.
      //
      // El motor cuelga del mismo grupo porque es la continuación del mismo
      // recorrido —universo, señal, persona, conversación— y separarlo obligaba
      // a salir del tablero para operarlo.
      titulo: "Prospección",
      items: [
        { href: "/dashboard360/prospeccion", etiqueta: "Mercado", icono: "◎" },
        // El motor es un módulo aparte y puede no estar desplegado. Cuando no
        // está, estas entradas no se pintan: un menú con pestañas muertas es
        // peor que un menú corto, y el tablero se vende sin el motor.
        ...(hayMotor
          ? [
              { href: "/dashboard360/motor", etiqueta: "Despacho", icono: "▷" },
              {
                href: "/dashboard360/motor/senales",
                etiqueta: "Señales",
                icono: "◈",
              },
              {
                href: "/dashboard360/motor/prospectos",
                etiqueta: "Prospectos",
                icono: "⛁",
              },
            ]
          : []),
      ],
    },
    {
      titulo: "Dirección",
      items: [
        {
          href: "/dashboard360/informe",
          etiqueta: "Informe al directorio",
          icono: "▤",
          badge: informes,
        },
      ],
    },
    {
      // Emisores va acá y no en Prospección: es la misma pregunta que Fuentes
      // conectadas —¿está entrando y saliendo lo que debería, o hay algo
      // caído?—, y los dos badges son el mismo tipo de aviso.
      titulo: "Datos",
      items: [
        {
          href: "/dashboard360/fuentes",
          etiqueta: "Fuentes conectadas",
          icono: "⇄",
          badge: fuentes,
        },
        ...(hayMotor
          ? [
              {
                href: "/dashboard360/motor/emisores",
                etiqueta: "Emisores",
                icono: "◉",
                badge: emisores,
              },
            ]
          : []),
      ],
    },
  ];

  // El badge de la conversación que espera respuesta va en Despacho: es la
  // única cifra del menú que representa a una persona esperando, y por eso pesa
  // más que cualquier otra.
  if (responder > 0) {
    const despacho = grupos
      .flatMap((g) => g.items)
      .find((i) => i.href === "/dashboard360/motor");
    if (despacho) despacho.badge = responder;
  }

  return (
    <div className="flex min-h-screen">
      <aside className="d360-no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between bg-[var(--d360-sidebar)] px-3 py-5 lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Wordmark tipográfico y no el PNG de la marca, por una razón que se
              vio en pantalla: el logo de adoOps es navy oscuro sobre
              transparente —hecho para el fondo claro de la home— y sobre esta
              barra navy desaparece. Solo se distinguía el símbolo verde.
              El texto se controla y contrasta. */}
          <Link
            href="/dashboard360"
            className="mb-6 flex items-baseline gap-2 px-3 text-[19px] font-semibold lowercase tracking-[-0.02em] text-white"
          >
            <span>
              ado<span className="text-[var(--d360-accent)]">Ops</span>
            </span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7be9ae]">
              360
            </span>
          </Link>
          <Nav grupos={grupos} />
        </div>

        <div className="border-t border-white/10 pt-3">
          <div className="px-3 pb-2">
            <div className="truncate text-[13px] font-medium text-[#e6eef5]">
              {sesion.nombre}
            </div>
            <div className="text-[11px] capitalize text-[#55677a]">{sesion.rol}</div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="d360-nav-link w-full text-left">
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
        <div className="d360-no-print sticky top-0 z-20 flex items-center gap-3 overflow-x-auto border-b border-[var(--d360-grid)] bg-[var(--d360-sidebar)] px-4 py-2.5 lg:hidden">
          <Link
            href="/dashboard360"
            className="shrink-0 text-[15px] font-semibold lowercase tracking-[-0.02em] text-white"
          >
            ado<span className="text-[var(--d360-accent)]">Ops</span>
          </Link>
          {grupos
            .flatMap((g) => g.items)
            .map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="shrink-0 text-[13px] text-[#93a4b4] hover:text-white"
              >
                {it.etiqueta}
              </Link>
            ))}
        </div>

        <main className="mx-auto max-w-[1400px] px-5 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
