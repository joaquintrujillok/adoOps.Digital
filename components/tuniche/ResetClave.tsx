"use client";

import { useActionState } from "react";
import { resetearClaveAction, type Resultado } from "@/lib/tuniche/usuarios.actions";
import ClaveDeUnSoloUso from "./ClaveDeUnSoloUso";

/**
 * Genera una clave nueva para otra persona. La anterior deja de servir en el
 * mismo momento, así que es una acción con consecuencia inmediata sobre alguien
 * que puede estar trabajando: por eso es un botón explícito y no algo que pase
 * al guardar el formulario de edición.
 */
export default function ResetClave({ id, nombre }: { id: number; nombre: string }) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(
    resetearClaveAction,
    {},
  );

  if (estado.clave) {
    return <ClaveDeUnSoloUso mensaje={estado.ok ?? ""} clave={estado.clave} />;
  }

  return (
    <form action={accion} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pendiente}
        className="tun-boton-suave"
        title={`Genera una clave nueva para ${nombre}. La actual deja de servir.`}
      >
        {pendiente ? "Generando…" : "Resetear clave"}
      </button>
      {estado.error && (
        <span className="ml-2 text-[12px]" style={{ color: "var(--tun-critico)" }}>
          {estado.error}
        </span>
      )}
    </form>
  );
}
