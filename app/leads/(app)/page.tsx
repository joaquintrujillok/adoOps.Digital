import Link from "next/link";
import { PageHeader, btnPrimario } from "@/components/crm/ui";
import { numero } from "@/lib/crm/formato";
import { bloqueos, embudo, ETAPAS } from "@/lib/leads/embudo";

export const dynamic = "force-dynamic";

export default async function Motor() {
  const [e, lista] = await Promise.all([embudo(), bloqueos()]);

  const listos = lista.filter((b) => b.listo).length;
  const siguiente = lista.find((b) => !b.listo);
  const enMarcha = Object.values(e.porEtapa).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        titulo="Motor de nurturing"
        bajada="Una máquina de estados por prospecto. Cada día decide a quién le toca, qué se le dice y por cuál canal, tomando siempre el más barato disponible. Ningún primer contacto sale sin una señal verificable."
      />

      {/* ── Lo primero es qué falta, no el embudo. Un embudo vacío no dice por
          qué está vacío, y eso es exactamente lo que hay que saber hoy. ── */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--leads-ink)]">
            Para poder mandar el primer mensaje
          </h2>
          <span className="text-[13px] text-[var(--leads-muted)]">
            {listos} de {lista.length} listos
          </span>
        </div>

        <ol className="grid gap-px overflow-hidden rounded-xl border border-[var(--leads-border)] bg-[var(--leads-grid)]">
          {lista.map((b, i) => (
            <li
              key={b.titulo}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-[var(--leads-surface)] px-4 py-3.5"
            >
              <span
                className="leads-punto shrink-0"
                data-apagado={!b.listo}
                aria-hidden
              />
              <span className="w-6 shrink-0 text-[13px] tabular-nums text-[var(--leads-muted)]">
                {i + 1}
              </span>
              <span className="min-w-[11rem] text-sm font-medium text-[var(--leads-ink)]">
                {b.titulo}
              </span>
              <span className="flex-1 text-[13px] text-[var(--leads-ink-2)]">{b.detalle}</span>
              {b.listo ? (
                <span className="text-[12px] font-medium text-[var(--leads-brand)]">listo</span>
              ) : b.href ? (
                <Link
                  href={b.href}
                  className="text-[12px] font-medium text-[var(--leads-brand)] hover:underline"
                >
                  {b.accion}
                </Link>
              ) : (
                <span className="text-[12px] text-[var(--leads-muted)]">{b.accion}</span>
              )}
            </li>
          ))}
        </ol>

        {siguiente && (
          <p className="mt-3 text-[13px] text-[var(--leads-ink-2)]">
            <span className="font-medium text-[var(--leads-ink)]">Lo siguiente:</span>{" "}
            {siguiente.accion}. Los pasos van en orden de dependencia — sin dominio no hay
            email, sin email no hay a quién escribirle, sin señal el mensaje no tiene qué decir.
          </p>
        )}
      </section>

      {/* ── El embudo ── */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-[var(--leads-ink)]">El recorrido</h2>
          <Link href="/leads/prospectos" className="text-[13px] text-[var(--leads-brand)] hover:underline">
            Ver los {numero(e.base)} prospectos
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="leads-etapa" data-viva={e.base > 0}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--leads-muted)]">
              En la base
            </div>
            <div className="text-2xl font-semibold tabular-nums text-[var(--leads-ink)]">
              {numero(e.base)}
            </div>
            <div className="text-[13px] text-[var(--leads-ink-2)]">
              {numero(e.alcanzables)} con email o perfil de LinkedIn
            </div>
          </div>

          {ETAPAS.map((etapa) => (
            <div key={etapa.id} className="leads-etapa" data-viva={e.porEtapa[etapa.id] > 0}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--leads-muted)]">
                {etapa.nombre}
              </div>
              <div className="text-2xl font-semibold tabular-nums text-[var(--leads-ink)]">
                {numero(e.porEtapa[etapa.id])}
              </div>
              <div className="text-[13px] text-[var(--leads-ink-2)]">{etapa.que}</div>
            </div>
          ))}
        </div>

        {enMarcha === 0 && (
          <p className="mt-5 rounded-lg border border-dashed border-[var(--leads-axis)] px-4 py-3 text-[13px] text-[var(--leads-ink-2)]">
            Todavía no hay nadie en el recorrido, y está bien: el motor no inscribe a nadie
            hasta que exista una campaña con un emisor y una señal. Los ceros de arriba no son
            un error, son el estado real.
            {e.suprimidos > 0 && ` ${numero(e.suprimidos)} persona(s) suprimida(s).`}
          </p>
        )}
      </section>

      <div className="mt-10 flex gap-3">
        <Link href="/leads/cargar" className={btnPrimario}>
          Cargar prospectos
        </Link>
      </div>
    </>
  );
}
