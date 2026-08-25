"use client";

import { useActionState } from "react";
import BotonEnvio from "@/components/leads/BotonEnvio";
import { btnPrimario } from "@/components/dashboard360/ui";
import { crearSenalAction, type EstadoAccion } from "@/lib/leads/motor.actions";
import { TIPOS_SENAL } from "@/lib/leads/senales";

/**
 * Alta manual de una señal.
 *
 * El campo que importa es `resumen`, y por eso ocupa el lugar central: **es el
 * texto que termina dentro del mensaje**, no una nota interna. La ayuda muestra
 * cómo se va a leer en la frase completa, porque escribir "licitación" a secas
 * produce "vi que Constructora Vilos licitación" y eso no se nota hasta que sale.
 */
export default function FormularioSenal({
  empresaId,
  empresaNombre,
}: {
  empresaId: number;
  empresaNombre: string;
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(crearSenalAction, {});
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="empresaId" value={empresaId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[var(--d360-ink-2)]">
            Tipo de señal
          </span>
          <select
            name="tipo"
            defaultValue="adjudicacion"
            className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2.5 py-2 text-[13px]"
          >
            {TIPOS_SENAL.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · vale {t.ventanaDias} días
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[var(--d360-ink-2)]">
            Fecha del hecho
          </span>
          <input
            type="date"
            name="fechaHecho"
            defaultValue={hoy}
            max={hoy}
            required
            className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2.5 py-2 text-[13px]"
          />
          <span className="mt-1 block text-[11px] text-[var(--d360-muted)]">
            Cuándo ocurrió, no cuándo lo cargás. La ventana se cuenta desde acá.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-[var(--d360-ink-2)]">
          Resumen · esto se cita textual en el mensaje
        </span>
        <input
          type="text"
          name="resumen"
          required
          minLength={10}
          maxLength={200}
          placeholder="se adjudicó la licitación 1057-42-LR26 por $184 millones"
          className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2.5 py-2 text-[13px]"
        />
        <span className="mt-1 block text-[11px] text-[var(--d360-muted)]">
          Se va a leer así: «vi que {empresaNombre} <em>lo que escribas acá</em>». En
          minúscula y sin punto final.
        </span>
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-[var(--d360-ink-2)]">
          Enlace que lo prueba
        </span>
        <input
          type="url"
          name="evidenciaUrl"
          placeholder="https://www.mercadopublico.cl/..."
          className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2.5 py-2 text-[13px]"
        />
        <span className="mt-1 block text-[11px] text-[var(--d360-muted)]">
          Obligatorio para el tipo «otra». Sin evidencia la señal no es verificable, y una
          señal no verificable no sostiene el interés legítimo del art. 13 d).
        </span>
      </label>

      {estado.error && (
        <p className="rounded-md bg-[#fbe9e9] px-3 py-2 text-[12.5px] text-[#96201f]">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-md bg-[#e4f6e4] px-3 py-2 text-[12.5px] text-[var(--status-good-text)]">
          {estado.ok}
        </p>
      )}

      <BotonEnvio className={btnPrimario} pendiente="Guardando…">
        Registrar señal
      </BotonEnvio>
    </form>
  );
}
