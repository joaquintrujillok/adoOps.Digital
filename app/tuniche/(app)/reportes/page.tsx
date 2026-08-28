import Link from "next/link";
import { AREAS, nombreArea, type AreaId } from "@/lib/tuniche/areas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { armarReporte, zonalesSinCuenta, type LoteEnReporte } from "@/lib/tuniche/reportes";

export const dynamic = "force-dynamic";

const PERIODOS = [
  { dias: 30, etiqueta: "30 días" },
  { dias: 60, etiqueta: "60 días" },
  { dias: 90, etiqueta: "90 días" },
];

function colorNota(n: number): string {
  if (n >= 80) return "var(--tun-ok)";
  if (n >= 60) return "var(--tun-alerta)";
  return "var(--tun-critico)";
}

function Cifra({
  valor,
  etiqueta,
  nota,
  color,
}: {
  valor: string | number;
  etiqueta: string;
  nota?: string;
  color?: string;
}) {
  return (
    <div className="tun-tarjeta p-5">
      <div
        className="text-[28px] font-semibold leading-none"
        style={{ color: color ?? "var(--tun-ink)" }}
      >
        {valor}
      </div>
      <div className="mt-2 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
        {etiqueta}
      </div>
      {nota && (
        <div className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
          {nota}
        </div>
      )}
    </div>
  );
}

function Fila({ l, detalle }: { l: LoteEnReporte; detalle: string }) {
  return (
    <Link
      href={`/tuniche/lotes/${l.id}`}
      className="flex flex-wrap items-baseline justify-between gap-2 border-b px-1 py-2.5 last:border-0"
      style={{ borderColor: "var(--tun-border)" }}
    >
      <span className="min-w-0">
        <span className="text-[13.5px] font-semibold" style={{ color: "var(--tun-brand)" }}>
          {l.codigo}
        </span>
        {l.demo && (
          <span className="ml-1.5 text-[9.5px] font-bold uppercase" style={{ color: "var(--tun-alerta)" }}>
            demo
          </span>
        )}
        <span className="ml-2 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
          {l.agricultor}
        </span>
        {l.zonal && (
          <span className="ml-2 text-[12px]" style={{ color: "var(--tun-muted)" }}>
            {l.zonal}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[12.5px]" style={{ color: "var(--tun-alerta)" }}>
        {detalle}
      </span>
    </Link>
  );
}

export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; dias?: string }>;
}) {
  const s = await requireSesion();
  const alcance = await alcanceActual();
  const sp = await searchParams;

  const disponibles = s.area ? AREAS.filter((a) => a.id === s.area) : AREAS;
  const area = (sp.area && disponibles.some((a) => a.id === sp.area)
    ? sp.area
    : disponibles[0].id) as AreaId;
  const dias = PERIODOS.some((p) => String(p.dias) === sp.dias) ? Number(sp.dias) : 30;

  const [r, sinCuenta] = await Promise.all([
    armarReporte(area, alcance, dias),
    zonalesSinCuenta(area),
  ]);

  const conVisita = r.lotes.length - r.nuncaVisitados.length;
  const cobertura = r.lotes.length ? Math.round((conVisita / r.lotes.length) * 100) : 0;

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Reportes
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Cómo va la operación hacia adentro. No son los informes que salen al
          agricultor: esto responde <b>qué se está quedando sin mirar</b>.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {disponibles.length > 1 &&
          disponibles.map((a) => (
            <Link
              key={a.id}
              href={`/tuniche/reportes?area=${a.id}&dias=${dias}`}
              className="rounded-lg border px-3.5 py-2 text-[13px] font-medium"
              style={
                a.id === area
                  ? { borderColor: "var(--tun-brand)", background: "var(--tun-brand-soft)", color: "var(--tun-brand-dark)" }
                  : { borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }
              }
            >
              {a.nombre}
            </Link>
          ))}
        {PERIODOS.map((p) => (
          <Link
            key={p.dias}
            href={`/tuniche/reportes?area=${area}&dias=${p.dias}`}
            className="rounded-lg border px-3.5 py-2 text-[13px] font-medium"
            style={
              p.dias === dias
                ? { borderColor: "var(--tun-brand)", background: "var(--tun-brand-soft)", color: "var(--tun-brand-dark)" }
                : { borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }
            }
          >
            Últimos {p.etiqueta}
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* La cobertura va primero porque es la cifra que la POC tiene que
            mover: hoy la mitad de las visitas no queda registrada en ninguna
            parte. Es el antes y después que se puede demostrar. */}
        <Cifra
          valor={`${cobertura}%`}
          etiqueta="Cobertura de lotes"
          nota={`${conVisita} de ${r.lotes.length} tienen al menos una visita`}
          color={cobertura >= 80 ? "var(--tun-ok)" : cobertura >= 50 ? "var(--tun-alerta)" : "var(--tun-critico)"}
        />
        <Cifra valor={r.visitasPeriodo} etiqueta={`Visitas en ${dias} días`} />
        <Cifra
          valor={r.notaPromedio == null ? "—" : `${r.notaPromedio}%`}
          etiqueta="Nota agronómica promedio"
          color={r.notaPromedio == null ? undefined : colorNota(r.notaPromedio)}
        />
        <Cifra
          valor={r.alertas.length}
          etiqueta="Lotes con alerta abierta"
          nota="riego, malezas o sanidad en la última visita"
          color={r.alertas.length ? "var(--tun-critico)" : "var(--tun-ok)"}
        />
      </div>

      {/* Lo que NO se hizo va antes que lo que sí: un tablero que solo muestra
          actividad deja invisible lo que se está quedando sin mirar, que es lo
          que duele. */}
      {(r.nuncaVisitados.length > 0 || r.atrasados.length > 0) && (
        <section className="tun-tarjeta p-5">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Lo que se está quedando sin visitar
          </h2>
          {r.atrasados.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-[12px] uppercase tracking-[0.08em]" style={{ color: "var(--tun-muted)" }}>
                Sin visita en los últimos {dias} días ({r.atrasados.length})
              </div>
              {r.atrasados.slice(0, 12).map((l) => (
                <Fila key={l.id} l={l} detalle={`hace ${l.dias} días`} />
              ))}
              {r.atrasados.length > 12 && (
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
                  y {r.atrasados.length - 12} más.
                </p>
              )}
            </div>
          )}
          {r.nuncaVisitados.length > 0 && (
            <div className="mt-5">
              <div className="mb-1 text-[12px] uppercase tracking-[0.08em]" style={{ color: "var(--tun-muted)" }}>
                Nunca visitados ({r.nuncaVisitados.length})
              </div>
              {r.nuncaVisitados.slice(0, 12).map((l) => (
                <Fila key={l.id} l={l} detalle="sin ninguna visita" />
              ))}
              {r.nuncaVisitados.length > 12 && (
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
                  y {r.nuncaVisitados.length - 12} más.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {r.alertas.length > 0 && (
        <section className="tun-tarjeta p-5">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Alertas abiertas
          </h2>
          <p className="mt-1 mb-3 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            Según la <b>última</b> visita de cada lote. Un problema que se arregló en la
            visita siguiente deja de aparecer: una lista que acumula lo ya resuelto enseña
            a ignorarla.
          </p>
          {r.alertas.map((l) => (
            <Fila
              key={l.id}
              l={l}
              detalle={[
                l.riego && l.riego !== "bien" ? `riego ${l.riego}` : null,
                l.malezas === "alta" ? "malezas alta" : null,
                l.sanidad && l.sanidad !== "sano" ? `sanidad ${l.sanidad}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </section>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="tun-tarjeta p-5">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Actividad por zonal
          </h2>
          <p className="mt-1 mb-3 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            Por el zonal a cargo del campo, no por quién apretó el micrófono: es la
            pregunta de gestión.
          </p>
          {r.porZonal.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--tun-muted)" }}>
              Sin datos en el periodo.
            </p>
          ) : (
            r.porZonal.map((z) => (
              <div
                key={z.zonal}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b py-2.5 last:border-0"
                style={{ borderColor: "var(--tun-border)" }}
              >
                <span className="text-[13.5px]" style={{ color: "var(--tun-ink)" }}>
                  {z.zonal}
                </span>
                <span className="text-[12.5px]" style={{ color: "var(--tun-ink-2)" }}>
                  {z.visitas} {z.visitas === 1 ? "visita" : "visitas"} · {z.lotes} lotes
                  {z.nota != null && (
                    <b className="ml-2" style={{ color: colorNota(z.nota) }}>
                      {z.nota}%
                    </b>
                  )}
                </span>
              </div>
            ))
          )}
        </section>

        <section className="tun-tarjeta p-5">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Del campo al agricultor
          </h2>
          <p className="mt-1 mb-3 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            Dónde se está deteniendo lo que debería salir.
          </p>
          {[
            ["Informes generados", r.informes.generados, null],
            ["Con visto bueno", r.informes.conVistoBueno, r.informes.generados],
            ["Enviados al agricultor", r.informes.enviados, r.informes.generados],
          ].map(([etiqueta, valor, total]) => (
            <div
              key={etiqueta as string}
              className="flex items-baseline justify-between border-b py-2.5 last:border-0"
              style={{ borderColor: "var(--tun-border)" }}
            >
              <span className="text-[13.5px]" style={{ color: "var(--tun-ink-2)" }}>
                {etiqueta as string}
              </span>
              <span className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
                {valor as number}
                {total ? (
                  <span className="ml-1 text-[12px] font-normal" style={{ color: "var(--tun-muted)" }}>
                    de {total as number}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
          {r.sinInforme > 0 && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--tun-alerta)" }}>
              {r.sinInforme} {r.sinInforme === 1 ? "visita validada" : "visitas validadas"} del
              periodo todavía sin informe generado.
            </p>
          )}
        </section>
      </div>

      {sinCuenta.length > 0 && (
        <section
          className="rounded-lg border p-5"
          style={{
            borderColor: "var(--tun-alerta)",
            background: "var(--tun-alerta-soft)",
            color: "var(--tun-alerta)",
          }}
        >
          <h2 className="text-[14px] font-semibold">Zonales sin cuenta con teléfono</h2>
          <p className="mt-2 text-[13px]">
            {sinCuenta.join(", ")}. Tienen agricultores asignados en {nombreArea(area)} pero
            no pueden mandar audios: el número es la identidad del sistema, y sin él sus
            mensajes no se atribuyen a nadie.
          </p>
        </section>
      )}
    </div>
  );
}
