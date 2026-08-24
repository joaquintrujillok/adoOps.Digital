// Piezas de interfaz de Dashboard360.
//
// Mismo criterio que el CRM y misma forma, con los tokens `--d360-*`. Están
// duplicadas y no importadas a propósito: los dos módulos se venden por
// separado y comparten repositorio por conveniencia, no por diseño.

import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  bajada,
  acciones,
}: {
  titulo: string;
  bajada?: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold text-[var(--d360-ink)]">{titulo}</h1>
        {bajada && (
          <p className="mt-1 max-w-[70ch] text-[13px] text-[var(--d360-ink-2)]">{bajada}</p>
        )}
      </div>
      {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
    </header>
  );
}

export function Card({
  titulo,
  descripcion,
  acciones,
  children,
  className = "",
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-5 shadow-[0_1px_2px_rgba(11,21,35,0.04)] ${className}`}
    >
      {(titulo || acciones) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo && (
              <h2 className="text-[15px] font-semibold text-[var(--d360-ink)]">{titulo}</h2>
            )}
            {descripcion && (
              <p className="mt-0.5 text-[12px] text-[var(--d360-muted)]">{descripcion}</p>
            )}
          </div>
          {acciones && <div className="shrink-0">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Cifra sola, sin gráfico. Es la forma correcta cuando el dato tiene un solo
 * valor: dibujar una barra de un solo elemento no agrega información, agrega
 * tinta.
 *
 * `variacion` va en puntos porcentuales sobre el período anterior. El signo lo
 * pinta el componente y siempre acompaña con una flecha, porque el color solo
 * no basta para quien no lo distingue.
 */
export function StatTile({
  etiqueta,
  valor,
  variacion,
  nota,
  /** `true` cuando subir es malo (costo por lead, por ejemplo). */
  invertido = false,
}: {
  etiqueta: string;
  valor: string;
  variacion?: number | null;
  nota?: string;
  invertido?: boolean;
}) {
  const hayVar = typeof variacion === "number" && Number.isFinite(variacion);
  const sube = hayVar && variacion! > 0;
  const plano = hayVar && Math.abs(variacion!) < 0.5;
  const bueno = plano ? null : invertido ? !sube : sube;

  const color = bueno === null
    ? "var(--d360-muted)"
    : bueno
      ? "var(--status-good-text)"
      : "var(--status-critical)";

  return (
    <div className="rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-4">
      <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--d360-muted)]">
        {etiqueta}
      </div>
      <div className="d360-num mt-1.5 text-[26px] font-semibold leading-none text-[var(--d360-ink)]">
        {valor}
      </div>
      {hayVar && (
        <div className="d360-num mt-2 flex items-center gap-1 text-[12px]" style={{ color }}>
          <span aria-hidden>{plano ? "→" : sube ? "↑" : "↓"}</span>
          <span>
            {plano ? "sin cambio" : `${sube ? "+" : ""}${variacion!.toFixed(1)}%`}
          </span>
          <span className="text-[var(--d360-muted)]">vs. período anterior</span>
        </div>
      )}
      {nota && <div className="mt-2 text-[12px] text-[var(--d360-muted)]">{nota}</div>}
    </div>
  );
}

const TONOS = {
  neutro: "bg-[#eef2f5] text-[#43566a]",
  marca: "bg-[var(--d360-brand-soft)] text-[var(--d360-brand-dark)]",
  bueno: "bg-[#e4f6e4] text-[var(--status-good-text)]",
  alerta: "bg-[#fdf3dc] text-[#8a5d00]",
  critico: "bg-[#fbe9e9] text-[#96201f]",
} as const;

export type Tono = keyof typeof TONOS;

export function Badge({ children, tono = "neutro" }: { children: ReactNode; tono?: Tono }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

/**
 * Estado de una fuente. Siempre ícono + palabra: el color es refuerzo, no el
 * portador del significado.
 */
export function EstadoFuente({ estado }: { estado: string }) {
  const mapa: Record<string, { tono: Tono; icono: string; texto: string }> = {
    conectada: { tono: "bueno", icono: "●", texto: "Conectada" },
    sincronizando: { tono: "marca", icono: "◐", texto: "Sincronizando" },
    error: { tono: "critico", icono: "▲", texto: "Con error" },
    pendiente: { tono: "alerta", icono: "○", texto: "Sin conectar" },
  };
  const e = mapa[estado] ?? { tono: "neutro" as Tono, icono: "·", texto: estado };
  return (
    <Badge tono={e.tono}>
      <span aria-hidden>{e.icono}</span>
      {e.texto}
    </Badge>
  );
}

const BTN_BASE =
  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-60";

export const btnPrimario = `${BTN_BASE} bg-[var(--d360-brand)] text-white hover:bg-[var(--d360-brand-dark)]`;
export const btnSecundario = `${BTN_BASE} border border-[var(--d360-border)] bg-white text-[var(--d360-ink)] hover:border-[var(--d360-brand)] hover:text-[var(--d360-brand-dark)]`;
export const btnFantasma = `${BTN_BASE} text-[var(--d360-ink-2)] hover:bg-[#eef2f5]`;

export function Vacio({ mensaje, sugerencia }: { mensaje: string; sugerencia?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--d360-grid)] px-5 py-8 text-center">
      <p className="text-[14px] text-[var(--d360-ink-2)]">{mensaje}</p>
      {sugerencia && <p className="mt-1 text-[12px] text-[var(--d360-muted)]">{sugerencia}</p>}
    </div>
  );
}

/**
 * Tabla con scroll horizontal propio. La tabla no es un respaldo del gráfico:
 * es la vista accesible obligatoria cuando el color no alcanza, y por eso
 * aparece junto a cada gráfico y no escondida detrás de un botón.
 */
export function Tabla({ children }: { children: ReactNode }) {
  return (
    <div className="d360-scroll -mx-1 overflow-x-auto px-1">
      <table className="d360-table">{children}</table>
    </div>
  );
}
