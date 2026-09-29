"use client";

import { useActionState } from "react";
import { enviarPruebaAction } from "@/lib/vanni/backoffice.actions";

export default function EnviarPrueba({ campanaId, variantes }: { campanaId: number; variantes: string[] }) {
  const [estado, accion, pendiente] = useActionState(enviarPruebaAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="campanaId" value={campanaId} />
      <div style={{ display: "flex", gap: 8 }}>
        <input name="telefono" required placeholder="+56 9 …" className="vn-input" />
        <select name="codigo" className="vn-select" style={{ width: 90 }}>
          {variantes.map((v) => <option key={v}>{v}</option>)}
        </select>
      </div>
      <input name="nombre" placeholder="Nombre de prueba (opcional)" className="vn-input" />
      <div><button className="vn-btn vn-btn-sec" disabled={pendiente}>{pendiente ? "Enviando…" : "Enviarme una prueba"}</button></div>
      {estado?.ok && <p className="vn-aviso vn-aviso-teal">{estado.ok}</p>}
      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      <p className="vn-ayuda">La prueba no cuenta en las métricas ni asocia el número a la campaña.</p>
    </form>
  );
}
