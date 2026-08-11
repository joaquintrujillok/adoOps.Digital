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

import type { ReactNode } from "react";

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
