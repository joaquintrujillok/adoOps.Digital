"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Los gráficos de Reportes.
 *
 * **Todo lo de acá es una sola serie**, y eso decide casi todo el diseño:
 * comparar magnitudes (días sin visita, visitas por zonal) y una razón contra un
 * total (cobertura). Con una serie no hace falta paleta categórica ni leyenda
 * —la única identidad la da el título— y el largo de la barra carga el dato. El
 * color queda libre para lo que sí significa algo: el estado.
 *
 * No hay librería de gráficos y no hace falta: son barras y una pista. Una
 * dependencia acá costaría más de mantener que las cien líneas que ahorra.
 */

const NUM = new Intl.NumberFormat("es-CL");

// ─── Medidor ─────────────────────────────────────────────────────────────────

/** El estado que corresponde a un porcentaje de cobertura. */
function severidad(pct: number): { fill: string; pista: string; texto: string } {
  if (pct >= 80)
    return { fill: "var(--viz-ok)", pista: "var(--viz-ok-pista)", texto: "var(--tun-ok)" };
  if (pct >= 50)
    return {
      fill: "var(--viz-alerta)",
      pista: "var(--viz-alerta-pista)",
      texto: "var(--tun-alerta)",
    };
  return {
    fill: "var(--viz-critico)",
    pista: "var(--viz-critico-pista)",
    texto: "var(--tun-critico)",
  };
}

/**
 * La cifra que encabeza la pantalla, con su medidor.
 *
 * Es un **medidor y no una torta**: una razón contra un total se lee mejor en
 * una barra, y una torta de dos gajos obliga a comparar ángulos para responder
 * algo que un largo responde solo. La pista es un paso más claro del mismo tono
 * que el relleno, así el estado se lee a lo largo de toda la barra y no solo en
 * la parte llena.
 */
export function Medidor({
  pct,
  titulo,
  detalle,
}: {
  pct: number;
  titulo: string;
  detalle: string;
}) {
  const s = severidad(pct);
  return (
    <div className="tun-tarjeta p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--tun-muted)" }}>
        {titulo}
      </div>
      {/* Una sola cifra héroe por pantalla, en la misma tipografía del resto. */}
      <div className="mt-2 text-[52px] font-semibold leading-none" style={{ color: s.texto }}>
        {pct}%
      </div>
      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full"
        style={{ background: s.pista }}
        role="img"
        aria-label={`${titulo}: ${pct}%. ${detalle}`}
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.max(pct, 1)}%`, background: s.fill }}
        />
      </div>
      <p className="mt-3 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
        {detalle}
      </p>
    </div>
  );
}

// ─── Barras ──────────────────────────────────────────────────────────────────

export interface Barra {
  id: string | number;
  etiqueta: string;
  sub?: string | null;
  valor: number;
  /** Sobrescribe el color de la serie cuando la fila representa un estado. */
  color?: string;
  href?: string;
}

/**
 * Barras horizontales. Horizontal y no vertical porque las etiquetas son nombres
 * largos —"FUND EST EXPE AGR J ORTUZAR PEREirA DE L"— y en columnas quedarían
 * inclinadas o cortadas.
 *
 * El valor va **en la punta** y no dentro de la barra: adentro se sale cuando la
 * barra es corta, y recortarlo con `overflow: hidden` cortaría el primer dígito,
 * que es peor que no ponerlo.
 */
export function Barras({
  datos,
  unidad,
  titulo,
  nota,
  vacio,
}: {
  datos: Barra[];
  unidad: string;
  titulo: string;
  nota?: string;
  vacio: string;
}) {
  const [sobre, setSobre] = useState<string | number | null>(null);
  const max = Math.max(1, ...datos.map((d) => d.valor));

  return (
    <section className="tun-tarjeta p-5">
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
        {titulo}
      </h2>
      {nota && (
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
          {nota}
        </p>
      )}

      {datos.length === 0 ? (
        <p className="mt-3 text-[13.5px]" style={{ color: "var(--tun-muted)" }}>
          {vacio}
        </p>
      ) : (
        <div className="mt-4 space-y-1">
          {datos.map((d) => {
            const Fila = (
              <div
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
                style={{ background: sobre === d.id ? "var(--tun-plane)" : undefined }}
                onMouseEnter={() => setSobre(d.id)}
                onMouseLeave={() => setSobre(null)}
                title={`${d.etiqueta}${d.sub ? ` · ${d.sub}` : ""} — ${NUM.format(d.valor)} ${unidad}`}
              >
                <div className="w-[38%] min-w-0 shrink-0">
                  <div className="truncate text-[13px] font-medium" style={{ color: "var(--tun-ink)" }}>
                    {d.etiqueta}
                  </div>
                  {d.sub && (
                    <div className="truncate text-[11.5px]" style={{ color: "var(--tun-muted)" }}>
                      {d.sub}
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {/* Barra fina, tope 14px: la guía pide no llenar la banda y
                      dejar que el aire sobrante haga de separador. Extremo
                      redondeado al final del dato, recto en la línea base. */}
                  <div className="h-[14px] min-w-0 flex-1">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max((d.valor / max) * 100, 1.5)}%`,
                        background: d.color ?? "var(--viz-serie)",
                        borderRadius: "2px 4px 4px 2px",
                      }}
                    />
                  </div>
                  {/* El valor lleva token de texto, no el color de la barra. */}
                  <span
                    className="w-[68px] shrink-0 text-right text-[12.5px] tabular-nums"
                    style={{ color: "var(--tun-ink-2)" }}
                  >
                    {NUM.format(d.valor)} {unidad}
                  </span>
                </div>
              </div>
            );

            return d.href ? (
              <Link key={d.id} href={d.href} className="block">
                {Fila}
              </Link>
            ) : (
              <div key={d.id}>{Fila}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Embudo ──────────────────────────────────────────────────────────────────

/**
 * Los tres pasos de lo que debería salir, sobre una misma escala.
 *
 * Comparten el máximo del primer paso a propósito: lo que interesa no es cuánto
 * mide cada uno, sino **dónde se cae** entre uno y el siguiente. Escalas
 * independientes harían que tres pasos muy distintos se vieran iguales.
 */
export function Embudo({
  pasos,
  titulo,
  nota,
}: {
  pasos: { etiqueta: string; valor: number }[];
  titulo: string;
  nota?: string;
}) {
  const max = Math.max(1, ...pasos.map((p) => p.valor));
  return (
    <section className="tun-tarjeta p-5">
      <h2 className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
        {titulo}
      </h2>
      {nota && (
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
          {nota}
        </p>
      )}
      <div className="mt-4 space-y-3">
        {pasos.map((p, i) => {
          const pctDelAnterior =
            i > 0 && pasos[i - 1].valor > 0
              ? Math.round((p.valor / pasos[i - 1].valor) * 100)
              : null;
          return (
            <div key={p.etiqueta}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
                  {p.etiqueta}
                </span>
                <span className="text-[13px] tabular-nums" style={{ color: "var(--tun-ink)" }}>
                  <b>{NUM.format(p.valor)}</b>
                  {pctDelAnterior != null && (
                    <span className="ml-1.5 text-[12px]" style={{ color: "var(--tun-muted)" }}>
                      {pctDelAnterior}% del paso anterior
                    </span>
                  )}
                </span>
              </div>
              <div className="h-[14px] w-full rounded-full" style={{ background: "var(--viz-serie-pista)" }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max((p.valor / max) * 100, 1.5)}%`,
                    background: "var(--viz-serie)",
                    borderRadius: "999px 4px 4px 999px",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Punto de estado ─────────────────────────────────────────────────────────

/**
 * El punto de color de una alerta. **Siempre con su etiqueta al lado**: es el
 * alivio que exige un color de estado que no llega a 3:1 de contraste, y además
 * lo que hace que la lista se pueda leer sin distinguir colores.
 */
export function Punto({ nivel }: { nivel: "ok" | "alerta" | "critico" }) {
  const color = {
    ok: "var(--viz-ok)",
    alerta: "var(--viz-alerta)",
    critico: "var(--viz-critico)",
  }[nivel];
  return (
    <span
      aria-hidden
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: "0 0 0 2px var(--tun-surface)" }}
    />
  );
}
