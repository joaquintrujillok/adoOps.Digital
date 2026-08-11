import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, PageHeader, StatTile, Tabla, Vacio, btnSecundario } from "@/components/crm/ui";
import { Embudo, Figura, Lineas } from "@/components/crm/charts";
import { LecturaEsqueleto, LecturaNarrada } from "@/components/crm/LecturaNarrada";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, fecha, numero, porcentaje } from "@/lib/crm/formato";
import { listarAlertas } from "@/lib/crm/insights";
import { ingresosPorMes } from "@/lib/crm/marketing";
import { tareasPendientes } from "@/lib/crm/pipeline";
import { concentracion, embudoConversion, resumenComercial, topCuentas } from "@/lib/crm/reportes";
import { ownerScope } from "@/lib/crm/session";
import { accionCompletarTarea } from "@/lib/crm/acciones";

export const dynamic = "force-dynamic";

export default async function VisionGeneral() {
  const sesion = await requireSession();
  const alcance = ownerScope(sesion);

  const [resumen, alertas, meses, embudo, tareas, top, conc] = await Promise.all([
    resumenComercial(30),
    listarAlertas("abierta"),
    ingresosPorMes(12),
    embudoConversion(),
    tareasPendientes(alcance),
    topCuentas(365, 5),
    concentracion(365),
  ]);

  const altas = alertas.filter((a) => a.severidad === "alta");

  // El respaldo es un texto completo, no un placeholder: si el modelo no está
  // disponible, esta pantalla igual tiene que decir algo útil.
  const respaldo = [
    `En los últimos 30 días se facturaron ${clp(resumen.ingresos.valor)} en ${numero(resumen.ordenes.valor)} órdenes`,
    resumen.ingresos.variacion !== null
      ? `, un ${porcentaje(Math.abs(resumen.ingresos.variacion), 1)} ${resumen.ingresos.variacion >= 0 ? "más" : "menos"} que el período anterior.`
      : ".",
    ` El pipeline abierto suma ${clp(resumen.pipelineAbierto)} y, ponderado por probabilidad, se esperan ${clp(resumen.pipelinePonderado)}.`,
    alertas.length
      ? ` Hay ${alertas.length} alertas abiertas${altas.length ? `, ${altas.length} de severidad alta` : ""}: conviene partir por ahí.`
      : " No hay alertas abiertas.",
  ].join("");

  const cifras = {
    ingresos30d: resumen.ingresos.valor,
    ingresosPeriodoAnterior: resumen.ingresos.anterior,
    variacionIngresos: resumen.ingresos.variacion,
    ordenes30d: resumen.ordenes.valor,
    ticketPromedio: resumen.ticketPromedio.valor,
    pipelineAbierto: resumen.pipelineAbierto,
    pipelinePonderado: resumen.pipelinePonderado,
    oportunidadesAbiertas: resumen.oportunidadesAbiertas,
    tasaCierre: resumen.tasaCierre,
    cicloVentaDias: resumen.cicloVentaDias,
    alertasAbiertas: alertas.length,
    alertasAltas: altas.length,
    tituloAlertaMasGrave: altas[0]?.titulo ?? null,
    concentracionTop3: conc.top3,
  };

  return (
    <>
      <PageHeader
        titulo={`Hola, ${sesion.nombre.split(" ")[0]}`}
        bajada={`Esto es lo que está pasando comercialmente en los ${resumen.periodo.etiqueta}.`}
        acciones={
          <Link href="/crm/inteligencia" className={btnSecundario}>
            ◈ Ver alertas ({alertas.length})
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Facturado (30 días)"
          valor={clp(resumen.ingresos.valor)}
          delta={resumen.ingresos.variacion}
          contexto="vs 30 días previos"
        />
        <StatTile
          etiqueta="Pipeline ponderado"
          valor={clp(resumen.pipelinePonderado)}
          contexto={`de ${clp(resumen.pipelineAbierto)} abiertos`}
          href="/crm/oportunidades"
        />
        <StatTile
          etiqueta="Tasa de cierre"
          valor={porcentaje(resumen.tasaCierre, 1)}
          contexto={
            resumen.cicloVentaDias
              ? `ciclo de ${resumen.cicloVentaDias} días`
              : "sin ciclo calculable"
          }
        />
        <StatTile
          etiqueta="Ticket promedio"
          valor={clp(resumen.ticketPromedio.valor)}
          delta={resumen.ticketPromedio.variacion}
          contexto="vs período anterior"
        />
      </div>

      <div className="mb-6">
        <Suspense fallback={<LecturaEsqueleto />}>
          <LecturaNarrada
            clave="portada"
            resumen={cifras}
            contexto="Resumen ejecutivo de la portada de un CRM comercial, para el gerente comercial"
            respaldo={respaldo}
          />
        </Suspense>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Figura
            titulo="Facturación mensual"
            subtitulo="Últimos 12 meses, en pesos"
            pie="Fuente: órdenes cerradas del CRM. El último punto es el mes en curso y va incompleto; los meses sin ventas se muestran en cero, no se omiten."
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
          <Figura
            titulo="Embudo de conversión"
            subtitulo="Oportunidades que llegaron a cada etapa"
          >
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

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          titulo="Lo más urgente"
          descripcion="Alertas de severidad alta"
          className="lg:col-span-2"
          acciones={
            <Link href="/crm/inteligencia" className="text-[13px] text-[var(--crm-brand-dark)]">
              Ver todas →
            </Link>
          }
          padding={false}
        >
          {altas.length === 0 ? (
            <div className="p-5">
              <Vacio
                mensaje="No hay alertas de severidad alta"
                sugerencia="El motor revisa oportunidades estancadas, caídas de cuentas, stock comprometido y ventanas de recompra."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--crm-grid)]">
              {altas.slice(0, 5).map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <Badge tono="critico" icono="▲">
                      Alta
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium text-[var(--crm-ink)]">
                        {a.titulo}
                      </div>
                      <p className="mt-0.5 text-[13px] text-[var(--crm-ink-2)]">
                        {a.detalle}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card titulo="Tus tareas" descripcion="Pendientes asignadas a ti" padding={false}>
          {tareas.length === 0 ? (
            <div className="p-5">
              <Vacio mensaje="Sin tareas pendientes" />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--crm-grid)]">
              {tareas.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-start gap-2 px-5 py-3">
                  <form action={accionCompletarTarea}>
                    <input type="hidden" name="actividadId" value={t.id} />
                    <button
                      type="submit"
                      title="Marcar como hecha"
                      className="mt-0.5 h-4 w-4 rounded border border-[var(--crm-axis)] text-[11px] leading-none text-transparent hover:border-[var(--crm-brand)] hover:text-[var(--crm-brand)]"
                    >
                      ✓
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[var(--crm-ink)]">{t.titulo}</div>
                    <div className="text-[12px] text-[var(--crm-muted)]">
                      <Link href={`/crm/cuentas/${t.accountId}`} className="hover:underline">
                        {t.cuenta}
                      </Link>
                      {t.venceEn && (
                        <span className={t.vencida ? "ml-2 text-[#96201f]" : "ml-2"}>
                          {t.vencida ? "venció" : "vence"} {fecha(t.venceEn)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card
          titulo="Cuentas que más facturaron"
          descripcion={`Últimos 12 meses · las 3 más grandes concentran el ${porcentaje(conc.top3, 1)} de la facturación`}
          padding={false}
        >
          <Tabla
            columnas={[
              "Cuenta",
              { titulo: "Órdenes", alinear: "der" },
              { titulo: "Facturado", alinear: "der" },
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
              </tr>
            ))}
          </Tabla>
        </Card>
      </div>
    </>
  );
}
