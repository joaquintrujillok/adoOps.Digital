"use client";

import { useActionState } from "react";
import type { Campo, Etapa } from "@/lib/tuniche/plantillas";
import {
  guardarHitosAction,
  guardarIdentificacionAction,
  type Resultado,
} from "@/lib/tuniche/lotes.actions";

function Aviso({ e }: { e: Resultado }) {
  if (!e.error && !e.ok) return null;
  const malo = Boolean(e.error);
  return (
    <p
      role={malo ? "alert" : "status"}
      className="rounded-lg border px-3 py-2 text-[13px]"
      style={{
        borderColor: malo ? "var(--tun-critico)" : "var(--tun-ok)",
        background: malo ? "var(--tun-critico-soft)" : "var(--tun-ok-soft)",
        color: malo ? "var(--tun-critico)" : "var(--tun-ok)",
      }}
    >
      {e.error ?? e.ok}
    </p>
  );
}

/** Un campo de hito, según su tipo declarado en la plantilla. */
function CampoHito({ c, valor }: { c: Campo; valor: unknown }) {
  const id = `h-${c.id}`;
  const comun = {
    id,
    name: c.id,
    className: "tun-campo",
    defaultValue: valor == null ? "" : String(valor),
  };
  return (
    <div>
      <label htmlFor={id} className="tun-etiqueta">
        {c.etiqueta}
      </label>
      {c.tipo === "fecha" ? (
        <input type="date" {...comun} />
      ) : c.tipo === "numero" || c.tipo === "porcentaje" ? (
        <input type="number" step="any" {...comun} />
      ) : c.tipo === "opcion" ? (
        <select {...comun}>
          <option value="">— sin dato —</option>
          {(c.valores ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input type="text" {...comun} />
      )}
      {c.ayuda && (
        <p className="mt-1 text-[12px]" style={{ color: "var(--tun-muted)" }}>
          {c.ayuda}
        </p>
      )}
    </div>
  );
}

/**
 * Los hitos de UNA etapa.
 *
 * Un formulario por etapa y no uno solo con los 31 campos: cada envío reemplaza
 * solo lo suyo, así que abrir floración no puede pisar lo que alguien acaba de
 * cargar en trasplante. Además nadie llena treinta campos de una vez — se llenan
 * a medida que el cultivo avanza, que es justo lo que significa "hito".
 */
export function HitosDeEtapa({
  loteId,
  etapa,
  hitos,
}: {
  loteId: number;
  etapa: Etapa;
  hitos: Record<string, unknown>;
}) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(
    guardarHitosAction,
    {},
  );
  const cargados = etapa.campos.filter((c) => hitos[c.id] != null).length;

  return (
    <details className="tun-tarjeta p-5">
      <summary className="cursor-pointer text-[14px] font-semibold" style={{ color: "var(--tun-ink)" }}>
        {etapa.nombre}{" "}
        <span className="font-normal" style={{ color: cargados ? "var(--tun-ok)" : "var(--tun-muted)" }}>
          — {cargados} de {etapa.campos.length} campos
        </span>
      </summary>
      <form action={accion} className="mt-4 space-y-4 border-t pt-4" style={{ borderColor: "var(--tun-border)" }}>
        <input type="hidden" name="id" value={loteId} />
        <input type="hidden" name="etapa" value={etapa.id} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {etapa.campos.map((c) => (
            <CampoHito key={c.id} c={c} valor={hitos[c.id]} />
          ))}
        </div>
        <Aviso e={estado} />
        <button type="submit" disabled={pendiente} className="tun-boton">
          {pendiente ? "Guardando…" : `Guardar ${etapa.nombre.toLowerCase()}`}
        </button>
      </form>
    </details>
  );
}

export interface DatosLote {
  id: number;
  temporada: string | null;
  cultivo: string | null;
  variedad: string | null;
  relacionHm: string | null;
  hectareas: string | null;
  objetivo: string | null;
  clienteFinal: string | null;
  idase: string | null;
  tipoSemilla: string | null;
}

/** Los datos del contrato. Solo jefatura: no son cosas que se observen en el campo. */
export function EditarIdentificacion({ lote, area }: { lote: DatosLote; area: string }) {
  const [estado, accion, pendiente] = useActionState<Resultado, FormData>(
    guardarIdentificacionAction,
    {},
  );
  const esAltue = area === "altue";

  const campos: [string, string, string | null][] = [
    ["temporada", "Temporada", lote.temporada],
    ["cultivo", "Cultivo", lote.cultivo],
    ["variedad", esAltue ? "Variedad" : "Híbrido", lote.variedad],
    ["hectareas", "Superficie (ha)", lote.hectareas],
    ["objetivo", "Objetivo", lote.objetivo],
    ...((esAltue
      ? [
          ["relacionHm", "Relación H:M", lote.relacionHm],
          ["idase", "N° IDASE", lote.idase],
          ["clienteFinal", "Cliente", lote.clienteFinal],
        ]
      : [
          ["tipoSemilla", "Tipo de semilla", lote.tipoSemilla],
          ["clienteFinal", "Distribuidor", lote.clienteFinal],
        ]) as [string, string, string | null][]),
  ];

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="id" value={lote.id} />
      <div className="grid gap-4 sm:grid-cols-3">
        {campos.map(([name, etiqueta, valor]) => (
          <div key={name}>
            <label htmlFor={`i-${name}`} className="tun-etiqueta">
              {etiqueta}
            </label>
            <input id={`i-${name}`} name={name} defaultValue={valor ?? ""} className="tun-campo" />
          </div>
        ))}
      </div>
      {/* El código no está en la lista, y no es un olvido: es la identidad del
          lote y lo que enlaza sus visitas, sus informes y su historial. */}
      <p className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
        El código del lote no se edita: es lo que enlaza sus visitas, sus informes y su
        historial.
      </p>
      <Aviso e={estado} />
      <button type="submit" disabled={pendiente} className="tun-boton-suave">
        {pendiente ? "Guardando…" : "Guardar datos del lote"}
      </button>
    </form>
  );
}
