"use client";

import { useState, useTransition } from "react";
import { darDeBaja } from "@/lib/cafecito/actions";

/**
 * La baja se confirma con un clic explícito, no al abrir la página.
 *
 * Los escáneres de seguridad de los clientes de correo visitan cada URL de un
 * mensaje: si bastara con cargar la página, un antivirus corporativo daría de
 * baja a quien solo abrió la edición.
 */
export default function CafecitoBaja({ token, email }: { token: string; email: string }) {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (listo) {
    return (
      <>
        <h1>Listo, no te escribimos más</h1>
        <p className="cf-txt">
          Diste de baja <strong>{email}</strong>. Gracias
          por el tiempo que nos leíste. Si algún día lo echas de menos, la puerta
          queda abierta.
        </p>
        <a href="/cafecito-ia" className="cf-enlace">
          Ver las ediciones publicadas →
        </a>
      </>
    );
  }

  return (
    <>
      <h1>¿Damos de baja este correo?</h1>
      <p className="cf-txt">
        Dejarás de recibir Cafecito IA en <strong>{email}</strong>.
      </p>

      <div className="cf-acciones">
        <button
          type="button"
          disabled={pending}
          className="btn btn-ghost"
          onClick={() =>
            start(async () => {
              const r = await darDeBaja(token);
              if (r.ok) setListo(true);
              else setError(true);
            })
          }
        >
          {pending ? "Dando de baja…" : "Sí, darme de baja"}
        </button>
        <a href="/cafecito-ia" className="btn btn-primary">
          Mejor sigo suscrito
        </a>
      </div>

      {error && (
        <p className="form-error" style={{ marginTop: 14 }}>
          No se pudo procesar. Escríbenos a hola@adoops.digital y lo hacemos a mano.
        </p>
      )}
    </>
  );
}
