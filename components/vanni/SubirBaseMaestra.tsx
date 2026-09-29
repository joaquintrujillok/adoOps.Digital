"use client";

import { useActionState } from "react";
import { subirBaseMaestraAction } from "@/lib/vanni/backoffice.actions";

export default function SubirBaseMaestra() {
  const [estado, accion, pendiente] = useActionState(subirBaseMaestraAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 10 }}>
      <input type="file" name="archivo" accept=".xlsx,.csv,.txt" required className="vn-input" />
      <p className="vn-ayuda">
        Columnas: <b>RUT</b> (obligatoria), Nombre, Razón social, Teléfono, Email, Sucursal y <b>Descuento</b> (lo que se
        le muestra al cliente, por ejemplo “15% en bandejas”). Si el RUT ya existe se actualiza.
      </p>
      <div><button className="vn-btn" disabled={pendiente}>{pendiente ? "Cargando…" : "Cargar base maestra"}</button></div>
      {estado && "error" in estado && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      {estado && "nuevos" in estado && (
        <div className={`vn-aviso ${estado.rechazadas.length ? "" : "vn-aviso-teal"}`}>
          <b>{estado.nuevos} nuevos</b> y <b>{estado.actualizados} actualizados</b>
          {estado.rechazadas.length > 0 && <> · {estado.rechazadas.length} observaciones:</>}
          {estado.rechazadas.length > 0 && (
            <ul style={{ margin: "6px 0 0 18px", maxHeight: 140, overflowY: "auto" }}>
              {estado.rechazadas.slice(0, 50).map((r, i) => <li key={i}>Fila {r.fila}: {r.motivo}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
