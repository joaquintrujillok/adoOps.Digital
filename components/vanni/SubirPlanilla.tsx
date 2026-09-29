"use client";

import { useActionState } from "react";
import { subirPlanillaAction } from "@/lib/vanni/backoffice.actions";

export default function SubirPlanilla() {
  const [estado, accion, pendiente] = useActionState(subirPlanillaAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 10 }}>
      <input type="file" name="archivo" accept=".xlsx,.csv,.txt" required className="vn-input" />
      <p className="vn-ayuda">
        Columnas que reconoce: <b>Teléfono</b> (obligatoria), Nombre, Razón social, RUT, Email, Sucursal, Categoría habitual,
        Última compra, N compras, Monto total. Las tres últimas alimentan el RFM.{" "}
        <a href="/api/vanni/contactos/plantilla" style={{ color: "var(--vn-teal)", fontWeight: 600 }}>Descargar plantilla</a>
      </p>
      <div><button className="vn-btn" disabled={pendiente}>{pendiente ? "Cargando…" : "Cargar planilla"}</button></div>
      {estado && "error" in estado && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      {estado && "nuevos" in estado && (
        <div className={`vn-aviso ${estado.rechazadas.length ? "" : "vn-aviso-teal"}`}>
          <b>{estado.nuevos} nuevos</b> y <b>{estado.actualizados} actualizados</b>
          {estado.rechazadas.length > 0 && <> · {estado.rechazadas.length} filas no se cargaron:</>}
          {estado.rechazadas.length > 0 && (
            <ul style={{ margin: "6px 0 0 18px", maxHeight: 140, overflowY: "auto" }}>
              {estado.rechazadas.slice(0, 50).map((r) => <li key={r.fila}>Fila {r.fila}: {r.motivo}</li>)}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
