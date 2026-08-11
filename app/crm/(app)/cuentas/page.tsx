import Link from "next/link";
import { Card, Estado, PageHeader, StatTile, Tabla, Vacio } from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import { requireSession } from "@/lib/crm/auth.actions";
import { listarCuentas } from "@/lib/crm/cuentas";
import { clp, fecha, numero } from "@/lib/crm/formato";
import { scoresDeCuentas } from "@/lib/crm/scoring";
import { ownerScope } from "@/lib/crm/session";

export const dynamic = "force-dynamic";

const FILTROS = [
  { id: "", etiqueta: "Todas" },
  { id: "cliente", etiqueta: "Clientes" },
  { id: "prospecto", etiqueta: "Prospectos" },
  { id: "inactivo", etiqueta: "Inactivas" },
];

export default async function Cuentas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const sesion = await requireSession();
  const { estado, q } = await searchParams;

  const alcance = ownerScope(sesion);
  const [cuentas, todasDelAlcance, scores] = await Promise.all([
    listarCuentas({ ownerId: alcance, estado, busqueda: q }),
    // Sin el filtro de estado ni de búsqueda, pero SÍ con el de dueño: los
    // contadores tienen que hablar de la misma cartera que la tabla, o un
    // vendedor ve "18 cuentas" arriba y "15 clientes" de toda la empresa al lado.
    listarCuentas({ ownerId: alcance }),
    scoresDeCuentas(),
  ]);

  const conteo = todasDelAlcance.reduce<Record<string, number>>((acc, c) => {
    acc[c.estado] = (acc[c.estado] ?? 0) + 1;
    return acc;
  }, {});

  const porCuenta = new Map(scores.map((s) => [s.accountId, s]));
  const facturado = cuentas.reduce((s, c) => s + c.facturado, 0);
  const abierto = cuentas.reduce((s, c) => s + c.montoAbierto, 0);

  return (
    <>
      <PageHeader
        titulo="Cuentas y contactos"
        bajada="Toda la cartera, con su puntaje de potencial calculado a partir de recencia, frecuencia, monto, engagement y tamaño."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Cuentas" valor={numero(cuentas.length)} contexto="en la vista actual" />
        <StatTile etiqueta="Clientes" valor={numero(conteo.cliente ?? 0)} contexto={`${numero(conteo.prospecto ?? 0)} prospectos`} />
        <StatTile etiqueta="Facturado histórico" valor={clp(facturado)} />
        <StatTile etiqueta="Pipeline de la cartera" valor={clp(abierto)} />
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--crm-grid)] px-5 py-3">
          <div className="flex gap-1">
            {FILTROS.map((f) => (
              <Link
                key={f.id}
                href={f.id ? `/crm/cuentas?estado=${f.id}` : "/crm/cuentas"}
                className={`rounded-md px-3 py-1.5 text-[13px] ${
                  (estado ?? "") === f.id
                    ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]"
                    : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
                }`}
              >
                {f.etiqueta}
              </Link>
            ))}
          </div>

          <form className="ml-auto flex gap-2">
            {estado && <input type="hidden" name="estado" value={estado} />}
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nombre…"
              className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--crm-brand)]"
            />
            <button
              type="submit"
              className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[13px] hover:border-[var(--crm-brand)]"
            >
              Buscar
            </button>
          </form>
        </div>

        {cuentas.length === 0 ? (
          <div className="p-5">
            <Vacio
              mensaje="No hay cuentas que coincidan"
              sugerencia="Prueba con otro filtro o carga la base de demostración."
            />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Cuenta",
              "Estado",
              { titulo: "Potencial", alinear: "centro" },
              { titulo: "Contactos", alinear: "der" },
              { titulo: "Pipeline", alinear: "der" },
              { titulo: "Facturado", alinear: "der" },
              "Última compra",
              "Dueño",
            ]}
          >
            {cuentas.map((c) => {
              const s = porCuenta.get(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/crm/cuentas/${c.id}`}
                      className="font-medium hover:text-[var(--crm-brand-dark)]"
                    >
                      {c.nombre}
                    </Link>
                    <div className="text-[12px] text-[var(--crm-muted)]">
                      {[c.industria, c.ciudad].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td>
                    <Estado estado={c.estado} />
                  </td>
                  <td>
                    <div className="flex justify-center">
                      <Medidor score={s?.score ?? 0} tamano={36} />
                    </div>
                  </td>
                  <td className="crm-num text-right">{numero(c.contactos)}</td>
                  <td className="crm-num text-right">
                    {c.montoAbierto > 0 ? clp(c.montoAbierto) : "—"}
                    {c.dealsAbiertos > 0 && (
                      <div className="text-[12px] text-[var(--crm-muted)]">
                        {c.dealsAbiertos} abiertas
                      </div>
                    )}
                  </td>
                  <td className="crm-num text-right font-medium">{clp(c.facturado)}</td>
                  <td>{fecha(c.ultimaCompra)}</td>
                  <td className="text-[13px] text-[var(--crm-ink-2)]">{c.owner ?? "—"}</td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Card>
    </>
  );
}
