// Gráficos del CRM — SVG en línea, renderizados en el servidor.
//
// Sin librería de charts a propósito: son cuatro formas, el peso extra en el
// bundle no se justifica y el SVG servido desde el servidor se imprime bien.
//
// Reglas que se respetan en todos:
//   · marcas finas, extremos redondeados de 4px anclados a la línea base
//   · 2px de separación entre rellenos contiguos
//   · grilla y ejes recesivos; el texto usa tokens de tinta, nunca el color de
//     la serie (el color lo carga la marca, no la palabra)
//   · con 2 o más series siempre hay leyenda, y hasta 4 llevan etiqueta directa
//   · cada marca trae <title>, que el navegador muestra como tooltip nativo
//
// El tooltip nativo es una decisión consciente: da la capa de detalle al pasar
// el mouse sin convertir cada gráfico en un componente de cliente.

import { Fragment, type ReactNode } from "react";

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

const RAMPA = [
  "var(--ramp-1)",
  "var(--ramp-2)",
  "var(--ramp-3)",
  "var(--ramp-4)",
  "var(--ramp-5)",
  "var(--ramp-6)",
];

export function colorSerie(i: number): string {
  // Nunca se cicla: a partir del noveno, todo cae en "Otros" gris. Un color
  // repetido miente sobre la identidad de la serie.
  return SERIES[i] ?? "#898781";
}

// ─── Leyenda ─────────────────────────────────────────────────────────────────

export function Leyenda({
  items,
}: {
  items: { etiqueta: string; color: string }[];
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <li
          key={it.etiqueta}
          className="flex items-center gap-1.5 text-[12px] text-[var(--crm-ink-2)]"
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

// ─── Embudo ──────────────────────────────────────────────────────────────────

export type PasoEmbudo = {
  etiqueta: string;
  valor: number;
  /** Texto secundario (monto, por ejemplo). */
  detalle?: string;
  href?: string;
};

/**
 * Embudo como barras horizontales apiladas de arriba a abajo, no como trapecio.
 *
 * El trapecio clásico codifica la magnitud en el *ancho de un área*, que se lee
 * mal y exagera las caídas. Barras alineadas a la izquierda con eje común se
 * comparan de un vistazo, que es justo lo que se le pide a un embudo.
 */
export function Embudo({ pasos }: { pasos: PasoEmbudo[] }) {
  const tope = Math.max(...pasos.map((p) => p.valor), 1);
  const primero = pasos[0]?.valor ?? 0;

  return (
    <div className="space-y-2.5">
      {pasos.map((p, i) => {
        const ancho = Math.max((p.valor / tope) * 100, p.valor > 0 ? 1.5 : 0);
        const conversion = primero > 0 ? (p.valor / primero) * 100 : 0;
        const anterior = i > 0 ? pasos[i - 1].valor : null;
        const caida = anterior && anterior > 0 ? (1 - p.valor / anterior) * 100 : null;

        return (
          <div key={p.etiqueta}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium text-[var(--crm-ink)]">{p.etiqueta}</span>
              <span className="crm-num text-[var(--crm-ink-2)]">
                {p.valor.toLocaleString("es-CL")}
                {p.detalle && (
                  <span className="ml-2 text-[var(--crm-muted)]">{p.detalle}</span>
                )}
              </span>
            </div>
            <div className="relative h-7 w-full overflow-hidden rounded-[4px] bg-[#f0f1f3]">
              <div
                className="h-full rounded-[4px]"
                style={{ width: `${ancho}%`, background: RAMPA[Math.min(i, RAMPA.length - 1)] }}
                title={`${p.etiqueta}: ${p.valor.toLocaleString("es-CL")} (${conversion.toFixed(1)}% del inicio)`}
              />
            </div>
            <div className="mt-1 flex justify-between text-[12px] text-[var(--crm-muted)]">
              <span>{conversion.toFixed(1)}% del inicio</span>
              {caida !== null && caida > 0 && (
                <span>se cae {caida.toFixed(1)}% en este paso</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Barras horizontales ─────────────────────────────────────────────────────

export type BarraH = {
  etiqueta: string;
  valor: number;
  /** Texto que se muestra al final de la barra (formateado por quien llama). */
  texto?: string;
  color?: string;
  href?: string;
};

export function BarrasH({
  datos,
  colorUnico = "var(--series-1)",
  anchoEtiqueta = 160,
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
            className="shrink-0 truncate text-[13px] text-[var(--crm-ink-2)]"
            style={{ width: anchoEtiqueta }}
            title={d.etiqueta}
          >
            {d.etiqueta}
          </div>
          <div className="relative h-5 flex-1 rounded-[4px] bg-[#f4f5f7]">
            <div
              className="h-full rounded-[4px]"
              style={{
                width: `${Math.max((Math.abs(d.valor) / tope) * 100, d.valor !== 0 ? 1.5 : 0)}%`,
                background: d.color ?? colorUnico,
              }}
              title={`${d.etiqueta}: ${d.texto ?? d.valor.toLocaleString("es-CL")}`}
            />
          </div>
          <div className="crm-num w-24 shrink-0 text-right text-[13px] font-medium text-[var(--crm-ink)]">
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

/**
 * Línea con hasta 3 series. Un solo eje, siempre: dos escalas distintas en el
 * mismo gráfico es el error más caro que se puede cometer acá, porque hace que
 * dos curvas se crucen donde no se cruza nada.
 */
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
  const M = { top: 12, right: 16, bottom: 26, left: 56 };
  const anchoPlot = W - M.left - M.right;
  const altoPlot = H - M.top - M.bottom;

  const px = (i: number) =>
    M.left + (etiquetasX.length <= 1 ? anchoPlot / 2 : (i / (etiquetasX.length - 1)) * anchoPlot);
  const py = (v: number) => M.top + altoPlot - ((v - min) / rango) * altoPlot;

  // Los ticks se redondean a entero: con series de montos, un eje que dice
  // "$0,25" no significa nada y delata que el gráfico no tiene datos.
  const ticks = 4;
  const valoresTick = [
    ...new Set(
      Array.from({ length: ticks + 1 }, (_, i) =>
        Math.round(min + (rango * i) / ticks),
      ),
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
              stroke="var(--crm-grid)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={py(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--crm-muted)"
              className="crm-num"
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
              fill="var(--crm-muted)"
            >
              {x}
            </text>
          );
        })}

        {series.slice(0, 3).map((s, si) => {
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
                  stroke="var(--crm-surface)"
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
          items={series.slice(0, 3).map((s, i) => ({
            etiqueta: s.nombre,
            color: colorSerie(i),
          }))}
        />
      )}
    </div>
  );
}

// ─── Barras verticales agrupadas por categoría ───────────────────────────────

export function BarrasV({
  datos,
  alto = 200,
  formato = (n: number) => n.toLocaleString("es-CL"),
  color = "var(--series-1)",
}: {
  datos: { etiqueta: string; valor: number }[];
  alto?: number;
  formato?: (n: number) => string;
  color?: string;
}) {
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <div className="flex items-end gap-[2px]" style={{ height: alto }}>
      {datos.map((d) => (
        <div key={d.etiqueta} className="flex h-full flex-1 flex-col justify-end">
          <div
            className="crm-num mb-1 text-center text-[11px] text-[var(--crm-ink-2)]"
            style={{ minHeight: 14 }}
          >
            {formato(d.valor)}
          </div>
          <div
            className="rounded-t-[4px]"
            style={{
              height: `${Math.max((d.valor / max) * 100, d.valor > 0 ? 2 : 0)}%`,
              background: color,
            }}
            title={`${d.etiqueta}: ${formato(d.valor)}`}
          />
          <div className="mt-1.5 truncate text-center text-[11px] text-[var(--crm-muted)]">
            {d.etiqueta}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Medidor de score ────────────────────────────────────────────────────────

/**
 * El puntaje de una cuenta u oportunidad, 0-100.
 *
 * Va con el número escrito al lado siempre: un arco de color solo no permite
 * distinguir 71 de 78, y quien lo mira necesita justamente eso.
 */
export function Medidor({
  score,
  tamano = 52,
  numeroDentro = true,
}: {
  score: number;
  tamano?: number;
  /** El número va dentro del anillo; con `false` queda al lado (más legible en fichas). */
  numeroDentro?: boolean;
}) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = (tamano - 8) / 2;
  const c = 2 * Math.PI * r;
  const color =
    s >= 70 ? "var(--ramp-6)" : s >= 40 ? "var(--ramp-3)" : "var(--ramp-1)";

  const anillo = (
    <svg
      width={tamano}
      height={tamano}
      viewBox={`0 0 ${tamano} ${tamano}`}
      role="img"
      aria-label={`Puntaje ${s} de 100`}
    >
      <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="#eceef1" strokeWidth={5} />
      <circle
        cx={tamano / 2}
        cy={tamano / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${(c * s) / 100} ${c}`}
        transform={`rotate(-90 ${tamano / 2} ${tamano / 2})`}
      />
      {numeroDentro && (
        // El número siempre acompaña al anillo: un arco de color no permite
        // distinguir 71 de 78, y quien lo mira necesita justamente eso.
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={tamano * 0.34}
          fontWeight={600}
          fill="var(--crm-ink)"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {s}
        </text>
      )}
    </svg>
  );

  if (numeroDentro) return anillo;

  return (
    <div className="flex items-center gap-2">
      {anillo}
      <span className="crm-num text-[15px] font-semibold text-[var(--crm-ink)]">{s}</span>
    </div>
  );
}

// ─── Figura con título y lectura ─────────────────────────────────────────────

export function Figura({
  titulo,
  subtitulo,
  children,
  pie,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  return (
    <figure className="m-0">
      <figcaption className="mb-3">
        <div className="text-[15px] font-semibold text-[var(--crm-ink)]">{titulo}</div>
        {subtitulo && (
          <div className="mt-0.5 text-[13px] text-[var(--crm-ink-2)]">{subtitulo}</div>
        )}
      </figcaption>
      {children}
      {pie && <div className="mt-3 text-[12px] text-[var(--crm-muted)]">{pie}</div>}
    </figure>
  );
}

// ─── Matriz RFM ──────────────────────────────────────────────────────────────

export type CeldaRfm = { r: number; f: number; clientes: number; monto: number };

/**
 * La matriz 5×5 de recencia por frecuencia.
 *
 * El color codifica **cantidad de clientes** y no monto: la pregunta que se le
 * hace a esta matriz es "¿dónde está mi gente?", y usar el monto haría que dos
 * celdas con un solo cliente millonario se vean como el centro del negocio.
 * El monto va en el tooltip y en la tabla de segmentos, que es donde se compara.
 *
 * Rampa secuencial de un solo tono, clara a oscura: es lo que corresponde a una
 * magnitud. Un arcoíris acá inventaría categorías donde solo hay más y menos.
 */
export function MatrizRfm({
  celdas,
  formatoMonto,
}: {
  celdas: CeldaRfm[];
  formatoMonto: (n: number) => string;
}) {
  const maximo = Math.max(...celdas.map((c) => c.clientes), 1);

  const tono = (n: number) => {
    if (n === 0) return "var(--crm-surface)";
    const nivel = Math.ceil((n / maximo) * 6);
    return `var(--ramp-${Math.min(6, Math.max(1, nivel))})`;
  };

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-center">
        <span className="whitespace-nowrap text-[11px] uppercase tracking-wide text-[var(--crm-muted)] [writing-mode:vertical-rl] [transform:rotate(180deg)]">
          Recencia →
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
          {[5, 4, 3, 2, 1].map((r) => (
            <Fragment key={r}>
              <div className="crm-num flex w-6 items-center justify-end pr-1 text-[11px] text-[var(--crm-muted)]">
                {r}
              </div>
              {[1, 2, 3, 4, 5].map((f) => {
                const celda = celdas.find((c) => c.r === r && c.f === f);
                const n = celda?.clientes ?? 0;
                // El texto se invierte en las celdas oscuras: mantenerlo negro
                // sobre el paso 5 o 6 de la rampa lo vuelve ilegible.
                const oscura = n > maximo * 0.5;
                return (
                  <div
                    key={f}
                    className="flex aspect-square items-center justify-center rounded-md border border-[var(--crm-grid)] text-[13px] font-medium"
                    style={{
                      background: tono(n),
                      color: n === 0 ? "var(--crm-muted)" : oscura ? "#fff" : "var(--crm-ink)",
                    }}
                    title={`Recencia ${r} · Frecuencia ${f}: ${n} clientes · ${formatoMonto(celda?.monto ?? 0)}`}
                  >
                    {n > 0 ? n : "·"}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
          <div className="w-6" />
          {[1, 2, 3, 4, 5].map((f) => (
            <div key={f} className="crm-num text-center text-[11px] text-[var(--crm-muted)]">
              {f}
            </div>
          ))}
        </div>
        <div className="mt-1 text-center text-[11px] uppercase tracking-wide text-[var(--crm-muted)]">
          Frecuencia →
        </div>
      </div>
    </div>
  );
}

// ─── Cohortes ────────────────────────────────────────────────────────────────

/**
 * Heatmap de cohortes: cada fila es un mes de entrada, cada columna los meses
 * transcurridos desde esa entrada.
 *
 * La diagonal vacía de abajo a la derecha no es un error: las cohortes recientes
 * todavía no vivieron esos meses. Mostrarlas en blanco —y no en cero— es lo que
 * evita que alguien lea una caída donde solo falta tiempo.
 */
export function Cohortes({
  filas,
  columnas = 12,
  formato,
}: {
  filas: { etiqueta: string; clientes: number; valores: number[] }[];
  columnas?: number;
  formato: (n: number) => string;
}) {
  const todos = filas.flatMap((f) => f.valores.slice(0, columnas)).filter((v) => v > 0);
  const maximo = Math.max(...todos, 1);

  const tono = (v: number) => {
    if (v <= 0) return "var(--crm-surface)";
    const nivel = Math.ceil((v / maximo) * 6);
    return `var(--ramp-${Math.min(6, Math.max(1, nivel))})`;
  };

  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-[12px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[var(--crm-surface)] px-2 text-left font-medium text-[var(--crm-muted)]">
              Entraron en
            </th>
            <th className="px-2 text-right font-medium text-[var(--crm-muted)]">Clientes</th>
            {Array.from({ length: columnas }, (_, i) => (
              <th key={i} className="crm-num px-1 text-center font-medium text-[var(--crm-muted)]">
                {i}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            // Cuántos meses vivió realmente esta cohorte: más allá de eso no hay
            // dato, y pintar cero sería inventar una caída.
            const vividos = f.valores.length;
            return (
              <tr key={f.etiqueta}>
                <td className="sticky left-0 whitespace-nowrap bg-[var(--crm-surface)] px-2 font-medium">
                  {f.etiqueta}
                </td>
                <td className="crm-num px-2 text-right text-[var(--crm-ink-2)]">{f.clientes}</td>
                {Array.from({ length: columnas }, (_, i) => {
                  const v = f.valores[i];
                  if (i >= vividos || v === undefined) {
                    return <td key={i} className="rounded bg-transparent" />;
                  }
                  const oscura = v > maximo * 0.5;
                  return (
                    <td
                      key={i}
                      className="crm-num rounded px-1 py-1.5 text-center"
                      style={{
                        background: tono(v),
                        color: v === 0 ? "var(--crm-muted)" : oscura ? "#fff" : "var(--crm-ink)",
                      }}
                      title={`${f.etiqueta} · mes ${i}: ${formato(v)}`}
                    >
                      {v > 0 ? formato(v) : "·"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Barra apilada ───────────────────────────────────────────────────────────

/**
 * Una sola barra con la composición del total.
 *
 * Lleva 2px de separación entre tramos y etiqueta directa en los que superan el
 * 8%: por debajo de eso el texto no cabe y se sale de su tramo.
 */
export function BarraApilada({
  partes,
  alto = 40,
  formato,
}: {
  partes: { etiqueta: string; valor: number; color?: string }[];
  alto?: number;
  formato: (n: number) => string;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0) || 1;

  return (
    <div>
      <div className="flex gap-[2px] overflow-hidden rounded-lg" style={{ height: alto }}>
        {partes.map((p, i) => {
          const pct = (p.valor / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={p.etiqueta}
              className="flex items-center justify-center text-[12px] font-medium text-white"
              style={{ width: `${pct}%`, background: p.color ?? colorSerie(i) }}
              title={`${p.etiqueta}: ${formato(p.valor)} (${pct.toFixed(1)}%)`}
            >
              {pct >= 8 && `${pct.toFixed(0)}%`}
            </div>
          );
        })}
      </div>
      <Leyenda
        items={partes.map((p, i) => ({
          etiqueta: `${p.etiqueta} · ${formato(p.valor)}`,
          color: p.color ?? colorSerie(i),
        }))}
      />
    </div>
  );
}
