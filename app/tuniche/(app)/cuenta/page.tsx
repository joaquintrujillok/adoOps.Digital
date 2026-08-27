import { eq } from "drizzle-orm";
import CambioDeClave from "@/components/tuniche/CambioDeClave";
import { db } from "@/db";
import { tunicheUsuarios } from "@/db/tuniche";
import { AREAS, nombreArea } from "@/lib/tuniche/areas";
import { requireSesion } from "@/lib/tuniche/auth.actions";
import { guardarAreaAudioAction } from "@/lib/tuniche/usuarios.actions";

export const dynamic = "force-dynamic";

const ROL_VISIBLE: Record<string, string> = {
  admin: "Administrador",
  jefe: "Jefe de área",
  zonal: "Zonal",
};

function telefonoVisible(t: string | null): string | null {
  if (!t) return null;
  if (/^569\d{8}$/.test(t)) return `+56 9 ${t.slice(3, 7)} ${t.slice(7)}`;
  return `+${t}`;
}

export default async function MiCuenta() {
  const s = await requireSesion();
  const [u] = await db
    .select({ telefono: tunicheUsuarios.telefono, areaAudio: tunicheUsuarios.areaAudio })
    .from(tunicheUsuarios)
    .where(eq(tunicheUsuarios.id, s.userId))
    .limit(1);

  const tel = telefonoVisible(u?.telefono ?? null);

  return (
    <div className="max-w-[560px] space-y-6">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Mi cuenta
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          {s.nombre} · @{s.username} · {ROL_VISIBLE[s.rol] ?? s.rol} · {nombreArea(s.area)}
        </p>
      </header>

      <section className="tun-tarjeta p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--tun-muted)" }}
        >
          Tu WhatsApp
        </h2>
        {tel ? (
          <>
            <p className="mt-2 text-[16px] font-semibold" style={{ color: "var(--tun-ink)" }}>
              {tel}
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
              Los audios que mandes desde este número entran a tu nombre. Desde otro
              número, el sistema no sabe quién habla y los rechaza.
            </p>
          </>
        ) : (
          <p
            className="mt-2 rounded-lg border px-3 py-2 text-[13px]"
            style={{
              borderColor: "var(--tun-alerta)",
              background: "var(--tun-alerta-soft)",
              color: "var(--tun-alerta)",
            }}
          >
            No tienes teléfono registrado. Sin él no puedes mandar visitas por WhatsApp.
            Pídeselo a quien administra el sistema.
          </p>
        )}

        {/* Solo para admin: no tiene área y un audio sin área no tiene plantilla. */}
        {s.rol === "admin" && (
          <form action={guardarAreaAudioAction} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label htmlFor="areaAudio" className="tun-etiqueta">
                Área desde la que pruebas
              </label>
              <select
                id="areaAudio"
                name="areaAudio"
                defaultValue={u?.areaAudio ?? ""}
                className="tun-campo"
              >
                <option value="">Sin elegir</option>
                {AREAS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
                Como administrador no tienes área: ves las dos. Pero un audio necesita
                una para saber qué preguntas aplican. Elige desde cuál estás probando.
              </p>
            </div>
            <button type="submit" className="tun-boton-suave">
              Guardar
            </button>
          </form>
        )}
      </section>

      <p className="text-[13px]" style={{ color: "var(--tun-muted)" }}>
        Tu rol y tu área los define quien administra el sistema. Si algo de arriba está
        mal, pídeselo a esa persona.
      </p>

      <div className="tun-tarjeta p-6">
        <h2 className="mb-4 text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Cambiar contraseña
        </h2>
        <CambioDeClave />
      </div>
    </div>
  );
}
