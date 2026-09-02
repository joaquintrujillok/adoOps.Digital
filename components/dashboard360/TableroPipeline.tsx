"use client";

// El tablero de oportunidades, arrastrable.
//
// ── Sin librería de drag and drop ────────────────────────────────────────────
//
// Arrastrar entre columnas es lo que HTML da de fábrica: `draggable`,
// `dragstart`, `dragover`, `drop`. Traer una dependencia para eso agrega peso al
// bundle y una API que aprender, a cambio de animaciones que nadie pidió. El
// mismo criterio que se aplicó a los gráficos.
//
// ── Se mueve primero y se confirma después ───────────────────────────────────
//
// La tarjeta cambia de columna en el acto y la acción del servidor va detrás. Un
// tablero que espera medio segundo con la tarjeta en el aire se siente roto, y
// medio segundo es lo que tarda una escritura contra Neon desde Chile.
//
// Si la acción falla, la tarjeta vuelve sola a su columna. Es el único caso en
// que el optimismo miente, y dura lo que tarda el servidor en responder.

import { useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { borrarOportunidadAction, moverEtapaAction } from "@/lib/venta/acciones";

export type TarjetaVista = {
  id: number;
  titulo: string;
  etapa: string;
  monto: number;
  contacto: string;
  empresa: string | null;
  cierreEstimado: string | null;
  /** Días sin actividad. `null` si nunca hubo. */
  dias: number | null;
};

export type ColumnaVista = {
  id: string;
  nombre: string;
  tarjetas: TarjetaVista[];
};

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default function TableroPipeline({ columnas }: { columnas: ColumnaVista[] }) {
  const [, iniciar] = useTransition();
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [encima, setEncima] = useState<string | null>(null);
  // Qué tarjeta está esperando confirmación de borrado. Un `confirm()` del
  // navegador funcionaría, pero se ve como un error del sistema y no como una
  // decisión del tablero.
  const [porBorrar, setPorBorrar] = useState<number | null>(null);
  const origen = useRef<string | null>(null);

  // Un solo reductor para las dos cosas que le pasan a una tarjeta: cambiar de
  // columna o desaparecer. Separarlos en dos `useOptimistic` haría que el
  // segundo pisara al primero cuando ocurren seguidos.
  type Cambio = { tipo: "mover"; id: number; a: string } | { tipo: "borrar"; id: number };

  const [vista, aplicar] = useOptimistic(columnas, (actual, cambio: Cambio) => {
    if (cambio.tipo === "borrar") {
      return actual.map((col) => ({
        ...col,
        tarjetas: col.tarjetas.filter((t) => t.id !== cambio.id),
      }));
    }
    const tarjeta = actual.flatMap((c) => c.tarjetas).find((t) => t.id === cambio.id);
    if (!tarjeta) return actual;
    return actual.map((col) => ({
      ...col,
      tarjetas:
        col.id === cambio.a
          ? [...col.tarjetas, { ...tarjeta, etapa: cambio.a }]
          : col.tarjetas.filter((t) => t.id !== cambio.id),
    }));
  });

  const soltar = (etapa: string) => {
    const id = arrastrando;
    setArrastrando(null);
    setEncima(null);
    if (!id || origen.current === etapa) return;

    iniciar(async () => {
      aplicar({ tipo: "mover", id, a: etapa });
      const fd = new FormData();
      fd.set("id", String(id));
      fd.set("etapa", etapa);
      await moverEtapaAction(fd);
    });
  };

  const borrar = (id: number) => {
    setPorBorrar(null);
    iniciar(async () => {
      aplicar({ tipo: "borrar", id });
      const fd = new FormData();
      fd.set("id", String(id));
      await borrarOportunidadAction(fd);
    });
  };

  return (
    // El scroll es del contenedor y las columnas tienen ancho fijo: con
    // `flex-1` se encogerían hasta ser ilegibles en vez de desbordar.
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3 px-1">
      {vista.map((col) => {
        const total = col.tarjetas.reduce((s, t) => s + t.monto, 0);
        const destino = encima === col.id && arrastrando !== null;
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              // Sin esto el navegador no permite soltar. Es el paso que más se
              // olvida al implementar arrastre nativo.
              e.preventDefault();
              setEncima(col.id);
            }}
            onDragLeave={() => setEncima((c) => (c === col.id ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              soltar(col.id);
            }}
            className={`w-[240px] shrink-0 rounded-xl border p-3 transition-colors ${
              destino
                ? "border-[var(--d360-brand)] bg-[var(--d360-brand-soft)]"
                : "border-[var(--d360-border)] bg-[var(--d360-surface)]"
            }`}
          >
            <header className="mb-3">
              <h2 className="text-[12.5px] font-semibold text-[var(--d360-ink)]">
                {col.nombre}
              </h2>
              <p className="d360-num text-[11px] text-[var(--d360-muted)]">
                {col.tarjetas.length} · {CLP.format(total)}
              </p>
            </header>

            <div className="space-y-2">
              {col.tarjetas.length === 0 ? (
                <p className="py-3 text-center text-[11.5px] text-[var(--d360-muted)]">
                  {destino ? "soltar acá" : "vacía"}
                </p>
              ) : (
                col.tarjetas.map((t) => {
                  const fria = t.dias !== null && t.dias >= 14;
                  const confirmando = porBorrar === t.id;
                  return (
                    <div
                      key={t.id}
                      draggable={!confirmando}
                      onDragStart={() => {
                        setArrastrando(t.id);
                        origen.current = col.id;
                      }}
                      onDragEnd={() => {
                        setArrastrando(null);
                        setEncima(null);
                      }}
                      className={`group relative rounded-lg border p-3 transition-colors ${
                        arrastrando === t.id ? "opacity-40" : ""
                      } ${
                        fria
                          ? "border-[#e6d9b0] bg-[#fdf8e9]"
                          : "border-[var(--d360-border)] bg-white"
                      } ${confirmando ? "" : "cursor-grab active:cursor-grabbing hover:border-[var(--d360-brand)]"}`}
                    >
                      {confirmando ? (
                        <div className="space-y-2">
                          <p className="text-[12px] text-[var(--d360-ink)]">
                            ¿Borrar «{t.titulo}» y su historial?
                          </p>
                          {/* Se dice qué se pierde. «¿Estás seguro?» no informa
                              nada y la gente aprende a decir que sí sin leer. */}
                          <p className="text-[11px] text-[var(--d360-muted)]">
                            Si la oportunidad existió y no se ganó, muévela a
                            Perdido en vez de borrarla: ahí el registro sirve.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => borrar(t.id)}
                              className="rounded-md bg-[#d03b3b] px-2.5 py-1 text-[11.5px] font-medium text-white"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setPorBorrar(null)}
                              className="rounded-md border border-[var(--d360-border)] bg-white px-2.5 py-1 text-[11.5px] text-[var(--d360-ink-2)]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setPorBorrar(t.id)}
                            aria-label={`Borrar ${t.titulo}`}
                            // Aparece al pasar el mouse y siempre al enfocar con
                            // teclado: escondido tras hover, para quien navega
                            // con tabulador simplemente no existiría.
                            className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[13px] leading-none text-[var(--d360-muted)] opacity-0 transition group-hover:opacity-100 hover:bg-[#fbe9e9] hover:text-[#96201f] focus:opacity-100"
                          >
                            ×
                          </button>

                          <Link href={`/dashboard360/crm/oportunidades/${t.id}`} className="block">
                            <p className="pr-5 text-[13px] font-medium leading-snug text-[var(--d360-ink)]">
                              {t.titulo}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-[var(--d360-muted)]">
                              {t.contacto}
                              {t.empresa ? ` · ${t.empresa}` : ""}
                            </p>
                            <p className="d360-num mt-1.5 text-[11.5px] text-[var(--d360-ink-2)]">
                              {t.monto > 0 ? CLP.format(t.monto) : "sin monto"}
                              {t.cierreEstimado ? ` · cierra ${t.cierreEstimado}` : ""}
                            </p>
                            {fria && (
                              <p className="mt-1 text-[11px] font-medium text-[#8a6d1f]">
                                {t.dias} días sin actividad
                              </p>
                            )}
                          </Link>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
