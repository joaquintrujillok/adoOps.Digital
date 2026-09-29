"use client";

import { useActionState } from "react";
import { crearUsuarioAction } from "@/lib/vanni/backoffice.actions";

export default function FormUsuario() {
  const [estado, accion, pendiente] = useActionState(crearUsuarioAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 10 }}>
      <div className="vn-grid vn-grid-2" style={{ gap: 10 }}>
        <div><label className="vn-label">Usuario *</label><input name="username" required className="vn-input" placeholder="mgonzalez" /></div>
        <div><label className="vn-label">Nombre *</label><input name="nombre" required className="vn-input" placeholder="María González" /></div>
        <div><label className="vn-label">WhatsApp (recibe los avisos)</label><input name="telefono" className="vn-input" placeholder="+56 9 …" /></div>
        <div><label className="vn-label">Email (recibe los avisos)</label><input name="email" type="email" className="vn-input" /></div>
        <div>
          <label className="vn-label">Rol</label>
          <select name="rol" className="vn-select"><option value="ejecutiva">Ejecutiva</option><option value="admin">Administrador</option></select>
        </div>
        <div><label className="vn-label">Clave inicial *</label><input name="clave" required minLength={12} className="vn-input" autoComplete="new-password" /><p className="vn-ayuda">Se le pedirá cambiarla al entrar.</p></div>
      </div>
      <div><button className="vn-btn" disabled={pendiente}>{pendiente ? "Creando…" : "Crear cuenta"}</button></div>
      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      {estado?.ok && <p className="vn-aviso vn-aviso-teal">{estado.ok}</p>}
    </form>
  );
}
