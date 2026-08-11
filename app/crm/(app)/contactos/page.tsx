import Link from "next/link";
import { Badge, Card, Estado, PageHeader, StatTile, Tabla, Vacio } from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import { requireSession } from "@/lib/crm/auth.actions";
import { contarClientes, etiquetasEnUso, listarClientes } from "@/lib/crm/contactos";
import { clp, fecha, numero } from "@/lib/crm/formato";
import { scoresDeClientes } from "@/lib/crm/scoring";
import { ownerScope } from "@/lib/crm/session";
import { formatearTelefono } from "@/lib/crm/telefono";

export const dynamic = "force-dynamic";

const FILTROS = [
  { id: "", etiqueta: "Todos" },
  { id: "cliente", etiqueta: "Clientes" },
  { id: "prospecto", etiqueta: "Prospectos" },
  { id: "inactivo", etiqueta: "Inactivos" },
];

export default async function Contactos({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; etiqueta?: string }>;
}) {
  const sesion = await requireSession();
  const { estado, q, etiqueta } = await searchParams;
  const alcance = ownerScope(sesion);

  const [clientes, todosDelAlcance, scores, etiquetas] = await Promise.all([
    listarClientes({ ownerId: alcance, estado, busqueda: q, etiqueta }),
    listarClientes({ ownerId: alcance }),
    scoresDeClientes(),
    etiquetasEnUso(),
  ]);

  const conteo = todosDelAlcance.reduce<Record<string, number>>((acc, c) => {
    acc[c.estado] = (acc[c.estado] ?? 0) + 1;
    return acc;
  }, {});

  const porCliente = new Map(scores.map((s) => [s.contactId, s]));
  const facturado = clientes.reduce((s, c) => s + c.facturado, 0);
  const conWhatsapp = todosDelAlcance.filter((c) => c.optInWhatsapp).length;

  return (
    <>
      <PageHeader
        titulo="Contactos"
        bajada="Todos los clientes de la boutique. El puntaje mide potencial con una ventana de 24 meses, porque en alta gama el ciclo de recompra se mide en años."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Contactos" valor={numero(todosDelAlcance.length)} contexto={`${numero(clientes.length)} en la vista actual`} />
        <StatTile
          etiqueta="Clientes"
          valor={numero(conteo.cliente ?? 0)}
          contexto={`${numero(conteo.prospecto ?? 0)} prospectos · ${numero(conteo.inactivo ?? 0)} inactivos`}
        />
        <StatTile etiqueta="Comprado histórico" valor={clp(facturado)} contexto="en la vista actual" />
        <StatTile
          etiqueta="Autorizan WhatsApp"
          valor={numero(conWhatsapp)}
          contexto={`de ${numero(todosDelAlcance.length)} contactos`}
        />
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--crm-grid)] px-5 py-3">
          <div className="flex gap-1">
            {FILTROS.map((f) => (
              <Link
                key={f.id}
                href={f.id ? `/crm/contactos?estado=${f.id}` : "/crm/contactos"}
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
              placeholder="Nombre, teléfono o correo…"
              className="w-56 rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--crm-brand)]"
            />
            <button
              type="submit"
              className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[13px] hover:border-[var(--crm-brand)]"
            >
              Buscar
            </button>
          </form>
        </div>

        {etiquetas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--crm-grid)] px-5 py-2.5">
            <span className="text-[12px] uppercase tracking-wide text-[var(--crm-muted)]">
              Etiquetas
            </span>
            {etiquetas.map((e) => (
              <Link
                key={e}
                href={etiqueta === e ? "/crm/contactos" : `/crm/contactos?etiqueta=${encodeURIComponent(e)}`}
              >
                <Badge tono={etiqueta === e ? "marca" : "neutro"}>{e}</Badge>
              </Link>
            ))}
          </div>
        )}

        {clientes.length === 0 ? (
          <div className="p-5">
            <Vacio
              mensaje="No hay contactos que coincidan"
              sugerencia="Prueba con otro filtro o revisa la búsqueda."
            />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Cliente",
              "Estado",
              { titulo: "Potencial", alinear: "centro" },
              { titulo: "Compras", alinear: "der" },
              { titulo: "Comprado", alinear: "der" },
              "Última compra",
              "Ejecutivo",
              { titulo: "", alinear: "der" },
            ]}
          >
            {clientes.map((c) => {
              const s = porCliente.get(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/crm/contactos/${c.id}`}
                      className="font-medium hover:text-[var(--crm-brand-dark)]"
                    >
                      {c.nombre}
                    </Link>
                    <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                      {formatearTelefono(c.telefono)}
                      {c.ciudad ? ` · ${c.ciudad}` : ""}
                    </div>
                    {(c.etiquetas ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(c.etiquetas ?? []).map((e) => (
                          <Badge key={e} tono="neutro">
                            {e}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <Estado estado={c.estado} />
                  </td>
                  <td>
                    <div className="flex justify-center">
                      <Medidor score={s?.score ?? 0} tamano={36} />
                    </div>
                  </td>
                  <td className="crm-num text-right">{numero(c.compras)}</td>
                  <td className="crm-num text-right font-medium">{clp(c.facturado)}</td>
                  <td>{fecha(c.ultimaCompra)}</td>
                  <td className="text-[13px] text-[var(--crm-ink-2)]">{c.owner ?? "—"}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {c.optInWhatsapp && c.conversationId && (
                        <Link
                          href={`/crm/conversaciones?hilo=${c.conversationId}`}
                          title="Abrir conversación"
                          className="rounded-md border border-[var(--crm-border)] px-2 py-1 text-[12px] hover:border-[var(--crm-brand)]"
                        >
                          ✆
                        </Link>
                      )}
                      {c.cotizacionesAbiertas > 0 && (
                        <Link
                          href={`/crm/cotizaciones?q=${encodeURIComponent(c.nombre)}`}
                          title={`${c.cotizacionesAbiertas} cotizaciones abiertas`}
                          className="rounded-md border border-[var(--crm-border)] px-2 py-1 text-[12px] hover:border-[var(--crm-brand)]"
                        >
                          ▤ {c.cotizacionesAbiertas}
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Card>
    </>
  );
}
