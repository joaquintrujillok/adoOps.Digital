import Link from "next/link";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  StatTile,
  Tabla,
  Vacio,
  btnPrimario,
  btnFantasma,
} from "@/components/crm/ui";
import { accionBorrarSegmento, accionGuardarSegmento } from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, numero, porcentaje } from "@/lib/crm/formato";
import {
  aplicar,
  listarSegmentos,
  paresCrossSell,
  universo,
  ventanaRecompra,
  SEGMENTOS_SUGERIDOS,
  type DefinicionSegmento,
} from "@/lib/crm/segmentos";
import { veTodo } from "@/lib/crm/session";

export const dynamic = "force-dynamic";

export default async function Segmentos() {
  const sesion = await requireSession();

  const [cuentas, guardados, recompras, cross] = await Promise.all([
    universo(),
    listarSegmentos(),
    ventanaRecompra(),
    paresCrossSell(),
  ]);

  const potencialRecompra = recompras.reduce((s, r) => s + r.ticketPromedio, 0);
  const contactables = recompras.filter((r) => r.cuenta.contactoWhatsapp).length;

  return (
    <>
      <PageHeader
        titulo="Segmentos y recompra"
        bajada="Los grupos que importan, la ventana de recompra calculada por cuenta y qué producto se vende bien junto a cuál."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Cuentas en cartera" valor={numero(cuentas.length)} />
        <StatTile
          etiqueta="Pasadas de recompra"
          valor={numero(recompras.length)}
          contexto={`${numero(contactables)} con WhatsApp autorizado`}
          deltaBueno="abajo"
        />
        <StatTile
          etiqueta="Potencial de recompra"
          valor={clp(potencialRecompra)}
          contexto="suma de sus tickets promedio"
        />
        <StatTile
          etiqueta="Pares de cross-selling"
          valor={numero(cross.length)}
          contexto="con evidencia suficiente"
        />
      </div>

      {recompras.length > 0 && (
        <div className="mb-6">
          <Lectura titulo="Quiénes deberían haber vuelto y no volvieron">
            <p>
              {recompras.length} cuentas pasaron su propia ventana de recompra. El ciclo
              se calcula cuenta por cuenta, no con un promedio general: un cliente que
              compra cada 30 días y otro que compra cada 180 no se atrasan el mismo día.
              Sumados, sus tickets promedio valen <strong>{clp(potencialRecompra)}</strong>.
            </p>
          </Lectura>
        </div>
      )}

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card
          titulo="Ventana de recompra vencida"
          descripcion="Ordenadas por ticket promedio: las de arriba ameritan llamada, no mensaje masivo"
          padding={false}
        >
          {recompras.length === 0 ? (
            <div className="p-5">
              <Vacio
                mensaje="Nadie está atrasado"
                sugerencia="Se necesitan al menos dos compras por cuenta para calcular un ciclo."
              />
            </div>
          ) : (
            <Tabla
              columnas={[
                "Cuenta",
                { titulo: "Ciclo", alinear: "der" },
                { titulo: "Atraso", alinear: "der" },
                { titulo: "Ticket", alinear: "der" },
                "Suele comprar",
              ]}
            >
              {recompras.slice(0, 12).map((r) => (
                <tr key={r.cuenta.accountId}>
                  <td>
                    <Link
                      href={`/crm/cuentas/${r.cuenta.accountId}`}
                      className="font-medium hover:text-[var(--crm-brand-dark)]"
                    >
                      {r.cuenta.nombre}
                    </Link>
                    {r.cuenta.contactoWhatsapp && (
                      <Badge tono="bueno" icono="✆">
                        WhatsApp
                      </Badge>
                    )}
                  </td>
                  <td className="crm-num text-right">{r.cuenta.cicloRecompraDias} d</td>
                  <td className="crm-num text-right font-medium text-[#96201f]">
                    +{r.atraso} d
                  </td>
                  <td className="crm-num text-right">{clp(r.ticketPromedio)}</td>
                  <td className="text-[13px] text-[var(--crm-ink-2)]">
                    {r.productoHabitual ?? "—"}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>

        <Card
          titulo="Cross-selling"
          descripcion="Quien compró A también compró B. Se muestran solo pares con al menos 3 cuentas en común."
          padding={false}
        >
          {cross.length === 0 ? (
            <div className="p-5">
              <Vacio
                mensaje="Todavía no hay patrones de canasta"
                sugerencia="Hacen falta más órdenes con varios productos para que el análisis sea confiable."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--crm-grid)]">
              {cross.slice(0, 6).map((p, i) => (
                <li key={i} className="px-5 py-3.5">
                  <div className="text-[14px] text-[var(--crm-ink)]">
                    Quien compra <strong>{p.productoA.nombre}</strong> suele comprar{" "}
                    <strong>{p.productoB.nombre}</strong>
                  </div>
                  <div className="mt-1 text-[13px] text-[var(--crm-ink-2)]">
                    De {numero(p.conA)} cuentas que compraron el primero, {numero(p.juntas)}{" "}
                    compraron el segundo ({porcentaje(p.confianza, 0)}).{" "}
                    <strong>{numero(p.oportunidades.length)}</strong> todavía no.
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.oportunidades.slice(0, 5).map((o) => (
                      <Link key={o.accountId} href={`/crm/cuentas/${o.accountId}`}>
                        <Badge tono="info">{o.nombre}</Badge>
                      </Link>
                    ))}
                    {p.oportunidades.length > 5 && (
                      <Badge tono="neutro">+{p.oportunidades.length - 5} más</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card titulo="Segmentos guardados" descripcion="Guardan la regla, no la lista: se recalculan solos" padding={false}>
            {guardados.length === 0 ? (
              <div className="p-5">
                <Vacio mensaje="Todavía no hay segmentos guardados" sugerencia="Crea uno con el formulario de al lado." />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--crm-grid)]">
                {guardados.map((s) => {
                  const miembros = aplicar(cuentas, s.definicion as DefinicionSegmento);
                  const valor = miembros.reduce((t, m) => t + m.facturado, 0);
                  return (
                    <li key={s.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-medium">{s.nombre}</div>
                          {s.descripcion && (
                            <p className="text-[13px] text-[var(--crm-ink-2)]">
                              {s.descripcion}
                            </p>
                          )}
                          <div className="crm-num mt-1 text-[13px] text-[var(--crm-muted)]">
                            {numero(miembros.length)} cuentas · {clp(valor)} facturados
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {miembros.slice(0, 6).map((m) => (
                              <Link key={m.accountId} href={`/crm/cuentas/${m.accountId}`}>
                                <Badge tono="neutro">{m.nombre}</Badge>
                              </Link>
                            ))}
                            {miembros.length > 6 && (
                              <Badge tono="neutro">+{miembros.length - 6}</Badge>
                            )}
                          </div>
                        </div>
                        {veTodo(sesion) && (
                          <form action={accionBorrarSegmento}>
                            <input type="hidden" name="segmentoId" value={s.id} />
                            <button type="submit" className={btnFantasma} title="Borrar segmento">
                              ✕
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            titulo="Segmentos que casi todos terminan armando"
            descripcion="Vienen calculados para que veas el patrón y armes los tuyos encima"
            padding={false}
          >
            <Tabla
              columnas={["Segmento", { titulo: "Cuentas", alinear: "der" }, { titulo: "Facturado", alinear: "der" }]}
            >
              {SEGMENTOS_SUGERIDOS.map((s) => {
                const miembros = aplicar(cuentas, s.definicion);
                return (
                  <tr key={s.nombre}>
                    <td>
                      <div className="font-medium">{s.nombre}</div>
                      <div className="text-[12px] text-[var(--crm-muted)]">
                        {s.descripcion}
                      </div>
                    </td>
                    <td className="crm-num text-right">{numero(miembros.length)}</td>
                    <td className="crm-num text-right">
                      {clp(miembros.reduce((t, m) => t + m.facturado, 0))}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
          </Card>
        </div>

        <Card titulo="Crear un segmento" descripcion="Se guarda la regla y se evalúa cada vez que lo abres">
          <form action={accionGuardarSegmento} className="space-y-3 text-[13px]">
            <div>
              <label className="mb-1 block font-medium text-[var(--crm-ink-2)]">Nombre</label>
              <input
                name="nombre"
                required
                className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 outline-none focus:border-[var(--crm-brand)]"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--crm-ink-2)]">Descripción</label>
              <input
                name="descripcion"
                className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 outline-none focus:border-[var(--crm-brand)]"
              />
            </div>

            <fieldset>
              <legend className="mb-1 font-medium text-[var(--crm-ink-2)]">Estado</legend>
              <div className="flex flex-wrap gap-3">
                {["cliente", "prospecto", "inactivo"].map((e) => (
                  <label key={e} className="flex items-center gap-1.5 capitalize">
                    <input type="checkbox" name="estado" value={e} /> {e}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-1 font-medium text-[var(--crm-ink-2)]">Tamaño</legend>
              <div className="flex flex-wrap gap-3">
                {["micro", "pyme", "mediana", "grande"].map((t) => (
                  <label key={t} className="flex items-center gap-1.5 capitalize">
                    <input type="checkbox" name="tamano" value={t} /> {t}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
                  Puntaje mínimo
                </span>
                <input
                  type="number"
                  name="scoreMin"
                  min={0}
                  max={100}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
                  Compras mínimas
                </span>
                <input
                  type="number"
                  name="comprasMin"
                  min={0}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
                  Facturado mínimo
                </span>
                <input
                  type="number"
                  name="facturadoMin"
                  min={0}
                  step={100000}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
                  Días sin comprar
                </span>
                <input
                  type="number"
                  name="sinComprarMin"
                  min={0}
                  className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2"
                />
              </label>
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" name="conWhatsapp" value="1" />
              Solo cuentas con WhatsApp autorizado
            </label>

            <button type="submit" className={`${btnPrimario} w-full`}>
              Guardar segmento
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
