import { BarrasH, type BarraH } from "@/components/dashboard360/charts";
import { Badge, Card, PageHeader, StatTile, Vacio } from "@/components/dashboard360/ui";
import { ICP, motor, NOMBRE_REGION, porRubro, universo } from "@/lib/dashboard360/mercado";

export const dynamic = "force-dynamic";

const n = (x: number) => x.toLocaleString("es-CL");
const pct = (parte: number, total: number) =>
  total > 0 ? `${Math.round((parte / total) * 100)}%` : "—";

export default async function Prospeccion({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; tramo?: string }>;
}) {
  const { region, tramo } = await searchParams;
  const regionFiltro = region === "pais" ? null : Number(region ?? ICP.region);
  const tramoMinimo = Number(tramo ?? ICP.tramoMinimo);

  const [u, rubros, m] = await Promise.all([
    universo(),
    porRubro({ region: regionFiltro, tramoMinimo }),
    motor(),
  ]);

  if (u.paisTodas === 0) {
    return (
      <>
        <PageHeader titulo="Prospección" />
        <Vacio
          mensaje="No hay datos de mercado cargados"
          sugerencia="Corre node scripts/d360-mercado.mjs para poblar d360_mercado desde la nómina del SII."
        />
      </>
    );
  }

  const barras: BarraH[] = rubros.slice(0, 12).map((r) => ({
    etiqueta: r.rubro
      .toLowerCase()
      .replace(/^\w/, (c) => c.toUpperCase())
      .replace(/;.*$/, "")
      .slice(0, 34),
    valor: r.operativas,
    texto: n(r.operativas),
    color: r.rubro === ICP.rubro ? "var(--d360-brand)" : undefined,
  }));

  const ambito = regionFiltro ? NOMBRE_REGION[regionFiltro] : "todo Chile";

  return (
    <>
      <PageHeader
        titulo="Prospección"
        bajada={`El mercado al que adoOps le puede vender, y en qué parte del recorrido está cada prospecto. Universo del SII, año comercial ${u.anoComercial}.`}
      />

      {/* ── 1. El universo ─────────────────────────────────────────────── */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Empresas en Chile"
          valor={n(u.paisTodas)}
          nota={`personas jurídicas con actividad en ${u.anoComercial}`}
        />
        <StatTile
          etiqueta="Con operación real"
          valor={n(u.paisOperativas)}
          nota={`${pct(u.paisOperativas, u.paisTodas)} del total · 10+ trabajadores, sin vehículos de inversión`}
        />
        <StatTile
          etiqueta="ICP · universo bruto"
          valor={n(u.icpTodas)}
          nota="lo que contaría cualquiera"
        />
        <StatTile
          etiqueta="ICP · direccionable"
          valor={n(u.icpOperativas)}
          nota={`${pct(u.icpOperativas, u.icpTodas)} del bruto. Es el número que sirve`}
        />
      </div>

      {/* Esta tarjeta existe porque el número corregido, solo, es indistinguible
          de un número inventado. Hay que mostrar la corrección. */}
      <Card
        titulo="Por qué el ICP es mucho más chico de lo que parece"
        className="mb-8"
      >
        <p className="text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
          El rubro <strong>{ICP.rubro.toLowerCase()}</strong> en la Región
          Metropolitana, tramo {ICP.tramoMinimo}+, tiene{" "}
          <strong>{n(u.icpTodas)} empresas</strong> según el SII. Pero{" "}
          <strong>{n(u.icpInversion)}</strong> —el {pct(u.icpInversion, u.icpTodas)}— son{" "}
          fondos y sociedades de inversión: no tienen trabajadores, no tienen operación y no
          hay nadie a quien escribirle. Descontándolas y exigiendo 10 o más trabajadores,
          quedan <strong>{n(u.icpOperativas)}</strong>.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
          Sin ese descuento, una muestra de 200 empresas para el test de cobertura habría
          salido llena de cascarones y habría quemado los créditos de enriquecimiento en
          empresas que no existen operativamente.
        </p>
        <p className="mt-3 text-[12px] text-[var(--d360-muted)]">
          {ICP.porQue}
        </p>
      </Card>

      {/* ── 2. El mercado por rubro ────────────────────────────────────── */}
      <Card
        titulo={`Empresas con operación real · ${ambito} · tramo ${tramoMinimo}+`}
        descripcion="Barra destacada: el ICP vigente. El orden es por tamaño direccionable, no por total."
        acciones={
          <form className="flex items-center gap-2" action="/dashboard360/prospeccion">
            <select
              name="region"
              defaultValue={regionFiltro ? String(regionFiltro) : "pais"}
              className="rounded-md border border-[var(--d360-border)] bg-white px-2 py-1 text-[13px]"
            >
              <option value="pais">Todo Chile</option>
              {Object.entries(NOMBRE_REGION).map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
            <select
              name="tramo"
              defaultValue={String(tramoMinimo)}
              className="rounded-md border border-[var(--d360-border)] bg-white px-2 py-1 text-[13px]"
            >
              <option value="1">Todos los tamaños</option>
              <option value="5">Pequeñas y más (5+)</option>
              <option value="8">Medianas y grandes (8+)</option>
              <option value="10">Solo grandes (10+)</option>
            </select>
            <button
              type="submit"
              className="rounded-md border border-[var(--d360-border)] px-2.5 py-1 text-[13px] hover:border-[var(--d360-brand)]"
            >
              Ver
            </button>
          </form>
        }
        className="mb-8"
      >
        {barras.length === 0 ? (
          <Vacio mensaje="Ningún rubro califica con esos filtros" />
        ) : (
          <BarrasH datos={barras} anchoEtiqueta={230} />
        )}
      </Card>

      {/* ── 3. El motor ────────────────────────────────────────────────── */}
      <Card
        titulo="El motor de nurturing"
        descripcion="De todo ese universo, lo que efectivamente está cargado y en movimiento."
        acciones={
          m.disponible ? (
            <a
              href="/dashboard360/motor"
              className="text-[13px] text-[var(--d360-brand)] hover:underline"
            >
              Abrir el motor →
            </a>
          ) : undefined
        }
      >
        {!m.disponible ? (
          <Vacio
            mensaje="El motor de nurturing no está disponible en este entorno"
            sugerencia="Es un módulo aparte. El tablero funciona igual sin él."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <StatTile etiqueta="En la base" valor={n(m.enBase)} nota="empresas cargadas" />
              <StatTile
                etiqueta="Con dominio"
                valor={n(m.conDominio)}
                nota={`${pct(m.conDominio, m.enBase)} · sin dominio no hay enriquecimiento`}
              />
              <StatTile
                etiqueta="Alcanzables"
                valor={n(m.alcanzables)}
                nota="con email o perfil de LinkedIn"
              />
              <StatTile etiqueta="Inscritos" valor={n(m.inscritos)} nota="en alguna campaña" />
              <StatTile
                etiqueta="Respondieron"
                valor={n(m.respondieron)}
                nota="salieron de la automatización"
              />
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
              <Badge tono={m.conDominio === 0 ? "alerta" : "neutro"}>
                {m.conDominio === 0 ? "bloqueado" : "en marcha"}
              </Badge>{" "}
              {m.conDominio === 0 ? (
                <>
                  Los {n(m.enBase)} prospectos no tienen dominio web, y sin dominio ningún
                  proveedor de enriquecimiento encuentra correos. Ese es el cuello de botella
                  y es trabajo manual: hay que completarlos antes de que el motor sirva de algo.
                </>
              ) : (
                <>
                  {n(m.alcanzables)} de {n(m.enBase)} prospectos tienen por dónde recibir un
                  mensaje. El motor no inscribe a nadie sin campaña, emisor y señal.
                </>
              )}
            </p>
          </>
        )}
      </Card>

      <p className="mt-6 text-[12px] text-[var(--d360-muted)]">
        Fuente: nómina de personas jurídicas del SII, año comercial {u.anoComercial}, descarga
        libre. &ldquo;Operación real&rdquo; = 10 o más trabajadores dependientes, excluyendo
        fondos y sociedades de inversión. El SII publica una vez al año: este corte no cambia
        hasta la próxima nómina.
      </p>
    </>
  );
}
