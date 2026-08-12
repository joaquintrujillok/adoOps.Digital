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

export const dynamic = "force-dynamic";

const VISTAS = [
  { id: "panorama", etiqueta: "Panorama" },
  { id: "rfm", etiqueta: "Segmentos RFM" },
  { id: "valor", etiqueta: "Valor de vida" },
  { id: "producto", etiqueta: "Producto" },
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
      {vista === "rfm" && <VistaRfm rfm={rfm} />}
      {vista === "valor" && <VistaValor rfm={rfm} />}
      {vista === "producto" && <VistaProducto rfm={rfm} />}
      {vista === "datos" && <VistaDatos />}
    </>
  );
}

// ─── Panorama ────────────────────────────────────────────────────────────────

async function VistaPanorama({ rfm }: { rfm: Awaited<ReturnType<typeof calcularRfm>> }) {
  const [p, ltv, calidad] = await Promise.all([
    panorama(rfm),
    Promise.resolve(resumirLtv(rfm)),
    calidadDatos(),
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
            titulo="Facturación mensual"
            subtitulo="Últimos 12 meses, todos los canales"
            pie="Fuente: ventas del punto de venta y del e-commerce. El último mes va incompleto."
          >
            <Lineas
              series={[
                {
                  nombre: "Facturación",
                  puntos: p.ventasPorMes.map((m) => ({ x: m.etiqueta, y: m.monto })),
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

      <Lectura titulo="El dato que ordena el proyecto">
        <p>
          <strong>{porcentaje(100 - calidad.porcentajeIdentificado, 1)} de las ventas no tiene
          cliente asociado</strong>, y eso son {clp(calidad.montoAnonimo)} que existen en la
          contabilidad y no existen en el CRM: no tienen segmento, no tienen valor de vida y no
          se les puede escribir.
        </p>
        <p>
          Subir esa cifra es la palanca más barata del proyecto. Cada punto porcentual son{" "}
          {clp(Math.round((calidad.montoIdentificado + calidad.montoAnonimo) / 100))} de venta que
          pasan a ser analizables. Por eso la captura en el showroom no es un módulo aparte: es lo
          que hace que todo lo demás tenga con qué trabajar.
        </p>
      </Lectura>
    </>
  );
}

// ─── RFM ─────────────────────────────────────────────────────────────────────

async function VistaRfm({ rfm }: { rfm: Awaited<ReturnType<typeof calcularRfm>> }) {
  const resumen = resumirSegmentos(rfm);
  const celdas = matrizRfm(rfm);
  const migracion = await migracionSegmentos(3);

  const criticos = resumen.filter((s) =>
    ["no_perder", "en_riesgo", "necesitan_atencion"].includes(s.segmento),
  );
  const montoCritico = criticos.reduce((s, x) => s + x.monto, 0);

  return (
    <>
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card
          titulo="Dónde está la base"
          descripcion="Recencia (qué tan reciente compró) contra frecuencia (cuántas veces). El color es cantidad de clientes."
        >
          <MatrizRfm celdas={celdas} formatoMonto={clp} />
          <p className="mt-3 text-[12px] text-[var(--crm-muted)]">
            Arriba a la derecha están los mejores: compran seguido y hace poco. Abajo a la
            izquierda, los que ya se fueron. La recencia va por quintiles de la base —así el
            corte sigue significando lo mismo cuando el negocio crece— y la frecuencia por
            número de compras: F1 es una compra, F5 son seis o más.
          </p>
        </Card>

        <Card
          titulo={`Movimiento de los últimos ${migracion.mesesAtras} meses`}
          descripcion="Una foto dice cuántos hay en cada grupo; esto dice quién se está moviendo."
          padding={false}
        >
          {migracion.movimientos.length === 0 ? (
            <div className="p-5">
              <Vacio mensaje="Sin movimientos en el período" />
            </div>
          ) : (
            <Tabla columnas={["Pasaron de", "A", { titulo: "Clientes", alinear: "der" }]}>
              {migracion.movimientos.slice(0, 10).map((m, i) => (
                <tr key={i}>
                  <td className="text-[var(--crm-ink-2)]">{m.nombreDesde}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden style={{ color: m.mejora ? "var(--status-good-text)" : "var(--status-critical)" }}>
                        {m.mejora ? "▲" : "▼"}
                      </span>
                      <strong>{m.nombreHasta}</strong>
                    </span>
                  </td>
                  <td className="crm-num text-right font-medium">{numero(m.clientes)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="text-[var(--crm-ink-2)]">
                  Clientes nuevos en el período
                </td>
                <td className="crm-num text-right font-medium">{numero(migracion.nuevos)}</td>
              </tr>
            </Tabla>
          )}
        </Card>
      </div>

      {criticos.length > 0 && (
        <div className="mb-6">
          <Lectura titulo="Por dónde partir">
            <p>
              {numero(criticos.reduce((s, x) => s + x.clientes, 0))} clientes están en los grupos
              que exigen acción —{criticos.map((c) => c.nombre.toLowerCase()).join(", ")}— y entre
              todos han comprado <strong>{clp(montoCritico)}</strong>. No son prospectos: son gente
              que ya confió en la marca y se está enfriando.
            </p>
          </Lectura>
        </div>
      )}

      <Card titulo="Los segmentos" descripcion="Ordenados por lo que han comprado. Cada uno con lo que corresponde hacer." padding={false}>
        <Tabla
          columnas={[
            "Segmento",
            { titulo: "Clientes", alinear: "der" },
            { titulo: "% base", alinear: "der" },
            { titulo: "Comprado", alinear: "der" },
            { titulo: "% ingresos", alinear: "der" },
            { titulo: "Ticket", alinear: "der" },
            { titulo: "Sin comprar", alinear: "der" },
            { titulo: "Contactables", alinear: "der" },
          ]}
        >
          {resumen.map((s) => (
            <tr key={s.segmento}>
              <td>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: s.tono }}
                  />
                  <div>
                    <div className="font-medium">{s.nombre}</div>
                    <div className="text-[12px] text-[var(--crm-muted)]">{s.descripcion}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--crm-brand-dark)]">
                      → {s.accion}
                    </div>
                  </div>
                </div>
              </td>
              <td className="crm-num text-right font-medium">{numero(s.clientes)}</td>
              <td className="crm-num text-right">{porcentaje(s.porcentaje, 1)}</td>
              <td className="crm-num text-right font-medium">{clp(s.monto)}</td>
              <td className="crm-num text-right">{porcentaje(s.porcentajeMonto, 1)}</td>
              <td className="crm-num text-right">{clp(s.ticketPromedio)}</td>
              <td className="crm-num text-right">{numero(s.recenciaMediana)} d</td>
              <td className="crm-num text-right">
                {numero(s.contactables)}
                <div className="text-[12px] text-[var(--crm-muted)]">
                  {porcentaje(s.clientes > 0 ? (s.contactables / s.clientes) * 100 : 0, 0)}
                </div>
              </td>
            </tr>
          ))}
        </Tabla>
      </Card>
    </>
  );
}

// ─── Valor de vida ───────────────────────────────────────────────────────────

async function VistaValor({ rfm }: { rfm: Awaited<ReturnType<typeof calcularRfm>> }) {
  const ltv = resumirLtv(rfm);
  const coh = await cohortes(12);
  const top = [...rfm].sort((a, b) => b.monto - a.monto).slice(0, 12);

  // Se muestran las cohortes con al menos 6 meses de vida: con menos, el
  // acumulado todavía no dice nada y la tabla invita a comparar lo incomparable.
  const cohortesUtiles = coh.filter((c) => c.clientes >= 3).slice(-14);

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
        descripcion="Cada fila son los clientes que compraron por primera vez ese mes. Las columnas son los meses transcurridos desde su entrada."
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
              Las celdas vacías de la derecha no son ceros: son meses que esa cohorte todavía no
              vivió. Comparar el mes 6 de una cohorte con el mes 6 de otra responde la pregunta que
              importa — si los clientes nuevos valen más o menos que los de antes a la misma edad.
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
            subtitulo="Porcentaje de ventas con cliente asociado, por mes"
            pie="Este es el indicador a seguir semana a semana una vez implementada la captura."
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
