"use client";

import { useRef } from "react";
import { ETAPAS } from "@/lib/crm/etapas";
import { accionMoverEtapa } from "@/lib/crm/acciones";

/**
 * Selector de etapa que envía al cambiar.
 *
 * Convive con el arrastre del tablero (`ArrastreEtapa.tsx`) y no sobra: el
 * arrastre es el atajo cómodo para el mouse, pero la API de arrastre de HTML no
 * existe en táctil y no se maneja con teclado ni con lector de pantalla. Este
 * `select` es el camino que funciona siempre, y además el único que sirve en una
 * lista larga donde soltar en la columna correcta obliga a apuntar.
 */
export default function MoverEtapa({
  dealId,
  etapa,
  compacto = false,
}: {
  dealId: number;
  etapa: string;
  compacto?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={accionMoverEtapa} className="inline-flex">
      <input type="hidden" name="dealId" value={dealId} />
      <select
        name="etapa"
        defaultValue={etapa}
        aria-label="Cambiar etapa"
        onChange={(e) => {
          // "Perdido" exige motivo: cerrar un negocio sin decir por qué es
          // exactamente el dato que después falta para mejorar la tasa.
          if (e.target.value === "perdido") {
            const motivo = window.prompt(
              "¿Por qué se perdió? (Precio, Competencia, Sin presupuesto, Sin respuesta, …)",
            );
            if (motivo === null) {
              e.target.value = etapa;
              return;
            }
            const campo = document.createElement("input");
            campo.type = "hidden";
            campo.name = "motivo";
            campo.value = motivo;
            form.current?.appendChild(campo);
          }
          form.current?.requestSubmit();
        }}
        className={`rounded-md border border-[var(--crm-border)] bg-white text-[var(--crm-ink-2)] outline-none hover:border-[var(--crm-brand)] ${
          compacto ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[13px]"
        }`}
      >
        {ETAPAS.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </form>
  );
}
