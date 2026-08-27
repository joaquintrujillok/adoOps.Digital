"use client";

import { useActionState } from "react";
import { VISITA, type Campo } from "@/lib/tuniche/plantillas";
import { editarVisitaAction } from "@/lib/tuniche/visitas.actions";

/**
 * Corregir lo que la IA entendió mal.
 *
 * **Los campos se recorren desde `VISITA`, no se escriben acá.** Agregar un
 * campo a la plantilla lo agrega a este formulario. Escrito a mano, el
 * formulario se queda corto al primer cambio y nadie lo nota: el síntoma es un
 * campo que la IA sí extrae pero que ninguna persona puede corregir.
 */
function Campito({
  c,
  valor,
}: {
  c: Campo;
  valor: unknown;
}) {
  const id = `${c.id}-editar`;

  if (c.tipo === "opcion") {
    return (
      <div>
        <label htmlFor={id} className="tun-etiqueta">
          {c.etiqueta}
        </label>
        <select id={id} name={c.id} defaultValue={(valor as string) ?? ""} className="tun-campo">
          {/* Vacío primero: "no se mencionó" es una respuesta legítima y tiene
              que poder elegirse, no solo heredarse de que la IA no lo puso. */}
          <option value="">— sin dato —</option>
          {(c.valores ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (c.tipo === "opciones") {
    const puestos = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <div>
        <span className="tun-etiqueta">{c.etiqueta}</span>
        <div className="flex flex-wrap gap-4 pt-1">
          {(c.valores ?? []).map((v) => (
            <label key={v} className="flex items-center gap-2 text-[13.5px]" style={{ color: "var(--tun-ink-2)" }}>
              <input type="checkbox" name={c.id} value={v} defaultChecked={puestos.includes(v)} />
              {v}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (c.tipo === "porcentaje") {
    return (
      <div>
        <label htmlFor={id} className="tun-etiqueta">
          {c.etiqueta} <span style={{ color: "var(--tun-muted)" }}>(0 a 100)</span>
        </label>
        <input
          id={id}
          name={c.id}
          type="number"
          min={0}
          max={100}
          defaultValue={valor == null ? "" : String(valor)}
          className="tun-campo"
        />
      </div>
    );
  }

  if (c.tipo === "lista") {
    const lineas = Array.isArray(valor) ? (valor as string[]).join("\n") : "";
    return (
      <div className="sm:col-span-2">
        <label htmlFor={id} className="tun-etiqueta">
          {c.etiqueta} <span style={{ color: "var(--tun-muted)" }}>(una por línea)</span>
        </label>
        <textarea id={id} name={c.id} rows={3} defaultValue={lineas} className="tun-campo" />
      </div>
    );
  }

  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="tun-etiqueta">
        {c.etiqueta}
      </label>
      <textarea
        id={id}
        name={c.id}
        rows={2}
        defaultValue={valor == null ? "" : String(valor)}
        className="tun-campo"
      />
    </div>
  );
}

export default function EditarVisita({
  visitaId,
  etapa,
  etapas,
  datos,
  nota,
  resumen,
}: {
  visitaId: number;
  etapa: string | null;
  etapas: string[];
  datos: Record<string, unknown>;
  nota: number | null;
  resumen: string;
}) {
  const [estado, accion, pendiente] = useActionState(editarVisitaAction, {});

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={visitaId} />

      <p
        className="rounded-lg border px-3 py-2 text-[12.5px]"
        style={{ borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }}
      >
        La transcripción del audio <b>no se toca</b>: es la constancia de lo que dijo el
        zonal, y es contra ella que se contrasta lo que entendió la IA. Al guardar, la
        visita queda marcada como <b>corregida</b>.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="etapa-editar" className="tun-etiqueta">
            Etapa del cultivo
          </label>
          <select id="etapa-editar" name="etapa" defaultValue={etapa ?? ""} className="tun-campo">
            <option value="">— sin dato —</option>
            {etapas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        {VISITA.filter((c) => c.id !== "etapa" && c.tipo !== "fotos").map((c) => (
          <Campito key={c.id} c={c} valor={c.id === "nota_agronomica" ? nota : datos[c.id]} />
        ))}

        <div className="sm:col-span-2">
          <label htmlFor="resumen-editar" className="tun-etiqueta">
            Resumen <span style={{ color: "var(--tun-muted)" }}>— es lo que lee el agricultor</span>
          </label>
          <textarea
            id="resumen-editar"
            name="resumen"
            rows={3}
            defaultValue={resumen}
            className="tun-campo"
          />
        </div>
      </div>

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
      {estado.ok && (
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

      <button type="submit" disabled={pendiente} className="tun-boton">
        {pendiente ? "Guardando…" : "Guardar corrección"}
      </button>
    </form>
  );
}
