"use client";

import { useActionState } from "react";
import {
  aprobarInformeAction,
  enviarInformeAction,
  marcarEnviadoAction,
  retirarInformeAction,
  type Resultado,
} from "@/lib/tuniche/informes.actions";

function Aviso({ estado }: { estado: Resultado }) {
  if (estado.error) {
    return (
      <p
        role="alert"
        className="rounded-lg border px-3 py-2 text-[13px]"
        style={{
          borderColor: "var(--tun-critico)",
          background: "var(--tun-critico-soft)",
          color: "var(--tun-critico)",
        }}
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p
        role="status"
        className="rounded-lg border px-3 py-2 text-[13px]"
        style={{
          borderColor: "var(--tun-ok)",
          background: "var(--tun-ok-soft)",
          color: "var(--tun-ok)",
        }}
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

/**
 * Lo único que sale de Tuniche, y sus controles.
 *
 * **Es un componente de cliente por una razón concreta.** Las acciones devuelven
 * su error en vez de lanzarlo, porque un `throw` en una acción de servidor llega
 * como un digest —Next redacta el mensaje en producción— y la persona termina
 * viendo un texto genérico mientras el motivo real, que casi siempre es una
 * regla de negocio explicable, se queda en los registros del servidor. Pasó
 * exactamente eso al intentar el primer envío: el sistema sabía decir "este
 * agricultor no tiene teléfono" y en pantalla salió "algo falló".
 */
export default function AccionesInforme({
  id,
  tipo,
  estado,
  puede,
  demo,
  aprobadoPor,
  enviadoEn,
  enviadoA,
  agricultor,
  telefono,
}: {
  id: number;
  tipo: string;
  estado: string;
  puede: boolean;
  demo: boolean;
  aprobadoPor: string | null;
  enviadoEn: string | null;
  enviadoA: string | null;
  agricultor: string | null;
  telefono: string | null;
}) {
  const [aprobado, aprobar, aprobando] = useActionState<Resultado, FormData>(
    aprobarInformeAction,
    {},
  );
  const [retirado, retirar, retirando] = useActionState<Resultado, FormData>(
    retirarInformeAction,
    {},
  );
  const [enviado, enviar, enviando] = useActionState<Resultado, FormData>(
    enviarInformeAction,
    {},
  );
  const [marcado, marcar, marcando] = useActionState<Resultado, FormData>(
    marcarEnviadoAction,
    {},
  );

  const esVisita = tipo === "visita";
  const sinTelefono = esVisita && !telefono;

  // El PDF se puede mirar en cualquier estado, y conviene que así sea: es lo
  // que va a recibir el agricultor, y quien da el visto bueno debería poder
  // abrirlo antes de darlo — no después.
  const verPdf = esVisita ? (
    <a
      href={`/api/tuniche/informes/${id}/pdf`}
      target="_blank"
      rel="noreferrer"
      className="tun-boton-suave"
    >
      Ver el PDF que se adjunta
    </a>
  ) : null;

  if (estado === "enviado") {
    return (
      <div className="mt-3 space-y-3">
        <p className="text-[14px]" style={{ color: "var(--tun-ok)" }}>
          ✓ Enviado el {enviadoEn}
          {enviadoA ? ` a ${enviadoA}` : ""}, con el PDF adjunto. Este documento ya no se
          puede modificar ni retirar: el destinatario lo tiene.
        </p>
        {verPdf}
      </div>
    );
  }

  if (estado === "aprobado") {
    return (
      <div className="mt-3 space-y-4">
        <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Con visto bueno de <b>{aprobadoPor}</b>. Puede salir.
        </p>

        <Aviso estado={enviado.error || enviado.ok ? enviado : marcado} />

        {/* Se comprueba ANTES de ofrecer el botón. Ofrecer una acción que no
            puede funcionar y explicarlo recién cuando falla es peor que no
            ofrecerla: la persona ya hizo el gesto y no sabe qué arreglar. */}
        {puede && sinTelefono && (
          <p
            className="rounded-lg border px-3 py-2.5 text-[13px]"
            style={{
              borderColor: "var(--tun-alerta)",
              background: "var(--tun-alerta-soft)",
              color: "var(--tun-alerta)",
            }}
          >
            <b>{agricultor ?? "Este agricultor"} no tiene teléfono registrado</b>, así que
            todavía no hay a quién enviarle el informe. Cárgalo en su ficha y el botón
            aparece.
          </p>
        )}

        {puede && demo && esVisita && (
          <p
            className="rounded-lg border px-3 py-2.5 text-[13px]"
            style={{
              borderColor: "var(--tun-alerta)",
              background: "var(--tun-alerta-soft)",
              color: "var(--tun-alerta)",
            }}
          >
            Es un informe de <b>demostración</b>: el flujo se puede recorrer entero, pero el
            despacho real está bloqueado.
          </p>
        )}

        {puede && esVisita && !sinTelefono && !demo && (
          <form action={enviar} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={id} />
            <button type="submit" disabled={enviando} className="tun-boton">
              {enviando ? "Enviando…" : "Enviar al agricultor por WhatsApp"}
            </button>
            <span className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
              Va el PDF adjunto y el texto de abajo como epígrafe, en un solo mensaje.
            </span>
          </form>
        )}

        {verPdf}

        {puede && !esVisita && (
          <form action={marcar} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <div className="min-w-[260px] flex-1">
              <label htmlFor="destinatario" className="tun-etiqueta">
                ¿A quién se lo enviaste?
              </label>
              <input
                id="destinatario"
                name="destinatario"
                required
                className="tun-campo"
                placeholder="correo o nombre del contacto del cliente"
              />
            </div>
            <button type="submit" disabled={marcando} className="tun-boton">
              {marcando ? "Guardando…" : "Marcar como enviado"}
            </button>
          </form>
        )}

        {puede && (
          <>
            <Aviso estado={retirado} />
            <form action={retirar}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" disabled={retirando} className="tun-boton-suave">
                {retirando ? "Retirando…" : "Retirar visto bueno"}
              </button>
            </form>
          </>
        )}
      </div>
    );
  }

  if (!puede) {
    return (
      <p className="mt-3 text-[14px]" style={{ color: "var(--tun-muted)" }}>
        En borrador, esperando el visto bueno de la jefatura de tu área. Nada sale de
        Tuniche sin eso.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
        Este informe está en borrador. <b>Nada sale de Tuniche sin visto bueno</b>, y se da
        sobre el documento de arriba: lo que apruebas es exactamente lo que va a recibir el
        destinatario.
      </p>
      {sinTelefono && (
        <p className="text-[13px]" style={{ color: "var(--tun-alerta)" }}>
          Ojo: {agricultor ?? "este agricultor"} todavía no tiene teléfono, así que aunque
          le des el visto bueno no se va a poder enviar.
        </p>
      )}
      <Aviso estado={aprobado} />
      <div className="flex flex-wrap items-center gap-3">
        <form action={aprobar}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" disabled={aprobando} className="tun-boton">
            {aprobando ? "Guardando…" : "Dar visto bueno"}
          </button>
        </form>
        {verPdf}
      </div>
    </div>
  );
}
