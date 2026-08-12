"use client";

import { useActionState } from "react";
import { accionRegistrarVisita } from "@/lib/crm/showroom.actions";

/**
 * El formulario que llena el visitante en su teléfono.
 *
 * Cuatro campos y una casilla. Cada campo adicional baja la tasa de completado,
 * y un formulario que la gente abandona a la mitad no captura nada: el nombre y
 * una forma de contacto son lo único obligatorio, el resto ayuda a que el
 * seguimiento tenga sentido.
 *
 * Está pensado para pulgar: campos grandes, teclado correcto por tipo de dato y
 * un solo botón.
 */
export default function FormularioShowroom({
  intereses,
  boutiques,
  empresa,
  boutiquePorDefecto,
  evento,
}: {
  intereses: string[];
  boutiques: string[];
  empresa: string;
  boutiquePorDefecto?: string;
  evento?: string;
}) {
  const [estado, accion, pendiente] = useActionState(accionRegistrarVisita, {});

  if (estado.ok) {
    return (
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 text-center">
        <div className="text-[40px]" aria-hidden>
          ✓
        </div>
        <h2 className="mt-2 text-[20px] font-semibold text-[var(--crm-ink)]">
          Gracias, quedaste registrado
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--crm-ink-2)]">
          {estado.yaExistia
            ? "Te reconocimos: uno de nuestros ejecutivos ya tiene tu historial y te va a contactar."
            : "Un ejecutivo de la boutique se va a poner en contacto contigo."}
        </p>
        <p className="mt-4 text-[13px] text-[var(--crm-muted)]">
          Puedes cerrar esta ventana.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="medio" value="qr" />
      {evento && <input type="hidden" name="evento" value={evento} />}

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-[var(--crm-ink)]">
          ¿Cómo te llamas?
        </span>
        <input
          name="nombre"
          required
          autoComplete="name"
          autoFocus
          className="w-full rounded-xl border border-[var(--crm-border)] bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--crm-brand)] focus:ring-2 focus:ring-[var(--crm-brand)]/20"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-[var(--crm-ink)]">
          Teléfono
        </span>
        <input
          name="telefono"
          // `tel` abre el teclado numérico en el celular, que es donde se llena
          // esto el 100% de las veces.
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="9 1234 5678"
          className="w-full rounded-xl border border-[var(--crm-border)] bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--crm-brand)] focus:ring-2 focus:ring-[var(--crm-brand)]/20"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-[var(--crm-ink)]">
          Correo <span className="font-normal text-[var(--crm-muted)]">(opcional)</span>
        </span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="w-full rounded-xl border border-[var(--crm-border)] bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--crm-brand)] focus:ring-2 focus:ring-[var(--crm-brand)]/20"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[14px] font-medium text-[var(--crm-ink)]">
          ¿Qué viniste a ver?
        </span>
        <select
          name="interes"
          defaultValue=""
          className="w-full rounded-xl border border-[var(--crm-border)] bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--crm-brand)]"
        >
          <option value="">Prefiero no decir</option>
          {intereses.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </label>

      {boutiques.length > 1 && !boutiquePorDefecto && (
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-[var(--crm-ink)]">
            ¿En qué boutique estás?
          </span>
          <select
            name="boutique"
            className="w-full rounded-xl border border-[var(--crm-border)] bg-white px-4 py-3.5 text-[16px] outline-none focus:border-[var(--crm-brand)]"
          >
            {boutiques.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      )}
      {boutiquePorDefecto && <input type="hidden" name="boutique" value={boutiquePorDefecto} />}

      <label className="flex items-start gap-3 rounded-xl bg-[var(--crm-brand-soft)] px-4 py-3.5">
        <input
          type="checkbox"
          name="consentimiento"
          value="1"
          defaultChecked
          className="mt-1 h-4 w-4 shrink-0"
        />
        <span className="text-[14px] leading-relaxed text-[var(--crm-ink)]">
          Acepto que {empresa} me contacte con novedades y recomendaciones.
          <span className="mt-0.5 block text-[13px] text-[var(--crm-ink-2)]">
            Puedes pedirnos que dejemos de escribirte cuando quieras.
          </span>
        </span>
      </label>

      {estado.error && (
        <p
          role="alert"
          className="rounded-xl border border-[#f2c3c3] bg-[#fbe9e9] px-4 py-3 text-[14px] text-[#96201f]"
        >
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-xl bg-[var(--crm-brand)] py-4 text-[16px] font-semibold text-white transition hover:bg-[var(--crm-brand-dark)] disabled:opacity-60"
      >
        {pendiente ? "Enviando…" : "Listo"}
      </button>
    </form>
  );
}
