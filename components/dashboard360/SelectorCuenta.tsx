"use client";

// El selector de cuenta, arriba de todo en la barra lateral.
//
// ── Por qué colapsado y no una lista ─────────────────────────────────────────
//
// La primera versión pintaba las cuatro cuentas apiladas, siempre. Se veía mal
// por una razón que no es estética: una lista permanente de opciones invita a
// leerla cada vez, y esto no es un menú —es una etiqueta que dice dónde estás
// parado—. Colapsado, la pregunta que responde de un vistazo es "¿en qué mundo
// estoy?", que es la que uno se hace; la otra, "¿a cuál me cambio?", se hace
// tres veces al día y puede costar un clic.
//
// ── Por qué arriba y no en el menú de usuario ────────────────────────────────
//
// Porque la confusión que existe para evitar —mirar una reunión personal
// creyendo que es de trabajo— ocurre al llegar a la pantalla, no cuando uno va a
// cerrar sesión. Es la misma lección de `<ChipModulo>`: el estado se muestra
// donde está la persona que se puede confundir.
//
// ── Por qué no hay buscador ──────────────────────────────────────────────────
//
// Son cuatro. Un campo de búsqueda sobre cuatro elementos agrega un paso y no
// quita ninguno. El día que sean quince, entra.

import { useEffect, useRef, useState } from "react";
import { cambiarCuentaAction } from "@/lib/dashboard360/auth.actions";
import { CUENTAS, type Cuenta } from "@/lib/cuentas";

function Marca({ cuenta, tenue = false }: { cuenta: Cuenta; tenue?: boolean }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: cuenta.color, opacity: tenue ? 0.55 : 1 }}
    >
      {cuenta.nombre.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function SelectorCuenta({
  activa,
  permitidas,
}: {
  activa: Cuenta;
  /** Ids permitidos. Vacío o ausente = todas. */
  permitidas?: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);

  const disponibles =
    permitidas && permitidas.length > 0
      ? CUENTAS.filter((c) => permitidas.includes(c.id))
      : CUENTAS;

  // Cerrar al hacer clic afuera o con Escape. Un panel que se queda abierto
  // tapando el menú es peor que uno que cuesta un clic extra.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  // Con una sola cuenta no hay nada que elegir, pero igual se muestra cuál es:
  // saber en qué mundo estás parado sigue importando aunque no puedas cambiarlo.
  if (disponibles.length <= 1) {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
        <Marca cuenta={activa} />
        <span className="truncate text-[13px] font-medium text-white">{activa.nombre}</span>
      </div>
    );
  }

  return (
    <div ref={caja} className="relative mb-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
      >
        <Marca cuenta={activa} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium leading-tight text-white">
            {activa.nombre}
          </span>
          <span className="block truncate text-[11px] leading-tight text-[#7f93a8]">
            {activa.modulos.length}{" "}
            {activa.modulos.length === 1 ? "sección" : "secciones"}
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-[10px] text-[#7f93a8] transition-transform ${
            abierto ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {abierto ? (
        <form
          action={cambiarCuentaAction}
          className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-white/10 bg-[#16202e] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {disponibles.map((c) => {
            const esActiva = c.id === activa.id;
            return (
              <button
                key={c.id}
                type="submit"
                name="cuenta"
                value={c.id}
                aria-current={esActiva ? "true" : undefined}
                className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  esActiva ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <Marca cuenta={c} tenue={!esActiva} />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-[13px] leading-tight ${
                      esActiva ? "font-medium text-white" : "text-[#c6d4e1]"
                    }`}
                  >
                    {c.nombre}
                  </span>
                  {/* La descripción va acá y no en un tooltip: cambiar de cuenta
                      es cambiar de mundo, y conviene leer a cuál antes de ir. */}
                  <span className="mt-0.5 block text-[11px] leading-snug text-[#7f93a8]">
                    {c.descripcion}
                  </span>
                </span>
                {esActiva ? (
                  <span aria-hidden className="shrink-0 text-[11px] text-[#7be9ae]">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </form>
      ) : null}
    </div>
  );
}
