"use client";

import { useState } from "react";

/**
 * La clave recién generada, mostrada una sola vez.
 *
 * **Por qué tiene tanto espacio en pantalla.** Después de esto solo existe su
 * hash: nadie —ni el administrador, ni quien mira la base de datos— puede
 * volver a leerla. Si alguien cierra la pestaña sin copiarla, la única salida
 * es generar otra. Un aviso discreto se pierde; este no.
 */
export default function ClaveDeUnSoloUso({
  mensaje,
  clave,
}: {
  mensaje: string;
  clave: string;
}) {
  const [copiada, setCopiada] = useState(false);

  return (
    <div
      role="status"
      className="rounded-lg border p-4"
      style={{ borderColor: "var(--tun-brand)", background: "var(--tun-brand-soft)" }}
    >
      <p className="text-[13px] font-semibold" style={{ color: "var(--tun-brand-dark)" }}>
        {mensaje}
      </p>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--tun-ink-2)" }}>
        Cópiala ahora y entrégasela en persona o por WhatsApp. No se puede volver a
        ver: al cerrar esta pantalla solo queda guardado su resguardo cifrado.
        Quien la reciba tendrá que cambiarla al entrar.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code
          className="rounded-md border bg-white px-3 py-2 text-[16px] font-semibold tracking-[0.08em]"
          style={{ borderColor: "var(--tun-border-fuerte)", color: "var(--tun-ink)" }}
        >
          {clave}
        </code>
        <button
          type="button"
          className="tun-boton-suave"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(clave);
              setCopiada(true);
            } catch {
              // Sin permiso de portapapeles queda seleccionable a mano, que es
              // justamente por lo que la clave se muestra como texto y no como
              // un campo que se pueda ocultar.
              setCopiada(false);
            }
          }}
        >
          {copiada ? "Copiada ✓" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
