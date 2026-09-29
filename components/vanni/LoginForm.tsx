"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/vanni/auth.actions";

export default function LoginForm({ from }: { from: string }) {
  const [estado, accion, pendiente] = useActionState(loginAction, {});
  return (
    <form action={accion} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="from" value={from} />
      <div>
        <label htmlFor="username" className="vn-label">Usuario</label>
        <input id="username" name="username" autoComplete="username" autoFocus required className="vn-input" />
      </div>
      <div>
        <label htmlFor="password" className="vn-label">Contraseña</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="vn-input" />
      </div>
      {estado.error && (
        <p role="alert" className="vn-aviso vn-aviso-rojo">{estado.error}</p>
      )}
      <button type="submit" disabled={pendiente} className="vn-btn">
        {pendiente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
