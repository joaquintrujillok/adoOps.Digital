"use client";

import { useActionState, useEffect, useRef } from "react";
import { canjearAction } from "@/lib/vanni/canje.actions";

const CLAVE_SUCURSAL = "vanni-sucursal-caja";

export default function FormCanje({ token, sucursales }: { token: string; sucursales: string[] }) {
  const [estado, accion, pendiente] = useActionState(canjearAction.bind(null, token), null);
  // La caja siempre es la misma sucursal: se recuerda en este teléfono.
  const sucursalRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(CLAVE_SUCURSAL);
      if (guardada && sucursalRef.current && !sucursalRef.current.value) sucursalRef.current.value = guardada;
    } catch {
      /* sin almacenamiento local: se elige cada vez */
    }
    // Tras un error React limpia el formulario: se vuelve a rellenar.
  }, [estado]);

  if (estado?.ok) {
    return <p className="vn-aviso vn-aviso-teal" style={{ fontSize: 16 }}>✅ Cupón canjeado. Aplica el descuento en la boleta.</p>;
  }
  return (
    <form
      action={accion}
      onSubmit={() => {
        try {
          const sucursal = sucursalRef.current?.value.trim();
          if (sucursal) localStorage.setItem(CLAVE_SUCURSAL, sucursal);
        } catch {
          /* no importa */
        }
      }}
      style={{ display: "grid", gap: 10 }}
    >
      <div>
        <label className="vn-label" htmlFor="sucursal">Sucursal</label>
        <input
          id="sucursal"
          name="sucursal"
          list="vn-sucursales-caja"
          ref={sucursalRef}
          required
          className="vn-input"
          placeholder="Ej: Centro"
        />
        <datalist id="vn-sucursales-caja">{sucursales.map((s) => <option key={s} value={s} />)}</datalist>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div><label className="vn-label" htmlFor="boleta">N° de boleta</label><input id="boleta" name="boleta" className="vn-input" inputMode="numeric" /></div>
        <div><label className="vn-label" htmlFor="monto">Monto de la compra</label><input id="monto" name="monto" className="vn-input" inputMode="numeric" placeholder="$" /></div>
      </div>
      <p className="vn-ayuda">Boleta y monto son opcionales, pero con ellos se mide cuánto vende la captura en tienda.</p>
      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      <button className="vn-btn vn-qr-boton" disabled={pendiente}>{pendiente ? "Canjeando…" : "Canjear cupón"}</button>
    </form>
  );
}
