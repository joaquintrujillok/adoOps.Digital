"use client";

// La columna del centro: el hilo y el cuadro de redacción.
//
// Es el único componente de cliente de la pantalla, y lo es por dos razones
// concretas: las respuestas rápidas necesitan leer lo que se está tecleando
// para saber si abrir el menú, y el hilo tiene que marcarse leído al abrirse.
// Todo lo demás —bandeja, ficha, cifras— se pinta en el servidor.
//
// Las fechas llegan ya formateadas desde el servidor. Formatearlas acá haría
// que el HTML del servidor y el del navegador no coincidan cuando difieren el
// huso o el idioma del sistema, y React descarta el árbol entero cuando eso
// pasa: el hilo parpadearía en cada carga.

import { useEffect, useRef, useState } from "react";
import {
  accionAprobarMensaje,
  accionDescartarMensaje,
  accionMarcarLeida,
  accionRedactarMensaje,
} from "@/lib/crm/acciones";
import { buscarRespuestas, HUECO } from "@/lib/crm/respuestas-rapidas";
import BotonEnvio from "./BotonEnvio";
import { Estado, btnPrimario } from "./ui";

export interface MensajeVista {
  id: number;
  direccion: string;
  cuerpo: string;
  estado: string;
  motivo: string | null;
  automatico: boolean;
  /** Clave de agrupación por día, ya calculada en el servidor. */
  dia: string;
  /** "Hoy", "Ayer" o la fecha escrita. */
  diaEtiqueta: string;
  hora: string;
}

/**
 * Un mensaje largo se muestra recortado a tres líneas, con «ver más» al lado.
 *
 * El recorte es por largo del texto y no por alto medido: medir obliga a pintar
 * el mensaje entero, comparar `scrollHeight` con `clientHeight` y volver a
 * pintar, y eso en un hilo de cuarenta mensajes es un salto visible en cada
 * carga. El umbral está en caracteres, que es lo que se puede decidir antes de
 * pintar nada.
 */
const LARGO_QUE_MOLESTA = 220;

function Cuerpo({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  const largo = texto.length > LARGO_QUE_MOLESTA;

  return (
    <>
      <p
        className={`whitespace-pre-line leading-relaxed ${
          largo && !abierto ? "line-clamp-3" : ""
        }`}
      >
        {texto}
      </p>
      {largo && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="mt-0.5 text-[11px] font-medium text-[var(--crm-brand-dark)] hover:underline"
        >
          {abierto ? "ver menos" : "ver más"}
        </button>
      )}
    </>
  );
}

export default function HiloConversacion({
  conversationId,
  mensajes,
  baja,
  noLeida,
  simulado,
}: {
  conversationId: number;
  mensajes: MensajeVista[];
  baja: boolean;
  noLeida: boolean;
  simulado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const caja = useRef<HTMLDivElement>(null);

  // Abrir un hilo es haberlo leído. Se llama solo cuando queda algo por marcar:
  // la acción no revalida si no cambió nada, así que abrir una conversación ya
  // leída no dispara trabajo de servidor.
  useEffect(() => {
    if (noLeida) void accionMarcarLeida(conversationId);
  }, [conversationId, noLeida]);

  // Al abrir se ve lo último, no lo primero. Un hilo de cuarenta mensajes que
  // arranca arriba obliga a bajar a mano cada vez para saber en qué quedó.
  //
  // Moviendo `scrollTop` del contenedor y no con `scrollIntoView` sobre un
  // centinela: lo segundo también mueve el scroll de la página cuando el hilo
  // no entra entero en pantalla, y la bandeja se va para arriba sola.
  // El segundo intento dentro de un frame no es paranoia: en la primera pasada
  // el contenedor todavía no terminó de repartir el alto del flex, `scrollHeight`
  // vale lo mismo que `clientHeight` y la asignación no mueve nada.
  useEffect(() => {
    const c = caja.current;
    if (!c) return;
    const alFinal = () => {
      c.scrollTop = c.scrollHeight;
    };
    alFinal();
    const frame = requestAnimationFrame(alFinal);
    return () => cancelAnimationFrame(frame);
  }, [conversationId, mensajes.length]);

  // Solo cuando la barra abre el mensaje: si se disparara con una barra en
  // cualquier posición, escribir "lunes 8/9" abriría el menú a media frase.
  const sugerencias = texto.startsWith("/") ? buscarRespuestas(texto.slice(1)) : null;

  return (
    <>
      <div ref={caja} className="crm-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {mensajes.length === 0 && (
          <p className="py-10 text-center text-[13px] text-[var(--crm-muted)]">
            Todavía no hay mensajes en este hilo.
          </p>
        )}

        {mensajes.map((m, i) => {
          const previo = i > 0 ? mensajes[i - 1] : null;
          // El primero siempre abre día: sin eso el hilo arranca sin decir de
          // cuándo es el mensaje más viejo.
          const abreDia = !previo || previo.dia !== m.dia;
          // Se agrupan los seguidos del mismo lado y del mismo día. Es lo que
          // hace que un hilo largo se lea de un vistazo en vez de como una
          // lista de tarjetas sueltas.
          const encadena = !abreDia && previo?.direccion === m.direccion;
          const saliente = m.direccion === "out";
          const borrador = saliente && m.estado === "draft";
          const trabado = saliente && (m.estado === "retenido" || m.estado === "failed");

          return (
            <div key={m.id}>
              {abreDia && (
                <div className="flex justify-center py-3">
                  <span className="rounded-full bg-[#f0f1f3] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-ink-2)]">
                    {m.diaEtiqueta}
                  </span>
                </div>
              )}

              <div
                className={`flex ${encadena ? "mt-1" : "mt-3"} ${
                  saliente ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                    borrador
                      // El borrador se ve distinto a propósito: mientras nadie
                      // lo apruebe no puede parecer un mensaje ya resuelto.
                      ? "border-2 border-dashed border-[#f6e0a5] bg-white"
                      : saliente
                        ? "bg-[var(--crm-brand-soft)]"
                        : "bg-[#f0f1f3]"
                  } text-[var(--crm-ink)]`}
                >
                  {m.automatico && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
                      Mensaje automático
                    </p>
                  )}
                  <Cuerpo texto={m.cuerpo} />

                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--crm-muted)]">
                    <span>{m.hora}</span>
                    {saliente && <Estado estado={m.estado} />}
                  </div>

                  {/* Por qué no salió. Sin esto, un mensaje retenido se ve igual
                      que uno en tránsito y nadie sabe si esperar. */}
                  {m.motivo && (
                    <p className="mt-1 text-[11px] leading-snug text-[#96201f]">{m.motivo}</p>
                  )}

                  {borrador && (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-[#f6e0a5] pt-2.5">
                      <form action={accionAprobarMensaje}>
                        <input type="hidden" name="messageId" value={m.id} />
                        <BotonEnvio
                          className="rounded-lg bg-[var(--crm-brand)] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[var(--crm-brand-dark)] disabled:opacity-50"
                          pendiente="Enviando…"
                        >
                          Aprobar y enviar
                        </BotonEnvio>
                      </form>
                      <form action={accionDescartarMensaje}>
                        <input type="hidden" name="messageId" value={m.id} />
                        <BotonEnvio
                          className="rounded-lg border border-[var(--crm-border)] px-2.5 py-1 text-[11px] text-[var(--crm-ink-2)] transition hover:bg-[#f0f1f3] disabled:opacity-50"
                          pendiente="…"
                        >
                          Descartar
                        </BotonEnvio>
                      </form>
                    </div>
                  )}

                  {/* Sin esto, un mensaje que salió de borrador pero no llegó a
                      enviarse no tiene ningún botón y el hilo queda muerto. */}
                  {trabado && (
                    <form action={accionAprobarMensaje} className="mt-2 border-t border-[var(--crm-grid)] pt-2">
                      <input type="hidden" name="messageId" value={m.id} />
                      <BotonEnvio
                        className="rounded-lg border border-[var(--crm-border)] bg-white px-2.5 py-1 text-[11px] text-[var(--crm-ink-2)] transition hover:bg-[#f0f1f3] disabled:opacity-50"
                        pendiente="Reintentando…"
                      >
                        Reintentar envío
                      </BotonEnvio>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-[var(--crm-grid)] p-4">
        {baja ? (
          <div className="rounded-lg border border-[#f2c3c3] bg-[#fbe9e9] px-4 py-3 text-[13px] text-[#96201f]">
            <strong>Este contacto pidió no recibir más mensajes.</strong> El despacho
            retiene cualquier envío a este número, aunque alguien lo apruebe por error.
          </div>
        ) : (
          <form
            action={async (formData: FormData) => {
              await accionRedactarMensaje(formData);
              setTexto("");
            }}
          >
            <input type="hidden" name="conversationId" value={conversationId} />

            {/* Respuestas rápidas. Se abren escribiendo `/` al principio, como en
                cualquier chat de trabajo: en una boutique las preguntas se
                repiten y hoy eso se teclea entero cada vez. */}
            {sugerencias !== null && sugerencias.length > 0 && (
              <div className="crm-scroll mb-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-white shadow-sm">
                {sugerencias.map((r) => (
                  <button
                    key={r.atajo}
                    type="button"
                    onClick={() => setTexto(r.texto)}
                    className="w-full border-b border-[var(--crm-grid)] px-3 py-2 text-left last:border-b-0 hover:bg-[var(--crm-brand-soft)]"
                  >
                    <span className="text-[11px] font-semibold text-[var(--crm-brand-dark)]">
                      /{r.atajo}
                    </span>
                    <span className="text-[11px] text-[var(--crm-muted)]"> · {r.titulo}</span>
                    {r.incompleta && (
                      <span className="ml-1.5 text-[10px] text-[#7a5600]">completar</span>
                    )}
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--crm-ink-2)]">
                      {r.texto}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {/* Un hueco sin completar mandado tal cual es peor que no tener la
                respuesta rápida: el cliente recibe un corchete. */}
            {HUECO.test(texto) && (
              <p className="mb-1.5 text-[11px] text-[#7a5600]">
                Falta completar lo que está entre corchetes antes de mandarlo.
              </p>
            )}

            <textarea
              name="cuerpo"
              rows={2}
              required
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe el mensaje…   ·   escribe / para las respuestas rápidas"
              className="w-full resize-none rounded-lg border border-[var(--crm-border)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-brand)]"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[var(--crm-muted)]">
                {simulado
                  ? "Modo simulado: queda registrado sin salir a la red."
                  : "Modo real: sale por WaSender si el número está autorizado."}
              </p>
              <BotonEnvio className={btnPrimario} pendiente="Enviando…" disabled={!texto.trim()}>
                Enviar
              </BotonEnvio>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
