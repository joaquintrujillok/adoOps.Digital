"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/tuniche/auth.actions";

export default function LoginForm({ from }: { from: string }) {
  const [estado, accion, pendiente] = useActionState(loginAction, {});

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="from" value={from} />

      <div>
        <label htmlFor="username" className="tun-etiqueta">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          className="tun-campo"
        />
      </div>

      <div>
        <label htmlFor="password" className="tun-etiqueta">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="tun-campo"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-lg border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--tun-critico)",
            background: "var(--tun-critico-soft)",
            color: "var(--tun-critico)",
          }}
        >
          {estado.error}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="tun-boton w-full">
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
