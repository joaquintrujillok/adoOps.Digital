"use client";

import { useActionState } from "react";
import { cambiarClaveAction } from "@/lib/vanni/auth.actions";

export default function CambioDeClave() {
  const [estado, accion, pendiente] = useActionState(cambiarClaveAction, {});
  return (
    <form action={accion} style={{ display: "grid", gap: 12 }}>
      <div>
        <label className="vn-label" htmlFor="actual">Contraseña actual</label>
        <input id="actual" name="actual" type="password" autoComplete="current-password" required className="vn-input" />
      </div>
      <div>
        <label className="vn-label" htmlFor="nueva">Nueva contraseña</label>
        <input id="nueva" name="nueva" type="password" autoComplete="new-password" required minLength={12} className="vn-input" />
        <p className="vn-ayuda">Al menos 12 caracteres.</p>
      </div>
      <div>
        <label className="vn-label" htmlFor="repetida">Repite la nueva contraseña</label>
        <input id="repetida" name="repetida" type="password" autoComplete="new-password" required className="vn-input" />
      </div>
      {estado.error && <p role="alert" className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      <button className="vn-btn" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  );
}
