"use client";

import { useEffect, useState } from "react";
import { accionCrearCotizacion } from "@/lib/crm/acciones";
import { clp } from "@/lib/crm/documento-cotizacion";

interface Pieza {
  id: number;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  precio: number;
  permiteDescuento: boolean;
  topeDescuentoBp: number | null;
  disponible: number | null;
}

interface Linea extends Pieza {
  cantidad: number;
  descuento: number;
}

/**
 * El armador que se usa con el cliente delante.
 *
 * Los descuentos se escriben en PESOS, no en porcentaje: en el mostrador se
 * negocia "te lo dejo en un millón ochocientos", y obligar a convertir a
 * porcentaje introduce redondeos que después no cuadran con la boleta.
 *
 * El tope se muestra acá como ayuda, pero quien manda es el servidor:
 * `crearCotizacion` relee precios y topes del catálogo y rechaza lo que se
 * pase. Lo de esta pantalla es una intención, no un hecho.
 */
export default function ArmadorCotizacion({
  boutiques,
  contactoInicial,
  error,
}: {
  boutiques: string[];
  contactoInicial?: { id: number; nombre: string; telefono: string | null } | null;
  error?: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Pieza[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [descuentoGlobal, setDescuentoGlobal] = useState(0);
  const [esRegalo, setEsRegalo] = useState(false);

  useEffect(() => {
    if (consulta.trim().length < 2) {
      setResultados([]);
      return;
    }
    // Se cancela la búsqueda anterior en cada pulsación: sin esto, teclear
    // rápido deja respuestas viejas pisando a las nuevas.
    const controlador = new AbortController();
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/crm/piezas?q=${encodeURIComponent(consulta)}`, {
          signal: controlador.signal,
        });
        const j = await r.json();
        setResultados(j.piezas ?? []);
      } catch {
        /* búsqueda cancelada */
      } finally {
        setBuscando(false);
      }
    }, 220);

    return () => {
      controlador.abort();
      clearTimeout(timer);
    };
  }, [consulta]);

  const agregar = (p: Pieza) => {
    setLineas((prev) =>
      prev.some((l) => l.id === p.id)
        ? prev.map((l) => (l.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...prev, { ...p, cantidad: 1, descuento: 0 }],
    );
    setConsulta("");
    setResultados([]);
  };

  const subtotal = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const descuentoItems = lineas.reduce((s, l) => s + l.descuento, 0);
  const total = Math.max(0, subtotal - descuentoItems - descuentoGlobal);

  const topeDe = (l: Linea) =>
    l.topeDescuentoBp === null
      ? null
      : Math.round((l.precio * l.cantidad * l.topeDescuentoBp) / 10000);

  return (
    <form action={accionCrearCotizacion} className="space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(
        lineas.map((l) => ({ productId: l.id, cantidad: l.cantidad, descuento: l.descuento })),
      )} />
      <input type="hidden" name="descuentoGlobal" value={descuentoGlobal} />
      {contactoInicial && <input type="hidden" name="contactId" value={contactoInicial.id} />}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[#f2c3c3] bg-[#fbe9e9] px-4 py-2.5 text-[13px] text-[#96201f]"
        >
          {error}
        </p>
      )}

      <section className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
        <h2 className="mb-3 text-[15px] font-semibold">Quién cotiza</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[13px]">
            <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
              Nombre y apellido
            </span>
            <input
              name="nombre"
              required
              defaultValue={contactoInicial?.nombre ?? ""}
              className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 outline-none focus:border-[var(--crm-brand)]"
            />
          </label>
          <label className="block text-[13px]">
            <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">Teléfono</span>
            <input
              name="telefono"
              required
              placeholder="9 1234 5678"
              defaultValue={contactoInicial?.telefono ?? ""}
              className="crm-num w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 outline-none focus:border-[var(--crm-brand)]"
            />
          </label>
          <label className="block text-[13px]">
            <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">Boutique</span>
            <select
              name="boutique"
              className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2"
            >
              {boutiques.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <div className="text-[13px]">
            <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
              ¿Para quién es?
            </span>
            <label className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                name="esRegalo"
                checked={esRegalo}
                onChange={(e) => setEsRegalo(e.target.checked)}
              />
              Es un regalo para otra persona
            </label>
          </div>
          {esRegalo && (
            <label className="block text-[13px] sm:col-span-2">
              <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
                Nombre de quien recibe
              </span>
              <input
                name="destinatario"
                className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 outline-none focus:border-[var(--crm-brand)]"
              />
              <span className="mt-1 block text-[12px] text-[var(--crm-muted)]">
                Cambia a quién se saluda en el mensaje: se le escribe a quien cotiza,
                no a quien recibe la pieza.
              </span>
            </label>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
        <h2 className="mb-3 text-[15px] font-semibold">Piezas</h2>

        <div className="relative">
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar por marca, nombre o SKU…"
            className="w-full rounded-lg border border-[var(--crm-border)] px-3 py-2.5 text-[14px] outline-none focus:border-[var(--crm-brand)]"
          />
          {buscando && (
            <span className="absolute right-3 top-3 text-[12px] text-[var(--crm-muted)]">
              buscando…
            </span>
          )}

          {resultados.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-[var(--crm-border)] bg-white shadow-lg">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => agregar(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[#f4f6f8]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px]">
                        {p.marca && <strong>{p.marca}</strong>} {p.nombre}
                      </span>
                      <span className="block text-[12px] text-[var(--crm-muted)]">
                        {p.sku}
                        {p.disponible !== null
                          ? ` · ${p.disponible} disponible${p.disponible === 1 ? "" : "s"}`
                          : " · servicio"}
                        {!p.permiteDescuento ? " · sin descuento" : ""}
                      </span>
                    </span>
                    <span className="crm-num shrink-0 text-[14px] font-medium">
                      {clp(p.precio)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lineas.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-[var(--crm-axis)] px-4 py-6 text-center text-[13px] text-[var(--crm-muted)]">
            Busca una pieza para empezar la cotización.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {lineas.map((l) => {
              const tope = topeDe(l);
              const excedido = tope !== null && l.descuento > tope;
              return (
                <li
                  key={l.id}
                  className="rounded-lg border border-[var(--crm-grid)] px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px]">
                        {l.marca && <strong>{l.marca}</strong>} {l.nombre}
                      </div>
                      <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                        {l.sku} · {clp(l.precio)} c/u
                        {tope !== null && ` · tope de descuento ${clp(tope)}`}
                        {!l.permiteDescuento && " · no admite descuento"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLineas((p) => p.filter((x) => x.id !== l.id))}
                      className="text-[13px] text-[var(--crm-muted)] hover:text-[#96201f]"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <label className="text-[12px]">
                      <span className="mb-1 block text-[var(--crm-ink-2)]">Cantidad</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={l.cantidad}
                        onChange={(e) =>
                          setLineas((p) =>
                            p.map((x) =>
                              x.id === l.id
                                ? { ...x, cantidad: Math.max(1, Number(e.target.value)) }
                                : x,
                            ),
                          )
                        }
                        className="crm-num w-20 rounded border border-[var(--crm-border)] px-2 py-1.5 text-right"
                      />
                    </label>
                    <label className="text-[12px]">
                      <span className="mb-1 block text-[var(--crm-ink-2)]">
                        Descuento (pesos)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={l.descuento}
                        disabled={!l.permiteDescuento}
                        onChange={(e) =>
                          setLineas((p) =>
                            p.map((x) =>
                              x.id === l.id
                                ? { ...x, descuento: Math.max(0, Number(e.target.value)) }
                                : x,
                            ),
                          )
                        }
                        className={`crm-num w-36 rounded border px-2 py-1.5 text-right disabled:bg-[#f4f5f7] ${
                          excedido ? "border-[#d03b3b]" : "border-[var(--crm-border)]"
                        }`}
                      />
                    </label>
                    <div className="crm-num ml-auto text-[15px] font-semibold">
                      {clp(l.precio * l.cantidad - l.descuento)}
                    </div>
                  </div>

                  {excedido && (
                    <p className="mt-1.5 text-[12px] text-[#96201f]">
                      Supera el tope de {clp(tope!)}. El servidor lo va a rechazar.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="text-[13px]">
            <span className="mb-1 block font-medium text-[var(--crm-ink-2)]">
              Descuento adicional al total (pesos)
            </span>
            <input
              type="number"
              min={0}
              step={50000}
              value={descuentoGlobal}
              onChange={(e) => setDescuentoGlobal(Math.max(0, Number(e.target.value)))}
              className="crm-num w-48 rounded-lg border border-[var(--crm-border)] px-3 py-2 text-right"
            />
            <span className="mt-1 block text-[12px] text-[var(--crm-muted)]">
              Se aplica después de los descuentos por pieza, sobre lo que quedó.
            </span>
          </label>

          <dl className="crm-num min-w-[220px] space-y-1 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-[var(--crm-ink-2)]">Subtotal</dt>
              <dd>{clp(subtotal)}</dd>
            </div>
            {descuentoItems > 0 && (
              <div className="flex justify-between">
                <dt className="text-[var(--crm-ink-2)]">Descuento por pieza</dt>
                <dd>−{clp(descuentoItems)}</dd>
              </div>
            )}
            {descuentoGlobal > 0 && (
              <div className="flex justify-between">
                <dt className="text-[var(--crm-ink-2)]">Descuento adicional</dt>
                <dd>−{clp(descuentoGlobal)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--crm-grid)] pt-1 text-[17px] font-semibold">
              <dt>Total</dt>
              <dd>{clp(total)}</dd>
            </div>
          </dl>
        </div>

        <button
          type="submit"
          disabled={lineas.length === 0}
          className="mt-5 w-full rounded-lg bg-[var(--crm-brand)] py-2.5 text-[14px] font-semibold text-white transition hover:bg-[var(--crm-brand-dark)] disabled:opacity-50"
        >
          Crear cotización
        </button>
        <p className="mt-2 text-center text-[12px] text-[var(--crm-muted)]">
          Se crea como borrador. El mensaje al cliente se revisa y se envía en el
          paso siguiente.
        </p>
      </section>
    </form>
  );
}
