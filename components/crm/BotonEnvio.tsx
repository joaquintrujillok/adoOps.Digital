"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de submit que se apaga y cambia de texto mientras la acción corre.
 *
 * No es cosmético: recalcular las alertas o despachar una tanda de mensajes
 * toma varios segundos, y un botón que no reacciona invita a apretarlo de
 * nuevo. La segunda pulsación es la que manda los mensajes dos veces.
 */
export default function BotonEnvio({
  children,
  pendiente,
  className,
  title,
  disabled,
}: {
  children: React.ReactNode;
  /** Qué mostrar mientras la acción está en curso. */
  pendiente: string;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      title={title}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      {pending ? pendiente : children}
    </button>
  );
}
