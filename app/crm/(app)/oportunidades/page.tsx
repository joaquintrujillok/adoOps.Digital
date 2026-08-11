import Link from "next/link";
import { Badge, Card, Lectura, PageHeader, StatTile, Vacio } from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import MoverEtapa from "@/components/crm/MoverEtapa";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, numero, porcentaje } from "@/lib/crm/formato";
import { tablero } from "@/lib/crm/pipeline";
import { scoresDeDeals } from "@/lib/crm/scoring";
import { ownerScope, veTodo } from "@/lib/crm/session";

export const dynamic = "force-dynamic";

export default async function Oportunidades({
  searchParams,
}: {
  searchParams: Promise<{ mias?: string }>;
}) {
  const sesion = await requireSession();
  const { mias } = await searchParams;

  // Gerencia ve todo por defecto y puede filtrar a lo suyo; un vendedor solo ve
  // su cartera y el filtro no le cambia nada.
  const alcance = mias === "1" ? sesion.userId : ownerScope(sesion);

  const [columnas, scores] = await Promise.all([tablero(alcance), scoresDeDeals()]);

  const totalAbierto = columnas.reduce((s, c) => s + c.total, 0);
  const totalPonderado = columnas.reduce((s, c) => s + c.ponderado, 0);
  const totalDeals = columnas.reduce((s, c) => s + c.deals.length, 0);
  const estancadas = columnas
    .flatMap((c) => c.deals)
    .filter((d) => (d.diasSinTocar ?? 0) >= 14);

  return (
    <>
      <PageHeader
        titulo="Oportunidades"
        bajada="El tablero completo del pipeline. Cambiar la etapa deja registro automático en la bitácora de la cuenta."
        acciones={
          veTodo(sesion) ? (
            <div className="flex rounded-lg border border-[var(--crm-border)] bg-white p-0.5 text-[13px]">
              <Link
                href="/crm/oportunidades"
                className={`rounded-md px-3 py-1.5 ${mias !== "1" ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]" : "text-[var(--crm-ink-2)]"}`}
              >
                Todo el equipo
              </Link>
              <Link
                href="/crm/oportunidades?mias=1"
                className={`rounded-md px-3 py-1.5 ${mias === "1" ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]" : "text-[var(--crm-ink-2)]"}`}
              >
                Solo mías
              </Link>
            </div>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Pipeline abierto" valor={clp(totalAbierto)} contexto={`${numero(totalDeals)} oportunidades`} />
        <StatTile
          etiqueta="Proyección ponderada"
          valor={clp(totalPonderado)}
          contexto="corregido por probabilidad de cada etapa"
        />
        <StatTile
          etiqueta="En negociación"
          valor={clp(columnas.find((c) => c.etapa === "negociacion")?.total ?? 0)}
          contexto={`${columnas.find((c) => c.etapa === "negociacion")?.deals.length ?? 0} negocios`}
        />
        <StatTile
          etiqueta="Estancadas"
          valor={numero(estancadas.length)}
          contexto="14 días o más sin actividad"
          deltaBueno="abajo"
        />
      </div>

      {estancadas.length > 0 && (
        <div className="mb-6">
          <Lectura titulo="Lo que hay que mirar">
            <p>
              {estancadas.length} de {totalDeals} oportunidades llevan más de dos semanas
              sin una actividad registrada, y suman{" "}
              <strong>{clp(estancadas.reduce((s, d) => s + d.monto, 0))}</strong>. La más
              grande es &ldquo;{estancadas.sort((a, b) => b.monto - a.monto)[0].titulo}
              &rdquo; de {estancadas[0].cliente}.
            </p>
          </Lectura>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {columnas.map((col) => (
          <section key={col.etapa} className="min-w-0">
            <div className="mb-2.5 px-1">
              <h2 className="text-[14px] font-semibold text-[var(--crm-ink)]">
                {col.nombre}
                <span className="ml-2 text-[12px] font-normal text-[var(--crm-muted)]">
                  {col.deals.length}
                </span>
              </h2>
              <div className="crm-num text-[12px] text-[var(--crm-ink-2)]">
                {clpCorto(col.total)}
                <span className="ml-2 text-[11px] text-[var(--crm-muted)]">
                  pond. {clpCorto(col.ponderado)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {col.deals.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--crm-axis)] px-4 py-6 text-center text-[13px] text-[var(--crm-muted)]">
                  Vacía
                </div>
              )}

              {col.deals.map((d) => {
                const salud = scores.get(d.id);
                return (
                  <article
                    key={d.id}
                    className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3.5 shadow-[0_1px_2px_rgba(11,11,11,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/crm/oportunidades/${d.id}`}
                        className="text-[14px] font-medium leading-snug text-[var(--crm-ink)] hover:text-[var(--crm-brand-dark)]"
                      >
                        {d.titulo}
                      </Link>
                      {salud && <Medidor score={salud.score} tamano={38} />}
                    </div>

                    <Link
                      href={`/crm/contactos/${d.contactId}`}
                      className="mt-1 block text-[13px] text-[var(--crm-ink-2)] hover:underline"
                    >
                      {d.cliente}
                    </Link>

                    <div className="crm-num mt-2 text-[15px] font-semibold text-[var(--crm-ink)]">
                      {clp(d.monto)}
                      <span className="ml-2 text-[12px] font-normal text-[var(--crm-muted)]">
                        {porcentaje(d.probabilidad)}
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <MoverEtapa dealId={d.id} etapa={d.etapa} compacto />
                      {(d.diasSinTocar ?? 0) >= 14 && (
                        <Badge tono="serio" icono="◆">
                          {d.diasSinTocar} días sin tocar
                        </Badge>
                      )}
                      {!d.owner && (
                        <Badge tono="alerta" icono="!">
                          Sin dueño
                        </Badge>
                      )}
                    </div>

                    {d.owner && (
                      <div className="mt-2 text-[12px] text-[var(--crm-muted)]">
                        {d.owner}
                        {d.fuente ? ` · ${d.fuente}` : ""}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {totalDeals === 0 && (
        <Card>
          <Vacio
            mensaje="No hay oportunidades abiertas"
            sugerencia="Carga la base de demostración para ver el tablero con datos."
          />
        </Card>
      )}
    </>
  );
}
