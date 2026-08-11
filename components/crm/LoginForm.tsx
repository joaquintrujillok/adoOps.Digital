"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/crm/auth.actions";

export default function LoginForm({ from }: { from: string }) {
  const [estado, accion, pendiente] = useActionState(loginAction, {});

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="from" value={from} />

      <div>
        <label
          htmlFor="username"
          className="mb-1.5 block text-[13px] font-medium text-[var(--crm-ink-2)]"
        >
          Usuario
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          className="w-full rounded-lg border border-[var(--crm-border)] bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--crm-brand)] focus:ring-2 focus:ring-[var(--crm-brand)]/20"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-[13px] font-medium text-[var(--crm-ink-2)]"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-lg border border-[var(--crm-border)] bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--crm-brand)] focus:ring-2 focus:ring-[var(--crm-brand)]/20"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-lg border border-[#f2c3c3] bg-[#fbe9e9] px-3 py-2 text-[13px] text-[#96201f]"
        >
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-lg bg-[var(--crm-brand)] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[var(--crm-brand-dark)] disabled:opacity-60"
      >
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
