import { BarrasH, colorSerie } from "@/components/dashboard360/charts";
import { Badge, Card, PageHeader, Tabla, Vacio } from "@/components/dashboard360/ui";
import SelectorRango from "@/components/dashboard360/SelectorRango";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import {
  clp,
  num,
  pct,
  porCampania,
  porFuente,
  rangoDisponible,
  rangoPedido,
  resumen,
} from "@/lib/dashboard360/metricas";

export const dynamic = "force-dynamic";

export default async function CanalesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireSession();

  const { desde, hasta } = await searchParams;
  const [rango, disponible] = await Promise.all([
    rangoPedido(desde, hasta),
    rangoDisponible(),
  ]);
  const [fuentes, campanias, r] = await Promise.all([
    porFuente(rango),
    porCampania(rango),
    resumen(rango),
  ]);

  const ads = fuentes.filter((f) => f.tipo === "ads");
  const nombrePorSlug = new Map(fuentes.map((f) => [f.slug, f.nombre]));

  // Umbral para marcar una campaña como cara: 1,5 veces la mediana del período,
  // no un número fijo. Lo que es caro en una industria es barato en otra, y un
  // umbral fijo termina marcando todas las filas o ninguna — que es lo mismo
  // que no marcar nada.
  const cpls = campanias
    .filter((c) => c.leads > 0)
    .map((c) => c.inversionClp / c.leads)
    .sort((a, b) => a - b);
  const mediana = cpls.length ? cpls[Math.floor(cpls.length / 2)] : 0;
  const umbralCaro = mediana * 1.5;

  const tasaApertura = r.envios ? (r.aperturas / r.envios) * 100 : 0;

  return (
    <>
      <PageHeader
        titulo="Canales"
        bajada={`Detalle por canal y campaña. Período del ${rango.desde} al ${rango.hasta}.`}
      />

      <div className="mb-5">
        <SelectorRango desde={rango.desde} hasta={rango.hasta} disponible={disponible} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Publicidad · inversión por plataforma"
          descripcion="Ordenado por gasto del período"
        >
          {ads.length === 0 ? (
            <Vacio mensaje="Sin datos de publicidad en el período." />
          ) : (
            <>
              <BarrasH
                datos={ads.map((f, i) => ({
                  etiqueta: f.nombre,
                  valor: f.inversionClp,
                  texto: clp(f.inversionClp),
                  color: colorSerie(i),
                }))}
              />
              <div className="mt-5">
                <Tabla>
                  <thead>
                    <tr>
                      <th>Plataforma</th>
                      <th className="text-right">Inversión</th>
                      <th className="text-right">Clics</th>
                      <th className="text-right">CTR</th>
                      <th className="text-right">Leads</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ads.map((f) => (
                      <tr key={f.slug}>
                        <td className="font-medium">{f.nombre}</td>
                        <td className="d360-num text-right">{clp(f.inversionClp)}</td>
                        <td className="d360-num text-right">{num(f.clics)}</td>
                        <td className="d360-num text-right">
                          {f.impresiones ? pct((f.clics / f.impresiones) * 100, 2) : "—"}
                        </td>
                        <td className="d360-num text-right">{num(f.leadsPlataforma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Tabla>
              </div>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card titulo="Email" descripcion="Campañas salientes del período">
            <dl className="grid grid-cols-3 gap-3">
              {[
                { t: "Envíos", v: num(r.envios) },
                { t: "Aperturas", v: num(r.aperturas) },
                { t: "Tasa de apertura", v: pct(tasaApertura) },
              ].map((x) => (
                <div key={x.t}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--d360-muted)]">
                    {x.t}
                  </dt>
                  <dd className="d360-num mt-1 text-[20px] font-semibold text-[var(--d360-ink)]">
                    {x.v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-[var(--d360-muted)]">
              La tasa de apertura quedó inflada en toda la industria desde que Apple
              precarga imágenes. Se muestra por continuidad histórica, pero las
              decisiones se toman sobre clics y leads.
            </p>
          </Card>

          <Card titulo="Redes sociales · orgánico" descripcion="Sin inversión asociada">
            <dl className="grid grid-cols-3 gap-3">
              {[
                { t: "Impresiones", v: num(r.impresiones) },
                { t: "Interacciones", v: num(r.interacciones) },
                { t: "Seguidores nuevos", v: num(r.seguidoresNuevos) },
              ].map((x) => (
                <div key={x.t}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--d360-muted)]">
                    {x.t}
                  </dt>
                  <dd className="d360-num mt-1 text-[20px] font-semibold text-[var(--d360-ink)]">
                    {x.v}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[12px] text-[var(--d360-muted)]">
              Las impresiones incluyen las de campañas pagadas, porque las plataformas
              no las separan en el reporte de página.
            </p>
          </Card>
        </div>
      </div>

      <Card
        titulo="Campañas"
        descripcion={
          umbralCaro > 0
            ? `Las doce con mayor inversión. Se marcan las que superan ${clp(umbralCaro)} por lead — 1,5 veces la mediana del período`
            : "Las doce con mayor inversión en el período"
        }
      >
        {campanias.length === 0 ? (
          <Vacio
            mensaje="Sin campañas en el período."
            sugerencia="Revisa el estado de las fuentes conectadas."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Campaña</th>
                <th>Plataforma</th>
                <th className="text-right">Inversión</th>
                <th className="text-right">Clics</th>
                <th className="text-right">Leads</th>
                <th className="text-right">Costo/lead</th>
              </tr>
            </thead>
            <tbody>
              {campanias.map((c) => {
                const cpl = c.leads ? c.inversionClp / c.leads : null;
                const caro = cpl !== null && umbralCaro > 0 && cpl > umbralCaro;
                return (
                  <tr key={`${c.slug}-${c.campania}`}>
                    <td className="max-w-[320px] truncate font-medium" title={c.campania}>
                      {c.campania}
                    </td>
                    <td className="text-[var(--d360-ink-2)]">
                      {nombrePorSlug.get(c.slug) ?? c.slug}
                    </td>
                    <td className="d360-num text-right">{clp(c.inversionClp)}</td>
                    <td className="d360-num text-right">{num(c.clics)}</td>
                    <td className="d360-num text-right">{num(c.leads)}</td>
                    <td className="d360-num text-right">
                      {cpl === null ? (
                        <span className="text-[var(--d360-muted)]">sin leads</span>
                      ) : caro ? (
                        <Badge tono="alerta">
                          <span aria-hidden>▲</span>
                          {clp(cpl)}
                        </Badge>
                      ) : (
                        clp(cpl)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
      </Card>
    </>
  );
}
