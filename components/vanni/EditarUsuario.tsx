"use client";

import { useActionState } from "react";
import { editarUsuarioAction } from "@/lib/vanni/backoffice.actions";

export default function EditarUsuario({
  id,
  nombre,
  telefono,
  email,
}: {
  id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
}) {
  const [estado, accion, pendiente] = useActionState(editarUsuarioAction.bind(null, id), null);
  return (
    <details>
      <summary className="vn-btn vn-btn-sm vn-btn-sec" style={{ listStyle: "none", cursor: "pointer" }}>Editar</summary>
      <form action={accion} style={{ display: "grid", gap: 8, marginTop: 8, minWidth: 220 }}>
        <input name="nombre" defaultValue={nombre} required className="vn-input" aria-label="Nombre" />
        <input name="telefono" defaultValue={telefono ? `+${telefono}` : ""} className="vn-input" placeholder="WhatsApp +56 9 …" aria-label="WhatsApp" />
        <input name="email" type="email" defaultValue={email ?? ""} className="vn-input" placeholder="Email" aria-label="Email" />
        <button className="vn-btn vn-btn-sm" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</button>
        {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
        {estado?.ok && <p className="vn-aviso vn-aviso-teal">{estado.ok}</p>}
      </form>
    </details>
  );
}
