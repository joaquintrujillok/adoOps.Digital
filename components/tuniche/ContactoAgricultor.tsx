"use client";

import { useActionState } from "react";
import { guardarContactoAction, type Resultado } from "@/lib/tuniche/agricultores.actions";

/**
 * Los datos de contacto de un agricultor.
 *
 * Existe porque son el único dato que bloquea el último paso del flujo —sin
 * teléfono no hay a quién mandarle el informe— y **ninguna de las dos planillas
 * lo trajo**: la de Mercado Nacional mandó las columnas vacías y la de Altué vino
 * anonimizada. Van a tener que cargarse a mano, uno por uno, por la persona que
 * los tiene: el zonal.
 */
export default function ContactoAgricultor({
  id,
  nombreContacto,
  telefono,
  email,
}: {
  id: number;
  nombreContacto: string | null;
  telefono: string | null;
  email: string | null;
}) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(
    guardarContactoAction,
    {},
  );

  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor={`c-${id}`} className="tun-etiqueta">
            Nombre del contacto
          </label>
          <input
            id={`c-${id}`}
            name="nombreContacto"
            defaultValue={nombreContacto ?? ""}
            className="tun-campo"
          />
        </div>
        <div>
          <label htmlFor={`t-${id}`} className="tun-etiqueta">
            Teléfono
          </label>
          <input
            id={`t-${id}`}
            name="telefono"
            defaultValue={telefono ? `+${telefono}` : ""}
            className="tun-campo"
            placeholder="+56 9 1234 5678"
          />
        </div>
        <div>
          <label htmlFor={`e-${id}`} className="tun-etiqueta">
            Correo <span style={{ color: "var(--tun-muted)" }}>(opcional)</span>
          </label>
          <input
            id={`e-${id}`}
            name="email"
            type="email"
            defaultValue={email ?? ""}
            className="tun-campo"
          />
        </div>
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

      <button type="submit" disabled={pendiente} className="tun-boton-suave">
        {pendiente ? "Guardando…" : "Guardar contacto"}
      </button>
    </form>
  );
}
