"use client";

import { useActionState } from "react";
import { buscarCodigoAction } from "@/lib/vanni/canje.actions";

export default function BuscarCupon() {
  const [estado, accion, pendiente] = useActionState(buscarCodigoAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 10 }}>
      <label className="vn-label" htmlFor="codigo">Código del cupón</label>
      <input id="codigo" name="codigo" placeholder="VN-XXXXX" autoComplete="off" autoCapitalize="characters" required className="vn-input vn-qr-input" />
      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      <button className="vn-btn vn-qr-boton" disabled={pendiente}>{pendiente ? "Buscando…" : "Buscar cupón"}</button>
    </form>
  );
}
