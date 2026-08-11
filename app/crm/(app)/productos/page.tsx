import Link from "next/link";
import { Badge, Card, Lectura, PageHeader, StatTile, Tabla, Vacio } from "@/components/crm/ui";
import { BarrasH, Figura } from "@/components/crm/charts";
import { accionAjustarStock } from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, numero, porcentaje } from "@/lib/crm/formato";
import { listarProductos, riesgosDeStock, ventasPorProducto } from "@/lib/crm/productos";
import { veTodo } from "@/lib/crm/session";

export const dynamic = "force-dynamic";

const ETIQUETA_DISPONIBILIDAD = {
  disponible: { tono: "bueno" as const, icono: "●", texto: "Disponible" },
  ajustado: { tono: "alerta" as const, icono: "◐", texto: "Ajustado" },
  agotado: { tono: "critico" as const, icono: "○", texto: "Agotado" },
  sin_datos: { tono: "neutro" as const, icono: "?", texto: "Sin inventario" },
};

export default async function Productos() {
  const sesion = await requireSession();
  const puedeEditar = veTodo(sesion);

  const [productos, riesgos, ventas] = await Promise.all([
    listarProductos(),
    riesgosDeStock(),
    ventasPorProducto(new Date(Date.now() - 365 * 86_400_000)),
  ]);

  const agotados = productos.filter((p) => p.disponibilidad === "agotado");
  const ajustados = productos.filter((p) => p.disponibilidad === "ajustado");
  // Solo lo que ocupa bodega: los servicios no se valorizan como existencias.
  const valorInventario = productos
    .filter((p) => p.tieneInventario)
    .reduce((s, p) => s + p.stock * p.costo, 0);
  const enRiesgo = riesgos.reduce(
    (s, r) => s + r.deals.reduce((t, d) => t + d.monto, 0),
    0,
  );

  return (
    <>
      <PageHeader
        titulo="Productos e inventario"
        bajada="El catálogo con su disponibilidad real. Lo que se compromete en oportunidades abiertas descuenta del stock que se puede prometer."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Productos activos" valor={numero(productos.filter((p) => p.activo).length)} />
        <StatTile etiqueta="Valor del inventario" valor={clp(valorInventario)} contexto="a costo" />
        <StatTile
          etiqueta="Sin stock"
          valor={numero(agotados.length)}
          contexto={`${numero(ajustados.length)} bajo el punto de reposición`}
          deltaBueno="abajo"
        />
        <StatTile
          etiqueta="Ventas en riesgo"
          valor={clp(enRiesgo)}
          contexto="comprometido sin stock suficiente"
          deltaBueno="abajo"
        />
      </div>

      {riesgos.length > 0 && (
        <div className="mb-6">
          <Lectura titulo="Estás vendiendo lo que no tienes">
            <p>
              {riesgos.length === 1
                ? "Un producto está comprometido"
                : `${riesgos.length} productos están comprometidos`}{" "}
              en oportunidades abiertas por más unidades de las que hay en bodega. En
              total son <strong>{clp(enRiesgo)}</strong> que dependen de reponer a
              tiempo.
            </p>
            <ul className="mt-2 space-y-1.5">
              {riesgos.slice(0, 4).map((r) => (
                <li key={r.productId} className="text-[13px]">
                  <strong>{r.nombre}</strong>: hay {numero(r.stock)} en bodega y{" "}
                  {numero(r.comprometido)} comprometidas en {r.deals.length}{" "}
                  oportunidad{r.deals.length === 1 ? "" : "es"} · reposición en{" "}
                  {r.leadTimeDias} días
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                    {r.deals.map((d) => (
                      <Link
                        key={d.id}
                        href={`/crm/oportunidades/${d.id}`}
                        className="underline decoration-dotted hover:text-[var(--crm-brand-dark)]"
                      >
                        {d.titulo} ({numero(d.cantidad)})
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Lectura>
        </div>
      )}

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <Figura
            titulo="Lo que más se vende"
            subtitulo="Ingresos por producto en los últimos 12 meses"
            pie="Fuente: ítems de órdenes cerradas."
          >
            {ventas.length === 0 ? (
              <Vacio mensaje="Sin ventas registradas" />
            ) : (
              <BarrasH
                datos={ventas.slice(0, 8).map((v) => ({
                  etiqueta: v.nombre,
                  valor: v.ingresos,
                  texto: clpCorto(v.ingresos),
                }))}
              />
            )}
          </Figura>
        </Card>

        <Card>
          <Figura
            titulo="Alcance por producto"
            subtitulo="Cuántas cuentas distintas lo compraron"
            pie="Un producto con muchos ingresos y pocas cuentas es una concentración de riesgo."
          >
            {ventas.length === 0 ? (
              <Vacio mensaje="Sin ventas registradas" />
            ) : (
              <BarrasH
                datos={[...ventas]
                  .sort((a, b) => b.cuentas - a.cuentas)
                  .slice(0, 8)
                  .map((v) => ({
                    etiqueta: v.nombre,
                    valor: v.cuentas,
                    texto: `${numero(v.cuentas)} cuentas`,
                  }))}
                colorUnico="var(--series-3)"
              />
            )}
          </Figura>
        </Card>
      </div>

      <Card titulo="Catálogo" descripcion="Disponible = stock menos lo comprometido en oportunidades abiertas" padding={false}>
        {productos.length === 0 ? (
          <div className="p-5">
            <Vacio mensaje="El catálogo está vacío" sugerencia="Carga la base de demostración." />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Producto",
              "Categoría",
              { titulo: "Precio", alinear: "der" },
              { titulo: "Margen", alinear: "der" },
              { titulo: "Stock", alinear: "der" },
              { titulo: "Disponible", alinear: "der" },
              "Estado",
              { titulo: "Repone en", alinear: "der" },
              ...(puedeEditar ? [{ titulo: "Ajustar", alinear: "der" as const }] : []),
            ]}
          >
            {productos.map((p) => {
              const e = ETIQUETA_DISPONIBILIDAD[p.disponibilidad];
              return (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-[12px] text-[var(--crm-muted)]">{p.sku}</div>
                  </td>
                  <td className="text-[13px] text-[var(--crm-ink-2)]">{p.categoria ?? "—"}</td>
                  <td className="crm-num text-right">{clp(p.precio)}</td>
                  <td className="crm-num text-right">{porcentaje(p.margen, 0)}</td>
                  <td className="crm-num text-right">
                    {p.tieneInventario ? numero(p.stock) : "—"}
                  </td>
                  <td className="crm-num text-right font-medium">
                    {p.tieneInventario ? numero(p.disponible) : "—"}
                  </td>
                  <td>
                    {p.tieneInventario ? (
                      <Badge tono={e.tono} icono={e.icono}>
                        {e.texto}
                      </Badge>
                    ) : (
                      <Badge tono="neutro" icono="∞">
                        Servicio
                      </Badge>
                    )}
                  </td>
                  <td className="crm-num text-right">
                    {p.tieneInventario ? `${p.leadTimeDias} d` : "—"}
                  </td>
                  {puedeEditar && (
                    <td className="text-right">
                      {!p.tieneInventario ? (
                        <span className="text-[12px] text-[var(--crm-muted)]">
                          Sin stock que llevar
                        </span>
                      ) : (
                      <form action={accionAjustarStock} className="flex justify-end gap-1">
                        <input type="hidden" name="productId" value={p.id} />
                        <input
                          type="number"
                          name="stock"
                          min={0}
                          defaultValue={p.stock}
                          className="crm-num w-20 rounded border border-[var(--crm-border)] px-2 py-1 text-right text-[13px]"
                        />
                        <button
                          type="submit"
                          className="rounded border border-[var(--crm-border)] px-2 py-1 text-[12px] hover:border-[var(--crm-brand)]"
                        >
                          Guardar
                        </button>
                      </form>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </Tabla>
        )}
      </Card>
    </>
  );
}
