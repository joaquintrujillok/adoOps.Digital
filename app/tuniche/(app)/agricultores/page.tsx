import Link from "next/link";
import { nombreArea } from "@/lib/tuniche/areas";
import { alcanceActual } from "@/lib/tuniche/auth.actions";
import { listarAgricultores } from "@/lib/tuniche/visitas";
import Demo from "@/components/tuniche/Demo";

export const dynamic = "force-dynamic";

export default async function Agricultores() {
  const alcance = await alcanceActual();
  const agricultores = await listarAgricultores(alcance);

  const sinContacto = agricultores.filter((a) => !a.telefono).length;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Agricultores
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          {agricultores.length} agricultores ·{" "}
          {agricultores.reduce((n, a) => n + a.lotes.length, 0)} lotes
        </p>
      </header>

      {/* Sin teléfono no hay a quién mandarle el informe, y ese es el último paso
          del flujo completo. Decirlo acá arriba y no en cada ficha: es un
          problema de la carga de datos, no de un agricultor en particular. */}
      {sinContacto > 0 && (
        <p
          className="rounded-lg border px-3.5 py-2.5 text-[13px]"
          style={{
            borderColor: "var(--tun-alerta)",
            background: "var(--tun-alerta-soft)",
            color: "var(--tun-alerta)",
          }}
        >
          <b>{sinContacto} de {agricultores.length} agricultores no tienen teléfono.</b>{" "}
          Ninguna de las dos planillas lo traía — MN mandó las columnas vacías y Altué
          venía anonimizada. Sin ese dato se puede registrar la visita, pero no
          enviarle el informe al agricultor.
        </p>
      )}

      <div className="space-y-3">
        {agricultores.map((a) => (
          <div key={a.id} className="tun-tarjeta p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {a.razonSocial}
                  </span>
                  {a.demo && <Demo />}
                </div>
                <div
                  className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]"
                  style={{ color: "var(--tun-ink-2)" }}
                >
                  <span>{nombreArea(a.area)}</span>
                  {a.localidad && <span>{a.localidad}</span>}
                  {a.distribuidor && <span title="Distribuidor">{a.distribuidor}</span>}
                  {a.zonalNombre && <span title="Zonal a cargo">Zonal: {a.zonalNombre}</span>}
                  <span style={{ color: a.telefono ? undefined : "var(--tun-alerta)" }}>
                    {a.telefono ? `+${a.telefono}` : "sin teléfono"}
                  </span>
                </div>
              </div>
              <span className="text-[13px]" style={{ color: "var(--tun-muted)" }}>
                {a.lotes.length} {a.lotes.length === 1 ? "lote" : "lotes"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {a.lotes.map((l) => (
                <Link
                  key={l.id}
                  href={`/tuniche/lotes/${l.id}`}
                  className="rounded-lg border px-3 py-2 text-[12.5px] transition hover:border-[var(--tun-brand)]"
                  style={{ borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }}
                >
                  <span className="font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {l.codigo}
                  </span>
                  {l.cultivo && <span className="ml-2">{l.cultivo}</span>}
                  {l.variedad && <span className="ml-1.5">{l.variedad}</span>}
                  {l.hectareas && <span className="ml-2">{l.hectareas} ha</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {agricultores.length === 0 && (
        <p className="text-[14px]" style={{ color: "var(--tun-muted)" }}>
          No hay agricultores en tu alcance. Si eres zonal, todavía no tienes ninguno
          asignado — pídeselo a quien administra el sistema.
        </p>
      )}
    </div>
  );
}
