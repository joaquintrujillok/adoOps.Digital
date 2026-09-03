"use client";

import { useActionState, useState } from "react";
import { perfilar, type PerfilState } from "@/lib/cafecito/actions";
import { TAZAS, type CafecitoTaza } from "@/db/cafecito";

const INITIAL: PerfilState = { status: "idle" };

const ORDEN: CafecitoTaza[] = ["expreso_directivo", "expreso_builder", "flat_white"];

const ICONO: Record<CafecitoTaza, string> = {
  expreso_directivo: "briefcase",
  expreso_builder: "terminal",
  flat_white: "book-open",
};

const input: React.CSSProperties = {
  width: "100%", padding: "12px 14px", border: "1px solid #DCE3E7", borderRadius: 9,
  font: "15px Inter, sans-serif", color: "#0E1D33", background: "#FFFFFF", outline: "none",
};
const label: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "#697A88", marginBottom: 7,
};

export default function CafecitoPerfil({
  token,
  tazaActual,
  datos,
}: {
  token: string;
  tazaActual: CafecitoTaza | null;
  datos: { nombre: string | null; empresa: string | null; rol: string | null };
}) {
  const [state, action, pending] = useActionState(perfilar, INITIAL);
  const [taza, setTaza] = useState<CafecitoTaza>(tazaActual ?? "expreso_directivo");

  if (state.status === "success") {
    const t = TAZAS[state.taza];
    return (
      <div style={{ textAlign: "center", padding: "34px 20px" }}>
        <span style={{ width: 62, height: 62, borderRadius: "50%", background: "rgba(32,196,99,0.14)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
          <span style={{ display: "block", width: 30, height: 30, background: "#20C463", WebkitMask: "url('https://unpkg.com/lucide-static@latest/icons/coffee.svg') center/contain no-repeat", mask: "url('https://unpkg.com/lucide-static@latest/icons/coffee.svg') center/contain no-repeat" }} />
        </span>
        <h2 style={{ fontFamily: "var(--font-sora), Sora, sans-serif", fontWeight: 650, fontSize: 24, margin: "0 0 10px", color: "#0E1D33", letterSpacing: "-0.02em" }}>
          Quedaste dentro
        </h2>
        <p style={{ fontSize: 15.5, lineHeight: 1.62, color: "#5C6B79", margin: "0 0 24px" }}>
          Te sirvo un <strong style={{ color: "#0E1D33" }}>{t.nombre.toLowerCase()}</strong> los
          lunes, miércoles y viernes a las 9 de la mañana. Puedes volver a este
          enlace cuando quieras si te cambias de taza.
        </p>
        <a href="/cafecito-ia" style={{ display: "inline-flex", alignItems: "center", background: "#20C463", color: "#06281A", fontSize: 15, fontWeight: 600, padding: "13px 26px", borderRadius: 10, textDecoration: "none" }}>
          Leer la última edición
        </a>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 22 }}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="taza" value={taza} />

      <div>
        <span style={label}>¿Cómo lo tomas?</span>
        <div style={{ display: "grid", gap: 10 }}>
          {ORDEN.map((valor) => {
            const t = TAZAS[valor];
            const activo = taza === valor;
            return (
              <button
                key={valor} type="button" onClick={() => setTaza(valor)} aria-pressed={activo}
                style={{
                  display: "flex", gap: 14, alignItems: "flex-start", textAlign: "left", cursor: "pointer",
                  padding: "15px 17px", borderRadius: 12,
                  border: activo ? "1.5px solid #20C463" : "1.5px solid #DCE3E7",
                  background: activo ? "rgba(32,196,99,0.06)" : "#FFFFFF",
                  transition: "border-color .15s, background .15s",
                }}
              >
                <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 9, background: activo ? "rgba(32,196,99,0.16)" : "#F1F4F6", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ display: "block", width: 19, height: 19, background: activo ? "#0B7A4B" : "#697A88", WebkitMask: `url('https://unpkg.com/lucide-static@latest/icons/${ICONO[valor]}.svg') center/contain no-repeat`, mask: `url('https://unpkg.com/lucide-static@latest/icons/${ICONO[valor]}.svg') center/contain no-repeat` }} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 3 }}>
                    <span style={{ fontSize: 15.5, fontWeight: 650, color: "#0E1D33" }}>{t.nombre}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#7B8894", background: "#F1F4F6", padding: "2px 7px", borderRadius: 999 }}>{t.minutos}</span>
                  </span>
                  <span style={{ display: "block", fontSize: 13.5, lineHeight: 1.5, color: "#5C6B79" }}>{t.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={label} htmlFor="nombre">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={datos.nombre ?? ""} placeholder="Cómo te llamamos" style={input} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label} htmlFor="empresa">Empresa</label>
            <input id="empresa" name="empresa" defaultValue={datos.empresa ?? ""} placeholder="Dónde trabajas" style={input} />
          </div>
          <div>
            <label style={label} htmlFor="rol">Rol</label>
            <input id="rol" name="rol" defaultValue={datos.rol ?? ""} placeholder="A qué te dedicas" style={input} />
          </div>
        </div>
      </div>

      <div>
        <button
          type="submit" disabled={pending}
          style={{ width: "100%", background: pending ? "#8FD9B0" : "#20C463", color: "#06281A", fontSize: 15.5, fontWeight: 600, padding: "15px 28px", border: "none", borderRadius: 10, cursor: pending ? "default" : "pointer", boxShadow: "0 6px 20px rgba(32,196,99,0.26)" }}
        >
          {pending ? "Guardando…" : "Confirmar suscripción"}
        </button>
        {state.status === "error" && (
          <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "#C0392B" }}>{state.message}</p>
        )}
        <p style={{ margin: "12px 0 0", fontSize: 12, lineHeight: 1.5, color: "#8394A2", textAlign: "center" }}>
          Los datos son opcionales y solo se usan para afinar el contenido.
        </p>
      </div>
    </form>
  );
}
