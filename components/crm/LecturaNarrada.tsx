// La lectura de negocio de cada pantalla, redactada por el asistente.
//
// Vive en su propio componente async para poder envolverlo en <Suspense>: así
// la página se pinta con todas sus cifras de inmediato (~430 ms) y el párrafo
// aparece cuando el modelo responde, en vez de dejar la pantalla en blanco
// mientras tanto. Con el caché caliente llega junto con el resto.

import { Lectura } from "./ui";
import { narrar } from "@/lib/crm/narrador";

export async function LecturaNarrada({
  resumen,
  contexto,
  respaldo,
  clave,
  titulo,
  extra,
}: {
  resumen: Record<string, unknown>;
  contexto: string;
  respaldo: string;
  /** Identifica la pantalla en el caché de narraciones. */
  clave: string;
  titulo?: string;
  /** Contenido fijo que se agrega bajo el párrafo (avisos calculados). */
  extra?: React.ReactNode;
}) {
  const narracion = await narrar(resumen, contexto, respaldo, clave);

  return (
    <Lectura
      titulo={titulo}
      fuente={
        narracion.origen === "ia"
          ? "Redactado por el asistente sobre cifras calculadas por el CRM."
          : "Redactado con plantilla sobre cifras calculadas por el CRM."
      }
    >
      <p>{narracion.texto}</p>
      {extra}
    </Lectura>
  );
}

/** Lo que se ve mientras el asistente escribe. */
export function LecturaEsqueleto({ titulo = "Qué dice esto" }: { titulo?: string }) {
  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-brand-soft)] px-5 py-4">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--crm-brand-dark)]">
        <span aria-hidden>◈</span>
        {titulo}
      </div>
      <div className="mt-3 space-y-2" aria-live="polite" aria-busy="true">
        <div className="h-3 w-[92%] animate-pulse rounded bg-[#cfe8d9]" />
        <div className="h-3 w-[85%] animate-pulse rounded bg-[#cfe8d9]" />
        <div className="h-3 w-[64%] animate-pulse rounded bg-[#cfe8d9]" />
      </div>
      <p className="mt-3 text-[12px] text-[var(--crm-ink-2)]">
        El asistente está redactando la lectura…
      </p>
    </div>
  );
}
