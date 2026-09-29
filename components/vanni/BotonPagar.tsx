"use client";

import { useState, useTransition } from "react";
import { pagarPedidoAction } from "@/lib/vanni/pago.actions";

export default function BotonPagar({ token, total }: { token: string; total: string }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="vn-btn"
        style={{ width: "100%", padding: "13px 16px", fontSize: 16 }}
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await pagarPedidoAction(token);
            if (!r.ok) setError(r.error ?? "No se pudo procesar el pago");
          })
        }
      >
        {pendiente ? "Procesando…" : `Pagar ${total}`}
      </button>
      {error && <p className="vn-aviso vn-aviso-rojo" style={{ marginTop: 10 }}>{error}</p>}
    </>
  );
}
