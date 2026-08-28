import Link from "next/link";
import { AREAS, nombreArea, type AreaId } from "@/lib/tuniche/areas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { armarReporte, zonalesSinCuenta, type LoteEnReporte } from "@/lib/tuniche/reportes";
import { Barras, Embudo, Medidor, Punto } from "@/components/tuniche/Graficos";

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

function Fila({
  l,
  detalle,
  nivel,
}: {
  l: LoteEnReporte;
  detalle: string;
  nivel?: "ok" | "alerta" | "critico";
}) {
  return (
    <Link
      href={`/tuniche/lotes/${l.id}`}
      className="flex flex-wrap items-baseline justify-between gap-2 border-b px-1 py-2.5 last:border-0"
      style={{ borderColor: "var(--tun-border)" }}
    >
      <span className="flex min-w-0 items-center gap-2">
        {nivel && <Punto nivel={nivel} />}
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

      <div className="grid gap-3 lg:grid-cols-[1.1fr_2fr]">
        <Medidor
          pct={cobertura}
          titulo="Cobertura de lotes"
          detalle={`${conVisita} de ${r.lotes.length} lotes tienen al menos una visita registrada. Es la cifra que la prueba de concepto tiene que mover.`}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Cifra valor={r.visitasPeriodo} etiqueta={`Visitas en ${dias} días`} />
          <Cifra
            valor={r.notaPromedio == null ? "—" : `${r.notaPromedio}%`}
            etiqueta="Nota agronómica promedio"
            color={r.notaPromedio == null ? undefined : colorNota(r.notaPromedio)}
          />
          <Cifra
            valor={r.alertas.length}
            etiqueta="Lotes con alerta abierta"
            nota="según su última visita"
            color={r.alertas.length ? "var(--tun-critico)" : "var(--tun-ok)"}
          />
        </div>
      </div>

      {/* Lo que NO se hizo va antes que lo que sí: un tablero que solo muestra
          actividad deja invisible lo que se está quedando sin mirar, que es lo
          que duele. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {/* Barras y no una lista: la pregunta no es "cuáles están atrasados"
            sino "cuánto", y un largo responde eso de un vistazo mientras que una
            columna de números obliga a compararlos de a pares. */}
        <Barras
          titulo="Los que llevan más tiempo sin visita"
          nota={`Lotes cuya última visita validada es anterior a los ${dias} días.`}
          unidad="días"
          vacio="Ningún lote visitado se pasó del periodo."
          datos={r.atrasados.slice(0, 10).map((l) => ({
            id: l.id,
            etiqueta: l.codigo,
            sub: l.agricultor,
            valor: l.dias ?? 0,
            color:
              (l.dias ?? 0) >= 60
                ? "var(--viz-critico)"
                : (l.dias ?? 0) >= 30
                  ? "var(--viz-alerta)"
                  : "var(--viz-serie)",
            href: `/tuniche/lotes/${l.id}`,
          }))}
        />

        <Barras
          titulo="Actividad por zonal"
          nota="Por el zonal a cargo del campo, no por quién apretó el micrófono."
          unidad="visitas"
          vacio="Sin visitas en el periodo."
          datos={r.porZonal.map((z) => ({
            id: z.zonal,
            etiqueta: z.zonal,
            sub: `${z.lotes} lotes${z.nota != null ? ` · nota ${z.nota}%` : ""}`,
            valor: z.visitas,
          }))}
        />
      </div>

      {r.nuncaVisitados.length > 0 && (
        <section className="tun-tarjeta p-5">
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Nunca visitados ({r.nuncaVisitados.length} de {r.lotes.length})
          </h2>
          <p className="mt-1 mb-3 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            No llevan barra porque no hay magnitud que comparar: o tienen visitas o no.
            Es una lista, y la lista es el trabajo pendiente.
          </p>
          <div className="flex flex-wrap gap-2">
            {r.nuncaVisitados.map((l) => (
              <Link
                key={l.id}
                href={`/tuniche/lotes/${l.id}`}
                className="rounded-lg border px-2.5 py-1.5 text-[12.5px]"
                style={{ borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }}
                title={l.agricultor}
              >
                <b style={{ color: "var(--tun-brand)" }}>{l.codigo}</b>
              </Link>
            ))}
          </div>
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
              // Crítico si hay algo con problema declarado; alerta si es una
              // observación. El punto acompaña SIEMPRE al texto, nunca lo
              // reemplaza: es lo que hace que la lista se lea sin distinguir
              // colores, y el alivio que exige el naranja de marca.
              nivel={
                l.riego === "crítico" || l.sanidad === "con problema" || l.malezas === "alta"
                  ? "critico"
                  : "alerta"
              }
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

      <div className="grid gap-3">
        <Embudo
          titulo="Del campo al agricultor"
          nota="Dónde se detiene lo que debería salir. Los tres pasos comparten escala: lo que interesa no es cuánto mide cada uno, sino dónde se cae."
          pasos={[
            { etiqueta: "Informes generados", valor: r.informes.generados },
            { etiqueta: "Con visto bueno", valor: r.informes.conVistoBueno },
            { etiqueta: "Enviados al agricultor", valor: r.informes.enviados },
          ]}
        />
      </div>

      {r.sinInforme > 0 && (
        <p className="text-[13px]" style={{ color: "var(--tun-alerta)" }}>
          {r.sinInforme} {r.sinInforme === 1 ? "visita validada" : "visitas validadas"} del
          periodo todavía sin informe generado.
        </p>
      )}

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
