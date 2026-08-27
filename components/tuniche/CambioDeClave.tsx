"use client";

import { useActionState } from "react";
import { cambiarMiClaveAction } from "@/lib/tuniche/usuarios.actions";

/**
 * Cambio de contraseña propia.
 *
 * `obligatorio` cambia el texto, no la lógica: es la misma acción, pero cuando
 * llega acá forzado por una clave dictada por el administrador, la pantalla
 * tiene que explicar por qué no lo dejan pasar. Un formulario idéntico sin
 * explicación se lee como un error de la aplicación.
 */
export default function CambioDeClave({ obligatorio = false }: { obligatorio?: boolean }) {
  const [estado, accion, pendiente] = useActionState(cambiarMiClaveAction, {});

  return (
    <form action={accion} className="space-y-4">
      {obligatorio && (
        <p
          className="rounded-lg border px-3 py-2.5 text-[13px]"
          style={{
            borderColor: "var(--tun-alerta)",
            background: "var(--tun-alerta-soft)",
            color: "var(--tun-alerta)",
          }}
        >
          Estás usando la clave que te dictó quien administra el sistema. Esa clave
          la conocen dos personas, así que sirve para entrar una vez. Elige la tuya
          para continuar.
        </p>
      )}

      <div>
        <label htmlFor="actual" className="tun-etiqueta">
          {obligatorio ? "Clave que te dieron" : "Contraseña actual"}
        </label>
        <input
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          className="tun-campo"
        />
      </div>

      <div>
        <label htmlFor="nueva" className="tun-etiqueta">
          Contraseña nueva
        </label>
        <input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="tun-campo"
        />
        <p className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
          Mínimo 12 caracteres. No pedimos mayúsculas ni símbolos: una frase que
          recuerdes es más segura que <code>Tuniche2026!</code> anotado en un papel.
        </p>
      </div>

      <div>
        <label htmlFor="repetida" className="tun-etiqueta">
          Repite la contraseña nueva
        </label>
        <input
          id="repetida"
          name="repetida"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="tun-campo"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-lg border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--tun-critico)",
            background: "var(--tun-critico-soft)",
            color: "var(--tun-critico)",
          }}
        >
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p
          role="status"
          className="rounded-lg border px-3 py-2 text-[13px]"
          style={{
            borderColor: "var(--tun-ok)",
            background: "var(--tun-ok-soft)",
            color: "var(--tun-ok)",
          }}
        >
          {estado.ok}
        </p>
      )}

      <button type="submit" disabled={pendiente} className="tun-boton w-full">
        {pendiente ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
