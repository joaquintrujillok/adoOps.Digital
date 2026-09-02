import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { d360Fuentes, d360Informes } from "@/db/dashboard360";
import Nav, { type GrupoNav } from "@/components/dashboard360/Nav";
import { logoutAction, requireSession } from "@/lib/dashboard360/auth.actions";
import { disponible, emisoresConProblema, sinResponder } from "@/lib/dashboard360/motor";
import {
  disponible as contenidoDisponible,
  emisoresConProblema as perfilesConProblema,
} from "@/lib/dashboard360/contenido";
import {
  disponible as reunionesDisponible,
  sinResumen,
} from "@/lib/dashboard360/reuniones";
import { disponible as crmDisponible, frias } from "@/lib/venta/consultas";
import ChipModuloAuto from "@/components/ChipModuloAuto";
import SelectorCuenta from "@/components/dashboard360/SelectorCuenta";
import { resolverCuenta } from "@/lib/cuentas";
import { filtrarPorCuenta } from "@/lib/dashboard360/nav";

// Cada request revalida la sesión y los contadores del menú. Un tablero que
// dice "todo al día" cuando hay dos fuentes caídas es peor que no decir nada.
export const dynamic = "force-dynamic";

async function contadores() {
  const [problemas, borradores, hayMotor, hayContenido, hayReuniones, hayCrm] =
    await Promise.all([
    db
      .select({ id: d360Fuentes.id })
      .from(d360Fuentes)
      .where(inArray(d360Fuentes.estado, ["error", "pendiente"])),
    db
      .select({ id: d360Informes.id })
      .from(d360Informes)
      .where(eq(d360Informes.estado, "borrador")),
    disponible(),
    contenidoDisponible(),
    reunionesDisponible(),
    crmDisponible(),
  ]);

  // Los contadores del motor solo se piden si el motor existe. Encadenarlos en
  // el Promise.all de arriba costaba dos consultas fallidas por cada carga de
  // CUALQUIER pantalla del tablero mientras las tablas `lead_*` no estuvieran
  // creadas — y el tablero se despliega sin ellas a propósito.
  const [responder, emisores] = hayMotor
    ? await Promise.all([sinResponder(), emisoresConProblema()])
    : [0, 0];

  // Mismo cuidado que con el motor: la máquina de contenido puede no estar
  // desplegada, y preguntarle a sus tablas cuando no existen costaría una
  // consulta fallida por cada carga de CUALQUIER pantalla del tablero.
  const perfiles = hayContenido ? await perfilesConProblema() : 0;

  // Y lo mismo con las reuniones: el tablero se despliega sin las tablas
  // `reunion_*` y no debe pagar una consulta fallida por cada carga.
  const reunionesPendientes = hayReuniones ? await sinResumen() : 0;

  // Mismo cuidado: el badge del CRM es el número de oportunidades que llevan dos
  // semanas sin que nadie las toque, y no se pregunta si las tablas no existen.
  const crmFrias = hayCrm ? await frias() : 0;

  return {
    fuentes: problemas.length,
    informes: borradores.length,
    hayMotor,
    responder,
    emisores,
    hayContenido,
    perfiles,
    hayReuniones,
    reunionesPendientes,
    hayCrm,
    crmFrias,
  };
}

export default async function Dashboard360AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireSession();
  const {
    fuentes,
    informes,
    hayMotor,
    responder,
    emisores,
    hayContenido,
    perfiles,
    hayReuniones,
    reunionesPendientes,
    hayCrm,
    crmFrias,
  } = await contadores();

  const grupos: GrupoNav[] = [
    {
      titulo: "Rendimiento",
      items: [
        { href: "/dashboard360", etiqueta: "Panel 360", icono: "◉" },
        { href: "/dashboard360/canales", etiqueta: "Canales", icono: "▥" },
      ],
    },
    {
      // El CRM es su propio grupo y no una sección de Prospección.
      //
      // Estaban juntos porque el recorrido parecía uno solo: el motor consigue
      // conversaciones y el CRM las administra. Pero el pipeline de adoOps no
      // sale del motor —su origen principal es "Referido de Clases"—, así que
      // colgarlo de Prospección sugería una procedencia que los datos no tienen.
      //
      // Son además dos preguntas distintas: prospección es "¿a quién le hablo?"
      // y CRM es "¿cómo va lo que ya está hablado?". Van antes que Prospección
      // porque la segunda se hace todos los días y la primera, por tandas.
      //
      // El grupo entero desaparece cuando el CRM no está desplegado: los grupos
      // sin entradas se filtran en `filtrarPorCuenta`.
      titulo: "CRM",
      items: hayCrm
        ? [
            { href: "/dashboard360/crm", etiqueta: "Pipeline", icono: "⛁", badge: crmFrias },
            { href: "/dashboard360/crm/contactos", etiqueta: "Contactos", icono: "☰" },
          ]
        : [],
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
        // Las reuniones van en Dirección y no en Datos: no responden "¿hay algo
        // caído?" sino "¿en qué quedamos?". El badge cuenta las que llegaron
        // sin resumen, que es el único caso en que alguien tiene que hacer algo.
        ...(hayReuniones
          ? [
              {
                href: "/dashboard360/reuniones",
                etiqueta: "Reuniones",
                icono: "✎",
                badge: reunionesPendientes,
              },
              // La base del copiloto cuelga de Reuniones y no de Datos: se toca
              // cuando cambia lo que ofreces, no cuando algo se cae.
              {
                href: "/dashboard360/reuniones/conocimiento",
                etiqueta: "Base de conocimiento",
                icono: "◫",
              },
            ]
          : []),
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
        // Perfiles conectados cuelga del mismo grupo y por la misma razón que
        // Emisores: responde "¿va a salir lo que está programado?", que es la
        // versión de contenido de "¿hay algo caído?".
        ...(hayContenido
          ? [
              {
                href: "/dashboard360/contenido/emisores",
                etiqueta: "Perfiles conectados",
                icono: "◍",
                badge: perfiles,
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

  // El menú se arma completo arriba —con sus contadores y sus condiciones de
  // despliegue— y recién acá se recorta a lo que la cuenta activa tiene
  // encendido. Ver `lib/dashboard360/nav.ts`.
  const cuenta = resolverCuenta(sesion.cuenta, sesion.cuentas);
  const visibles = filtrarPorCuenta(grupos, cuenta);

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
          <SelectorCuenta activa={cuenta} permitidas={sesion.cuentas} />
          <Nav grupos={visibles} />
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
          {visibles
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
      <ChipModuloAuto />
    </div>
  );
}
