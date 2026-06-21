"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitLead, type LeadFormState } from "@/lib/actions";

const INITIAL: LeadFormState = { status: "idle" };

export default function ContactForm({ defaultTipo }: { defaultTipo?: string }) {
  const [state, action, pending] = useActionState(submitLead, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div className="text-center py-10">
        <span
          style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "rgba(32,196,99,0.14)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <span style={{ display: "block", width: 30, height: 30, background: "#20C463", WebkitMask: "url('https://unpkg.com/lucide-static@latest/icons/check.svg') center/contain no-repeat", mask: "url('https://unpkg.com/lucide-static@latest/icons/check.svg') center/contain no-repeat" }} />
        </span>
        <h3 style={{ fontFamily: "Sora,sans-serif", fontWeight: 600, fontSize: 22, margin: "0 0 10px", color: "#0E1D33" }}>¡Solicitud recibida!</h3>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: "#5C6B79", margin: 0 }}>
          Gracias por tu interés. Un especialista de adoOps te contactará en menos de 24 horas.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    border: "1px solid #DCE3E7", borderRadius: 9,
    font: "14px Inter,sans-serif", color: "#0E1D33",
    background: "#FFFFFF", outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    letterSpacing: "0.06em", textTransform: "uppercase",
    color: "#7A8896", marginBottom: 7,
  };

  return (
    <form ref={formRef} action={action}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input required name="nombre" type="text" placeholder="Tu nombre" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email corporativo *</label>
          <input required name="email" type="email" placeholder="nombre@empresa.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Empresa *</label>
          <input required name="empresa" type="text" placeholder="Nombre de la empresa" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Rol</label>
          <input name="rol" type="text" placeholder="Tu cargo" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Tipo de solicitud</label>
        <select name="tipo" defaultValue={defaultTipo || "Assessment"} style={inputStyle}>
          <option>Assessment</option>
          <option>Diagnóstico</option>
        </select>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label style={labelStyle}>Mensaje</label>
        <textarea
          name="mensaje" rows={3}
          placeholder="Contanos brevemente tu contexto y objetivos"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {state.status === "error" && (
        <p style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          width: "100%", display: "inline-flex", alignItems: "center",
          justifyContent: "center", gap: 9,
          background: pending ? "#8ED9A8" : "#20C463",
          color: "#06281A", fontFamily: "Inter,sans-serif",
          fontSize: 15, fontWeight: 600,
          padding: "14px 24px", border: "none", borderRadius: 999,
          cursor: pending ? "not-allowed" : "pointer",
          boxShadow: "0 8px 24px rgba(32,196,99,0.3)",
          transition: "background .15s",
        }}
      >
        {pending ? "Enviando…" : "Solicitar Assessment"}
        {!pending && (
          <span style={{ display: "block", width: 17, height: 17, background: "#06281A", WebkitMask: "url('https://unpkg.com/lucide-static@latest/icons/arrow-right.svg') center/contain no-repeat", mask: "url('https://unpkg.com/lucide-static@latest/icons/arrow-right.svg') center/contain no-repeat" }} />
        )}
      </button>
    </form>
  );
}
