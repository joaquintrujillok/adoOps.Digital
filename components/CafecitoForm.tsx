"use client";

import { useActionState, useRef, useState } from "react";
import { suscribir, type SuscripcionState } from "@/lib/cafecito/actions";

const INITIAL: SuscripcionState = { status: "idle" };

const PERFILES = [
  {
    valor: "direccion" as const,
    titulo: "Dirección",
    detalle: "Qué significa para el negocio: costo, riesgo y posición competitiva.",
  },
  {
    valor: "builder" as const,
    titulo: "Builder",
    detalle: "Qué salió, cuánto cuesta y qué conviene probar. Con benchmarks y links.",
  },
];

export default function CafecitoForm({ compacto = false }: { compacto?: boolean }) {
  const [state, action, pending] = useActionState(suscribir, INITIAL);
  const [perfil, setPerfil] = useState<"direccion" | "builder">("direccion");
  const formRef = useRef<HTMLFormElement>(null);

  if (state.status === "success") {
    return (
      <div style={{ textAlign: "center", padding: "28px 20px" }}>
        <span
          style={{
            width: 54, height: 54, borderRadius: "50%", background: "rgba(32,196,99,0.14)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}
        >
          <span
            style={{
              display: "block", width: 26, height: 26, background: "#20C463",
              WebkitMask: "url('https://unpkg.com/lucide-static@latest/icons/coffee.svg') center/contain no-repeat",
              mask: "url('https://unpkg.com/lucide-static@latest/icons/coffee.svg') center/contain no-repeat",
            }}
          />
        </span>
        <h3 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 20, margin: "0 0 8px", color: "#0E1D33" }}>
          Listo, quedaste suscrito
        </h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5C6B79", margin: 0 }}>
          Te llega la edición {state.perfil === "direccion" ? "Dirección" : "Builder"} los lunes,
          miércoles y viernes a las 9 de la mañana.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} style={{ display: "grid", gap: 14 }}>
      <input type="hidden" name="perfil" value={perfil} />

      {/* Honeypot: invisible para personas, irresistible para bots. */}
      <input
        type="text" name="empresa_web" tabIndex={-1} autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      <div>
        <span style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "#697A88", marginBottom: 9 }}>
          ¿Cuál te sirve más?
        </span>
        <div style={{ display: "grid", gridTemplateColumns: compacto ? "1fr" : "1fr 1fr", gap: 10 }}>
          {PERFILES.map((p) => {
            const activo = perfil === p.valor;
            return (
              <button
                key={p.valor}
                type="button"
                onClick={() => setPerfil(p.valor)}
                aria-pressed={activo}
                style={{
                  textAlign: "left", cursor: "pointer",
                  padding: "13px 15px", borderRadius: 11,
                  border: activo ? "1.5px solid #20C463" : "1.5px solid #DCE3E7",
                  background: activo ? "rgba(32,196,99,0.06)" : "#FFFFFF",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "#0E1D33", marginBottom: 3 }}>
                  {p.titulo}
                </span>
                <span style={{ display: "block", fontSize: 12.5, lineHeight: 1.45, color: "#5C6B79" }}>
                  {p.detalle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: compacto ? "1fr" : "1fr auto", gap: 10 }}>
        <input
          type="email" name="email" required placeholder="tu@correo.cl"
          style={{
            width: "100%", padding: "13px 15px", border: "1px solid #DCE3E7",
            borderRadius: 10, font: "15px Inter, sans-serif", color: "#0E1D33",
            background: "#FFFFFF", outline: "none",
          }}
        />
        <button
          type="submit" disabled={pending}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: pending ? "#8FD9B0" : "#20C463", color: "#06281A",
            fontSize: 15, fontWeight: 600, padding: "13px 26px",
            border: "none", borderRadius: 10, whiteSpace: "nowrap",
            cursor: pending ? "default" : "pointer",
            boxShadow: "0 6px 20px rgba(32,196,99,0.26)",
          }}
        >
          {pending ? "Suscribiendo…" : "Quiero el cafecito"}
        </button>
      </div>

      {state.status === "error" && (
        <p style={{ margin: 0, fontSize: 13.5, color: "#C0392B" }}>{state.message}</p>
      )}

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#8394A2" }}>
        Tres correos por semana. Sin spam, sin venderle tu correo a nadie, y te
        puedes dar de baja con un clic desde cualquier edición.
      </p>
    </form>
  );
}
