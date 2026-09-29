"use client";

import { useActionState } from "react";
import { agregarContactoAction } from "@/lib/vanni/backoffice.actions";

export default function AgregarContacto({ sucursales }: { sucursales: string[] }) {
  const [estado, accion, pendiente] = useActionState(agregarContactoAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 10 }}>
      <div className="vn-grid vn-grid-2" style={{ gap: 10 }}>
        <div><label className="vn-label">Teléfono *</label><input name="telefono" required placeholder="+56 9 1234 5678" className="vn-input" /></div>
        <div><label className="vn-label">Nombre</label><input name="nombre" className="vn-input" /></div>
        <div><label className="vn-label">Razón social</label><input name="razonSocial" className="vn-input" /></div>
        <div>
          <label className="vn-label">Sucursal</label>
          <input name="sucursal" list="vn-sucursales" className="vn-input" />
          <datalist id="vn-sucursales">{sucursales.map((s) => <option key={s} value={s} />)}</datalist>
        </div>
        <div><label className="vn-label">Email</label><input name="email" type="email" className="vn-input" /></div>
        <div><label className="vn-label">Categoría habitual</label><input name="categoria" className="vn-input" /></div>
      </div>
      <div><button className="vn-btn" disabled={pendiente}>{pendiente ? "Guardando…" : "Agregar contacto"}</button></div>
      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      {estado?.ok && <p className="vn-aviso vn-aviso-teal">Contacto agregado. Entra en la próxima campaña que lo incluya.</p>}
    </form>
  );
}
