"use client";

import { useActionState } from "react";
import { registrar, type RegistroState } from "@/lib/cafecito/actions";

const INITIAL: RegistroState = { status: "idle" };

/**
 * Paso 1 del doble opt-in: solo el correo.
 *
 * Nombre, empresa, rol y taza se piden después de confirmar. Pedirlos acá cuesta
 * conversión en el momento de menor compromiso, y no sirven de nada hasta que la
 * dirección esté verificada.
 */
export default function CafecitoForm({ compacto = false }: { compacto?: boolean }) {
  const [state, action, pending] = useActionState(registrar, INITIAL);

  if (state.status === "success") {
    return (
      <div style={{ textAlign: "center", padding: "26px 20px" }}>
        <span style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(32,196,99,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <span style={{ display: "block", width: 26, height: 26, background: "#20C463", WebkitMask: "url('https://unpkg.com/lucide-static@latest/icons/mail-check.svg') center/contain no-repeat", mask: "url('https://unpkg.com/lucide-static@latest/icons/mail-check.svg') center/contain no-repeat" }} />
        </span>
        <h3 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 600, fontSize: 20, margin: "0 0 8px", color: "#0E1D33" }}>
          Revisa tu correo
        </h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#5C6B79", margin: 0 }}>
          Te mandamos un enlace para confirmar la suscripción y elegir tu taza.
          Si no llega en unos minutos, mira en spam.
        </p>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 12 }}>
      {/* Honeypot: invisible para personas, irresistible para bots. */}
      <input type="text" name="empresa_web" tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      <div style={{ display: "grid", gridTemplateColumns: compacto ? "1fr" : "1fr auto", gap: 10 }}>
        <input
          type="email" name="email" required placeholder="tu@correo.cl" aria-label="Tu correo"
          style={{ width: "100%", padding: "14px 16px", border: "1px solid #DCE3E7", borderRadius: 10, font: "15.5px Inter, sans-serif", color: "#0E1D33", background: "#FFFFFF", outline: "none" }}
        />
        <button
          type="submit" disabled={pending}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: pending ? "#8FD9B0" : "#20C463", color: "#06281A", fontSize: 15.5, fontWeight: 600, padding: "14px 28px", border: "none", borderRadius: 10, whiteSpace: "nowrap", cursor: pending ? "default" : "pointer", boxShadow: "0 6px 20px rgba(32,196,99,0.26)" }}
        >
          {pending ? "Enviando…" : "Servirme un cafecito"}
        </button>
      </div>

      {state.status === "error" && (
        <p style={{ margin: 0, fontSize: 13.5, color: "#C0392B" }}>{state.message}</p>
      )}

      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#8394A2" }}>
        Te llega un correo para confirmar y elegir el tamaño de tu taza. Sin spam,
        y te das de baja con un clic desde cualquier edición.
      </p>
    </form>
  );
}
