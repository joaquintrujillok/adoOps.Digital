import Link from "next/link";
import { notFound } from "next/navigation";
import { nombreArea } from "@/lib/tuniche/areas";
import { VISITA, etapaPorId, etapasDe } from "@/lib/tuniche/plantillas";
import { alcanceActual } from "@/lib/tuniche/auth.actions";
import { fotosDe, historialDeLote, loteConAgricultor } from "@/lib/tuniche/visitas";
import type { AreaId } from "@/lib/tuniche/areas";

export const dynamic = "force-dynamic";

function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** El color de la nota. Es lo único que se lee de un vistazo en el historial. */
function colorNota(n: number): string {
  if (n >= 80) return "var(--tun-ok)";
  if (n >= 60) return "var(--tun-alerta)";
  return "var(--tun-critico)";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--tun-muted)" }}>
        {etiqueta}
      </div>
      <div className="mt-0.5 text-[14px]" style={{ color: "var(--tun-ink)" }}>
        {valor}
      </div>
    </div>
  );
}

export default async function LoteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const alcance = await alcanceActual();
  const encontrado = await loteConAgricultor(Number(id), alcance);
  // notFound() y no un mensaje de permisos: si el lote no está en el alcance de
  // esta persona, decirle "no te corresponde" ya le confirmaría que existe.
  if (!encontrado) notFound();

  const { lote, agricultor } = encontrado;
  const [historial, etapas] = await Promise.all([
    historialDeLote(lote.id),
    Promise.resolve(etapasDe(lote.area as AreaId)),
  ]);

  const fotosPorVisita = await Promise.all(historial.map((v) => fotosDe(v.id)));
  const hitos = (lote.hitos ?? {}) as Record<string, unknown>;
  const etapaActual = lote.etapaActual ? etapaPorId(lote.area as AreaId, lote.etapaActual) : null;

  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/tuniche/agricultores"
          className="text-[13px]"
          style={{ color: "var(--tun-brand)" }}
        >
          ← Agricultores
        </Link>
        <h1 className="mt-2 text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          {lote.codigo}
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          {agricultor.razonSocial}
          {agricultor.localidad ? ` · ${agricultor.localidad}` : ""} · {nombreArea(lote.area)}
        </p>
      </header>

      {/* Capa 1 · lo que viene precargado y el zonal no escribe */}
      <section className="tun-tarjeta p-5">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {lote.temporada && <Dato etiqueta="Temporada" valor={lote.temporada} />}
          {lote.cultivo && <Dato etiqueta="Cultivo" valor={lote.cultivo} />}
          {lote.variedad && <Dato etiqueta="Variedad" valor={lote.variedad} />}
          {lote.relacionHm && <Dato etiqueta="Relación H:M" valor={lote.relacionHm} />}
          {lote.hectareas && <Dato etiqueta="Superficie" valor={`${lote.hectareas} ha`} />}
          {lote.objetivo && <Dato etiqueta="Objetivo" valor={lote.objetivo} />}
          {lote.tipoSemilla && <Dato etiqueta="Tipo de semilla" valor={lote.tipoSemilla} />}
          {lote.idase && <Dato etiqueta="N° IDASE" valor={lote.idase} />}
          {lote.clienteFinal && <Dato etiqueta="Cliente" valor={lote.clienteFinal} />}
          {etapaActual && <Dato etiqueta="Etapa actual" valor={etapaActual.nombre} />}
        </div>
      </section>

      {/* Capa 3 · los hitos. Solo las etapas que tienen algo cargado: una lista
          de nueve etapas vacías no informa, solo hace scroll. */}
      {etapas.some((e) => e.campos.some((c) => hitos[c.id] != null)) && (
        <section className="tun-tarjeta p-5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--tun-muted)" }}
          >
            Hitos del ciclo
          </h2>
          <div className="mt-4 space-y-5">
            {etapas
              .filter((e) => e.campos.some((c) => hitos[c.id] != null))
              .map((e) => (
                <div key={e.id}>
                  <div className="mb-2 text-[13px] font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {e.nombre}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {e.campos
                      .filter((c) => hitos[c.id] != null)
                      .map((c) => (
                        <Dato key={c.id} etiqueta={c.etiqueta} valor={String(hitos[c.id])} />
                      ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Capa 2 · el historial. Es el "mira, esta es la trazabilidad de tu campo". */}
      <section>
        <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Historial de visitas
        </h2>

        {historial.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--tun-muted)" }}>
            Todavía no hay visitas validadas en este lote. Las visitas aparecen acá
            recién después de que el zonal confirma lo que el sistema entendió de su
            audio.
          </p>
        ) : (
          <div className="space-y-3">
            {historial.map((v, i) => (
              <div key={v.id} className="tun-tarjeta p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium" style={{ color: "var(--tun-ink)" }}>
                    {fecha(v.fecha)}
                    {v.etapa ? ` · ${v.etapa}` : ""}
                  </span>
                  {v.notaAgronomica != null && (
                    <span
                      className="text-[18px] font-semibold"
                      style={{ color: colorNota(v.notaAgronomica) }}
                      title="Nota agronómica"
                    >
                      {v.notaAgronomica}%
                    </span>
                  )}
                </div>

                {v.resumen && (
                  <p className="mt-2 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
                    {v.resumen}
                  </p>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {VISITA.filter(
                    (c) => c.id !== "etapa" && c.tipo !== "fotos" && c.id !== "nota_agronomica",
                  ).map((c) => {
                    const val = (v.datos as Record<string, unknown>)?.[c.id];
                    if (val == null || (Array.isArray(val) && !val.length)) return null;
                    return (
                      <Dato
                        key={c.id}
                        etiqueta={c.etiqueta}
                        valor={Array.isArray(val) ? val.join("; ") : String(val)}
                      />
                    );
                  })}
                </div>

                {fotosPorVisita[i].length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {fotosPorVisita[i].map((f) => (
                      <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.url}
                          alt={f.tipo}
                          className="h-24 w-24 rounded-lg object-cover"
                          style={{ border: "1px solid var(--tun-border)" }}
                        />
                      </a>
                    ))}
                  </div>
                )}

                {v.transcripcion && (
                  <details className="mt-3">
                    <summary
                      className="cursor-pointer text-[12.5px]"
                      style={{ color: "var(--tun-brand)" }}
                    >
                      Lo que dijo el zonal
                    </summary>
                    {/* El audio original queda a la vista a propósito: cuando alguien
                        dude de un campo, la respuesta no es "lo dijo la IA", es la
                        frase textual. */}
                    <p
                      className="mt-2 whitespace-pre-wrap rounded-lg p-3 text-[13px]"
                      style={{ background: "var(--tun-plane)", color: "var(--tun-ink-2)" }}
                    >
                      {v.transcripcion}
                    </p>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
