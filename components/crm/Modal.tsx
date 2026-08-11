"use client";

// El caparazón de los modales del CRM.
//
// Es un `<dialog>` nativo y no un div con `position: fixed`. La diferencia no es
// cosmética: `showModal()` trae gratis el cierre con Escape, el foco atrapado
// adentro, el fondo marcado como inerte para el lector de pantalla y el
// backdrop. Reimplementar eso a mano son cien líneas y siempre se olvida alguna
// —normalmente el foco, y entonces tabular saca a la persona del modal sin que
// se note.
//
// Cierra con `router.back()` y no con un estado local porque el modal ES una
// ruta interceptada: la URL cambió al abrirlo, así que cerrarlo tiene que
// deshacer esa navegación. Si no, el botón «atrás» del navegador reabriría el
// modal recién cerrado.

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function Modal({
  titulo,
  bajada,
  children,
  pie,
}: {
  titulo: string;
  bajada?: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const cerrar = () => router.back();

  return (
    <dialog
      ref={ref}
      onClose={cerrar}
      // Clic en el backdrop: el target es el propio <dialog> solo cuando el clic
      // cayó fuera del panel, así que no hace falta comparar coordenadas.
      onClick={(e) => {
        if (e.target === ref.current) cerrar();
      }}
      // Sin `crm-root`: el <dialog> ya cuelga de él en el DOM y hereda los
      // tokens igual —el top layer cambia el orden de pintado, no la herencia—,
      // mientras que repetir la clase le aplicaría también su `min-height:
      // 100vh` y el modal saldría estirado de borde a borde.
      className="m-auto w-[min(38rem,calc(100vw-2rem))] rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-0 text-[var(--crm-ink)] shadow-[0_24px_60px_rgba(11,11,11,0.22)] backdrop:bg-[rgba(11,17,22,0.45)]"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--crm-grid)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold text-[var(--crm-ink)]">
            {titulo}
          </h2>
          {bajada && (
            <p className="mt-0.5 truncate text-[13px] text-[var(--crm-ink-2)]">{bajada}</p>
          )}
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="shrink-0 rounded-lg px-2 py-1 text-[16px] leading-none text-[var(--crm-muted)] transition hover:bg-[#f0f1f3] hover:text-[var(--crm-ink)]"
        >
          ✕
        </button>
      </header>

      <div className="crm-scroll max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

      {pie && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--crm-grid)] px-5 py-3">
          {pie}
        </footer>
      )}
    </dialog>
  );
}
