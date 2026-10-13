"use client";

// El cuadrante de madurez. Lo usan el celular (chico, con "tú"), la pantalla
// proyectada (grande) y el panel. Cada punto es una persona, sin nombre.
//
// Color = rol (identidad), posición = uso × expectativa. Paleta validada con el
// script de dataviz contra el papel claro y el fondo oscuro de la web: pasa CVD
// y contraste en ambos. La leyenda va siempre: el color nunca es la única pista.

import { CUADRANTES, ROLES, type Cuadrante, type PuntoMapa } from "@/lib/pulso/modelo";

export const COLOR_ROL: Record<string, string> = {
  gerencia: "#0F8542",
  jefatura: "#7C3AED",
  profesional: "#C2410C",
  operacion: "#1E6FD9",
};

// Cada cuadrante rotulado afuera de su esquina, para que ningún punto lo tape: x = uso (izq→der), y = expectativa (abajo→arriba).
const ESQUINAS: Record<Cuadrante, { x: number; y: number; anchor: "start" | "end" }> = {
  curioso: { x: 0, y: -3.5, anchor: "start" },
  impulsor: { x: 100, y: -3.5, anchor: "end" },
  observador: { x: 0, y: 104.5, anchor: "start" },
  practico: { x: 100, y: 104.5, anchor: "end" },
};

export default function Mapa({
  puntos,
  cuadrantes,
  yo,
  grande = false,
  cierre = false,
}: {
  puntos: PuntoMapa[];
  cuadrantes: Record<Cuadrante, number>;
  /** id de la respuesta propia: se marca con un anillo y la palabra "tú". */
  yo?: number | null;
  grande?: boolean;
  /** Dibuja el desplazamiento de la expectativa de quienes respondieron el cierre. */
  cierre?: boolean;
}) {
  const r = grande ? 1.25 : 1.9;
  const fs = grande ? 2.1 : 3.1;
  const propio = yo != null ? puntos.find((p) => p.id === yo) : undefined;

  return (
    <figure className={`pz-mapa ${grande ? "pz-mapa-g" : ""}`}>
      <svg viewBox="-8 -8 110 122" role="img" aria-label={`Mapa de madurez: ${puntos.length} personas`}>
        <rect x="0" y="0" width="100" height="100" rx="1.5" className="pz-fondo" />
        <line x1="50" y1="0" x2="50" y2="100" className="pz-eje" />
        <line x1="0" y1="50" x2="100" y2="50" className="pz-eje" />

        {(Object.keys(ESQUINAS) as Cuadrante[]).map((k) => {
          const e = ESQUINAS[k];
          return (
            <text key={k} x={e.x} y={e.y} textAnchor={e.anchor} fontSize={fs} className="pz-cuad">
              {CUADRANTES[k].nombre.toUpperCase()} · {cuadrantes[k]}
            </text>
          );
        })}

        <text x="50" y="111.5" textAnchor="middle" fontSize={fs * 0.85} className="pz-tick">
          USO HOY →
        </text>
        <text x="-4" y="50" textAnchor="middle" fontSize={fs * 0.85} className="pz-tick" transform="rotate(-90 -4 50)">
          EXPECTATIVA →
        </text>

        {cierre &&
          puntos
            .filter((p) => p.yCierre != null && Math.abs(p.yCierre - p.y) > 1)
            .map((p) => (
              <line
                key={`c${p.id}`}
                x1={p.x}
                y1={100 - p.y}
                x2={p.x}
                y2={100 - p.yCierre!}
                className="pz-traza"
                stroke={COLOR_ROL[p.rol] ?? "currentColor"}
              />
            ))}

        {puntos.map((p) => {
          const y = 100 - (cierre && p.yCierre != null ? p.yCierre : p.y);
          return (
            <circle
              key={p.id}
              cx={p.x}
              cy={y}
              r={r}
              fill={COLOR_ROL[p.rol] ?? "currentColor"}
              className="pz-punto"
              style={{ transformOrigin: `${p.x}px ${y}px` }}
            >
              <title>{`${ROLES.find((o) => o.valor === p.rol)?.texto ?? ""} · ${CUADRANTES[p.cuadrante].nombre}`}</title>
            </circle>
          );
        })}

        {propio && (
          <g className="pz-yo">
            <circle cx={propio.x} cy={100 - propio.y} r={r * 2.4} className="pz-yo-anillo" />
            <text x={propio.x} y={100 - propio.y - r * 3.2} textAnchor="middle" fontSize={fs * 1.05} className="pz-yo-txt">
              tú
            </text>
          </g>
        )}
      </svg>
      <figcaption className="pz-leyenda">
        {ROLES.map((o) => (
          <span key={o.valor}>
            <i style={{ background: COLOR_ROL[o.valor] }} />
            {o.texto}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
