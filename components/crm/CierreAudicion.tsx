"use client";

// El cierre de audición, en menos de un minuto.
//
// Lo que hace distinta a esta pantalla de un formulario normal son las tres
// preguntas del medio: **no son fijas**. El motor las eligió para esta persona
// en particular, mirando lo que ya se sabe de ella, y trae el porqué de cada
// una. El vendedor no tiene que acordarse de qué falta averiguar.
//
// Todo es opcional salvo la sala. Media audición registrada vale infinitamente
// más que ninguna, y un formulario que exige quince campos al final de una
// atención de dos horas no se llena nunca.

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { accionCerrarAudicion, type EstadoCierre } from "@/lib/crm/audiciones.actions";
import type { PreguntaPropuesta } from "@/lib/crm/preguntas";
import type { Sala } from "@/lib/crm/audiciones";

const CAMPO =
  "w-full rounded-xl border border-[var(--crm-border)] bg-white px-4 py-3 text-[15px] outline-none focus:border-[var(--crm-brand)] focus:ring-2 focus:ring-[var(--crm-brand)]/20";
const ETIQUETA = "mb-1.5 block text-[13px] font-medium text-[var(--crm-ink)]";
const AYUDA = "mt-1 text-[12px] text-[var(--crm-muted)]";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-[var(--crm-brand)] px-5 py-3.5 text-[15px] font-semibold text-white hover:bg-[var(--crm-brand-dark)] disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Cerrar audición"}
    </button>
  );
}

export default function CierreAudicion({
  salas,
  preguntas,
  contacto,
}: {
  salas: Sala[];
  preguntas: PreguntaPropuesta[];
  contacto: { id: number; nombre: string };
}) {
  const [estado, accion] = useActionState<EstadoCierre, FormData>(accionCerrarAudicion, {});

  if (estado.ok) {
    return (
      <div className="rounded-2xl border border-[var(--crm-brand)]/30 bg-[var(--crm-brand-soft)] p-8 text-center">
        <div className="text-[15px] font-semibold text-[var(--crm-brand-dark)]">
          Audición registrada
        </div>
        <p className="mt-2 text-[14px] text-[var(--crm-ink-2)]">
          {estado.respuestasGuardadas
            ? `Y ${estado.respuestasGuardadas} ${estado.respuestasGuardadas === 1 ? "dato nuevo" : "datos nuevos"} de ${contacto.nombre} que antes no estaban en ninguna parte.`
            : "Quedó escrito lo que pasó en la sala."}
        </p>
        <a
          href="/crm/audiciones"
          className="mt-5 inline-block rounded-lg border border-[var(--crm-border)] bg-white px-4 py-2 text-[14px] font-medium"
        >
          Volver a audiciones
        </a>
      </div>
    );
  }

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="contactId" value={contacto.id} />

      {estado.error ? (
        <div className="rounded-xl border border-[#f2c3c3] bg-[#fbe9e9] px-4 py-3 text-[14px] text-[#96201f]">
          {estado.error}
        </div>
      ) : null}

      {/* ── La sala. Lo único obligatorio ── */}
      <div>
        <label className={ETIQUETA}>¿En qué sala fue?</label>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {salas.map((s, i) => (
            <label
              key={s.id}
              className="cursor-pointer rounded-xl border border-[var(--crm-border)] bg-white p-3 transition hover:border-[var(--crm-brand)] has-[:checked]:border-[var(--crm-brand)] has-[:checked]:bg-[var(--crm-brand-soft)]"
            >
              <input
                type="radio"
                name="salaId"
                value={s.id}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <div className="text-[14px] font-semibold text-[var(--crm-ink)]">{s.nombre}</div>
              <div className="mt-0.5 text-[11px] text-[var(--crm-muted)]">
                {s.capacidadMin} a {s.capacidadMax} personas
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={ETIQUETA} htmlFor="duracion">Cuánto duró</label>
          <select id="duracion" name="duracion" className={CAMPO} defaultValue="60">
            <option value="30">Media hora</option>
            <option value="60">Una hora</option>
            <option value="90">Hora y media</option>
            <option value="120">Dos horas</option>
            <option value="180">Más de dos horas</option>
          </select>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="acompanantes">Vino con</label>
          <select id="acompanantes" name="acompanantes" className={CAMPO} defaultValue="0">
            <option value="0">Solo</option>
            <option value="1">Una persona</option>
            <option value="2">Dos personas</option>
            <option value="3">Tres o más</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
            <input type="checkbox" name="conCita" defaultChecked className="h-4 w-4 accent-[var(--crm-brand)]" />
            <span>Venía con cita</span>
          </label>
        </div>
      </div>

      {/* ── Lo que dijo. El campo más valioso, y por eso va arriba ── */}
      <div>
        <label className={ETIQUETA} htmlFor="queDijo">¿Qué dijo?</label>
        <textarea
          id="queDijo"
          name="queDijo"
          rows={3}
          className={CAMPO}
          placeholder="En sus palabras, lo más textual que se pueda."
        />
        <p className={AYUDA}>
          Es lo único irremplazable. En seis meses, la frase que dijo acá es el argumento para
          volver a llamarlo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA} htmlFor="leGusto">Qué le gustó</label>
          <textarea id="leGusto" name="leGusto" rows={2} className={CAMPO} placeholder="Marca, modelo, qué le llamó la atención." />
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="descarto">Qué descartó</label>
          <textarea id="descarto" name="descarto" rows={2} className={CAMPO} placeholder="Y por qué, si lo dijo." />
          <p className={AYUDA}>Vale tanto como lo anterior: evita volver a ofrecerle lo que ya rechazó.</p>
        </div>
      </div>

      {/* ── Las preguntas que el motor eligió para esta persona ── */}
      {preguntas.length > 0 ? (
        <div className="rounded-2xl border border-[var(--crm-brand)]/25 bg-[var(--crm-brand-soft)]/50 p-5">
          <div className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--crm-brand-dark)]">
            Lo que falta saber de {contacto.nombre.split(" ")[0]}
          </div>
          <p className="mb-4 text-[13px] text-[var(--crm-ink-2)]">
            Estas tres, y no otras: son las que más cambian lo que se le puede ofrecer. Si no
            salieron en la conversación, se dejan en blanco.
          </p>

          <div className="space-y-4">
            {preguntas.map((p) => (
              <div key={p.clave}>
                <label className={ETIQUETA} htmlFor={`r-${p.clave}`}>{p.texto}</label>
                {p.opciones ? (
                  <select id={`r-${p.clave}`} name={`respuesta.${p.clave}`} className={CAMPO} defaultValue="">
                    <option value="">No salió el tema</option>
                    {p.opciones.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                    <option value="__no_tiene">No tiene / ninguna</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id={`r-${p.clave}`}
                      name={`respuesta.${p.clave}`}
                      className={CAMPO}
                      placeholder="Si no salió el tema, déjalo en blanco"
                      inputMode={p.esMonto ? "numeric" : "text"}
                    />
                    {p.clave.startsWith("sistema.") ? (
                      // El botón que hace la diferencia entre "no preguntamos"
                      // y "preguntamos y no tiene". Lo segundo es una venta.
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                          input.value = "__no_tiene";
                          input.setAttribute("data-no-tiene", "1");
                        }}
                        className="shrink-0 rounded-xl border border-[var(--crm-border)] bg-white px-3 text-[13px] font-medium text-[var(--crm-ink-2)] hover:border-[var(--crm-brand)]"
                        title="Preguntamos y confirmó que no lo tiene"
                      >
                        No tiene
                      </button>
                    ) : null}
                  </div>
                )}
                <p className={AYUDA}>{p.porQue}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── El presupuesto, al final y sin insistir ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={ETIQUETA} htmlFor="presupuesto">¿Mencionó un presupuesto?</label>
          <input
            id="presupuesto"
            name="presupuesto"
            className={CAMPO}
            inputMode="numeric"
            placeholder="Solo si lo dijo él"
          />
          <p className={AYUDA}>Nunca se pregunta de frente. Se anota si salió.</p>
        </div>
        <div>
          <label className={ETIQUETA} htmlFor="proximoPasoEn">¿Cuándo corresponde volver?</label>
          <input id="proximoPasoEn" name="proximoPasoEn" type="date" className={CAMPO} />
        </div>
      </div>

      <div>
        <label className={ETIQUETA} htmlFor="proximoPaso">Próximo paso</label>
        <input
          id="proximoPaso"
          name="proximoPaso"
          className={CAMPO}
          placeholder="Mandarle la comparativa · Avisarle cuando llegue el Børresen · Cotizar"
        />
        <p className={AYUDA}>
          Decidido ahora, mientras está fresco. Una audición sin próximo paso se enfría sola.
        </p>
      </div>

      <Guardar />
    </form>
  );
}
