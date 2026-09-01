// El selector de cuenta, arriba de todo en la barra lateral.
//
// ── Por qué arriba y no en el menú de usuario ────────────────────────────────
//
// Porque la pregunta que responde no es "¿quién soy?" sino "¿en qué mundo estoy
// parado?", y esa se hace al llegar a la pantalla, no cuando uno va a cerrar
// sesión. Escondido abajo, la confusión que este selector existe para evitar
// —mirar una reunión personal creyendo que es de trabajo— ocurriría igual.
//
// ── Por qué un punto de color ────────────────────────────────────────────────
//
// Es lo único que se distingue de reojo cuando ya no se lee el nombre, y de
// reojo es exactamente como se mira una barra lateral después de la primera
// semana. El nombre está igual, para quien recién llega y para quien no
// distingue los colores.
//
// Es la misma lección de `<ChipModulo>`: el estado se muestra donde está la
// persona que se puede confundir.

import { cambiarCuentaAction } from "@/lib/dashboard360/auth.actions";
import { CUENTAS, type Cuenta } from "@/lib/cuentas";

export default function SelectorCuenta({
  activa,
  permitidas,
}: {
  activa: Cuenta;
  /** Ids permitidos. Vacío o ausente = todas. */
  permitidas?: string[];
}) {
  const disponibles =
    permitidas && permitidas.length > 0
      ? CUENTAS.filter((c) => permitidas.includes(c.id))
      : CUENTAS;

  // Con una sola cuenta no hay nada que elegir, pero igual se muestra cuál es:
  // saber en qué mundo estás parado sigue importando aunque no puedas cambiarlo.
  if (disponibles.length <= 1) {
    return (
      <div className="mb-4 flex items-center gap-2 px-3 py-1.5">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: activa.color }}
        />
        <span className="text-[12.5px] font-medium text-[#c6d4e1]">{activa.nombre}</span>
      </div>
    );
  }

  return (
    <form action={cambiarCuentaAction} className="mb-4 space-y-0.5">
      {disponibles.map((c) => {
        const esActiva = c.id === activa.id;
        return (
          <button
            key={c.id}
            type="submit"
            name="cuenta"
            value={c.id}
            title={c.descripcion}
            aria-current={esActiva ? "true" : undefined}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-[12.5px] transition-colors ${
              esActiva
                ? "bg-white/10 font-medium text-white"
                : "text-[#7f93a8] hover:bg-white/5 hover:text-[#c6d4e1]"
            }`}
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: c.color, opacity: esActiva ? 1 : 0.45 }}
            />
            {c.nombre}
          </button>
        );
      })}
    </form>
  );
}
