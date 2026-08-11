import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  Estado,
  Lectura,
  PageHeader,
  Tabla,
  Vacio,
  btnPrimario,
  btnSecundario,
} from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import MoverEtapa from "@/components/crm/MoverEtapa";
import { accionRegistrarActividad } from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, fecha, fechaHora, numero, porcentaje, relativo } from "@/lib/crm/formato";
import { recorridoDeDeal } from "@/lib/crm/marketing";
import { fichaDeal } from "@/lib/crm/pipeline";
import { sustitutos } from "@/lib/crm/productos";
import { scoresDeDeals } from "@/lib/crm/scoring";
import { formatearTelefono } from "@/lib/crm/telefono";

export const dynamic = "force-dynamic";

export default async function FichaOportunidad({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const dealId = Number(id);

  const ficha = await fichaDeal(dealId);
  if (!ficha) notFound();

  const [recorrido, scores] = await Promise.all([
    recorridoDeDeal(dealId),
    scoresDeDeals(),
  ]);
  const salud = scores.get(dealId);

  // Solo se buscan sustitutos para lo que efectivamente no alcanza: es la
  // información que sirve mientras se está armando la propuesta, no después.
  const faltantes = ficha.items.filter(
    (i) => i.disponible !== null && i.disponible < i.cantidad,
  );
  const alternativas = await Promise.all(
    faltantes.map(async (i) => ({ item: i, opciones: await sustitutos(i.productId) })),
  );

  const totalItems = ficha.items.reduce((s, i) => s + i.subtotal, 0);

  return (
    <>
      <PageHeader
        titulo={ficha.deal.titulo}
        bajada={`${ficha.cliente?.nombre ?? "Sin cliente"}${ficha.owner ? ` · ${ficha.owner}` : " · sin dueño asignado"}`}
        acciones={
          <>
            <Link href={`/crm/contactos/${ficha.cliente?.id ?? 0}`} className={btnSecundario}>
              Ver el cliente
            </Link>
            <MoverEtapa dealId={dealId} etapa={ficha.deal.etapa} />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card titulo="Productos de la oportunidad" padding={false}>
            {ficha.items.length === 0 ? (
              <div className="p-5">
                <Vacio
                  mensaje="Sin productos asociados"
                  sugerencia="Asociar productos permite validar stock y calcular el monto solo."
                />
              </div>
            ) : (
              <Tabla
                columnas={[
                  "Producto",
                  { titulo: "Cant.", alinear: "der" },
                  { titulo: "Precio", alinear: "der" },
                  { titulo: "Subtotal", alinear: "der" },
                  "Disponibilidad",
                ]}
              >
                {ficha.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="font-medium">{i.nombre}</div>
                      <div className="text-[12px] text-[var(--crm-muted)]">{i.sku}</div>
                    </td>
                    <td className="crm-num text-right">{numero(i.cantidad)}</td>
                    <td className="crm-num text-right">{clp(i.precioUnitario)}</td>
                    <td className="crm-num text-right font-medium">{clp(i.subtotal)}</td>
                    <td>
                      {i.disponible === null ? (
                        <Badge tono="neutro" icono="∞">
                          Servicio · sin stock que reservar
                        </Badge>
                      ) : i.disponible >= i.cantidad ? (
                        <Badge tono="bueno" icono="●">
                          {numero(i.disponible)} disponibles
                        </Badge>
                      ) : (
                        <Badge tono="critico" icono="▲">
                          Faltan {numero(i.cantidad - i.disponible)} · repone en{" "}
                          {i.leadTimeDias} días
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="text-right font-medium">
                    Total de productos
                  </td>
                  <td className="crm-num text-right font-semibold">{clp(totalItems)}</td>
                  <td />
                </tr>
              </Tabla>
            )}
          </Card>

          {alternativas.length > 0 && (
            <Card
              titulo="No alcanza el stock"
              descripcion="Alternativas de la misma categoría, con disponibilidad, ordenadas por cercanía de precio"
            >
              <div className="space-y-4">
                {alternativas.map(({ item, opciones }) => (
                  <div key={item.id}>
                    <div className="mb-2 text-[13px] font-medium text-[var(--crm-ink)]">
                      {item.nombre}: se comprometieron {numero(item.cantidad)} y hay{" "}
                      {numero(item.disponible)}
                    </div>
                    {opciones.length === 0 ? (
                      <p className="text-[13px] text-[var(--crm-ink-2)]">
                        No hay sustitutos con stock en esta categoría. La reposición
                        demora {item.leadTimeDias} días.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {opciones.map((o) => (
                          <li
                            key={o.id}
                            className="flex items-center justify-between rounded-lg border border-[var(--crm-grid)] px-3 py-2 text-[13px]"
                          >
                            <span>
                              <Link
                                href="/crm/productos"
                                className="font-medium hover:text-[var(--crm-brand-dark)]"
                              >
                                {o.nombre}
                              </Link>
                              <span className="ml-2 text-[var(--crm-muted)]">{o.sku}</span>
                            </span>
                            <span className="crm-num">
                              {clp(o.precio)} · {numero(o.disponible)} disponibles
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card titulo="Bitácora" descripcion="Todo lo que se hizo con esta oportunidad" padding={false}>
            <div className="border-b border-[var(--crm-grid)] p-5">
              <form action={accionRegistrarActividad} className="space-y-2.5">
                <input type="hidden" name="contactId" value={ficha.cliente?.id ?? 0} />
                <input type="hidden" name="dealId" value={dealId} />
                <div className="flex flex-wrap gap-2">
                  <select
                    name="tipo"
                    defaultValue="llamada"
                    className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-2 text-[13px]"
                  >
                    <option value="llamada">Llamada</option>
                    <option value="reunion">Reunión</option>
                    <option value="email">Email</option>
                    <option value="nota">Nota</option>
                    <option value="tarea">Tarea pendiente</option>
                  </select>
                  <input
                    name="titulo"
                    required
                    placeholder="Qué pasó (o qué hay que hacer)"
                    className="min-w-[220px] flex-1 rounded-lg border border-[var(--crm-border)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-brand)]"
                  />
                  <input
                    type="date"
                    name="venceEn"
                    title="Solo si es una tarea"
                    className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-2 text-[13px]"
                  />
                  <button type="submit" className={btnPrimario}>
                    Registrar
                  </button>
                </div>
              </form>
            </div>

            {ficha.actividades.length === 0 ? (
              <div className="p-5">
                <Vacio mensaje="Todavía no hay actividad registrada" />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--crm-grid)]">
                {ficha.actividades.map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] text-[var(--crm-ink)]">{a.titulo}</span>
                      <span className="shrink-0 text-[12px] text-[var(--crm-muted)]">
                        {fechaHora(a.ocurridoEn)}
                      </span>
                    </div>
                    {a.detalle && (
                      <p className="mt-0.5 text-[13px] text-[var(--crm-ink-2)]">{a.detalle}</p>
                    )}
                    <div className="mt-1 text-[12px] text-[var(--crm-muted)]">
                      {a.tipo}
                      {a.autor ? ` · ${a.autor}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card titulo="Estado del negocio">
            <dl className="space-y-3 text-[14px]">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Monto</dt>
                <dd className="crm-num font-semibold">{clp(ficha.deal.monto)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Etapa</dt>
                <dd>
                  <Estado
                    estado={ficha.deal.etapa === "perdido" ? "perdido_deal" : ficha.deal.etapa}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Probabilidad</dt>
                <dd className="crm-num">{porcentaje(ficha.deal.probabilidad)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Abierta</dt>
                <dd>{fecha(ficha.deal.abiertoEn)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Cierre estimado</dt>
                <dd>{fecha(ficha.deal.cierreEstimado)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Última actividad</dt>
                <dd>{relativo(ficha.deal.ultimaActividadEn ?? ficha.deal.abiertoEn)}</dd>
              </div>
              {ficha.deal.motivoPerdida && (
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--crm-ink-2)]">Motivo de pérdida</dt>
                  <dd>{ficha.deal.motivoPerdida}</dd>
                </div>
              )}
            </dl>
          </Card>

          {salud && (
            <Card titulo="Salud de la oportunidad">
              <div className="mb-3 flex items-center gap-3">
                <Medidor score={salud.score} tamano={56} />
                <p className="text-[13px] text-[var(--crm-ink-2)]">{salud.resumen}</p>
              </div>
              <ul className="space-y-1.5 text-[13px]">
                {salud.factores.map((f) => (
                  <li key={f.etiqueta} className="flex items-baseline justify-between gap-2">
                    <span className="text-[var(--crm-ink-2)]">{f.etiqueta}</span>
                    <span className="text-right">
                      <span className="crm-num font-medium">{f.puntos}</span>
                      <span className="ml-2 text-[12px] text-[var(--crm-muted)]">
                        {f.evidencia}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {ficha.cliente && (
            <Card titulo="Cliente">
              <div className="text-[14px] font-medium">{ficha.cliente.nombre}</div>
              {ficha.cliente.email && (
                <div className="mt-1 text-[13px] text-[var(--crm-ink-2)]">
                  {ficha.cliente.email}
                </div>
              )}
              {ficha.cliente.telefono && (
                <div className="crm-num mt-0.5 text-[13px] text-[var(--crm-ink-2)]">
                  {formatearTelefono(ficha.cliente.telefono)}
                </div>
              )}
            </Card>
          )}

          <Card
            titulo="De dónde salió"
            descripcion="Trazabilidad de marketing de esta cuenta"
          >
            {recorrido.length === 0 ? (
              <p className="text-[13px] text-[var(--crm-ink-2)]">
                Sin interacciones de marketing registradas.
              </p>
            ) : (
              <>
                <div className="mb-3 space-y-1 text-[13px]">
                  <div>
                    <span className="text-[var(--crm-ink-2)]">Primer toque: </span>
                    <strong>{ficha.campanaOrigen ?? "directo"}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--crm-ink-2)]">Último toque antes de abrir: </span>
                    <strong>{ficha.campanaUltima ?? "directo"}</strong>
                  </div>
                </div>
                <ol className="space-y-2 border-l border-[var(--crm-grid)] pl-4">
                  {recorrido.slice(0, 8).map((r, i) => (
                    <li key={i} className="relative text-[13px]">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--ramp-3)]" />
                      <div className="text-[var(--crm-ink)]">
                        {r.campana ?? "Interacción directa"}
                      </div>
                      <div className="text-[12px] text-[var(--crm-muted)]">
                        {r.tipo} · {fecha(r.fecha)}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
