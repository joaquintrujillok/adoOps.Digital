"use client";

import { useActionState, useEffect } from "react";
import { registrar, type RegistroState } from "@/lib/cafecito/actions";
import { evento } from "@/lib/cafecito/analitica";

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

  // En un efecto y no en el render: `status === "success"` sigue siendo cierto
  // en cada re-render, así que disparar ahí contaría la misma suscripción
  // muchas veces. La dependencia es el estado, y solo cambia una vez.
  useEffect(() => {
    if (state.status === "success") evento("suscripcion_iniciada");
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div className="form-ok" role="status">
        <h3 className="display" style={{ fontSize: 22 }}>Revisa tu correo</h3>
        <p className="cf-fino" style={{ fontSize: 14.5 }}>
          Te mandamos un enlace para confirmar la suscripción y elegir tu taza.
          Si no llega en unos minutos, mira en spam.
        </p>
      </div>
    );
  }

  // Los estilos son los de la web pública (`.v2`, app/_web/sitio.css): este
  // formulario solo se renderiza dentro de `Sitio`.
  return (
    <form action={action} className="cf-form">
      {/* Honeypot: invisible para personas, irresistible para bots. */}
      <input type="text" name="empresa_web" tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

      <div className={compacto ? "cf-form-fila cf-compacto" : "cf-form-fila"}>
        <input type="email" name="email" required placeholder="tu@correo.cl" aria-label="Tu correo" />
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? "Enviando…" : "Servirme un cafecito"}
        </button>
      </div>

      {state.status === "error" && <p className="form-error">{state.message}</p>}

      <p className="cf-fino">
        Te llega un correo para confirmar y elegir el tamaño de tu taza. Sin spam,
        y te das de baja con un clic desde cualquier edición.
      </p>
    </form>
  );
}
