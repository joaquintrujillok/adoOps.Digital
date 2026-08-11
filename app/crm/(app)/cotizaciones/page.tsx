import Link from "next/link";
import { Badge, Card, Lectura, PageHeader, StatTile, Tabla, Vacio, btnPrimario } from "@/components/crm/ui";
import { Embudo, Figura } from "@/components/crm/charts";
import { requireSession } from "@/lib/crm/auth.actions";
import { embudoCotizaciones, listarCotizaciones } from "@/lib/crm/cotizaciones";
import { clp, clpCorto, fecha, numero, porcentaje } from "@/lib/crm/formato";
import { formatearTelefono } from "@/lib/crm/telefono";

export const dynamic = "force-dynamic";

const ESTADOS = [
  { id: "", etiqueta: "Todas" },
  { id: "abierta", etiqueta: "Abiertas" },
  { id: "enviada", etiqueta: "Enviadas" },
  { id: "convertida", etiqueta: "Convertidas" },
  { id: "descartada", etiqueta: "Descartadas" },
];

const TONO = {
  abierta: { tono: "neutro" as const, icono: "✎", texto: "Abierta" },
  enviada: { tono: "alerta" as const, icono: "→", texto: "Enviada" },
  convertida: { tono: "bueno" as const, icono: "✓", texto: "Convertida" },
  descartada: { tono: "critico" as const, icono: "✕", texto: "Descartada" },
};

export default async function Cotizaciones({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  await requireSession();
  const { estado, q } = await searchParams;

  const [cotizaciones, embudo] = await Promise.all([
    listarCotizaciones({ estado, busqueda: q }),
    embudoCotizaciones(),
  ]);

  // Las que llevan más de una semana enviadas sin cerrarse: es el trabajo que
  // se pierde solo si nadie lo persigue.
  const olvidadas = cotizaciones.filter(
    (c) => c.estado === "enviada" && (c.diasSinCerrar ?? 0) >= 7,
  );

  return (
    <>
      <PageHeader
        titulo="Cotizaciones"
        bajada="Lo que se cotiza en el mostrador y por WhatsApp, con el teléfono capturado desde el primer minuto. Es el dato que normalmente se pierde."
        acciones={
          <Link href="/crm/cotizaciones/nueva" className={btnPrimario}>
            + Nueva cotización
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Cotizado y enviado"
          valor={clp(embudo.montoEnviado)}
          contexto={`${numero(embudo.enviadas + embudo.convertidas)} cotizaciones`}
        />
        <StatTile
          etiqueta="Convertido en venta"
          valor={clp(embudo.montoConvertido)}
          contexto={`${numero(embudo.convertidas)} cerradas`}
        />
        <StatTile
          etiqueta="Tasa de conversión"
          valor={porcentaje(embudo.tasaConversion, 1)}
          contexto={
            embudo.diasACerrar !== null
              ? `${embudo.diasACerrar} días promedio para cerrar`
              : "sin cierres aún"
          }
        />
        <StatTile
          etiqueta="Ticket convertido"
          valor={clp(embudo.ticketPromedio)}
          contexto="promedio de lo que se cierra"
        />
      </div>

      {olvidadas.length > 0 && (
        <div className="mb-6">
          <Lectura
            titulo="Cotizaciones que se están enfriando"
            resumen={`${olvidadas.length} enviadas hace más de una semana sin respuesta · ${clp(olvidadas.reduce((s, c) => s + c.total, 0))}`}
          >
            <p>
              {olvidadas.length} cotizaciones llevan más de una semana enviadas sin
              respuesta ni cierre, y suman{" "}
              <strong>{clp(olvidadas.reduce((s, c) => s + c.total, 0))}</strong>. En este
              rubro la decisión toma tiempo, pero el silencio de dos semanas casi siempre
              significa que se fue a mirar a otra parte.
            </p>
          </Lectura>
        </div>
      )}

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--crm-grid)] px-5 py-3">
            <div className="flex flex-wrap gap-1">
              {ESTADOS.map((e) => (
                <Link
                  key={e.id}
                  href={e.id ? `/crm/cotizaciones?estado=${e.id}` : "/crm/cotizaciones"}
                  className={`rounded-md px-3 py-1.5 text-[13px] ${
                    (estado ?? "") === e.id
                      ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]"
                      : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
                  }`}
                >
                  {e.etiqueta}
                </Link>
              ))}
            </div>
            <form className="ml-auto flex gap-2">
              {estado && <input type="hidden" name="estado" value={estado} />}
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Nombre o teléfono…"
                className="w-48 rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[13px] outline-none focus:border-[var(--crm-brand)]"
              />
              <button
                type="submit"
                className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[13px] hover:border-[var(--crm-brand)]"
              >
                Buscar
              </button>
            </form>
          </div>

          {cotizaciones.length === 0 ? (
            <div className="p-5">
              <Vacio
                mensaje="No hay cotizaciones que coincidan"
                sugerencia="Crea una desde «Nueva cotización» o desde la ficha de un contacto."
              />
            </div>
          ) : (
            <Tabla
              columnas={[
                "N.º",
                "Cliente",
                "Estado",
                { titulo: "Piezas", alinear: "der" },
                { titulo: "Total", alinear: "der" },
                "Fecha",
                "Ejecutivo",
              ]}
            >
              {cotizaciones.map((c) => {
                const t = TONO[c.estado as keyof typeof TONO];
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
                      <div className="font-medium">
                        {c.contactId ? (
                          <Link
                            href={`/crm/contactos/${c.contactId}`}
                            className="hover:text-[var(--crm-brand-dark)]"
                          >
                            {c.cotizanteNombre}
                          </Link>
                        ) : (
                          c.cotizanteNombre
                        )}
                      </div>
                      <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                        {formatearTelefono(c.cotizanteTelefono)}
                      </div>
                      {!c.paraSiMismo && (
                        <Badge tono="info" icono="🎁">
                          Regalo{c.destinatarioNombre ? ` para ${c.destinatarioNombre}` : ""}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tono={t?.tono ?? "neutro"} icono={t?.icono}>
                          {t?.texto ?? c.estado}
                        </Badge>
                        {c.editadaTrasEnvio && (
                          <Badge tono="serio" icono="!">
                            Editada tras enviar
                          </Badge>
                        )}
                        {c.diasSinCerrar !== null && c.diasSinCerrar >= 7 && (
                          <Badge tono="alerta">{c.diasSinCerrar} días</Badge>
                        )}
                      </div>
                    </td>
                    <td className="crm-num text-right">{numero(c.piezas)}</td>
                    <td className="crm-num text-right font-medium">{clp(c.total)}</td>
                    <td>{fecha(c.createdAt)}</td>
                    <td className="text-[13px] text-[var(--crm-ink-2)]">{c.vendedor ?? "—"}</td>
                  </tr>
                );
              })}
            </Tabla>
          )}
        </Card>

        <Card>
          <Figura
            titulo="Del mostrador a la venta"
            subtitulo="Qué pasa con lo que se cotiza"
            pie="La tasa de conversión se calcula sobre las que efectivamente salieron: una cotización que quedó abierta en el mostrador no se le puede cobrar a nadie como pérdida."
          >
            <Embudo
              pasos={[
                {
                  etiqueta: "Cotizadas",
                  valor:
                    embudo.abiertas + embudo.enviadas + embudo.convertidas + embudo.descartadas,
                },
                {
                  etiqueta: "Enviadas al cliente",
                  valor: embudo.enviadas + embudo.convertidas,
                  detalle: clpCorto(embudo.montoEnviado),
                },
                {
                  etiqueta: "Convertidas en venta",
                  valor: embudo.convertidas,
                  detalle: clpCorto(embudo.montoConvertido),
                },
              ]}
            />
          </Figura>
        </Card>
      </div>
    </>
  );
}
