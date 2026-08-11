"use client";

// Los campos editables de la ficha lateral: nombre, correo y teléfono.
//
// Es de cliente por una sola razón: necesita mostrar el resultado del guardado.
// Un formulario que rechaza un teléfono mal escrito y no dice nada deja al
// vendedor creyendo que guardó, y el número equivocado se descubre cuando el
// mensaje no llega.

import { useActionState } from "react";
import { accionGuardarContacto } from "@/lib/crm/acciones";
import BotonEnvio from "./BotonEnvio";

const campo =
  "w-full rounded-lg border border-[var(--crm-border)] px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--crm-brand)]";
const etiqueta = "text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]";

export default function FormularioContacto({
  contactId,
  nombre,
  email,
  telefono,
}: {
  contactId: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
}) {
  const [estado, accion] = useActionState(accionGuardarContacto, null);

  // Lo rechazado manda sobre lo guardado: si el teléfono no pasó la validación,
  // el campo tiene que seguir mostrando lo que la persona escribió para que
  // pueda corregirlo. Cuando el guardado sale bien no hay `valores` y los campos
  // vuelven a lo que dice la base.
  const rechazado = estado?.ok === false ? estado.valores : undefined;
  const vNombre = rechazado?.nombre ?? nombre;
  const vEmail = rechazado?.email ?? email ?? "";
  const vTelefono = rechazado?.telefono ?? telefono ?? "";

  return (
    <form action={accion} className="space-y-2.5">
      <input type="hidden" name="contactId" value={contactId} />

      <div>
        <label className={etiqueta} htmlFor="ficha-nombre">
          Nombre
        </label>
        {/* `key` con el valor a mostrar: React vacía los campos apenas termina la
            acción, y sin remontar el input se quedaría en blanco. */}
        <input
          id="ficha-nombre"
          key={`n-${vNombre}`}
          name="nombre"
          defaultValue={vNombre}
          required
          className={`${campo} mt-1`}
        />
      </div>

      <div>
        <label className={etiqueta} htmlFor="ficha-email">
          Correo
        </label>
        <input
          id="ficha-email"
          key={`e-${vEmail}`}
          name="email"
          type="email"
          defaultValue={vEmail}
          placeholder="sin correo"
          className={`${campo} mt-1`}
        />
      </div>

      <div>
        <label className={etiqueta} htmlFor="ficha-telefono">
          Teléfono
        </label>
        <input
          id="ficha-telefono"
          key={`t-${vTelefono}`}
          name="telefono"
          defaultValue={vTelefono}
          placeholder="+56 9 …"
          className={`${campo} crm-num mt-1`}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <BotonEnvio
          className="rounded-lg border border-[var(--crm-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--crm-ink)] transition hover:border-[var(--crm-brand)] hover:text-[var(--crm-brand-dark)] disabled:opacity-50"
          pendiente="Guardando…"
        >
          Guardar cambios
        </BotonEnvio>
        {estado?.ok && <span className="text-[12px] text-[var(--crm-brand-dark)]">Guardado</span>}
      </div>

      {estado && !estado.ok && (
        <p className="text-[12px] text-[#96201f]">{estado.error}</p>
      )}
    </form>
  );
}
