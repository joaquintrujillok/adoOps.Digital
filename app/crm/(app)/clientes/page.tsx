import Link from "next/link";
import { Suspense } from "react";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  StatTile,
  Tabla,
  Vacio,
} from "@/components/crm/ui";
import {
  BarraApilada,
  BarrasH,
  Cohortes,
  Figura,
  Lineas,
  MatrizRfm,
  colorSerie,
} from "@/components/crm/charts";
import { LecturaEsqueleto, LecturaNarrada } from "@/components/crm/LecturaNarrada";
import { requireSession } from "@/lib/crm/auth.actions";
import {
  afinidadPorCategoria,
  calcularRfm,
  calidadDatos,
  clientesAnaliticos,
  cohortes,
  matrizRfm,
  migracionSegmentos,
  panorama,
  puertasDeEntrada,
  resumirLtv,
  resumirSegmentos,
  SEGMENTOS,
} from "@/lib/crm/analitica";
import { clp, clpCorto, numero, porcentaje } from "@/lib/crm/formato";
import { resumenShowroom } from "@/lib/crm/showroom";
import { recomendacionesDeUpgrade, resumenSistemas } from "@/lib/crm/sistemas";
import {
  alBordeDelSalto,
  ascensosDelAnio,
  carteraPorSegmento,
  definicionDe,
} from "@/lib/crm/segmentos-valor";

export const dynamic = "force-dynamic";

const VISTAS = [
  { id: "panorama", etiqueta: "Panorama" },
  { id: "segmentos", etiqueta: "Segmentos" },
  { id: "valor", etiqueta: "Valor de vida" },
  { id: "producto", etiqueta: "Producto" },
  // La vista propia del rubro. Va después de Producto porque se apoya en el
  // catálogo, y antes de Calidad del dato porque es de las que más se miran.
  { id: "sistemas", etiqueta: "Sistemas y upgrade" },
  { id: "datos", etiqueta: "Calidad del dato" },
] as const;

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  await requireSession();
  const { vista = "panorama" } = await searchParams;

  // Una sola pasada por los datos alimenta las cinco vistas: recalcular el RFM
  // en cada pestaña haría que dos pantallas abiertas a la vez muestren números
  // distintos si alguien compra entremedio.
  const base = await clientesAnaliticos();
  const rfm = calcularRfm(base);

  return (
    <>
      <PageHeader
        titulo="Clientes"
        bajada="Quiénes son, cuánto valen y qué hacer con cada grupo. Todo se calcula sobre las ventas que llegan del punto de venta y del e-commerce."
      />

      <nav className="crm-no-print mb-6 flex flex-wrap gap-1 border-b border-[var(--crm-grid)]">
        {VISTAS.map((v) => (
          <Link
            key={v.id}
            href={`/crm/clientes?vista=${v.id}`}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${
              vista === v.id
                ? "border-[var(--crm-brand)] font-medium text-[var(--crm-brand-dark)]"
                : "border-transparent text-[var(--crm-ink-2)] hover:text-[var(--crm-ink)]"
            }`}
          >
            {v.etiqueta}
          </Link>
        ))}
      </nav>

      {vista === "panorama" && <VistaPanorama rfm={rfm} />}
      {vista === "segmentos" && <VistaSegmentos />}
      {vista === "valor" && <VistaValor rfm={rfm} />}
      {vista === "producto" && <VistaProducto rfm={rfm} />}
      {vista === "sistemas" && <VistaSistemas />}
      {vista === "datos" && <VistaDatos />}
    </>
  );
}

// ─── Panorama ────────────────────────────────────────────────────────────────

async function VistaPanorama({ rfm }: { rfm: Awaited<ReturnType<typeof calcularRfm>> }) {
  const [p, ltv, calidad, showroom] = await Promise.all([
    panorama(rfm),
    Promise.resolve(resumirLtv(rfm)),
    calidadDatos(),
    resumenShowroom(),
  ]);

  const respaldo =
    `En los últimos 12 meses se facturaron ${clp(p.facturacion12m)} con ${numero(p.clientesActivos12m)} ` +
    `clientes activos y un ticket promedio de ${clp(p.ticketPromedio)}. ` +
    `El ${porcentaje(p.tasaRecompra, 1)} de los clientes volvió a comprar alguna vez. ` +
    `${numero(p.clientesEnRiesgo)} clientes están en riesgo de perderse. ` +
    `Solo el ${porcentaje(calidad.porcentajeIdentificado, 1)} de las ventas tiene un cliente asociado.`;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Facturación 12 meses"
          valor={clp(p.facturacion12m)}
          delta={p.variacion}
          contexto="vs los 12 meses previos"
        />
        <StatTile
          etiqueta="Clientes activos"
          valor={numero(p.clientesActivos12m)}
          contexto={`de ${numero(p.clientesConCompra)} con alguna compra`}
        />
        <StatTile
          etiqueta="Ventas identificadas"
          valor={porcentaje(calidad.porcentajeIdentificado, 1)}
          contexto="el resto no se puede analizar"
          deltaBueno="arriba"
        />
        <StatTile
          etiqueta="Valor de vida promedio"
          valor={clp(ltv.ltvHistorico)}
          contexto={`mediana ${clp(ltv.ltvMediana)}`}
        />
      </div>

      {/*
        El ritmo del negocio, arriba de todo.
        Es el número que ordena la lectura de todo lo demás: cuando entran
        cuatro ventas al mes, cualquier porcentaje con decimales que aparezca
        más abajo hay que leerlo sabiendo sobre cuántos casos se calculó.
      */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          etiqueta="Ventas al mes"
          valor={p.ventasPorMesPromedio.toFixed(1)}
          contexto="promedio de los últimos 12 meses"
        />
        <StatTile
          etiqueta="Venta típica"
          valor={clp(p.ticketMediana)}
          contexto={`el promedio es ${clp(p.ticketPromedio)}`}
        />
        <StatTile
          etiqueta="Concentración"
          valor={porcentaje(ltv.concentracionTop20, 0)}
          contexto="de la facturación viene del 20% de los clientes"
        />
      </div>

      <div className="mb-6">
        <Suspense fallback={<LecturaEsqueleto titulo="Qué dice esto" />}>
          <LecturaNarrada
            clave="clientes-panorama"
            resumen={{
              facturacion12m: p.facturacion12m,
              variacion: p.variacion,
              clientesActivos: p.clientesActivos12m,
              clientesNuevos12m: p.clientesNuevos12m,
              clientesRecuperados: p.clientesRecuperados,
              clientesEnRiesgo: p.clientesEnRiesgo,
              ticketPromedio: p.ticketPromedio,
              tasaRecompra: p.tasaRecompra,
              ltvPromedio: ltv.ltvHistorico,
              ltvOmnicanal: ltv.ltvOmnicanal,
              ltvUnCanal: ltv.ltvUnCanal,
              concentracionTop20: ltv.concentracionTop20,
              porcentajeVentasIdentificadas: calidad.porcentajeIdentificado,
            }}
            contexto="Panorama de la base de clientes de un retail de alta gama, para el dueño del negocio"
            respaldo={respaldo}
          />
        </Suspense>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Nuevos este año" valor={numero(p.clientesNuevos12m)} contexto="primera compra en 12 meses" />
        <StatTile etiqueta="Recuperados" valor={numero(p.clientesRecuperados)} contexto="volvieron tras más de un año" />
        <StatTile etiqueta="En riesgo" valor={numero(p.clientesEnRiesgo)} deltaBueno="abajo" contexto="se están enfriando o ya se fueron" />
        <StatTile
          etiqueta="Compran en ambos canales"
          valor={numero(p.omnicanal)}
          contexto={`valen ${clp(ltv.ltvOmnicanal)} contra ${clp(ltv.ltvUnCanal)}`}
        />
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Figura
            titulo="Facturación por trimestre"
            subtitulo="Últimos 24 meses, todos los canales"
            // Por trimestre y no por mes a propósito. Con tres o cuatro ventas
            // mensuales, la curva mensual es un serrucho que sube y baja según
            // si una venta cayó el 30 o el 2, y no hay ninguna decisión que
            // tomar mirándola. El trimestre junta una docena de ventas y ahí
            // sí una caída significa algo.
            pie="Agrupado por trimestre: con tres o cuatro ventas al mes, la curva mensual muestra ruido, no tendencia. El trimestre en curso va incompleto."
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

        <Card>
          <Figura
            titulo="De dónde viene la venta"
            subtitulo="Últimos 12 meses"
            pie="El e-commerce mueve unidades; el showroom mueve monto. Son dos negocios distintos con los mismos clientes."
          >
            <BarraApilada
              partes={p.ingresosPorCanal.map((c) => ({
                etiqueta: c.canal,
                valor: c.monto,
              }))}
              formato={clpCorto}
            />
            <Tabla columnas={["Canal", { titulo: "Ventas", alinear: "der" }, { titulo: "Monto", alinear: "der" }]}>
              {p.ingresosPorCanal.map((c) => (
                <tr key={c.canal}>
                  <td>{c.canal}</td>
                  <td className="crm-num text-right">{numero(c.ventas)}</td>
                  <td className="crm-num text-right font-medium">{clp(c.monto)}</td>
                </tr>
              ))}
            </Tabla>
          </Figura>
        </Card>
      </div>

      {/* Últimas ventas, con nombre.
          Con cuarenta ventas al año esto no es un adorno: es la vista más
          usada del panel. Nadie necesita que le resuman un mes de tres ventas
          —necesita ver cuáles fueron, quién compró y qué se llevó. */}
      <Card className="mb-6">
        <Figura
          titulo="Las últimas ventas"
          subtitulo="Todas, con nombre"
          pie="A este volumen conviene mirar las ventas una por una. Los promedios vienen después."
        >
          <Tabla
            columnas={[
              "Fecha",
              "Cliente",
              "Qué se llevó",
              "Canal",
              { titulo: "Monto", alinear: "der" },
            ]}
          >
            {p.ultimasVentas.map((v) => (
              <tr key={v.id}>
                <td className="crm-num whitespace-nowrap">
                  {v.fecha.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit" })}
                </td>
                <td>
                  {v.contactId ? (
                    <Link href={`/crm/contactos/${v.contactId}`} className="crm-link">
                      {v.cliente}
                    </Link>
                  ) : (
                    <span className="crm-muted">Sin identificar</span>
                  )}
                </td>
                <td className="crm-muted">{v.detalle ?? "—"}</td>
                <td className="crm-muted">{v.origen === "ecommerce" ? "E-commerce" : "Showroom"}</td>
                <td className="crm-num text-right font-medium">{clp(v.total)}</td>
              </tr>
            ))}
          </Tabla>
        </Figura>
      </Card>

      <Lectura titulo="El dato que ordena el proyecto">
        {/*
          Este texto cambió de raíz cuando el mock pasó a la escala real, y el
          cambio vale la pena explicarlo. Con el mock masivo el argumento era
          que la mitad de las boletas salía sin cliente. Acá eso sería falso:
          nadie despacha parlantes de veintiocho millones sin saber a quién, y
          los datos lo muestran con un porcentaje de identificación altísimo.

          Sostener el argumento viejo habría sido cómodo y habría durado hasta
          la primera pregunta del gerente. El hueco real de este negocio está
          antes de la venta, no en ella.
        */}
        <p>
          Las ventas están bien registradas: <strong>{porcentaje(calidad.porcentajeIdentificado, 0)} tiene
          cliente asociado</strong>. En un negocio de ticket alto es lo esperable —hay factura, hay
          despacho, hay instalación— y no es ahí donde falta información.
        </p>
        <p>
          El hueco está antes. Al showroom entraron{" "}
          <strong>{numero(showroom.total30d)} personas en los últimos 30 días</strong> contra{" "}
          {p.ventasPorMesPromedio.toFixed(1)} ventas al mes. La diferencia son personas que
          escucharon un equipo, se fueron a pensarlo y hoy no existen en ningún registro: no se les
          puede avisar cuándo llega lo que estaban esperando.
        </p>
        <p>
          A este volumen el cálculo es directo. Con una venta típica de {clp(p.ticketMediana)},{" "}
          <strong>recuperar dos visitas al año paga el sistema completo</strong>. Por eso la captura
          en el showroom no es un módulo más: es el que alimenta a todos los otros.
        </p>
      </Lectura>
    </>
  );
}

// ─── RFM ─────────────────────────────────────────────────────────────────────

async function VistaSegmentos() {
  const [cartera, ascensos, alBorde] = await Promise.all([
    carteraPorSegmento(),
    ascensosDelAnio(),
    alBordeDelSalto(8),
  ]);

  const totalClientes = cartera.reduce((s, c) => s + c.clientes, 0);
  const arriba = cartera.filter((s) => s.clave === "reference" || s.clave === "highend");
  const clientesArriba = arriba.reduce((s, c) => s + c.clientes, 0);
  const montoArriba = arriba.reduce((s, c) => s + c.porcentajeMonto, 0);

  return (
    <>
      {/*
        Cuatro tarjetas y no once. La segmentación anterior era RFM de manual
        —campeones, leales, hibernando— y sobre setenta y seis personas dejaba
        siete por casilla, con nombres que nadie del negocio usa. Estos cuatro
        tramos los definió el negocio en pesos, y por eso se pueden repetir.
      */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cartera.map((s) => (
          <Card key={s.clave}>
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
              <span className="crm-num text-[32px] font-semibold leading-none">
                {numero(s.clientes)}
              </span>
              <span className="text-[13px] text-[var(--crm-ink-2)]">
                {s.clientes === 1 ? "cliente" : "clientes"}
              </span>
            </div>
            <div className="mt-2.5 text-[13px] text-[var(--crm-ink-2)]">
              {clp(s.monto)}
              <span className="text-[var(--crm-muted)]"> · {porcentaje(s.porcentajeMonto, 0)} del total</span>
            </div>
            <div className="mt-1 text-[12px] text-[var(--crm-muted)]">
              Promedio {clp(s.valorPromedio)} · {numero(s.activos)} activos
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-6">
        <Lectura titulo="Lo que dicen estos cuatro números">
          <p>
            <strong>
              {numero(clientesArriba)} de {numero(totalClientes)} clientes concentran el{" "}
              {porcentaje(montoArriba, 0)} de la facturación.
            </strong>{" "}
            Con tres ventas al mes, eso no es una curiosidad estadística: es la lista de personas
            que hay que tratar por nombre, y cabe en una hoja.
          </p>
          <p>
            Los cortes están en pesos y los puso el negocio, no una fórmula. Es lo que permite
            decir <em>&ldquo;Reference es sobre cien millones&rdquo;</em> en una reunión y que
            signifique siempre lo mismo. Un porcentaje de la cartera —el 20% que más compra— sobre
            setenta y seis personas serían quince por definición, hubieran puesto cien millones o
            cinco.
          </p>
        </Lectura>
      </div>

      {/* ── Los ascensos: la métrica de crecimiento que este volumen sí permite ── */}
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card
          titulo="Quiénes subieron de tramo este año"
          descripcion="La medida de crecimiento que se puede leer a este volumen."
        >
          {ascensos.length === 0 ? (
            <Vacio mensaje="Nadie cambió de tramo en los últimos doce meses" />
          ) : (
            <>
              <Tabla columnas={["Cliente", "Movimiento", { titulo: "Sumó", alinear: "der" }]}>
                {ascensos.slice(0, 8).map((a) => (
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
              <p className="mt-3 text-[12px] text-[var(--crm-muted)]">
                &ldquo;La facturación subió un 12%&rdquo; sobre cuarenta ventas al año es ruido.
                &ldquo;Estos {numero(ascensos.length)} clientes subieron de tramo&rdquo; es un hecho
                sobre el que se puede actuar.
              </p>
            </>
          )}
        </Card>

        <Card
          titulo="A un paso del tramo siguiente"
          descripcion="Una sola compra los cruza. Es la lista más accionable del panel."
        >
          {alBorde.length === 0 ? (
            <Vacio mensaje="Nadie está cerca de cruzar un corte" />
          ) : (
            <Tabla
              columnas={[
                "Cliente",
                { titulo: "Lleva", alinear: "der" },
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
                  </td>
                  <td className="crm-num text-right">{clp(b.valor)}</td>
                  <td className="crm-num text-right font-semibold text-[var(--crm-brand-dark)]">
                    {clp(b.falta)}
                  </td>
                  <td className="text-[13px]">{definicionDe(b.siguiente).nombre}</td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>
      </div>

      {/* ── La cartera con nombre y apellido ──
          A este volumen se listan las personas, no se resumen. Un panel que
          diga "Reference: 8" y no diga quiénes son obliga a otra consulta que
          nadie hace. */}
      {cartera.map((s) => (
        <Card
          key={s.clave}
          titulo={`${s.nombre} · ${s.rango}`}
          descripcion={s.descripcion}
          className="mb-5"
          padding={false}
        >
          <div className="border-b border-[var(--crm-grid)] bg-[var(--crm-brand-soft)]/40 px-5 py-3 text-[13px] text-[var(--crm-brand-dark)]">
            <strong>Qué corresponde hacer:</strong> {s.accion}
          </div>
          {s.miembros.length === 0 ? (
            <Vacio mensaje="Sin clientes en este tramo" />
          ) : (
            <div className="max-h-[420px] overflow-y-auto crm-scroll">
              <Tabla
                columnas={[
                  "Cliente",
                  { titulo: "Ha invertido", alinear: "der" },
                  { titulo: "Compras", alinear: "der" },
                  { titulo: "Última", alinear: "der" },
                ]}
              >
                {s.miembros.map((m) => (
                  <tr key={m.contactId}>
                    <td>
                      <Link href={`/crm/contactos/${m.contactId}`} className="crm-link">
                        {m.nombre}
                      </Link>
                      {m.telefono ? (
                        <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                          {m.telefono}
                        </div>
                      ) : null}
                    </td>
                    <td className="crm-num text-right font-medium">{clp(m.valor)}</td>
                    <td className="crm-num text-right">{numero(m.compras)}</td>
                    <td className="crm-num text-right text-[var(--crm-ink-2)]">
                      {m.diasSinComprar === null
                        ? "—"
                        : m.diasSinComprar > 730
                          ? `${Math.floor(m.diasSinComprar / 365)} años`
                          : `${numero(m.diasSinComprar)} d`}
                    </td>
                  </tr>
                ))}
              </Tabla>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

// ─── Valor de vida ───────────────────────────────────────────────────────────

async function VistaValor({ rfm }: { rfm: Awaited<ReturnType<typeof calcularRfm>> }) {
  const ltv = resumirLtv(rfm);
  const coh = await cohortes(12);
  const top = [...rfm].sort((a, b) => b.monto - a.monto).slice(0, 12);

  // Se muestran las cohortes con al menos tres clientes. El umbral es bajo a
  // propósito ahora que las cohortes son anuales: son cuatro o cinco filas en
  // total y esconder una porque tiene cuatro personas dejaría la tabla sin
  // el año contra el que hay que comparar.
  const cohortesUtiles = coh.filter((c) => c.clientes >= 3);

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Valor de vida promedio"
          valor={clp(ltv.ltvHistorico)}
          contexto={`mediana ${clp(ltv.ltvMediana)}`}
        />
        <StatTile
          etiqueta="Proyección 12 meses"
          valor={clp(ltv.ltvProyectado12m)}
          contexto="por cliente activo, a ritmo actual"
        />
        <StatTile
          etiqueta="Concentración"
          valor={porcentaje(ltv.concentracionTop20, 1)}
          contexto="de los ingresos viene del 20% que más compra"
          deltaBueno="abajo"
        />
        <StatTile
          etiqueta="Vida promedio"
          valor={`${numero(Math.round(ltv.vidaPromedioDias / 30))} meses`}
          contexto={`${ltv.comprasPromedio.toFixed(1)} compras por cliente`}
        />
      </div>

      <div className="mb-6">
        <Lectura titulo="Lo que cambia una decisión">
          <p>
            Un cliente que compra en los dos canales vale{" "}
            <strong>{clp(ltv.ltvOmnicanal)}</strong> contra {clp(ltv.ltvUnCanal)} de quien compra
            en uno solo:{" "}
            <strong>
              {ltv.ltvUnCanal > 0
                ? `${(ltv.ltvOmnicanal / ltv.ltvUnCanal).toFixed(1)} veces más`
                : "bastante más"}
            </strong>
            . Eso convierte "que el cliente de tienda conozca la web" en un objetivo con número, no
            en una intuición.
          </p>
          <p>
            La diferencia entre el promedio ({clp(ltv.ltvHistorico)}) y la mediana (
            {clp(ltv.ltvMediana)}) muestra la forma real del negocio: unos pocos clientes sostienen
            una parte enorme de los ingresos, y por eso perder uno de los grandes no se compensa
            con diez chicos.
          </p>
        </Lectura>
      </div>

      <Card
        titulo="Valor acumulado por cohorte"
        descripcion="Cada fila son los clientes que compraron por primera vez ese año. Las columnas son los trimestres transcurridos desde su entrada."
        className="mb-6"
      >
        {cohortesUtiles.length === 0 ? (
          <Vacio mensaje="Todavía no hay cohortes con historia suficiente" />
        ) : (
          <>
            <Cohortes
              filas={cohortesUtiles.map((c) => ({
                etiqueta: c.etiqueta,
                clientes: c.clientes,
                valores: c.acumulado,
              }))}
              columnas={12}
              formato={clpCorto}
            />
            <p className="mt-3 text-[12px] text-[var(--crm-muted)]">
              Las celdas vacías de la derecha no son ceros: son trimestres que esa cohorte todavía
              no vivió. Comparar el trimestre 4 de una cohorte con el trimestre 4 de otra responde
              la pregunta que importa — si los clientes nuevos valen más o menos que los de antes a
              la misma edad.
            </p>
            <p className="mt-2 text-[12px] text-[var(--crm-muted)]">
              {/* La justificación va en pantalla y no solo en el código: a quien
                  mire esta tabla le va a extrañar que no sea mensual como en
                  todas partes, y la respuesta tiene que estar ahí mismo. */}
              Las cohortes son anuales y no mensuales porque entran unos veinte clientes nuevos al
              año: una cohorte de un mes serían dos personas, y con dos personas el promedio no
              muestra una tendencia, muestra a uno de los dos.
            </p>
          </>
        )}
      </Card>

      <Card titulo="Los clientes que más han comprado" padding={false}>
        <Tabla
          columnas={[
            "Cliente",
            "Segmento",
            { titulo: "Compras", alinear: "der" },
            { titulo: "Comprado", alinear: "der" },
            { titulo: "Ticket", alinear: "der" },
            { titulo: "Última", alinear: "der" },
            "Canal",
            "Ejecutivo",
          ]}
        >
          {top.map((c) => (
            <tr key={c.contactId}>
              <td>
                <Link
                  href={`/crm/contactos/${c.contactId}`}
                  className="font-medium hover:text-[var(--crm-brand-dark)]"
                >
                  {c.nombre}
                </Link>
                <div className="text-[12px] text-[var(--crm-muted)]">
                  {[c.ciudad, c.categoriaPrincipal].filter(Boolean).join(" · ")}
                </div>
              </td>
              <td>
                <Badge tono="neutro">{SEGMENTOS[c.segmento].nombre}</Badge>
              </td>
              <td className="crm-num text-right">{numero(c.compras)}</td>
              <td className="crm-num text-right font-medium">{clp(c.monto)}</td>
              <td className="crm-num text-right">{clp(c.ticketPromedio)}</td>
              <td className="crm-num text-right">{numero(c.recencia ?? 0)} d</td>
              <td>
                {c.omnicanal ? (
                  <Badge tono="bueno" icono="◆">
                    Ambos
                  </Badge>
                ) : (
                  <span className="text-[13px] text-[var(--crm-ink-2)]">
                    {c.canales[0] === "ecommerce" ? "E-commerce" : "Showroom"}
                  </span>
                )}
              </td>
              <td className="text-[13px] text-[var(--crm-ink-2)]">{c.ejecutivo ?? "—"}</td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  );
}

// ─── Producto ────────────────────────────────────────────────────────────────

async function VistaProducto({ rfm }: { rfm: Awaited<ReturnType<typeof calcularRfm>> }) {
  const afinidad = afinidadPorCategoria(rfm);
  const puertas = puertasDeEntrada(rfm);
  const mejorPuerta = [...puertas].sort((a, b) => b.tasaRecompra - a.tasaRecompra)[0];

  return (
    <>
      <div className="mb-6">
        <Lectura titulo="Qué producto trae mejores clientes">
          {mejorPuerta ? (
            <p>
              Quien entra comprando <strong>{mejorPuerta.categoria.toLowerCase()}</strong> vuelve a
              comprar en el {porcentaje(mejorPuerta.tasaRecompra, 0)} de los casos y termina
              gastando {clp(mejorPuerta.ltv)} en promedio. Eso cambia cómo se mira esa categoría:
              deja de medirse por su margen y pasa a medirse por los clientes que trae.
            </p>
          ) : (
            <p>Todavía no hay historia suficiente para identificar la puerta de entrada.</p>
          )}
        </Lectura>
      </div>

      <Card
        titulo="Por dónde entra cada cliente y qué compra después"
        descripcion="La categoría de su primera compra, y lo que sumó en las siguientes."
        className="mb-6"
        padding={false}
      >
        <Tabla
          columnas={[
            "Entró comprando",
            { titulo: "Clientes", alinear: "der" },
            { titulo: "Vuelve", alinear: "der" },
            { titulo: "Compras", alinear: "der" },
            { titulo: "Valor de vida", alinear: "der" },
            "Después compra",
          ]}
        >
          {puertas.map((p) => (
            <tr key={p.categoria}>
              <td className="font-medium">{p.categoria}</td>
              <td className="crm-num text-right">{numero(p.clientes)}</td>
              <td className="crm-num text-right font-medium">{porcentaje(p.tasaRecompra, 0)}</td>
              <td className="crm-num text-right">{p.comprasPromedio.toFixed(1)}</td>
              <td className="crm-num text-right font-medium">{clp(p.ltv)}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {p.siguientes.length === 0 ? (
                    <span className="text-[13px] text-[var(--crm-muted)]">no vuelve</span>
                  ) : (
                    p.siguientes.map((s) => (
                      <Badge key={s.categoria} tono="neutro">
                        {s.categoria} · {s.clientes}
                      </Badge>
                    ))
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Tabla>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <Figura
            titulo="Valor de vida por categoría"
            subtitulo="Cuánto gasta en total quien compra cada una"
            pie="Ojo: no es el precio de la categoría, es lo que termina gastando el cliente que la compra."
          >
            <BarrasH
              datos={afinidad.map((a) => ({
                etiqueta: a.categoria,
                valor: a.ltv,
                texto: clpCorto(a.ltv),
              }))}
            />
          </Figura>
        </Card>

        <Card>
          <Figura
            titulo="Tasa de recompra por categoría"
            subtitulo="Qué porcentaje de sus compradores vuelve"
            pie="Una categoría con recompra alta es un motor de relación; una con recompra baja es una venta única por más que facture."
          >
            <BarrasH
              datos={[...afinidad]
                .sort((a, b) => b.tasaRecompra - a.tasaRecompra)
                .map((a) => ({
                  etiqueta: a.categoria,
                  valor: a.tasaRecompra,
                  texto: porcentaje(a.tasaRecompra, 0),
                }))}
              colorUnico="var(--series-3)"
            />
          </Figura>
        </Card>
      </div>

      <Card
        titulo="Quién compra cada categoría"
        descripcion="Composición por segmento. Es lo que permite armar una campaña por producto sin mandarle lo mismo a todos."
        className="mt-6"
        padding={false}
      >
        <Tabla
          columnas={[
            "Categoría",
            { titulo: "Clientes", alinear: "der" },
            { titulo: "Comprado", alinear: "der" },
            { titulo: "Ticket", alinear: "der" },
            "Composición",
          ]}
        >
          {afinidad.map((a) => (
            <tr key={a.categoria}>
              <td className="font-medium">{a.categoria}</td>
              <td className="crm-num text-right">{numero(a.clientes)}</td>
              <td className="crm-num text-right font-medium">{clp(a.monto)}</td>
              <td className="crm-num text-right">{clp(a.ticket)}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {a.porSegmento.slice(0, 4).map((s, i) => (
                    <span
                      key={s.segmento}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--crm-grid)] px-2 py-0.5 text-[12px]"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: colorSerie(i) }}
                      />
                      {s.nombre} · {s.clientes}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  );
}

// ─── Sistemas y ruta de upgrade ──────────────────────────────────────────────

/**
 * La vista que solo existe porque el negocio es este y no otro.
 *
 * El RFM y el LTV sirven en cualquier retail. Esto no: un equipo de audio es
 * una cadena —fuente, previo, etapa, parlantes— y suena tan bien como su
 * eslabón más flojo. Saber qué tiene armado cada cliente y qué le falta es la
 * conversación de venta más natural del rubro, y sale entera de datos que la
 * tienda ya tiene.
 *
 * Con tres o cuatro ventas al mes, además, es el panel que reemplaza a los
 * promedios: acá no hay distribuciones, hay veinte personas con nombre y una
 * razón concreta para llamar a cada una.
 */
async function VistaSistemas() {
  const [resumen, recomendaciones] = await Promise.all([
    resumenSistemas(),
    recomendacionesDeUpgrade(20),
  ]);

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Armando su sistema"
          valor={numero(resumen.enConstruccion)}
          contexto="volvieron al menos una vez"
        />
        <StatTile
          etiqueta="Sistemas completos"
          valor={numero(resumen.completos)}
          contexto="tienen los cuatro eslabones"
        />
        <StatTile
          etiqueta="Con eslabón débil"
          valor={numero(resumen.conEslabonDebil)}
          contexto="una pieza desentona con el resto"
        />
        <StatTile
          etiqueta="Compra suelta"
          valor={numero(resumen.compraSuelta)}
          contexto="una sola pieza, sin sistema todavía"
        />
      </div>

      <div className="mb-6">
        <Lectura titulo="Cómo se lee esta pantalla">
          <p>
            En audio nadie compra dos veces lo mismo: se compra <strong>lo que falta</strong>. El
            cliente parte por los parlantes o por la fuente y vuelve meses después por la etapa. Esa
            es la recompra de este rubro, y es predecible mirando lo que ya se llevó.
          </p>
          <p>
            Hay dos motivos para llamar. <strong>Completar</strong> es que le falta un eslabón para
            cerrar el equipo. <strong>Equilibrar</strong> es que tiene una pieza muy por debajo del
            resto —parlantes de veinte millones movidos por una etapa de cuatro— y el sistema está
            rindiendo menos de lo que costó.
          </p>
          <p>
            {/* El techo hay que declararlo en la pantalla, no en una nota al pie
                de la propuesta: es la diferencia entre una cifra y una promesa. */}
            El precio sugerido es <strong>de lista y sin descuento</strong>, apuntando al nivel en
            que ese cliente compra habitualmente y no a su pieza más cara. Es una referencia para
            abrir la conversación, no un pronóstico de venta: acá la pieza grande se negocia.
          </p>
        </Lectura>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <Figura
            titulo="Las veinte conversaciones que existen hoy"
            subtitulo="Ordenadas por lo que cada cliente ha invertido"
            pie="Veinte y no todas: una lista de sesenta recomendaciones es una lista que nadie trabaja. Estas son las que caben en el mes de alguien que además atiende el showroom."
          >
            <Tabla
              columnas={[
                "Cliente",
                "Motivo",
                "Qué le falta",
                { titulo: "Ha invertido", alinear: "der" },
                { titulo: "Referencia", alinear: "der" },
              ]}
            >
              {recomendaciones.map((r) => (
                <tr key={`${r.contactId}-${r.eslabon}`}>
                  <td>
                    <Link href={`/crm/contactos/${r.contactId}`} className="crm-link">
                      {r.cliente}
                    </Link>
                    <div className="text-[12px] text-[var(--crm-muted)]">
                      {r.diasSinComprar} días sin comprar
                    </div>
                  </td>
                  <td>
                    <span
                      className="rounded px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide"
                      style={
                        r.tipo === "equilibrar"
                          ? { background: "var(--crm-brand-soft)", color: "var(--crm-brand-dark)" }
                          : { background: "rgba(42,120,214,0.1)", color: "var(--series-1)" }
                      }
                    >
                      {r.tipo}
                    </span>
                    <div className="mt-1 max-w-[380px] text-[12px] text-[var(--crm-ink-2)]">
                      {r.motivo}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{r.eslabonNombre}</td>
                  <td className="crm-num text-right">{clp(r.invertido)}</td>
                  <td className="crm-num text-right">
                    {r.sugerido ? (
                      <>
                        <div className="font-medium">{clp(r.sugerido.precio)}</div>
                        <div className="text-[12px] text-[var(--crm-muted)]">
                          {r.sugerido.nombre}
                        </div>
                      </>
                    ) : (
                      <span className="crm-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          </Figura>
        </Card>

        <Card>
          <Figura
            titulo="Qué eslabón falta más"
            subtitulo="Solo sobre quienes ya están armando un sistema"
            pie="El soporte —cables, acondicionador, racks— queda fuera del conteo: es complemento, no eslabón faltante, y meterlo dejaría a todos incompletos para siempre."
          >
            <Tabla columnas={["Eslabón", { titulo: "Clientes", alinear: "der" }]}>
              {resumen.faltantesPorEslabon.map((f) => (
                <tr key={f.eslabon}>
                  <td>{f.nombre}</td>
                  <td className="crm-num text-right font-medium">{numero(f.clientes)}</td>
                </tr>
              ))}
            </Tabla>
            <p className="mt-4 text-[13px] text-[var(--crm-ink-2)]">
              A precio de lista, cerrar estos sistemas son{" "}
              <strong>{clp(resumen.oportunidadEnPesos)}</strong>. Es un techo teórico y hay que
              decirlo así: nadie va a comprar todo, y lo que se compre se va a negociar.
            </p>
          </Figura>
        </Card>
      </div>
    </>
  );
}

// ─── Calidad del dato ────────────────────────────────────────────────────────

async function VistaDatos() {
  const c = await calidadDatos();
  const contactables = c.contactables;

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Ventas identificadas"
          valor={porcentaje(c.porcentajeIdentificado, 1)}
          contexto={`${numero(c.ventasIdentificadas)} de ${numero(c.ventasTotales)}`}
        />
        <StatTile
          etiqueta="Facturación sin dueño"
          valor={clp(c.montoAnonimo)}
          contexto={`${porcentaje(c.porcentajeMontoAnonimo, 1)} del total`}
          deltaBueno="abajo"
        />
        <StatTile
          etiqueta="Con consentimiento"
          valor={numero(contactables.conConsentimiento)}
          contexto={`de ${numero(contactables.total)} contactos`}
        />
        <StatTile
          etiqueta="Con WhatsApp autorizado"
          valor={numero(contactables.conWhatsapp)}
          contexto="los únicos a los que se les puede escribir"
        />
      </div>

      <div className="mb-6">
        <Lectura titulo="Por qué esta pantalla es la más importante del proyecto">
          <p>
            Todo lo demás —segmentos, valor de vida, alertas— se calcula sobre las ventas que
            tienen un cliente detrás. Hoy son el {porcentaje(c.porcentajeIdentificado, 1)}. El resto
            son {clp(c.montoAnonimo)} de facturación que el análisis no puede tocar.
          </p>
          <p>
            La brecha no se cierra con tecnología sino con un hábito en el mostrador: pedir el dato
            y registrarlo en el momento de la venta. La captura con QR del showroom existe
            justamente para que ese hábito tome diez segundos y no dos minutos.
          </p>
        </Lectura>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <Figura
            titulo="Evolución de la identificación"
            subtitulo="Porcentaje de ventas con cliente asociado, por trimestre"
            pie="Por trimestre: sobre tres o cuatro ventas al mes, este porcentaje salta entre 33% y 100% según si el vendedor alcanzó a pedir el RUT una vez más. El trimestre junta una docena de ventas y ahí el número ya significa algo."
          >
            <Lineas
              series={[
                {
                  nombre: "% identificadas",
                  puntos: c.evolucion.map((e) => ({ x: e.etiqueta, y: Math.round(e.porcentaje) })),
                },
              ]}
              formatoY={(n) => `${n}%`}
            />
          </Figura>
        </Card>

        <Card titulo="Identificación por canal" padding={false}>
          <Tabla
            columnas={[
              "Canal",
              { titulo: "Ventas", alinear: "der" },
              { titulo: "Identificadas", alinear: "der" },
              { titulo: "%", alinear: "der" },
              { titulo: "Monto", alinear: "der" },
            ]}
          >
            {c.porOrigen.map((o) => {
              const pct = o.ventas > 0 ? (o.identificadas / o.ventas) * 100 : 0;
              return (
                <tr key={o.origen}>
                  <td className="font-medium">
                    {o.origen === "ecommerce" ? "E-commerce" : o.origen === "pos" ? "Punto de venta" : o.origen}
                  </td>
                  <td className="crm-num text-right">{numero(o.ventas)}</td>
                  <td className="crm-num text-right">{numero(o.identificadas)}</td>
                  <td className="text-right">
                    <Badge tono={pct >= 90 ? "bueno" : pct >= 60 ? "alerta" : "critico"}>
                      {porcentaje(pct, 0)}
                    </Badge>
                  </td>
                  <td className="crm-num text-right font-medium">{clp(o.monto)}</td>
                </tr>
              );
            })}
          </Tabla>
          <div className="border-t border-[var(--crm-grid)] px-5 py-3 text-[13px] text-[var(--crm-ink-2)]">
            El e-commerce identifica siempre: hay cuenta, correo y dirección de despacho. La brecha
            está completa en el mostrador, y ahí es donde se puede mover la aguja.
          </div>
        </Card>
      </div>

      <Card titulo="Con qué se puede contactar a la base" descripcion="De nada sirve un segmento al que no se le puede escribir">
        <BarrasH
          datos={[
            { etiqueta: "Tienen teléfono", valor: contactables.conTelefono, texto: numero(contactables.conTelefono) },
            { etiqueta: "Tienen correo", valor: contactables.conEmail, texto: numero(contactables.conEmail) },
            { etiqueta: "Tienen ambos", valor: contactables.conAmbos, texto: numero(contactables.conAmbos) },
            { etiqueta: "Dieron consentimiento", valor: contactables.conConsentimiento, texto: numero(contactables.conConsentimiento) },
            { etiqueta: "Autorizan WhatsApp", valor: contactables.conWhatsapp, texto: numero(contactables.conWhatsapp) },
          ]}
          anchoEtiqueta={190}
        />
        <p className="mt-3 text-[12px] text-[var(--crm-muted)]">
          El consentimiento no es un trámite: sin él, el dato sirve para el registro de la venta y
          para nada más. La ley 19.628 y el sentido común coinciden en esto.
        </p>
      </Card>
    </>
  );
}
