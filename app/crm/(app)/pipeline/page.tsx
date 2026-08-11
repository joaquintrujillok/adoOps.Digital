// Pipeline y KPIs — la pantalla de revisión, en tres pestañas.
//
// Las otras pantallas responden "qué hago ahora". Esta responde "cómo vamos": qué
// entró en el periodo, cómo viene la semana contra las ocho anteriores, y de qué
// depende el pipeline si algo se cae.
//
// Las pestañas y los filtros viajan en la URL y no en estado de cliente. Es lo
// que hace que una vista filtrada se pueda pegar en un mensaje —"mira las de
// alta joyería en negociación"— y que el botón «atrás» deshaga el último filtro
// en vez de salir de la pantalla.

import Link from "next/link";
import {
  Card,
  PageHeader,
  Plegable,
  StatTile,
  Tabla,
  Vacio,
  btnSecundario,
} from "@/components/crm/ui";
import CategoriaEnLinea from "@/components/crm/CategoriaEnLinea";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, clpCorto, fecha, numero, porcentaje } from "@/lib/crm/formato";
import { ETAPAS_ABIERTAS } from "@/lib/crm/etapas";
import {
  categoriasDisponibles,
  kpisSemanales,
  mixDeCategoria,
  oportunidadesDelPeriodo,
  rangoDe,
  PERIODOS,
  PERIODO_POR_DEFECTO,
  UMBRAL_CONCENTRACION,
  type PeriodoId,
} from "@/lib/crm/panel-pipeline";

export const dynamic = "force-dynamic";

const PESTANAS = [
  { id: "oportunidades", nombre: "Oportunidades" },
  { id: "kpis", nombre: "KPIs semanales" },
  { id: "mix", nombre: "Mix de categoría" },
] as const;

type PestanaId = (typeof PESTANAS)[number]["id"];

type Params = {
  tab?: string;
  periodo?: string;
  desde?: string;
  hasta?: string;
  etapa?: string;
  categoria?: string;
};

/** Mantiene los filtros al cambiar de pestaña; sin esto cada clic los borra. */
function conParams(base: Params, cambios: Partial<Params>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...cambios })) {
    if (v) p.set(k, String(v));
  }
  const q = p.toString();
  return `/crm/pipeline${q ? `?${q}` : ""}`;
}

export default async function Pipeline({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireSession();
  const params = await searchParams;

  const pestana: PestanaId =
    PESTANAS.find((p) => p.id === params.tab)?.id ?? "oportunidades";

  return (
    <>
      <PageHeader
        titulo="Pipeline y KPIs"
        bajada="La revisión: qué entró, cómo viene la semana y de qué depende el pipeline."
      />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-[var(--crm-grid)]">
        {PESTANAS.map((p) => {
          const activa = p.id === pestana;
          return (
            <Link
              key={p.id}
              href={conParams(params, { tab: p.id })}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition ${
                activa
                  ? "border-[var(--crm-brand)] text-[var(--crm-brand-dark)]"
                  : "border-transparent text-[var(--crm-ink-2)] hover:text-[var(--crm-ink)]"
              }`}
            >
              {p.nombre}
            </Link>
          );
        })}
      </div>

      {pestana === "oportunidades" && <VistaOportunidades params={params} />}
      {pestana === "kpis" && <VistaKpis />}
      {pestana === "mix" && <VistaMix />}
    </>
  );
}

// ─── Pestaña 1 · Oportunidades ───────────────────────────────────────────────

async function VistaOportunidades({ params }: { params: Params }) {
  const periodo = (PERIODOS.find((p) => p.id === params.periodo)?.id ??
    PERIODO_POR_DEFECTO) as PeriodoId;
  const rango = rangoDe(periodo, params.desde, params.hasta);

  const [categorias, { filas, resumen }] = await Promise.all([
    categoriasDisponibles(),
    oportunidadesDelPeriodo({
      desde: rango.desde,
      hasta: rango.hasta,
      etapa: params.etapa,
      categoria: params.categoria,
    }),
  ]);

  const total = filas.reduce((s, f) => s + f.monto, 0);
  const ponderado = filas.reduce((s, f) => s + f.ponderado, 0);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--crm-border)] bg-white p-0.5">
          {PERIODOS.map((p) => {
            const activo = !rango.aMedida && p.id === periodo;
            return (
              <Link
                key={p.id}
                // Elegir un periodo limpia el rango a medida: si no, el rango
                // seguiría mandando y el botón parecería no hacer nada.
                href={conParams(params, {
                  periodo: p.id,
                  desde: undefined,
                  hasta: undefined,
                })}
                className={`rounded-md px-2.5 py-1 text-[12px] ${
                  activo
                    ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]"
                    : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
                }`}
              >
                {p.nombre}
              </Link>
            );
          })}
        </div>

        {/* GET y no una Server Action: son filtros, no una escritura. Así quedan
            en la URL y la vista filtrada se puede compartir. */}
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value="oportunidades" />
          {params.etapa && <input type="hidden" name="etapa" value={params.etapa} />}
          {params.categoria && (
            <input type="hidden" name="categoria" value={params.categoria} />
          )}
          <input
            type="date"
            name="desde"
            defaultValue={params.desde ?? ""}
            aria-label="Desde"
            className="rounded-lg border border-[var(--crm-border)] px-2 py-1 text-[12px]"
          />
          <span className="text-[12px] text-[var(--crm-muted)]">a</span>
          <input
            type="date"
            name="hasta"
            defaultValue={params.hasta ?? ""}
            aria-label="Hasta"
            className="rounded-lg border border-[var(--crm-border)] px-2 py-1 text-[12px]"
          />
          <button type="submit" className={`${btnSecundario} px-2.5 py-1 text-[12px]`}>
            Aplicar
          </button>
        </form>

        <Filtro
          params={params}
          clave="etapa"
          etiqueta="Toda etapa"
          opciones={ETAPAS_ABIERTAS.map((e) => ({ valor: e.id, nombre: e.nombre }))}
        />
        <Filtro
          params={params}
          clave="categoria"
          etiqueta="Toda categoría"
          opciones={categorias.map((c) => ({ valor: c, nombre: c }))}
        />
      </div>

      <p className="mb-4 text-[12px] text-[var(--crm-muted)]">
        Oportunidades que entraron al pipeline entre el {fecha(rango.desde)} y el{" "}
        {fecha(rango.hasta)}
        {rango.aMedida ? " (rango a medida)" : ""}. Se cuentan por fecha de apertura,
        no por cierre.
      </p>

      {/* Una tarjeta por etapa. El encabezado del kanban dice lo mismo, pero acá
          el conjunto está filtrado y las cifras no coinciden con el tablero: por
          eso se repiten en vez de mandar a mirarlas allá. */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {resumen.map((r) => (
          <StatTile
            key={r.etapa}
            etiqueta={`${r.nombre} (${porcentaje(r.probabilidad)})`}
            valor={clpCorto(r.monto)}
            contexto={`${numero(r.cantidad)} ${r.cantidad === 1 ? "oportunidad" : "oportunidades"} · pond. ${clpCorto(r.ponderado)}`}
          />
        ))}
      </div>

      <Card
        titulo={`${numero(filas.length)} ${filas.length === 1 ? "oportunidad" : "oportunidades"}`}
        descripcion={`${clp(total)} en total · ${clp(ponderado)} ponderado`}
        padding={false}
      >
        {filas.length === 0 ? (
          <div className="p-5">
            <Vacio
              mensaje="Nada entró en este periodo"
              sugerencia="Prueba con una ventana más larga: en alta gama no entran oportunidades todos los días."
            />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Oportunidad",
              "Cliente",
              "Etapa",
              "Categoría",
              { titulo: "Valor", alinear: "der" },
              { titulo: "Ponderado", alinear: "der" },
              "Abierta",
            ]}
          >
            {filas.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link
                    href={`/crm/oportunidades/${f.id}`}
                    className="font-medium hover:text-[var(--crm-brand-dark)]"
                  >
                    {f.titulo}
                  </Link>
                  {f.owner && (
                    <div className="text-[12px] text-[var(--crm-muted)]">{f.owner}</div>
                  )}
                </td>
                <td>
                  {f.contactId ? (
                    <Link
                      href={`/crm/contactos/${f.contactId}`}
                      className="hover:text-[var(--crm-brand-dark)]"
                    >
                      {f.cliente}
                    </Link>
                  ) : (
                    f.cliente
                  )}
                </td>
                <td>
                  {f.etapaNombre}
                  <span className="crm-num ml-1 text-[12px] text-[var(--crm-muted)]">
                    {porcentaje(f.probabilidad)}
                  </span>
                </td>
                <td>
                  <CategoriaEnLinea
                    dealId={f.id}
                    categoria={f.categoria}
                    heredada={f.categoriaHeredada}
                    corregida={f.categoriaCorregida}
                    categorias={categorias}
                  />
                </td>
                <td className="crm-num text-right font-medium">{clp(f.monto)}</td>
                <td className="crm-num text-right text-[var(--crm-ink-2)]">
                  {clp(f.ponderado)}
                </td>
                <td className="text-[13px] text-[var(--crm-ink-2)]">
                  {fecha(f.abiertoEn)}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}

function Filtro({
  params,
  clave,
  etiqueta,
  opciones,
}: {
  params: Params;
  clave: "etapa" | "categoria";
  etiqueta: string;
  opciones: { valor: string; nombre: string }[];
}) {
  const actual = params[clave];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Link
        href={conParams(params, { [clave]: undefined })}
        className={`rounded-lg px-2.5 py-1 text-[12px] ${
          !actual
            ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]"
            : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
        }`}
      >
        {etiqueta}
      </Link>
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={conParams(params, { [clave]: o.valor })}
          className={`rounded-lg px-2.5 py-1 text-[12px] ${
            actual === o.valor
              ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]"
              : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
          }`}
        >
          {o.nombre}
        </Link>
      ))}
    </div>
  );
}

// ─── Pestaña 2 · KPIs semanales ──────────────────────────────────────────────

async function VistaKpis() {
  const { semanas, metricas } = await kpisSemanales(8);

  return (
    <Card
      titulo="Últimas 8 semanas"
      descripcion="Una fila por métrica, una columna por semana. La semana en curso va al final y está incompleta."
      padding={false}
    >
      <Tabla
        columnas={[
          "Métrica",
          { titulo: "Total", alinear: "der" },
          ...semanas.map((s) => ({ titulo: s.etiqueta, alinear: "der" as const })),
        ]}
      >
        {metricas.map((m) => (
          <tr key={m.clave}>
            <td className="font-medium">{m.nombre}</td>
            {/* El total va a la izquierda, pegado al nombre: es la cifra que se
                lee primero, y al final de ocho columnas quedaría fuera de vista
                en una pantalla angosta. */}
            <td className="crm-num border-r border-[var(--crm-grid)] text-right font-semibold">
              {m.formato === "clp" ? clpCorto(m.total) : numero(m.total)}
            </td>
            {m.valores.map((v, i) => (
              <td
                key={i}
                className={`crm-num text-right ${
                  v === 0 ? "text-[var(--crm-muted)]" : "text-[var(--crm-ink)]"
                }`}
              >
                {m.formato === "clp" ? clpCorto(v) : numero(v)}
              </td>
            ))}
          </tr>
        ))}
      </Tabla>
    </Card>
  );
}

// ─── Pestaña 3 · Mix de categoría ────────────────────────────────────────────

const COLORES_SERIE = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

async function VistaMix() {
  const { categorias, riesgos, totalPipeline } = await mixDeCategoria();

  if (categorias.length === 0) {
    return (
      <Card>
        <Vacio mensaje="No hay pipeline abierto que repartir" />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Plegable
          titulo="Cómo leer esto"
          resumen={`${clp(totalPipeline)} abiertos en ${categorias.length} categorías`}
        >
          <div className="space-y-1.5 text-[13px] leading-relaxed text-[var(--crm-ink)]">
            <p>
              La <strong>participación</strong> es cuánto pesa la categoría en el
              pipeline abierto. La <strong>concentración</strong> es el HHI: la suma
              de los cuadrados de la parte de cada cliente dentro de esa categoría. Un
              solo cliente da 10.000; diez clientes parejos dan 1.000.
            </p>
            <p>
              Sirve para lo que un promedio esconde: dos categorías con el mismo monto
              y el mismo número de clientes pueden tener riesgos opuestos. La tabla de
              abajo marca en rojo a quien pase del {UMBRAL_CONCENTRACION}% de su
              categoría, porque ahí ese cliente no está en la categoría: <em>es</em> la
              categoría.
            </p>
          </div>
        </Plegable>
      </div>

      {/* Barra apilada del mix. Una sola barra y no un anillo: comparar
          longitudes sobre una línea común es más preciso que comparar ángulos. */}
      <div className="mb-5">
        <div className="flex h-8 w-full overflow-hidden rounded-lg">
          {categorias.map((c, i) => (
            <div
              key={c.categoria}
              style={{
                width: `${c.participacion}%`,
                background: COLORES_SERIE[i % COLORES_SERIE.length],
              }}
              title={`${c.categoria}: ${clp(c.monto)} (${porcentaje(c.participacion, 1)})`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {categorias.map((c, i) => (
            <span
              key={c.categoria}
              className="inline-flex items-center gap-1.5 text-[12px] text-[var(--crm-ink-2)]"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: COLORES_SERIE[i % COLORES_SERIE.length] }}
              />
              {c.categoria}
              <span className="crm-num text-[var(--crm-muted)]">
                {porcentaje(c.participacion, 1)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {categorias.map((c) => (
          <div
            key={c.categoria}
            className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-5 py-4 shadow-[0_1px_2px_rgba(11,11,11,0.04)]"
          >
            <div className="text-[13px] font-semibold text-[var(--crm-ink)]">
              {c.categoria}
            </div>
            <div className="crm-num mt-1 text-[22px] font-semibold leading-none text-[var(--crm-ink)]">
              {clpCorto(c.monto)}
            </div>
            <div className="mt-2 text-[13px] text-[var(--crm-ink-2)]">
              <span className="crm-num">{porcentaje(c.participacion, 1)}</span> del
              pipeline ·{" "}
              <span className="crm-num">{numero(c.cantidad)}</span>{" "}
              {c.cantidad === 1 ? "negocio" : "negocios"}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-[var(--crm-grid)] pt-2 text-[12px]">
              <span className="text-[var(--crm-muted)]">Concentración</span>
              <span
                className="crm-num font-medium"
                style={{
                  color:
                    c.hhi >= 2500 ? "var(--status-critical)" : "var(--crm-ink)",
                }}
              >
                {numero(c.hhi)}
              </span>
            </div>
            {c.mayor && (
              <div className="mt-1 truncate text-[12px] text-[var(--crm-muted)]">
                Mayor: {c.mayor.cliente} ({porcentaje(c.mayor.parte, 0)})
              </div>
            )}
          </div>
        ))}
      </div>

      <Card
        titulo="Riesgo de concentración"
        descripcion={`Clientes que solos valen más del ${UMBRAL_CONCENTRACION}% de su categoría`}
        padding={false}
      >
        {riesgos.length === 0 ? (
          <div className="p-5">
            <Vacio
              mensaje="Ninguna categoría depende de un solo cliente"
              sugerencia={`Nadie supera el ${UMBRAL_CONCENTRACION}% de su categoría.`}
            />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Categoría",
              "Cliente",
              { titulo: "Monto abierto", alinear: "der" },
              { titulo: "De su categoría", alinear: "der" },
            ]}
          >
            {riesgos.map((r) => (
              <tr key={`${r.categoria}-${r.cliente}`}>
                <td>{r.categoria}</td>
                <td>
                  {r.contactId ? (
                    <Link
                      href={`/crm/contactos/${r.contactId}`}
                      className="hover:text-[var(--crm-brand-dark)]"
                    >
                      {r.cliente}
                    </Link>
                  ) : (
                    r.cliente
                  )}
                </td>
                <td className="crm-num text-right">{clp(r.monto)}</td>
                <td
                  className="crm-num text-right font-semibold"
                  style={{ color: "var(--status-critical)" }}
                >
                  {porcentaje(r.parte, 0)}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Card>
    </>
  );
}
