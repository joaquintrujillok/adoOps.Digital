// Primitivas de interfaz del CRM.
//
// Server components puros (sin "use client"): se usan dentro de páginas de
// servidor sin arrastrar JavaScript al navegador. Lo interactivo vive en
// componentes propios marcados como cliente.

import Link from "next/link";
import type { ReactNode } from "react";

// ─── Estructura de página ────────────────────────────────────────────────────

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
      <div>
        <h1 className="text-2xl font-semibold text-[var(--crm-ink)]">{titulo}</h1>
        {bajada && (
          <p className="mt-1 max-w-3xl text-sm text-[var(--crm-ink-2)]">{bajada}</p>
        )}
      </div>
      {acciones && <div className="flex items-center gap-2">{acciones}</div>}
    </header>
  );
}

export function Card({
  titulo,
  descripcion,
  acciones,
  children,
  className = "",
  padding = true,
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[0_1px_2px_rgba(11,11,11,0.04)] ${className}`}
    >
      {(titulo || acciones) && (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--crm-grid)] px-5 py-4">
          <div>
            {titulo && (
              <h2 className="text-[15px] font-semibold text-[var(--crm-ink)]">
                {titulo}
              </h2>
            )}
            {descripcion && (
              <p className="mt-0.5 text-[13px] text-[var(--crm-ink-2)]">
                {descripcion}
              </p>
            )}
          </div>
          {acciones && <div className="flex shrink-0 items-center gap-2">{acciones}</div>}
        </div>
      )}
      <div className={padding ? "p-5" : ""}>{children}</div>
    </section>
  );
}

// ─── Cifras ──────────────────────────────────────────────────────────────────

/**
 * Una cifra sola con su contexto. Es la respuesta correcta cuando el dato es un
 * titular: un gráfico de un solo valor no agrega nada que el número no diga.
 *
 * `delta` recibe el cambio ya calculado; el signo decide color e ícono, y
 * siempre va acompañado de la palabra "vs …" para no depender del color.
 */
export function StatTile({
  etiqueta,
  valor,
  contexto,
  delta,
  deltaBueno = "arriba",
  href,
}: {
  etiqueta: string;
  valor: string;
  contexto?: string;
  delta?: number | null;
  deltaBueno?: "arriba" | "abajo";
  href?: string;
}) {
  const hayDelta = typeof delta === "number" && Number.isFinite(delta);
  const positivo = hayDelta && delta! > 0;
  const bueno = hayDelta
    ? deltaBueno === "arriba"
      ? delta! > 0
      : delta! < 0
    : false;
  const color = !hayDelta || delta === 0
    ? "var(--crm-muted)"
    : bueno
      ? "var(--status-good-text)"
      : "var(--status-critical)";

  const cuerpo = (
    <>
      <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
        {etiqueta}
      </div>
      <div className="mt-1.5 text-[28px] font-semibold leading-none text-[var(--crm-ink)]">
        {valor}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[13px]">
        {hayDelta && (
          <span className="crm-num font-medium" style={{ color }}>
            {positivo ? "▲" : delta === 0 ? "—" : "▼"}{" "}
            {Math.abs(delta!).toFixed(1)}%
          </span>
        )}
        {contexto && <span className="text-[var(--crm-ink-2)]">{contexto}</span>}
      </div>
    </>
  );

  const clases =
    "block rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-5 py-4 shadow-[0_1px_2px_rgba(11,11,11,0.04)]";

  return href ? (
    <Link href={href} className={`${clases} transition hover:border-[var(--crm-brand)]`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}

// ─── Etiquetas de estado ─────────────────────────────────────────────────────

const TONOS = {
  neutro: { bg: "#f0f1f3", fg: "#52514e", borde: "#e1e0d9" },
  bueno: { bg: "#e8f6e8", fg: "#0b5f0b", borde: "#bde5bd" },
  alerta: { bg: "#fdf3d9", fg: "#7a5600", borde: "#f6e0a5" },
  serio: { bg: "#fdeee7", fg: "#8a3d18", borde: "#f7d3c2" },
  critico: { bg: "#fbe9e9", fg: "#96201f", borde: "#f2c3c3" },
  marca: { bg: "var(--crm-brand-soft)", fg: "var(--crm-brand-dark)", borde: "#bfe6cd" },
  info: { bg: "#e8f0fc", fg: "#1c5cab", borde: "#c4dbf7" },
} as const;

export type Tono = keyof typeof TONOS;

export function Badge({
  children,
  tono = "neutro",
  icono,
}: {
  children: ReactNode;
  tono?: Tono;
  icono?: string;
}) {
  const t = TONOS[tono];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg, borderColor: t.borde }}
    >
      {icono && <span aria-hidden>{icono}</span>}
      {children}
    </span>
  );
}

/** Semáforo con ícono + palabra: el color nunca carga el significado solo. */
export function Estado({ estado }: { estado: string }) {
  const mapa: Record<string, { tono: Tono; icono: string; texto: string }> = {
    // Cuentas
    prospecto: { tono: "info", icono: "◌", texto: "Prospecto" },
    cliente: { tono: "bueno", icono: "●", texto: "Cliente" },
    inactivo: { tono: "alerta", icono: "◐", texto: "Inactivo" },
    perdido: { tono: "critico", icono: "○", texto: "Perdido" },
    // Etapas
    nuevo: { tono: "neutro", icono: "1", texto: "Nuevo" },
    calificado: { tono: "info", icono: "2", texto: "Calificado" },
    propuesta: { tono: "info", icono: "3", texto: "Propuesta" },
    negociacion: { tono: "marca", icono: "4", texto: "Negociación" },
    ganado: { tono: "bueno", icono: "✓", texto: "Ganado" },
    perdido_deal: { tono: "critico", icono: "✕", texto: "Perdido" },
    // Mensajes
    draft: { tono: "neutro", icono: "✎", texto: "Borrador" },
    pending: { tono: "alerta", icono: "⏳", texto: "En cola" },
    simulado: { tono: "info", icono: "◈", texto: "Simulado" },
    sent: { tono: "bueno", icono: "✓", texto: "Enviado" },
    retenido: { tono: "alerta", icono: "⛔", texto: "Retenido" },
    failed: { tono: "critico", icono: "!", texto: "Falló" },
  };
  const d = mapa[estado] ?? { tono: "neutro" as Tono, icono: "•", texto: estado };
  return (
    <Badge tono={d.tono} icono={d.icono}>
      {d.texto}
    </Badge>
  );
}

/** Severidad de alerta. Ícono + palabra, por lo mismo. */
export function Severidad({ nivel }: { nivel: string }) {
  const mapa: Record<string, { tono: Tono; icono: string; texto: string }> = {
    alta: { tono: "critico", icono: "▲", texto: "Alta" },
    media: { tono: "serio", icono: "◆", texto: "Media" },
    baja: { tono: "info", icono: "▼", texto: "Baja" },
  };
  const d = mapa[nivel] ?? mapa.baja;
  return (
    <Badge tono={d.tono} icono={d.icono}>
      {d.texto}
    </Badge>
  );
}

// ─── Botones ─────────────────────────────────────────────────────────────────

const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";

export const btnPrimario = `${BTN_BASE} bg-[var(--crm-brand)] text-white hover:bg-[var(--crm-brand-dark)]`;
export const btnSecundario = `${BTN_BASE} border border-[var(--crm-border)] bg-white text-[var(--crm-ink)] hover:border-[var(--crm-brand)] hover:text-[var(--crm-brand-dark)]`;
export const btnFantasma = `${BTN_BASE} text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]`;
export const btnPeligro = `${BTN_BASE} border border-[#f2c3c3] bg-white text-[#96201f] hover:bg-[#fbe9e9]`;

// ─── Vacíos y lectura ────────────────────────────────────────────────────────

export function Vacio({ mensaje, sugerencia }: { mensaje: string; sugerencia?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--crm-axis)] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[var(--crm-ink-2)]">{mensaje}</p>
      {sugerencia && (
        <p className="mt-1 text-[13px] text-[var(--crm-muted)]">{sugerencia}</p>
      )}
    </div>
  );
}

/**
 * La lectura de negocio que acompaña a cada pantalla: qué pasó, por qué y qué
 * hacer. Es lo que separa un reporte de un dashboard — y literalmente lo que
 * pide el mercado cuando dice "reportes útiles, no solo dashboards".
 */
export function Lectura({
  titulo = "Qué dice esto",
  children,
  fuente,
}: {
  titulo?: string;
  children: ReactNode;
  fuente?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-brand-soft)] px-5 py-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--crm-brand-dark)]">
        <span aria-hidden>◈</span>
        {titulo}
      </div>
      <div className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-[var(--crm-ink)]">
        {children}
      </div>
      {fuente && (
        <p className="mt-3 text-[12px] text-[var(--crm-ink-2)]">{fuente}</p>
      )}
    </div>
  );
}

// ─── Tabla ───────────────────────────────────────────────────────────────────

export function Tabla({
  columnas,
  children,
}: {
  columnas: (string | { titulo: string; alinear?: "izq" | "der" | "centro" })[];
  children: ReactNode;
}) {
  return (
    <div className="crm-scroll overflow-x-auto">
      <table className="crm-table">
        <thead>
          <tr>
            {columnas.map((c, i) => {
              const col = typeof c === "string" ? { titulo: c, alinear: "izq" as const } : c;
              return (
                <th
                  key={i}
                  style={{
                    textAlign:
                      col.alinear === "der"
                        ? "right"
                        : col.alinear === "centro"
                          ? "center"
                          : "left",
                  }}
                >
                  {col.titulo}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
