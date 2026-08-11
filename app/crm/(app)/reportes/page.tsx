import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader, StatTile, Tabla, Vacio } from "@/components/crm/ui";
import { LecturaEsqueleto, LecturaNarrada } from "@/components/crm/LecturaNarrada";
import { BarrasH, Embudo, Figura, Lineas } from "@/components/crm/charts";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, numero, porcentaje } from "@/lib/crm/formato";
import { ingresosPorMes } from "@/lib/crm/marketing";
import {
  concentracion,
  embudoConversion,
  motivosDePerdida,
  rendimientoEquipo,
  resumenComercial,
  topCuentas,
} from "@/lib/crm/reportes";

export const dynamic = "force-dynamic";

export default async function Reportes() {
  await requireSession();

  const [resumen, meses, embudo, equipo, motivos, top, conc] = await Promise.all([
    resumenComercial(90),
    ingresosPorMes(12),
    embudoConversion(),
    rendimientoEquipo(),
    motivosDePerdida(),
    topCuentas(365, 10),
    concentracion(365),
  ]);

  const perdidasTotales = motivos.reduce((s, m) => s + m.n, 0);
  const principal = motivos[0];

  const respaldo = `En 90 días se facturaron ${clp(resumen.ingresos.valor)} con una tasa de cierre de ${porcentaje(resumen.tasaCierre, 1)}${
    resumen.cicloVentaDias ? ` y un ciclo promedio de ${resumen.cicloVentaDias} días` : ""
  }. Las tres cuentas más grandes concentran el ${porcentaje(conc.top3, 1)} de la facturación${
    principal ? `, y el principal motivo de pérdida es "${principal.motivo}"` : ""
  }.`;

  const cifras = {
      ingresos90d: resumen.ingresos.valor,
      variacion: resumen.ingresos.variacion,
      tasaCierre: resumen.tasaCierre,
      cicloVentaDias: resumen.cicloVentaDias,
      ticketPromedio: resumen.ticketPromedio.valor,
      pipelinePonderado: resumen.pipelinePonderado,
      concentracionTop3: conc.top3,
      concentracionTop10: conc.top10,
      principalMotivoPerdida: principal?.motivo ?? null,
      perdidasTotales,
      mejorVendedor: equipo[0]?.nombre ?? null,
  };

  return (
    <>
      <PageHeader
        titulo="Reportes"
        bajada="Los números del trimestre con su lectura. Pensado para imprimirse y llevarse a la reunión."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Facturado (90 días)"
          valor={clp(resumen.ingresos.valor)}
          delta={resumen.ingresos.variacion}
          contexto="vs 90 días previos"
        />
        <StatTile
          etiqueta="Órdenes"
          valor={numero(resumen.ordenes.valor)}
          delta={resumen.ordenes.variacion}
          contexto={`ticket ${clp(resumen.ticketPromedio.valor)}`}
        />
        <StatTile
          etiqueta="Tasa de cierre"
          valor={porcentaje(resumen.tasaCierre, 1)}
          contexto={resumen.cicloVentaDias ? `ciclo ${resumen.cicloVentaDias} días` : ""}
        />
        <StatTile
          etiqueta="Concentración top 3"
          valor={porcentaje(conc.top3, 1)}
          contexto={`top 10: ${porcentaje(conc.top10, 1)}`}
          deltaBueno="abajo"
        />
      </div>

      <div className="mb-6">
        <Suspense fallback={<LecturaEsqueleto titulo="Lectura del trimestre" />}>
          <LecturaNarrada
            clave="reportes"
            titulo="Lectura del trimestre"
            resumen={cifras}
            contexto="Informe comercial trimestral para la reunión de gerencia de una empresa chilena"
            respaldo={respaldo}
            extra={
              conc.top3 > 50 ? (
                <p>
                  <strong>Riesgo de concentración:</strong> perder una de las tres
                  cuentas principales cambiaría el año. Vale la pena mirar el pipeline
                  de cuentas medianas antes de que eso pase.
                </p>
              ) : null
            }
          />
        </Suspense>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Figura
            titulo="Facturación mensual"
            subtitulo="Últimos 12 meses"
            pie="Fuente: órdenes del CRM. El último punto es el mes en curso y va incompleto; los meses sin ventas aparecen en cero."
          >
            <Lineas
              series={[
                {
                  nombre: "Facturación",
                  puntos: meses.map((m) => ({ x: m.etiqueta, y: m.total })),
                },
              ]}
              formatoY={clpCorto}
            />
          </Figura>
        </Card>

        <Card>
          <Figura titulo="Embudo" subtitulo="Oportunidades que alcanzaron cada etapa">
            <Embudo
              pasos={embudo.map((p) => ({
                etiqueta: p.nombre,
                valor: p.oportunidades,
                detalle: clpCorto(p.monto),
              }))}
            />
          </Figura>
        </Card>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card titulo="Rendimiento del equipo" padding={false}>
          {equipo.length === 0 ? (
            <div className="p-5">
              <Vacio mensaje="Sin datos del equipo" />
            </div>
          ) : (
            <Tabla
              columnas={[
                "Vendedor",
                { titulo: "Abiertas", alinear: "der" },
                { titulo: "Pipeline", alinear: "der" },
                { titulo: "Ganadas", alinear: "der" },
                { titulo: "Cierre", alinear: "der" },
              ]}
            >
              {equipo.map((v) => (
                <tr key={v.userId}>
                  <td className="font-medium">{v.nombre}</td>
                  <td className="crm-num text-right">{numero(v.abiertas)}</td>
                  <td className="crm-num text-right">{clp(v.montoAbierto)}</td>
                  <td className="crm-num text-right font-medium">{clp(v.montoGanado)}</td>
                  <td className="crm-num text-right">{porcentaje(v.tasaCierre, 0)}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>

        <Card>
          <Figura
            titulo="Por qué se pierden los negocios"
            subtitulo={`${numero(perdidasTotales)} oportunidades perdidas`}
            pie="Registrar el motivo al cerrar es lo que hace que este gráfico sirva para algo."
          >
            {motivos.length === 0 ? (
              <Vacio mensaje="Sin oportunidades perdidas registradas" />
            ) : (
              <BarrasH
                datos={motivos.map((m) => ({
                  etiqueta: m.motivo,
                  valor: m.n,
                  texto: `${numero(m.n)} · ${clpCorto(m.monto)}`,
                }))}
                colorUnico="var(--series-8)"
              />
            )}
          </Figura>
        </Card>
      </div>

      <Card
        titulo="Cuentas que más facturaron"
        descripcion="Últimos 12 meses"
        padding={false}
      >
        {top.length === 0 ? (
          <div className="p-5">
            <Vacio mensaje="Sin facturación registrada" />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Cuenta",
              { titulo: "Órdenes", alinear: "der" },
              { titulo: "Facturado", alinear: "der" },
              { titulo: "% del total", alinear: "der" },
            ]}
          >
            {top.map((t) => (
              <tr key={t.accountId}>
                <td>
                  <Link
                    href={`/crm/cuentas/${t.accountId}`}
                    className="font-medium hover:text-[var(--crm-brand-dark)]"
                  >
                    {t.nombre}
                  </Link>
                </td>
                <td className="crm-num text-right">{numero(t.ordenes)}</td>
                <td className="crm-num text-right font-medium">{clp(t.total)}</td>
                <td className="crm-num text-right">
                  {conc.total > 0 ? porcentaje((t.total / conc.total) * 100, 1) : "—"}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}
