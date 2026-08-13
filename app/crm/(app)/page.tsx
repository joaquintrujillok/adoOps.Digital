import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader, StatTile, Tabla, Vacio, btnSecundario } from "@/components/crm/ui";
import { Figura, Lineas } from "@/components/crm/charts";
import { LecturaEsqueleto, LecturaNarrada } from "@/components/crm/LecturaNarrada";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, fecha, numero, porcentaje } from "@/lib/crm/formato";
import { calcularRfm, clientesAnaliticos, panorama } from "@/lib/crm/analitica";
import {
  alBordeDelSalto,
  ascensosDelAnio,
  carteraPorSegmento,
  definicionDe,
} from "@/lib/crm/segmentos-valor";
import { resumenAudiciones } from "@/lib/crm/audiciones";
import { huecosDeCartera } from "@/lib/crm/preguntas";
import { resumirSenales } from "@/lib/crm/senales";

export const dynamic = "force-dynamic";

/**
 * La portada, reordenada alrededor de la cartera.
 *
 * La versión anterior abría con pipeline ponderado, tasa de cierre y ciclo de
 * venta: los indicadores de un CRM de venta B2B con decenas de oportunidades
 * simultáneas. Acá entran tres ventas al mes. Una "tasa de cierre del 34,2%"
 * sobre ese volumen es una fracción con denominador de una cifra disfrazada de
 * precisión, y el ciclo de venta se mide en meses de conversación que ninguna
 * etapa de embudo refleja.
 *
 * Lo que sí ordena el día en este negocio son cuatro cosas, y en este orden:
 * **cómo está repartida la cartera, qué se vendió, quién está a un paso de
 * subir de tramo, y a quién hay que llamar hoy.**
 */
export default async function VisionGeneral() {
  const sesion = await requireSession();

  const base = await clientesAnaliticos();
  const rfm = calcularRfm(base);

  const [p, cartera, ascensos, alBorde, audiciones, senales, huecos] = await Promise.all([
    panorama(rfm),
    carteraPorSegmento(),
    ascensosDelAnio(),
    alBordeDelSalto(6),
    resumenAudiciones(),
    resumirSenales(),
    huecosDeCartera(5),
  ]);

  const totalClientes = cartera.reduce((s, c) => s + c.clientes, 0);
  const arriba = cartera.filter((s) => s.clave === "reference" || s.clave === "highend");
  const clientesArriba = arriba.reduce((s, c) => s + c.clientes, 0);
  const montoArriba = arriba.reduce((s, c) => s + c.porcentajeMonto, 0);

  const respaldo =
    `La cartera son ${numero(totalClientes)} clientes repartidos en cuatro tramos por lo que han ` +
    `invertido. ${numero(clientesArriba)} de ellos concentran el ${porcentaje(montoArriba, 0)} de la ` +
    `facturación. En los últimos doce meses se facturaron ${clp(p.facturacion12m)} en ` +
    `${p.ventasPorMesPromedio.toFixed(1)} ventas al mes, con una venta típica de ${clp(p.ticketMediana)}. ` +
    `${numero(ascensos.length)} clientes cambiaron de tramo este año y ${numero(alBorde.length)} están ` +
    `a una compra de cruzar al siguiente.`;

  return (
    <>
      <PageHeader
        titulo={`Hola, ${sesion.nombre.split(" ")[0]}`}
        bajada="Cómo está repartida la cartera, qué se vendió y a quién hay que llamar."
        acciones={
          <Link href="/crm/audiciones/nueva" className={btnSecundario}>
            ♪ Cerrar una audición
          </Link>
        }
      />

      {/* ── La cartera en cuatro tramos. Lo primero que se ve ── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartera.map((s) => (
          <Link key={s.clave} href="/crm/clientes?vista=segmentos" className="block">
            <Card className="h-full transition hover:border-[var(--crm-brand)]">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: s.tono }}
                />
                <div className="text-[13px] font-semibold uppercase tracking-wide text-[var(--crm-ink)]">
                  {s.nombre}
                </div>
              </div>
              <div className="mt-1 text-[12px] text-[var(--crm-muted)]">{s.rango}</div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="crm-num text-[30px] font-semibold leading-none">
                  {numero(s.clientes)}
                </span>
                <span className="text-[13px] text-[var(--crm-ink-2)]">
                  {s.clientes === 1 ? "cliente" : "clientes"}
                </span>
              </div>
              <div className="mt-2 text-[13px] text-[var(--crm-ink-2)]">
                {porcentaje(s.porcentajeMonto, 0)}
                <span className="text-[var(--crm-muted)]"> de la facturación</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Facturación 12 meses"
          valor={clp(p.facturacion12m)}
          contexto={`${p.ventasPorMesPromedio.toFixed(1)} ventas al mes`}
        />
        <StatTile
          etiqueta="Venta típica"
          valor={clp(p.ticketMediana)}
          contexto={`el promedio es ${clp(p.ticketPromedio)}`}
        />
        <StatTile
          etiqueta="Audiciones · 30 días"
          valor={numero(audiciones.total30d)}
          contexto={`${audiciones.porVenta.toFixed(1)} por cada venta`}
          href="/crm/audiciones"
        />
        <StatTile
          etiqueta="Señales pendientes"
          valor={numero(senales.total)}
          contexto={`${numero(senales.altas)} de prioridad alta`}
          href="/crm/senales"
        />
      </div>

      <div className="mb-6">
        <Suspense fallback={<LecturaEsqueleto />}>
          <LecturaNarrada
            clave="portada-segmentos"
            resumen={{
              clientesTotales: totalClientes,
              clientesTramoAlto: clientesArriba,
              porcentajeFacturacionTramoAlto: montoArriba,
              facturacion12m: p.facturacion12m,
              ventasPorMes: p.ventasPorMesPromedio,
              ventaTipica: p.ticketMediana,
              ventaPromedio: p.ticketPromedio,
              ascensosDeTramo: ascensos.length,
              alBordeDelSalto: alBorde.length,
              audiciones30d: audiciones.total30d,
              senalesPendientes: senales.total,
            }}
            contexto="Portada de un CRM de audio de alta fidelidad con tres ventas al mes, para el gerente comercial. La cartera se segmenta en cuatro tramos por lo invertido: Reference sobre 100 millones, Highend de 50 a 100, Entusiasta de 10 a 50 y Entrada bajo 10."
            respaldo={respaldo}
          />
        </Suspense>
      </div>

      {/* ── Las ventas, con nombre. A este volumen se miran una por una ── */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding={false} titulo="Las últimas ventas">
          {p.ultimasVentas.length === 0 ? (
            <Vacio mensaje="Todavía no hay ventas registradas" />
          ) : (
            <Tabla
              columnas={[
                "Fecha",
                "Cliente",
                "Qué se llevó",
                { titulo: "Monto", alinear: "der" },
              ]}
            >
              {p.ultimasVentas.slice(0, 8).map((v) => (
                <tr key={v.id}>
                  <td className="crm-num whitespace-nowrap">{fecha(v.fecha)}</td>
                  <td>
                    {v.contactId ? (
                      <Link href={`/crm/contactos/${v.contactId}`} className="crm-link">
                        {v.cliente}
                      </Link>
                    ) : (
                      <span className="crm-muted">Sin identificar</span>
                    )}
                  </td>
                  <td className="crm-muted max-w-[260px] truncate">{v.detalle ?? "—"}</td>
                  <td className="crm-num text-right font-medium">{clp(v.total)}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>

        <Card>
          <Figura
            titulo="Facturación por trimestre"
            subtitulo="Últimos 24 meses"
            pie="Por trimestre y no por mes: con tres ventas mensuales la curva mensual muestra ruido, no tendencia."
          >
            <Lineas
              series={[
                {
                  nombre: "Facturación",
                  puntos: p.ventasPorTrimestre.map((t) => ({ x: t.etiqueta, y: t.monto })),
                },
              ]}
              formatoY={clpCorto}
            />
          </Figura>
        </Card>
      </div>

      {/* ── Lo accionable: quién está a punto de subir y a quién falta conocer ── */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card
          titulo="A un paso del tramo siguiente"
          descripcion="Una sola compra los cruza."
          padding={false}
        >
          {alBorde.length === 0 ? (
            <Vacio mensaje="Nadie está cerca de cruzar un corte" />
          ) : (
            <Tabla
              columnas={[
                "Cliente",
                { titulo: "Le falta", alinear: "der" },
                "Para entrar a",
              ]}
            >
              {alBorde.map((b) => (
                <tr key={b.contactId}>
                  <td>
                    <Link href={`/crm/contactos/${b.contactId}`} className="crm-link">
                      {b.nombre}
                    </Link>
                    <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                      lleva {clp(b.valor)}
                    </div>
                  </td>
                  <td className="crm-num text-right font-semibold text-[var(--crm-brand-dark)]">
                    {clp(b.falta)}
                  </td>
                  <td className="text-[13px]">{definicionDe(b.siguiente).nombre}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>

        <Card
          titulo="A quién le falta preguntarle"
          descripcion="Plata invertida contra lo poco que sabemos de esa persona."
          padding={false}
        >
          {huecos.length === 0 ? (
            <Vacio mensaje="Sin cartera con compras todavía" />
          ) : (
            <Tabla
              columnas={["Cliente", { titulo: "Sabemos", alinear: "der" }, "La pregunta"]}
            >
              {huecos.map((h) => (
                <tr key={h.contactId}>
                  <td>
                    <Link href={`/crm/contactos/${h.contactId}`} className="crm-link">
                      {h.cliente}
                    </Link>
                    <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                      {clp(h.invertido)}
                    </div>
                  </td>
                  <td className="crm-num text-right font-medium">{h.puntaje}%</td>
                  <td className="max-w-[260px] text-[13px] text-[var(--crm-ink-2)]">
                    {h.siguiente?.texto ?? "Ya sabemos lo importante"}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>
      </div>

      {/* ── Los ascensos: la medida de crecimiento que este volumen permite ── */}
      <Card
        titulo="Quiénes subieron de tramo este año"
        descripcion="Sobre cuarenta ventas al año, esto dice más que una variación porcentual."
        padding={false}
      >
        {ascensos.length === 0 ? (
          <Vacio mensaje="Nadie cambió de tramo en los últimos doce meses" />
        ) : (
          <Tabla
            columnas={["Cliente", "Movimiento", { titulo: "Sumó este año", alinear: "der" }]}
          >
            {ascensos.slice(0, 6).map((a) => (
              <tr key={a.contactId}>
                <td>
                  <Link href={`/crm/contactos/${a.contactId}`} className="crm-link">
                    {a.nombre}
                  </Link>
                </td>
                <td className="text-[13px]">
                  <span className="text-[var(--crm-muted)]">{definicionDe(a.desde).nombre}</span>
                  <span className="mx-1.5 text-[var(--crm-brand)]">→</span>
                  <span className="font-medium text-[var(--crm-brand-dark)]">
                    {definicionDe(a.hacia).nombre}
                  </span>
                </td>
                <td className="crm-num text-right font-medium">
                  {clp(a.valorAhora - a.valorAntes)}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}
