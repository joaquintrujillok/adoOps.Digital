import Link from "next/link";
import { Badge, Card, Lectura, PageHeader, StatTile, Vacio } from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import MoverEtapa from "@/components/crm/MoverEtapa";
import { ColumnaSoltable, TarjetaArrastrable } from "@/components/crm/ArrastreEtapa";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, numero, porcentaje } from "@/lib/crm/formato";
import { tablero } from "@/lib/crm/pipeline";
import { scoresDeDeals } from "@/lib/crm/scoring";
import { ownerScope, veTodo } from "@/lib/crm/session";

export const dynamic = "force-dynamic";

/**
 * La fila de actividad de la tarjeta.
 *
 * Los tipos son los que el CRM registra de verdad —`crm_activities.tipo`— y no
 * los de la captura de referencia. Un ícono de "documento" que siempre marca
 * cero porque el sistema nunca escribe ese tipo es peor que no tener el ícono:
 * enseña a ignorar la fila entera.
 *
 * Solo se pintan los que tienen algo. Cinco íconos en gris con cero al lado son
 * ruido en una tarjeta que se lee de reojo.
 */
const TIPOS_ACTIVIDAD = [
  { tipo: "nota", icono: "✎", nombre: "notas" },
  { tipo: "llamada", icono: "✆", nombre: "llamadas" },
  { tipo: "email", icono: "✉", nombre: "correos" },
  { tipo: "reunion", icono: "◍", nombre: "reuniones" },
  { tipo: "tarea", icono: "☑", nombre: "tareas" },
] as const;

function IconosActividad({ conteos }: { conteos: Record<string, number> }) {
  const conAlgo = TIPOS_ACTIVIDAD.filter((t) => (conteos[t.tipo] ?? 0) > 0);
  if (conAlgo.length === 0) {
    return (
      <div className="mt-2 text-[12px] text-[var(--crm-muted)]">Sin actividad</div>
    );
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--crm-ink-2)]">
      {conAlgo.map((t) => (
        <span
          key={t.tipo}
          className="inline-flex items-center gap-1"
          title={`${conteos[t.tipo]} ${t.nombre}`}
        >
          <span aria-hidden>{t.icono}</span>
          <span className="crm-num">{conteos[t.tipo]}</span>
          <span className="sr-only">{t.nombre}</span>
        </span>
      ))}
    </div>
  );
}

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
        bajada="El tablero completo del pipeline. Arrastra una tarjeta a otra columna, o usa su selector. Cualquiera de las dos deja registro en la bitácora."
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
          <Lectura
            titulo="Lo que hay que mirar"
            resumen={`${estancadas.length} sin actividad hace más de dos semanas · ${clp(estancadas.reduce((s, d) => s + d.monto, 0))}`}
          >
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
            {/* El encabezado dice la etapa con su probabilidad, y debajo cuántas
                y cuánto. Ver "Propuesta (50%)" arriba de la columna hace que el
                ponderado deje de ser un número que aparece de la nada. */}
            <div className="mb-2.5 rounded-lg bg-[#f0f1f3] px-3 py-2">
              <h2 className="text-[13px] font-semibold text-[var(--crm-ink)]">
                {col.nombre}{" "}
                <span className="crm-num font-normal text-[var(--crm-ink-2)]">
                  ({porcentaje(col.probabilidad)})
                </span>
              </h2>
              <div className="crm-num mt-0.5 text-[12px] text-[var(--crm-ink-2)]">
                {numero(col.deals.length)}{" "}
                {col.deals.length === 1 ? "oportunidad" : "oportunidades"} ·{" "}
                {clpCorto(col.total)}
                <span className="ml-1.5 text-[11px] text-[var(--crm-muted)]">
                  pond. {clpCorto(col.ponderado)}
                </span>
              </div>
            </div>

            <ColumnaSoltable etapa={col.etapa}>
            <div className="space-y-2.5">
              {col.deals.length === 0 && (
                <div className="rounded-lg border border-dashed border-[var(--crm-axis)] px-4 py-6 text-center text-[13px] text-[var(--crm-muted)]">
                  Vacía
                </div>
              )}

              {col.deals.map((d) => {
                const salud = scores.get(d.id);
                return (
                  <TarjetaArrastrable key={d.id} dealId={d.id} etapa={d.etapa}>
                  <article
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

                    <IconosActividad conteos={d.actividades} />

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
                  </TarjetaArrastrable>
                );
              })}
            </div>
            </ColumnaSoltable>
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
