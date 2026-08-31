"use client";

import { useActionState, useState } from "react";
import { AREAS } from "@/lib/tuniche/areas";
import {
  actualizarUsuarioAction,
  crearUsuarioAction,
  type Resultado,
} from "@/lib/tuniche/usuarios.actions";
import ClaveDeUnSoloUso from "./ClaveDeUnSoloUso";

export interface ValoresUsuario {
  id: number;
  username: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: string;
  area: string | null;
  recibeInformes: boolean;
}

const ROLES = [
  {
    id: "zonal",
    etiqueta: "Zonal",
    ayuda: "Carga visitas y ve solo sus propios agricultores.",
  },
  {
    id: "jefe",
    etiqueta: "Jefe de área",
    ayuda: "Ve toda su área y puede enviarle el informe al agricultor.",
  },
  {
    id: "admin",
    etiqueta: "Administrador",
    ayuda: "Todas las áreas, más la gestión de usuarios y maestras.",
  },
];

/**
 * Alta y edición de una cuenta. Un solo componente para las dos porque los
 * campos son los mismos y mantener dos formularios significa que uno de los dos
 * se queda sin la validación que se agregó al otro.
 *
 * La diferencia real está en la contraseña: al crear, el sistema genera una y
 * la muestra **una sola vez**; al editar, no se toca (para eso está el botón de
 * resetear, que es una decisión aparte y con su propio clic).
 */
export default function FormularioUsuario({ valores }: { valores?: ValoresUsuario }) {
  const editando = Boolean(valores);
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(
    editando ? actualizarUsuarioAction : crearUsuarioAction,
    {},
  );
  const [rol, setRol] = useState(valores?.rol ?? "zonal");

  const descripcionRol = ROLES.find((r) => r.id === rol)?.ayuda;

  return (
    <form action={accion} className="space-y-4">
      {valores && <input type="hidden" name="id" value={valores.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`nombre-${valores?.id ?? "nuevo"}`} className="tun-etiqueta">
            Nombre completo
          </label>
          <input
            id={`nombre-${valores?.id ?? "nuevo"}`}
            name="nombre"
            defaultValue={valores?.nombre ?? ""}
            required
            className="tun-campo"
            placeholder="Francisco Pinochet"
          />
        </div>

        <div>
          <label htmlFor={`username-${valores?.id ?? "nuevo"}`} className="tun-etiqueta">
            Usuario
          </label>
          <input
            id={`username-${valores?.id ?? "nuevo"}`}
            name="username"
            defaultValue={valores?.username ?? ""}
            required
            className="tun-campo"
            placeholder="fpinochet"
          />
        </div>

        <div>
          <label htmlFor={`email-${valores?.id ?? "nuevo"}`} className="tun-etiqueta">
            Correo <span style={{ color: "var(--tun-muted)" }}>(opcional)</span>
          </label>
          <input
            id={`email-${valores?.id ?? "nuevo"}`}
            name="email"
            type="email"
            defaultValue={valores?.email ?? ""}
            className="tun-campo"
          />
        </div>

        <div>
          <label htmlFor={`telefono-${valores?.id ?? "nuevo"}`} className="tun-etiqueta">
            Teléfono de WhatsApp
          </label>
          <input
            id={`telefono-${valores?.id ?? "nuevo"}`}
            name="telefono"
            defaultValue={valores?.telefono ? `+${valores.telefono}` : ""}
            className="tun-campo"
            placeholder="+56 9 1234 5678"
          />
          {/* Esto no es un dato de contacto y conviene decirlo donde se escribe:
              es lo único que permite saber de quién es un audio que llega. */}
          <p className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
            Es el número desde el que mandará los audios. Sin él, sus mensajes de
            WhatsApp no se pueden atribuir a nadie y el sistema los rechaza.
          </p>
        </div>

        <div>
          <label htmlFor={`rol-${valores?.id ?? "nuevo"}`} className="tun-etiqueta">
            Rol
          </label>
          <select
            id={`rol-${valores?.id ?? "nuevo"}`}
            name="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="tun-campo"
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.etiqueta}
              </option>
            ))}
          </select>
          {descripcionRol && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
              {descripcionRol}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`area-${valores?.id ?? "nuevo"}`} className="tun-etiqueta">
            Área
          </label>
          {/* El administrador cruza áreas a propósito. Dejar el selector activo
              sugeriría que su alcance se puede limitar, y no se puede. */}
          <select
            id={`area-${valores?.id ?? "nuevo"}`}
            name="area"
            defaultValue={valores?.area ?? ""}
            disabled={rol === "admin"}
            className="tun-campo"
            style={rol === "admin" ? { opacity: 0.5 } : undefined}
          >
            <option value="">Elige un área…</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
            {rol === "admin"
              ? "Un administrador ve todas las áreas."
              : "Decide qué agricultores ve y qué plantilla de visita llena."}
          </p>
        </div>
      </div>

      {/* Durante la POC el informe no va al agricultor: llega a una persona del
          área que lo reenvía desde su propio WhatsApp, como trabajan hoy. */}
      {rol !== "admin" && (
        <label
          className="flex items-start gap-2.5 rounded-lg border p-3.5 text-[13.5px]"
          style={{ borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }}
        >
          <input
            type="checkbox"
            name="recibeInformes"
            value="1"
            defaultChecked={valores?.recibeInformes ?? false}
            className="mt-0.5"
          />
          <span>
            <b style={{ color: "var(--tun-ink)" }}>Recibe los informes de su área</b>
            <br />
            Los PDF aprobados le llegan a esta persona por WhatsApp, para que se los
            reenvíe al agricultor. Solo una por área: marcar a alguien desmarca al
            anterior.
          </span>
        </label>
      )}

      {estado.error && (
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
      )}

      {estado.ok && !estado.clave && (
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
      )}

      {estado.clave && <ClaveDeUnSoloUso mensaje={estado.ok ?? ""} clave={estado.clave} />}

      <button type="submit" disabled={pendiente} className="tun-boton">
        {pendiente
          ? "Guardando…"
          : editando
            ? "Guardar cambios"
            : "Crear cuenta"}
      </button>
    </form>
  );
}
