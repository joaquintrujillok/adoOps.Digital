"use client";

// El formulario de subida. Cliente por una sola razón: mostrar el resultado.
//
// Una ingesta tarda decenas de segundos —embeber 125 trozos no es instantáneo— y
// sin estado en pantalla la persona no sabe si está corriendo o si el clic no
// registró, y vuelve a apretar. Un `useActionState` cuesta poco y evita una
// ingesta duplicada.

import { useActionState } from "react";
import { subirConocimientoAction, type ResultadoSubida } from "@/lib/conocimiento/acciones";
import type { Cuenta } from "@/lib/cuentas";

export default function Subir({
  cuentas,
  activa,
}: {
  cuentas: Cuenta[];
  activa: Cuenta;
}) {
  const [estado, accion, cargando] = useActionState<ResultadoSubida, FormData>(
    subirConocimientoAction,
    {},
  );

  return (
    <form action={accion} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] text-[var(--d360-ink-2)]">
          <span className="mb-1 block">Cuenta</span>
          <select
            name="cuenta"
            defaultValue={activa.id}
            className="rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px]"
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="text-[12px] text-[var(--d360-ink-2)]">
          <span className="mb-1 block">Archivo markdown</span>
          <input
            type="file"
            name="archivo"
            accept=".md,.markdown,text/markdown,text/plain"
            required
            className="block w-72 text-[12.5px] text-[var(--d360-ink-2)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--d360-brand)] file:px-3 file:py-2 file:text-[12.5px] file:text-white hover:file:bg-[var(--d360-brand-dark)]"
          />
        </label>

        <button
          type="submit"
          disabled={cargando}
          className="rounded-lg bg-[var(--d360-brand)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--d360-brand-dark)] disabled:opacity-50"
        >
          {cargando ? "Procesando…" : "Cargar"}
        </button>
      </div>

      {cargando ? (
        <p className="text-[12.5px] text-[var(--d360-muted)]">
          Cortando por secciones y generando embeddings. Un documento de doscientas
          páginas tarda cerca de un minuto.
        </p>
      ) : null}

      {estado.ok ? (
        <p className="rounded-lg border border-[#b7dfc4] bg-[#eefaf1] p-3 text-[12.5px] text-[#1c6b39]">
          {estado.ok}
        </p>
      ) : null}
      {estado.error ? (
        <p className="rounded-lg border border-[#f0c2c2] bg-[#fdf1f1] p-3 text-[12.5px] text-[#8f2c2c]">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
