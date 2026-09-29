"use client";

import { useEffect, useRef } from "react";

/**
 * Contenedor de mensajes que arranca abajo, como cualquier chat, y vuelve abajo
 * cuando llega un mensaje nuevo (cambia `cantidad`) si ya estabas cerca del final.
 *
 * Las fotos de productos cargan después del primer pintado y alargan la
 * conversación: sin volver a bajar al cargar cada una, el chat quedaba a medio
 * camino.
 */
export default function ScrollAlFinal({ cantidad, children }: { cantidad: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pegado = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && pegado.current) el.scrollTop = el.scrollHeight;
  }, [cantidad]);

  return (
    <div
      ref={ref}
      className="vn-chat-mensajes"
      onScroll={(e) => {
        const el = e.currentTarget;
        pegado.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      }}
      onLoadCapture={() => {
        const el = ref.current;
        if (el && pegado.current) el.scrollTop = el.scrollHeight;
      }}
    >
      {children}
    </div>
  );
}
