"use client";

// Selector de rango de fechas del tablero.
//
// El rango viaja en la URL (`?desde=&hasta=`) y no en estado del componente:
// así un enlace a «los últimos 7 días de septiembre» se puede pegar en un
// correo, y volver atrás en el navegador vuelve al rango anterior. Un selector
// que solo vive en memoria obliga a describir con palabras lo que ya era un
// enlace.
//
// Los atajos van con `min`/`max` acotados a lo que existe en la base. Pedir
// noventa días cuando la ingesta trajo treinta muestra sesenta días en cero y
// parece que la inversión se derrumbó.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function restar(hasta: string, dias: number): string {
  const d = new Date(`${hasta}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (dias - 1));
  return iso(d);
}

export default function SelectorRango({
  desde,
  hasta,
  disponible,
}: {
  desde: string;
  hasta: string;
  /** Primer y último día con datos. Acota los extremos del selector. */
  disponible: { desde: string; hasta: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  const aplicar = (d: string, h: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("desde", d);
    p.set("hasta", h);
    iniciar(() => router.push(`${pathname}?${p.toString()}`));
  };

  const tope = disponible?.hasta ?? hasta;
  const piso = disponible?.desde ?? desde;

  // Un atajo solo se ofrece si hay datos para cubrirlo.
  const atajos = [7, 14, 30, 90].filter((d) => restar(tope, d) >= piso || d === 7);

  const activo = (d: number) => desde === restar(tope, d) && hasta === tope;

  const chip =
    "rounded-md px-2.5 py-1 text-[12px] font-medium transition disabled:opacity-50";

  return (
    <div className="d360-no-print flex flex-wrap items-center gap-1.5">
      {atajos.map((d) => (
        <button
          key={d}
          type="button"
          disabled={pendiente}
          onClick={() => aplicar(restar(tope, d), tope)}
          className={
            activo(d)
              ? `${chip} bg-[var(--d360-brand)] text-white`
              : `${chip} border border-[var(--d360-border)] bg-white text-[var(--d360-ink-2)] hover:border-[var(--d360-brand)]`
          }
        >
          {d} días
        </button>
      ))}

      <span className="mx-1 text-[var(--d360-grid)]">|</span>

      <input
        type="date"
        value={desde}
        min={piso}
        max={hasta}
        disabled={pendiente}
        onChange={(e) => e.target.value && aplicar(e.target.value, hasta)}
        className="rounded-md border border-[var(--d360-border)] bg-white px-2 py-1 text-[12px] text-[var(--d360-ink)] disabled:opacity-50"
        aria-label="Desde"
      />
      <span className="text-[12px] text-[var(--d360-muted)]">→</span>
      <input
        type="date"
        value={hasta}
        min={desde}
        max={tope}
        disabled={pendiente}
        onChange={(e) => e.target.value && aplicar(desde, e.target.value)}
        className="rounded-md border border-[var(--d360-border)] bg-white px-2 py-1 text-[12px] text-[var(--d360-ink)] disabled:opacity-50"
        aria-label="Hasta"
      />

      {disponible && (
        // Se declara qué hay: si alguien no encuentra un mes, la respuesta está
        // acá y no en una consulta al equipo.
        <span className="ml-1 text-[11px] text-[var(--d360-muted)]">
          Datos desde {disponible.desde}
        </span>
      )}
    </div>
  );
}
