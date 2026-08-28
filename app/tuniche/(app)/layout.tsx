import Link from "next/link";
import Nav, { type ItemNav } from "@/components/tuniche/Nav";
import CambioDeClave from "@/components/tuniche/CambioDeClave";
import { logoutAction, requireSesion } from "@/lib/tuniche/auth.actions";
import { nombreArea } from "@/lib/tuniche/areas";
import { puedeGestionarUsuarios } from "@/lib/tuniche/session";

// Sin caché: `requireSesion()` contrasta la cookie contra la base en cada
// carga, así que un cambio de rol —o una cuenta desactivada— se aplica en la
// siguiente pantalla y no doce horas después. Cachear este layout guardaría el
// menú de un rol y se lo mostraría a otro.
export const dynamic = "force-dynamic";

const ROL_VISIBLE: Record<string, string> = {
  admin: "Administrador",
  jefe: "Jefe de área",
  zonal: "Zonal",
};

export default async function TunicheAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await requireSesion();

  // Visitas va primero después de Inicio porque es la pantalla que se abre
  // todos los días: es la bandeja de lo que llegó por WhatsApp y espera un OK.
  // Agricultores se consulta; Visitas se opera.
  const items: ItemNav[] = [
    { href: "/tuniche", etiqueta: "Inicio", icono: "◉" },
    { href: "/tuniche/visitas", etiqueta: "Visitas", icono: "◈" },
    { href: "/tuniche/informes", etiqueta: "Informes", icono: "▤" },
    { href: "/tuniche/sabana", etiqueta: "Sábana", icono: "▦" },
    { href: "/tuniche/reportes", etiqueta: "Reportes", icono: "◐" },
    { href: "/tuniche/agricultores", etiqueta: "Agricultores", icono: "⛁" },
    ...(puedeGestionarUsuarios(sesion)
      ? [{ href: "/tuniche/usuarios", etiqueta: "Usuarios", icono: "◇" }]
      : []),
    { href: "/tuniche/cuenta", etiqueta: "Mi cuenta", icono: "⚙" },
  ];

  // Clave dictada por un administrador: no se entra a ninguna pantalla hasta
  // cambiarla. Se resuelve **acá**, reemplazando el contenido, y no con un
  // redirect a /tuniche/cuenta: esa pantalla vive dentro de este mismo layout y
  // el redirect sería un bucle. Reemplazar el contenido además cierra la puerta
  // entera —no hay ruta del módulo que se salte este layout—, que es lo que un
  // redirect por pantalla no garantiza.
  const contenido = sesion.debeCambiarClave ? (
    <div className="mx-auto max-w-[440px] py-8">
      <h1 className="text-[20px] font-semibold" style={{ color: "var(--tun-ink)" }}>
        Elige tu contraseña
      </h1>
      <p className="mt-1 mb-5 text-[13.5px]" style={{ color: "var(--tun-ink-2)" }}>
        Es el último paso antes de entrar.
      </p>
      <div className="tun-tarjeta p-6">
        <CambioDeClave obligatorio />
      </div>
    </div>
  ) : (
    children
  );

  return (
    <div className="flex min-h-screen">
      <aside
        className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col justify-between px-3 py-5 lg:flex"
        style={{ background: "var(--tun-sidebar)" }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Link href="/tuniche" className="mb-6 block px-3">
            <span className="block text-[17px] font-semibold tracking-[-0.02em] text-white">
              Tuniche
            </span>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[0.2em] text-[#8aa393]">
              Visitas a campo
            </span>
          </Link>
          {/* Con la clave por cambiar, el menú no se pinta: ofrecer destinos a
              los que no se puede ir es una promesa que la aplicación no cumple. */}
          {!sesion.debeCambiarClave && <Nav items={items} />}
        </div>

        <div className="border-t border-white/10 pt-3">
          <div className="px-3 pb-2">
            <div className="truncate text-[13px] font-medium text-[#e4ede7]">
              {sesion.nombre}
            </div>
            <div className="text-[11px] text-[#7e948a]">
              {ROL_VISIBLE[sesion.rol] ?? sesion.rol} · {nombreArea(sesion.area)}
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="tun-nav-link w-full text-left">
              <span aria-hidden className="w-4 text-center">
                ⎋
              </span>
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barra de teléfono. Es la vista que más se va a usar en terreno, así
            que lleva los mismos destinos y el nombre de quien está conectado:
            en un teléfono compartido en una camioneta, saber a nombre de quién
            se está cargando una visita no es un detalle. */}
        <div
          className="sticky top-0 z-20 flex items-center gap-3 overflow-x-auto px-4 py-2.5 lg:hidden"
          style={{ background: "var(--tun-sidebar)" }}
        >
          <Link href="/tuniche" className="shrink-0 text-[15px] font-semibold text-white">
            Tuniche
          </Link>
          {!sesion.debeCambiarClave &&
            items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="shrink-0 text-[13px] text-[#9db3a6] hover:text-white"
              >
                {it.etiqueta}
              </Link>
            ))}
          <span className="ml-auto shrink-0 text-[12px] text-[#7e948a]">
            {sesion.nombre}
          </span>
        </div>

        <main className="mx-auto max-w-[1200px] px-5 py-7 lg:px-8">{contenido}</main>
      </div>
    </div>
  );
}
