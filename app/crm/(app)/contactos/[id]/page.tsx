import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  Estado,
  Lectura,
  PageHeader,
  StatTile,
  Tabla,
  Vacio,
  btnPrimario,
  btnSecundario,
} from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import { accionRegistrarActividad } from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { fichaCliente } from "@/lib/crm/contactos";
import { clp, fecha, fechaHora, numero, relativo } from "@/lib/crm/formato";
import { scoreDeCliente } from "@/lib/crm/scoring";
import { formatearTelefono } from "@/lib/crm/telefono";

export const dynamic = "force-dynamic";

const ESTADO_COTIZACION = {
  abierta: { tono: "neutro" as const, texto: "Abierta" },
  enviada: { tono: "alerta" as const, texto: "Enviada" },
  convertida: { tono: "bueno" as const, texto: "Convertida" },
  descartada: { tono: "critico" as const, texto: "Descartada" },
};

export default async function FichaContacto({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const contactId = Number(id);

  const [ficha, score] = await Promise.all([
    fichaCliente(contactId),
    scoreDeCliente(contactId),
  ]);
  if (!ficha) notFound();

  const { contacto, totales } = ficha;
  const atrasado =
    totales.cicloRecompraDias &&
    totales.diasSinComprar &&
    totales.diasSinComprar > totales.cicloRecompraDias * 1.2;

  return (
    <>
      <PageHeader
        titulo={contacto.nombre}
        bajada={[
          formatearTelefono(contacto.telefono),
          contacto.ciudad,
          contacto.email,
          ficha.empresa,
        ]
          .filter(Boolean)
          .join(" · ")}
        acciones={
          <>
            {ficha.conversationId && (
              <Link
                href={`/crm/conversaciones?hilo=${ficha.conversationId}`}
                className={btnSecundario}
              >
                ✆ Conversación
              </Link>
            )}
            <Link
              href={`/crm/cotizaciones?nueva=1&contacto=${contacto.id}`}
              className={btnPrimario}
            >
              + Cotizar
            </Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Estado estado={contacto.estado} />
        {(contacto.etiquetas ?? []).map((e) => (
          <Badge key={e} tono="marca">
            {e}
          </Badge>
        ))}
        {contacto.optInWhatsapp ? (
          <Badge tono="bueno" icono="✆">
            Autoriza WhatsApp
          </Badge>
        ) : (
          <Badge tono="alerta" icono="⛔">
            Sin autorización de WhatsApp
          </Badge>
        )}
        {contacto.fuente && <Badge tono="info">Llegó por {contacto.fuente}</Badge>}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Comprado histórico" valor={clp(totales.facturado)} contexto={`${numero(totales.compras)} compras`} />
        <StatTile etiqueta="Ticket promedio" valor={clp(totales.ticketPromedio)} />
        <StatTile etiqueta="Pipeline abierto" valor={clp(totales.montoAbierto)} />
        <StatTile
          etiqueta="Ciclo de recompra"
          valor={totales.cicloRecompraDias ? `${totales.cicloRecompraDias} días` : "—"}
          contexto={
            totales.diasSinComprar !== null
              ? `${totales.diasSinComprar} días sin comprar`
              : "sin compras registradas"
          }
        />
      </div>

      {atrasado && (
        <div className="mb-6">
          <Lectura
            titulo="Ventana de recompra vencida"
            resumen={`Compra cada ${totales.cicloRecompraDias} días y lleva ${totales.diasSinComprar}`}
          >
            <p>
              Compra cada <strong>{totales.cicloRecompraDias} días</strong> en promedio y
              lleva <strong>{totales.diasSinComprar}</strong>. Su ticket promedio es de{" "}
              {clp(totales.ticketPromedio)}
              {totales.marcaHabitual ? `, y suele elegir ${totales.marcaHabitual}` : ""}: es
              la conversación que conviene tener esta semana.
            </p>
          </Lectura>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {contacto.preferencias && (
            <Card titulo="Lo que hay que saber antes de llamarlo">
              <p className="text-[14px] leading-relaxed text-[var(--crm-ink)]">
                {contacto.preferencias}
              </p>
            </Card>
          )}

          <Card titulo="Historial de compras" padding={false}>
            {ficha.compras.length === 0 ? (
              <div className="p-5">
                <Vacio mensaje="Todavía no ha comprado" />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--crm-grid)]">
                {ficha.compras.map((c) => (
                  <li key={c.orderId} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px] font-medium text-[var(--crm-ink)]">
                        {fecha(c.fecha)}
                        {c.canal && (
                          <span className="ml-2 text-[12px] font-normal text-[var(--crm-muted)]">
                            {c.canal}
                          </span>
                        )}
                      </span>
                      <span className="crm-num text-[14px] font-semibold">{clp(c.total)}</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {c.piezas.map((p, i) => (
                        <div key={i} className="text-[13px] text-[var(--crm-ink-2)]">
                          {p.cantidad > 1 ? `${p.cantidad}× ` : ""}
                          {p.marca ? <strong>{p.marca}</strong> : null} {p.nombre}
                          <span className="crm-num ml-2 text-[var(--crm-muted)]">
                            {clp(p.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card titulo="Cotizaciones" padding={false}>
            {ficha.cotizaciones.length === 0 ? (
              <div className="p-5">
                <Vacio mensaje="Sin cotizaciones" />
              </div>
            ) : (
              <Tabla
                columnas={[
                  "N.º",
                  "Estado",
                  { titulo: "Piezas", alinear: "der" },
                  { titulo: "Total", alinear: "der" },
                  "Fecha",
                ]}
              >
                {ficha.cotizaciones.map((c) => {
                  const e = ESTADO_COTIZACION[c.estado as keyof typeof ESTADO_COTIZACION];
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/crm/cotizaciones/${c.id}`}
                          className="font-medium hover:text-[var(--crm-brand-dark)]"
                        >
                          #{c.id}
                        </Link>
                      </td>
                      <td>
                        <Badge tono={e?.tono ?? "neutro"}>{e?.texto ?? c.estado}</Badge>
                      </td>
                      <td className="crm-num text-right">{numero(c.piezas)}</td>
                      <td className="crm-num text-right font-medium">{clp(c.total)}</td>
                      <td>{fecha(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </Tabla>
            )}
          </Card>

          <Card titulo="Oportunidades" padding={false}>
            {ficha.deals.length === 0 ? (
              <div className="p-5">
                <Vacio mensaje="Sin oportunidades registradas" />
              </div>
            ) : (
              <Tabla
                columnas={["Oportunidad", "Etapa", { titulo: "Monto", alinear: "der" }, "Abierta"]}
              >
                {ficha.deals.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link
                        href={`/crm/oportunidades/${d.id}`}
                        className="font-medium hover:text-[var(--crm-brand-dark)]"
                      >
                        {d.titulo}
                      </Link>
                    </td>
                    <td>
                      <Estado estado={d.etapa === "perdido" ? "perdido_deal" : d.etapa} />
                    </td>
                    <td className="crm-num text-right font-medium">{clp(d.monto)}</td>
                    <td>{fecha(d.abiertoEn)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </Card>

          <Card titulo="Bitácora" padding={false}>
            <div className="border-b border-[var(--crm-grid)] p-5">
              <form action={accionRegistrarActividad} className="flex flex-wrap gap-2">
                <input type="hidden" name="contactId" value={contactId} />
                <select
                  name="tipo"
                  defaultValue="llamada"
                  className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-2 text-[13px]"
                >
                  <option value="llamada">Llamada</option>
                  <option value="reunion">Visita al showroom</option>
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
              </form>
            </div>

            {ficha.actividades.length === 0 ? (
              <div className="p-5">
                <Vacio mensaje="Sin actividad registrada" />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--crm-grid)]">
                {ficha.actividades.slice(0, 15).map((a) => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[14px]">{a.titulo}</span>
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
          {score && (
            <Card titulo="Potencial del cliente" descripcion="Cómo se compone el puntaje">
              <div className="mb-3 flex items-center gap-3">
                <Medidor score={score.score} tamano={60} />
                <p className="text-[13px] text-[var(--crm-ink-2)]">{score.resumen}</p>
              </div>
              <ul className="space-y-2">
                {score.factores.map((f) => (
                  <li key={f.clave}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="text-[var(--crm-ink)]">
                        {f.etiqueta}
                        <span className="ml-1.5 text-[11px] text-[var(--crm-muted)]">
                          peso {f.peso}%
                        </span>
                      </span>
                      <span className="crm-num font-medium">{f.puntos}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-[#f0f1f3]">
                      <div
                        className="h-full rounded-full bg-[var(--ramp-4)]"
                        style={{ width: `${f.puntos}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-[12px] text-[var(--crm-muted)]">
                      {f.evidencia}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card titulo="Preferencias detectadas">
            <dl className="space-y-2.5 text-[14px]">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Marca habitual</dt>
                <dd className="font-medium">{ficha.totales.marcaHabitual ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Categoría habitual</dt>
                <dd className="font-medium">{ficha.totales.categoriaHabitual ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Ejecutivo</dt>
                <dd>{ficha.owner ?? "sin asignar"}</dd>
              </div>
            </dl>
          </Card>

          <Card titulo="Recorrido de marketing" descripcion="Cómo llegó y qué lo mantiene cerca">
            {ficha.recorrido.length === 0 ? (
              <p className="text-[13px] text-[var(--crm-ink-2)]">
                Sin interacciones registradas.
              </p>
            ) : (
              <ol className="space-y-2 border-l border-[var(--crm-grid)] pl-4">
                {ficha.recorrido.slice(0, 10).map((r, i) => (
                  <li key={i} className="relative text-[13px]">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--ramp-3)]" />
                    <div className="text-[var(--crm-ink)]">{r.campana ?? "Contacto directo"}</div>
                    <div className="text-[12px] text-[var(--crm-muted)]">
                      {r.tipo} · {relativo(r.fecha)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {contacto.notas && (
            <Card titulo="Notas">
              <p className="whitespace-pre-line text-[13px] text-[var(--crm-ink-2)]">
                {contacto.notas}
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
