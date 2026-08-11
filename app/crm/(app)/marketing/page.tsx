import { Badge, Card, Lectura, PageHeader, StatTile, Tabla, Vacio } from "@/components/crm/ui";
import { BarrasH, Embudo, Figura } from "@/components/crm/charts";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, fecha, numero, porcentaje } from "@/lib/crm/formato";
import { embudoMarketing, origenDeNegocios, rendimientoCampanas } from "@/lib/crm/marketing";
import { narrar } from "@/lib/crm/narrador";
import { nombreCanal } from "@/lib/crm/etapas";

export const dynamic = "force-dynamic";

export default async function Marketing() {
  await requireSession();

  const [campanas, embudo, origenes] = await Promise.all([
    rendimientoCampanas(),
    embudoMarketing(),
    origenDeNegocios(),
  ]);

  const conRetorno = campanas.filter((c) => c.roi !== null);
  const mejor = [...conRetorno].sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];
  const peor = [...conRetorno].sort((a, b) => (a.roi ?? 0) - (b.roi ?? 0))[0];
  const inversionTotal = campanas.reduce((s, c) => s + c.costo, 0);
  const ingresosAtribuidos = campanas.reduce((s, c) => s + c.ingresosPrimerToque, 0);

  const respaldo = `Se invirtieron ${clp(inversionTotal)} en ${campanas.length} campañas, que se atribuyen ${clp(ingresosAtribuidos)} en ventas cerradas por primer toque.${
    mejor ? ` La de mejor retorno es ${mejor.campana.nombre}.` : ""
  }${peor && (peor.roi ?? 0) < 0 ? ` La que va perdiendo plata es ${peor.campana.nombre}.` : ""}`;

  const narracion = await narrar(
    {
      inversionTotal,
      ingresosAtribuidosPrimerToque: ingresosAtribuidos,
      campanas: campanas.length,
      mejorCampana: mejor?.campana.nombre ?? null,
      roiMejor: mejor?.roi ?? null,
      peorCampana: peor?.campana.nombre ?? null,
      roiPeor: peor?.roi ?? null,
      oportunidadesGeneradas: embudo.oportunidades,
      ventasCerradas: embudo.ganadas,
      montoGanado: embudo.montoGanado,
    },
    "Análisis de retorno de marketing para el gerente comercial de una empresa chilena",
    respaldo,
  );

  return (
    <>
      <PageHeader
        titulo="Marketing y origen"
        bajada="La cadena completa: campaña → contacto tocado → oportunidad → venta. Con la inversión al lado, para poder decidir dónde poner el próximo peso."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Inversión total" valor={clp(inversionTotal)} contexto={`${numero(campanas.length)} campañas`} />
        <StatTile
          etiqueta="Ventas atribuidas"
          valor={clp(ingresosAtribuidos)}
          contexto="por primer toque"
        />
        <StatTile
          etiqueta="Retorno global"
          valor={
            inversionTotal > 0
              ? `${((ingresosAtribuidos - inversionTotal) / inversionTotal).toFixed(1)}×`
              : "—"
          }
          contexto="ingreso neto sobre inversión"
        />
        <StatTile
          etiqueta="Oportunidades generadas"
          valor={numero(embudo.oportunidades)}
          contexto={`${numero(embudo.ganadas)} cerradas`}
        />
      </div>

      <div className="mb-6">
        <Lectura
          fuente={
            narracion.origen === "ia"
              ? "Redactado por el asistente sobre cifras calculadas por el CRM."
              : "Redactado con plantilla sobre cifras calculadas por el CRM."
          }
        >
          <p>{narracion.texto}</p>
        </Lectura>
      </div>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <Figura
            titulo="Del contacto a la venta"
            subtitulo="Cuánto sobrevive en cada paso"
            pie="Solo se cuentan oportunidades con campaña de origen registrada."
          >
            <Embudo
              pasos={[
                { etiqueta: "Interacciones de marketing", valor: embudo.toques },
                { etiqueta: "Contactos alcanzados", valor: embudo.contactosTocados },
                { etiqueta: "Cuentas alcanzadas", valor: embudo.cuentasTocadas },
                {
                  etiqueta: "Oportunidades",
                  valor: embudo.oportunidades,
                  detalle: clpCorto(embudo.montoOportunidades),
                },
                {
                  etiqueta: "Ventas cerradas",
                  valor: embudo.ganadas,
                  detalle: clpCorto(embudo.montoGanado),
                },
              ]}
            />
          </Figura>
        </Card>

        <Card>
          <Figura
            titulo="De dónde salen los negocios"
            subtitulo="Ingresos ganados por origen declarado"
            pie="El origen se registra al crear la oportunidad; la atribución por campaña está en la tabla de abajo."
          >
            {origenes.length === 0 ? (
              <Vacio mensaje="Sin oportunidades registradas" />
            ) : (
              <BarrasH
                datos={origenes.map((o) => ({
                  etiqueta: o.fuente,
                  valor: o.ingresos,
                  texto: clpCorto(o.ingresos),
                }))}
                colorUnico="var(--series-2)"
              />
            )}
          </Figura>
        </Card>
      </div>

      <Card
        titulo="Rendimiento por campaña"
        descripcion="Primer toque mide adquisición; último toque, qué gatilló el cierre. Se muestran los dos porque optimizar con uno solo lleva a decisiones equivocadas."
        padding={false}
      >
        {campanas.length === 0 ? (
          <div className="p-5">
            <Vacio mensaje="No hay campañas registradas" />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Campaña",
              "Canal",
              { titulo: "Inversión", alinear: "der" },
              { titulo: "Alcance", alinear: "der" },
              { titulo: "Oport. (1er toque)", alinear: "der" },
              { titulo: "Cerradas", alinear: "der" },
              { titulo: "Ingresos (1er)", alinear: "der" },
              { titulo: "Ingresos (último)", alinear: "der" },
              { titulo: "CAC", alinear: "der" },
              { titulo: "ROI", alinear: "der" },
            ]}
          >
            {campanas.map((c) => (
              <tr key={c.campana.id}>
                <td>
                  <div className="font-medium">{c.campana.nombre}</div>
                  <div className="text-[12px] text-[var(--crm-muted)]">
                    desde {fecha(c.campana.inicio)}
                  </div>
                </td>
                <td className="text-[13px] text-[var(--crm-ink-2)]">
                  {nombreCanal(c.campana.canal)}
                </td>
                <td className="crm-num text-right">{clp(c.costo)}</td>
                <td className="crm-num text-right">
                  {numero(c.contactosAlcanzados)}
                  <div className="text-[12px] text-[var(--crm-muted)]">
                    {numero(c.toques)} toques
                  </div>
                </td>
                <td className="crm-num text-right">{numero(c.dealsPrimerToque)}</td>
                <td className="crm-num text-right">
                  {numero(c.ganadosPrimerToque)}
                  <div className="text-[12px] text-[var(--crm-muted)]">
                    {porcentaje(c.tasaCierre, 0)}
                  </div>
                </td>
                <td className="crm-num text-right font-medium">
                  {clp(c.ingresosPrimerToque)}
                </td>
                <td className="crm-num text-right">{clp(c.ingresosUltimoToque)}</td>
                <td className="crm-num text-right">{c.cac ? clp(c.cac) : "—"}</td>
                <td className="text-right">
                  {c.roi === null ? (
                    "—"
                  ) : c.roi >= 0 ? (
                    <Badge tono="bueno" icono="▲">
                      {c.roi.toFixed(1)}×
                    </Badge>
                  ) : (
                    <Badge tono="critico" icono="▼">
                      {c.roi.toFixed(1)}×
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}
