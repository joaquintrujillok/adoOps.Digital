import Link from "next/link";
import FormularioUsuario from "@/components/tuniche/FormularioUsuario";
import ResetClave from "@/components/tuniche/ResetClave";
import { nombreArea } from "@/lib/tuniche/areas";
import { requireSesion } from "@/lib/tuniche/auth.actions";
import { puedeGestionarUsuarios } from "@/lib/tuniche/session";
import { listarUsuarios } from "@/lib/tuniche/usuarios";
import { alternarActivoAction } from "@/lib/tuniche/usuarios.actions";

export const dynamic = "force-dynamic";

const ROL_VISIBLE: Record<string, string> = {
  admin: "Administrador",
  jefe: "Jefe de área",
  zonal: "Zonal",
};

function fecha(d: Date | null): string {
  if (!d) return "Nunca entró";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function telefonoVisible(t: string | null): string {
  if (!t) return "—";
  // 56912345678 → +56 9 1234 5678. Se formatea solo el móvil chileno, que es el
  // caso real; cualquier otro se muestra tal cual antes que mal partido.
  if (/^569\d{8}$/.test(t)) return `+56 9 ${t.slice(3, 7)} ${t.slice(7)}`;
  return `+${t}`;
}

export default async function UsuariosTuniche() {
  const admin = await requireSesion();

  // Una pantalla que no corresponde se **explica**, no se rompe. Las acciones
  // de este módulo sí lanzan (`requireAdmin`), y ahí está bien: quien llega a
  // una acción sin permiso está saltándose la interfaz. Pero un zonal que
  // escribe la URL a mano no está atacando nada, y una pantalla de error 500 le
  // haría creer que el sistema se cayó.
  if (!puedeGestionarUsuarios(admin)) {
    return (
      <div className="max-w-[520px] space-y-3">
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Esta pantalla no te corresponde
        </h1>
        <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Las cuentas las administra quien tiene rol de administrador. Si necesitas
          crear un acceso o cambiar el de alguien, pídeselo a esa persona.
        </p>
        <Link
          href="/tuniche"
          className="inline-block text-[14px] font-medium"
          style={{ color: "var(--tun-brand)" }}
        >
          ← Volver al inicio
        </Link>
      </div>
    );
  }

  const usuarios = await listarUsuarios();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Usuarios
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Quién entra, con qué rol y sobre qué área. Las cuentas no se borran: se
          desactivan, porque sus visitas quedan firmadas con su nombre.
        </p>
      </header>

      <details className="tun-tarjeta p-5">
        <summary
          className="cursor-pointer text-[14px] font-semibold"
          style={{ color: "var(--tun-brand)" }}
        >
          + Crear cuenta
        </summary>
        <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--tun-border)" }}>
          <FormularioUsuario />
        </div>
      </details>

      <div className="space-y-3">
        {usuarios.map((u) => (
          <div key={u.id} className="tun-tarjeta p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {u.nombre}
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--tun-muted)" }}>
                    @{u.username}
                  </span>
                  {!u.activo && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: "var(--tun-critico-soft)",
                        color: "var(--tun-critico)",
                      }}
                    >
                      Desactivada
                    </span>
                  )}
                  {u.recibeInformes && u.activo && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: "var(--tun-brand-soft)", color: "var(--tun-brand-dark)" }}
                      title="Los informes aprobados de su área le llegan por WhatsApp para que los reenvíe."
                    >
                      Recibe los informes
                    </span>
                  )}
                  {u.debeCambiarClave && u.activo && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: "var(--tun-alerta-soft)",
                        color: "var(--tun-alerta)",
                      }}
                      title="La clave se la dictó un administrador. Tiene que cambiarla al entrar."
                    >
                      Clave por cambiar
                    </span>
                  )}
                </div>

                <div
                  className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
                  style={{ color: "var(--tun-ink-2)" }}
                >
                  <span>{ROL_VISIBLE[u.rol] ?? u.rol}</span>
                  <span>{nombreArea(u.area)}</span>
                  <span
                    title={
                      u.telefono
                        ? "Número desde el que se le atribuyen los audios de WhatsApp"
                        : "Sin teléfono, sus audios de WhatsApp no se pueden atribuir"
                    }
                    style={!u.telefono && u.activo ? { color: "var(--tun-alerta)" } : undefined}
                  >
                    {telefonoVisible(u.telefono)}
                  </span>
                  <span style={{ color: "var(--tun-muted)" }}>{fecha(u.ultimoIngreso)}</span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <ResetClave id={u.id} nombre={u.nombre} />
                <form action={alternarActivoAction}>
                  <input type="hidden" name="id" value={u.id} />
                  <button
                    type="submit"
                    className="tun-boton-suave"
                    // El propio administrador no se puede dejar afuera. La
                    // acción lo vuelve a comprobar en el servidor; esto es para
                    // que el botón no prometa algo que va a fallar.
                    disabled={u.id === admin.userId}
                    title={
                      u.id === admin.userId
                        ? "No puedes desactivar tu propia cuenta"
                        : undefined
                    }
                  >
                    {u.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              </div>
            </div>

            <details className="mt-4">
              <summary
                className="cursor-pointer text-[13px] font-medium"
                style={{ color: "var(--tun-brand)" }}
              >
                Editar
              </summary>
              <div
                className="mt-4 border-t pt-4"
                style={{ borderColor: "var(--tun-border)" }}
              >
                <FormularioUsuario
                  valores={{
                    id: u.id,
                    username: u.username,
                    nombre: u.nombre,
                    email: u.email,
                    telefono: u.telefono,
                    rol: u.rol,
                    area: u.area,
                    recibeInformes: u.recibeInformes,
                  }}
                />
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
