// Gráficos de Dashboard360 — SVG en línea, renderizados en el servidor.
//
// Sin librería de charts a propósito: son tres formas, el peso extra en el
// bundle no se justifica y el SVG servido desde el servidor se imprime bien —
// que importa, porque el informe al directorio termina en papel.
//
// Reglas que se respetan en todos:
//   · marcas finas, extremos redondeados de 4px anclados a la línea base
//   · 2px de separación entre rellenos contiguos
//   · grilla y ejes recesivos; el texto usa tokens de tinta, nunca el color de
//     la serie (el color lo carga la marca, no la palabra)
//   · con 2 o más series siempre hay leyenda; una sola serie no lleva caja de
//     leyenda porque el título ya la nombra
//   · un solo eje, siempre. Dos escalas en el mismo gráfico hacen que dos
//     curvas se crucen donde no se cruza nada, y es el error más caro de todos
//   · cada marca trae <title>, que el navegador muestra como tooltip nativo
//
// Tres de los colores de serie quedaron bajo 3:1 de contraste contra la
// superficie clara. El validador lo marca y obliga a compensar: por eso hay
// leyenda visible y tabla con las mismas cifras junto a cada gráfico.

const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

export function colorSerie(i: number): string {
  // Nunca se cicla: a partir del noveno, todo cae en "Otros" gris. Un color
  // repetido miente sobre la identidad de la serie.
  return SERIES[i] ?? "#8b98a3";
}

// ─── Leyenda ─────────────────────────────────────────────────────────────────

export function Leyenda({ items }: { items: { etiqueta: string; color: string }[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li
          key={it.etiqueta}
          className="flex items-center gap-1.5 text-[12px] text-[var(--d360-ink-2)]"
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{ background: it.color }}
          />
          {it.etiqueta}
        </li>
      ))}
    </ul>
  );
}

// ─── Barras horizontales ─────────────────────────────────────────────────────

export type BarraH = {
  etiqueta: string;
  valor: number;
  /** Texto al final de la barra, ya formateado por quien llama. */
  texto?: string;
  color?: string;
};

export function BarrasH({
  datos,
  colorUnico = "var(--series-1)",
  anchoEtiqueta = 170,
}: {
  datos: BarraH[];
  colorUnico?: string;
  anchoEtiqueta?: number;
}) {
  const tope = Math.max(...datos.map((d) => Math.abs(d.valor)), 1);

  return (
    <div className="space-y-2">
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex items-center gap-3">
          <div
            className="shrink-0 truncate text-[13px] text-[var(--d360-ink-2)]"
            style={{ width: anchoEtiqueta }}
            title={d.etiqueta}
          >
            {d.etiqueta}
          </div>
          <div className="relative h-5 flex-1 rounded-[4px] bg-[#eef2f5]">
            <div
              className="h-full rounded-[4px]"
              style={{
                width: `${Math.max((Math.abs(d.valor) / tope) * 100, d.valor !== 0 ? 1.5 : 0)}%`,
                background: d.color ?? colorUnico,
              }}
              title={`${d.etiqueta}: ${d.texto ?? d.valor.toLocaleString("es-CL")}`}
            />
          </div>
          <div className="d360-num w-28 shrink-0 text-right text-[13px] font-medium text-[var(--d360-ink)]">
            {d.texto ?? d.valor.toLocaleString("es-CL")}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Serie temporal ──────────────────────────────────────────────────────────

export type SerieTemporal = {
  nombre: string;
  puntos: { x: string; y: number }[];
};

export function Lineas({
  series,
  alto = 220,
  formatoY = (n: number) => n.toLocaleString("es-CL"),
}: {
  series: SerieTemporal[];
  alto?: number;
  formatoY?: (n: number) => string;
}) {
  const etiquetasX = series[0]?.puntos.map((p) => p.x) ?? [];
  const todos = series.flatMap((s) => s.puntos.map((p) => p.y));
  const max = Math.max(...todos, 1);
  const min = Math.min(...todos, 0);
  const rango = max - min || 1;

  const W = 720;
  const H = alto;
  const M = { top: 12, right: 16, bottom: 26, left: 60 };
  const anchoPlot = W - M.left - M.right;
  const altoPlot = H - M.top - M.bottom;

  const px = (i: number) =>
    M.left +
    (etiquetasX.length <= 1 ? anchoPlot / 2 : (i / (etiquetasX.length - 1)) * anchoPlot);
  const py = (v: number) => M.top + altoPlot - ((v - min) / rango) * altoPlot;

  // Los ticks se redondean a entero: con series de montos, un eje que dice
  // "$0,25" no significa nada y delata que el gráfico no tiene datos.
  const ticks = 4;
  const valoresTick = [
    ...new Set(
      Array.from({ length: ticks + 1 }, (_, i) => Math.round(min + (rango * i) / ticks)),
    ),
  ];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Serie temporal: ${series.map((s) => s.nombre).join(", ")}`}
      >
        {valoresTick.map((v, i) => (
          <g key={i}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={py(v)}
              y2={py(v)}
              stroke="var(--d360-grid)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={py(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--d360-muted)"
              className="d360-num"
            >
              {formatoY(v)}
            </text>
          </g>
        ))}

        {etiquetasX.map((x, i) => {
          // Con muchas etiquetas se muestra una de cada N para que no se pisen.
          const salto = Math.ceil(etiquetasX.length / 8);
          if (i % salto !== 0 && i !== etiquetasX.length - 1) return null;
          return (
            <text
              key={x + i}
              x={px(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--d360-muted)"
            >
              {x}
            </text>
          );
        })}

        {series.slice(0, 4).map((s, si) => {
          const color = colorSerie(si);
          const d = s.puntos
            .map((p, i) => `${i === 0 ? "M" : "L"} ${px(i)} ${py(p.y)}`)
            .join(" ");
          return (
            <g key={s.nombre}>
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.puntos.map((p, i) => (
                <circle
                  key={i}
                  cx={px(i)}
                  cy={py(p.y)}
                  r={4}
                  fill={color}
                  stroke="var(--d360-surface)"
                  strokeWidth={2}
                >
                  <title>{`${s.nombre} · ${p.x}: ${formatoY(p.y)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {series.length > 1 && (
        <Leyenda
          items={series.slice(0, 4).map((s, i) => ({
            etiqueta: s.nombre,
            color: colorSerie(i),
          }))}
        />
      )}
    </div>
  );
}

// ─── Barra apilada de participación ──────────────────────────────────────────

export type Segmento = { etiqueta: string; valor: number; color?: string };

/**
 * Una sola barra con la composición del total. Sirve para «de dónde vino el
 * gasto» o «de dónde vinieron los leads», que es una pregunta de participación
 * y no de evolución.
 *
 * Los segmentos van separados por 2px de superficie: sin ese respiro, dos
 * colores contiguos se leen como uno.
 */
export function BarraApilada({
  segmentos,
  formato = (n: number) => n.toLocaleString("es-CL"),
}: {
  segmentos: Segmento[];
  formato?: (n: number) => string;
}) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0) || 1;

  return (
    <div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-[4px]">
        {segmentos.map((s, i) => (
          <div
            key={s.etiqueta}
            className="h-full first:rounded-l-[4px] last:rounded-r-[4px]"
            style={{
              width: `${(s.valor / total) * 100}%`,
              background: s.color ?? colorSerie(i),
            }}
            title={`${s.etiqueta}: ${formato(s.valor)} (${((s.valor / total) * 100).toFixed(1)}%)`}
          />
        ))}
      </div>
      <Leyenda
        items={segmentos.map((s, i) => ({
          etiqueta: `${s.etiqueta} · ${((s.valor / total) * 100).toFixed(0)}%`,
          color: s.color ?? colorSerie(i),
        }))}
      />
    </div>
  );
}
