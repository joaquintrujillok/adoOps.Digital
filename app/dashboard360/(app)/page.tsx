import Link from "next/link";
import { Card, PageHeader, StatTile, btnSecundario } from "@/components/dashboard360/ui";
import { BarraApilada, Lineas, colorSerie } from "@/components/dashboard360/charts";
import { Tabla } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import {
  clp,
  clpCorto,
  costoPorLead,
  ctr,
  fechaCorta,
  num,
  pct,
  porFuente,
  rangoPrevio,
  rangoReciente,
  reconciliacion,
  resumen,
  serieDiaria,
  variacion,
} from "@/lib/dashboard360/metricas";

export const dynamic = "force-dynamic";

export default async function Panel360() {
  await requireSession();

  const rango = await rangoReciente(30);
  const previo = rangoPrevio(rango);

  const [actual, anterior, fuentes, serie, recon] = await Promise.all([
    resumen(rango),
    resumen(previo),
    porFuente(rango),
    serieDiaria(rango),
    reconciliacion(rango),
  ]);

  const cplActual = costoPorLead(actual);
  const cplAnterior = costoPorLead(anterior);

  const inversionPorTipo = [
    { etiqueta: "Google Ads", slug: "google_ads" },
    { etiqueta: "LinkedIn Ads", slug: "linkedin_ads" },
    { etiqueta: "Meta Ads", slug: "meta_ads" },
  ].map((t) => ({
    etiqueta: t.etiqueta,
    valor: fuentes.find((f) => f.slug === t.slug)?.inversionClp ?? 0,
  }));

  return (
    <>
      <PageHeader
        titulo="Panel 360"
        bajada={`Publicidad, email y redes en una sola vista. Período del ${rango.desde} al ${rango.hasta}, comparado contra los 30 días anteriores.`}
        acciones={
          <Link href="/dashboard360/informe" className={btnSecundario}>
            Generar informe
          </Link>
        }
      />

      {/* Cifras sin gráfico: son valores únicos, y dibujar una barra de un solo
          elemento agrega tinta, no información. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          etiqueta="Inversión"
          valor={clpCorto(actual.inversionClp)}
          variacion={variacion(actual.inversionClp, anterior.inversionClp)}
          nota={clp(actual.inversionClp)}
        />
        <StatTile
          etiqueta="Leads reales"
          valor={num(actual.leadsReales)}
          variacion={variacion(actual.leadsReales, anterior.leadsReales)}
          nota={`Las plataformas reportan ${num(actual.leadsPlataforma)}`}
        />
        <StatTile
          etiqueta="Costo por lead"
          valor={cplActual ? clp(cplActual) : "—"}
          variacion={cplActual && cplAnterior ? variacion(cplActual, cplAnterior) : null}
          invertido
          nota="Sobre leads deduplicados"
        />
        <StatTile
          etiqueta="CTR"
          valor={pct(ctr(actual))}
          variacion={variacion(ctr(actual), ctr(anterior))}
          nota={`${num(actual.clics)} clics · ${num(actual.impresiones)} impresiones`}
        />
      </div>

      {/* La reconciliación va arriba y no escondida en una pestaña: es la
          pregunta que alguien va a hacer en la reunión, y es mejor responderla
          antes de que la hagan. */}
      <Card
        className="mb-5"
        titulo="Cuadratura de leads"
        descripcion="Por qué el número del tablero no coincide con el del CRM, explicado antes de que lo pregunten"
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <ol className="space-y-2.5">
            {[
              {
                n: recon.segunPlataformas,
                t: "Según las plataformas",
                d: "Suma de lo que cada canal se atribuye. Contiene duplicados: un mismo contacto puede tocarse en tres canales.",
                tono: "var(--d360-muted)",
              },
              {
                n: recon.personasUnicas,
                t: "Personas distintas",
                d: `Tras deduplicar por persona. Sobran ${num(recon.sobreconteo)} atribuciones repetidas.`,
                tono: "var(--series-1)",
              },
              {
                n: recon.enCrm,
                t: "Cargados en el CRM",
                d: `Faltan ${num(recon.faltanEnCrm)} por cargar. Esa brecha es trabajo comercial, no un error del tablero.`,
                tono: "var(--series-3)",
              },
            ].map((p) => (
              <li key={p.t} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: p.tono }}
                />
                <div className="min-w-0">
                  <div className="d360-num text-[17px] font-semibold text-[var(--d360-ink)]">
                    {num(p.n)}{" "}
                    <span className="text-[13px] font-medium text-[var(--d360-ink-2)]">
                      {p.t}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--d360-muted)]">{p.d}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-[var(--d360-brand-soft)] p-4">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--d360-brand-dark)]">
              Lectura
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
              Sumar lo que reporta cada plataforma infla el resultado en{" "}
              <strong className="text-[var(--d360-ink)]">
                {recon.personasUnicas
                  ? pct((recon.sobreconteo / recon.personasUnicas) * 100, 0)
                  : "—"}
              </strong>
              . El costo por lead de este panel se calcula sobre personas
              distintas, que es la cifra que resiste una auditoría.
            </p>
          </div>
        </div>
      </Card>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card
          titulo="Inversión y leads día a día"
          descripcion="Dos escalas distintas nunca comparten eje: son dos gráficos, no uno con doble eje"
        >
          <div className="mb-1 text-[12px] font-medium text-[var(--d360-ink-2)]">
            Inversión diaria
          </div>
          <Lineas
            series={[
              {
                nombre: "Inversión",
                puntos: serie.map((p) => ({
                  x: fechaCorta(p.fecha),
                  y: p.inversionClp,
                })),
              },
            ]}
            alto={170}
            formatoY={clpCorto}
          />

          <div className="mb-1 mt-5 text-[12px] font-medium text-[var(--d360-ink-2)]">
            Leads atribuidos por plataforma
          </div>
          <Lineas
            series={[
              {
                nombre: "Leads",
                puntos: serie.map((p) => ({ x: fechaCorta(p.fecha), y: p.leads })),
              },
            ]}
            alto={150}
          />
        </Card>

        <Card titulo="De dónde salió la inversión" descripcion="Participación del período">
          <BarraApilada segmentos={inversionPorTipo} formato={clp} />

          <div className="mt-5">
            <Tabla>
              <thead>
                <tr>
                  <th>Canal</th>
                  <th className="text-right">Inversión</th>
                </tr>
              </thead>
              <tbody>
                {inversionPorTipo.map((s, i) => (
                  <tr key={s.etiqueta}>
                    <td>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 rounded-[3px]"
                          style={{ background: colorSerie(i) }}
                        />
                        {s.etiqueta}
                      </span>
                    </td>
                    <td className="d360-num text-right">{clp(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </div>
        </Card>
      </div>

      <Card
        titulo="Resultado por fuente"
        descripcion="La tabla acompaña siempre al gráfico: tres colores de la paleta quedan bajo el umbral de contraste y el color solo no puede cargar el significado"
        acciones={
          <Link href="/dashboard360/canales" className={btnSecundario}>
            Ver detalle
          </Link>
        }
      >
        <Tabla>
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Tipo</th>
              <th className="text-right">Inversión</th>
              <th className="text-right">Impresiones</th>
              <th className="text-right">Clics</th>
              <th className="text-right">Leads</th>
              <th className="text-right">Costo/lead</th>
            </tr>
          </thead>
          <tbody>
            {fuentes.map((f) => (
              <tr key={f.slug}>
                <td className="font-medium">{f.nombre}</td>
                <td className="capitalize text-[var(--d360-ink-2)]">{f.tipo}</td>
                <td className="d360-num text-right">
                  {f.inversionClp ? clp(f.inversionClp) : "—"}
                </td>
                <td className="d360-num text-right">
                  {f.impresiones ? num(f.impresiones) : "—"}
                </td>
                <td className="d360-num text-right">{f.clics ? num(f.clics) : "—"}</td>
                <td className="d360-num text-right">
                  {f.leadsPlataforma ? num(f.leadsPlataforma) : "—"}
                </td>
                <td className="d360-num text-right">
                  {f.inversionClp && f.leadsPlataforma
                    ? clp(f.inversionClp / f.leadsPlataforma)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
        <p className="mt-3 text-[12px] text-[var(--d360-muted)]">
          El costo por lead de esta tabla usa los leads que reporta cada plataforma, no
          los deduplicados: sirve para comparar canales entre sí, no para el total. El
          total honesto está arriba.
        </p>
      </Card>
    </>
  );
}
