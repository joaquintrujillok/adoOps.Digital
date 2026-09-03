"use client";

import { useState, useTransition } from "react";
import { darDeBaja } from "@/lib/cafecito/actions";

/**
 * La baja se confirma con un clic explícito, no al abrir la página.
 *
 * Los escáneres de seguridad de los clientes de correo visitan cada URL de un
 * mensaje: si bastara con cargar la página, un antivirus corporativo daría de
 * baja a quien solo abrió la edición.
 */
export default function CafecitoBaja({ token, email }: { token: string; email: string }) {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (listo) {
    return (
      <>
        <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Listo, no te escribimos más
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: "0 0 22px" }}>
          Diste de baja <strong style={{ color: "#0E1D33" }}>{email}</strong>. Gracias
          por el tiempo que nos leíste. Si algún día lo echas de menos, la puerta
          queda abierta.
        </p>
        <a href="/cafecito-ia" style={{ fontSize: 14.5, fontWeight: 600, color: "#0B7A4B", textDecoration: "none" }}>
          Ver las ediciones publicadas →
        </a>
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 23, margin: "0 0 10px", letterSpacing: "-0.02em" }}>
        ¿Damos de baja este correo?
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.62, color: "#5C6B79", margin: "0 0 24px" }}>
        Dejarás de recibir Cafecito IA en <strong style={{ color: "#0E1D33" }}>{email}</strong>.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await darDeBaja(token);
              if (r.ok) setListo(true);
              else setError(true);
            })
          }
          style={{ background: "#FFFFFF", color: "#43566A", fontSize: 15, fontWeight: 600, padding: "13px 24px", border: "1px solid #DCE3E7", borderRadius: 10, cursor: pending ? "default" : "pointer" }}
        >
          {pending ? "Dando de baja…" : "Sí, darme de baja"}
        </button>
        <a href="/cafecito-ia" style={{ display: "inline-flex", alignItems: "center", background: "#20C463", color: "#06281A", fontSize: 15, fontWeight: 600, padding: "13px 26px", borderRadius: 10, textDecoration: "none" }}>
          Mejor sigo suscrito
        </a>
      </div>

      {error && (
        <p style={{ margin: "14px 0 0", fontSize: 13.5, color: "#C0392B" }}>
          No se pudo procesar. Escríbenos a hola@adoops.digital y lo hacemos a mano.
        </p>
      )}
    </>
  );
}
