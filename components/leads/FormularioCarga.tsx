"use client";

// La carga del CSV, con el resultado a la vista.
//
// Es de cliente porque lo que importa no es subir el archivo: es **mostrar qué
// pasó con cada fila**. Una importación que dice "listo" y se comió 40 filas
// por RUT inválido es peor que una que falla, porque el hueco se descubre tres
// semanas después, cuando la campaña tiene menos gente de la que debía.

import { useActionState } from "react";
import BotonEnvio from "@/components/crm/BotonEnvio";
import { Badge, Card, StatTile, btnPrimario } from "@/components/crm/ui";
import { cargarCsvAction, type EstadoCarga } from "@/lib/leads/carga.actions";

const campo =
  "w-full rounded-lg border border-[var(--crm-border)] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--crm-brand)]";
const etiqueta = "text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]";

const ORIGENES = [
  { id: "sii", nombre: "Nómina del SII" },
  { id: "csv", nombre: "CSV armado a mano" },
  { id: "prospeo", nombre: "Exportación de Prospeo" },
  { id: "fullenrich", nombre: "Exportación de FullEnrich" },
  { id: "linkedin", nombre: "Exportación de LinkedIn / Sales Navigator" },
  { id: "chilecompra", nombre: "ChileCompra" },
  { id: "manual", nombre: "Carga manual" },
];

export default function FormularioCarga() {
  const [estado, accion] = useActionState<EstadoCarga, FormData>(cargarCsvAction, {});
  const r = estado.resultado;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <Card titulo="Archivo">
        <form action={accion} className="grid gap-4">
          <div className="grid gap-1">
            <label className={etiqueta} htmlFor="archivo">
              CSV
            </label>
            <input id="archivo" name="archivo" type="file" accept=".csv,text/csv" required className={campo} />
          </div>

          <div className="grid gap-1">
            <label className={etiqueta} htmlFor="origen">
              De dónde viene
            </label>
            <select id="origen" name="origen" defaultValue="sii" className={campo}>
              {ORIGENES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
            {/* Esto no es un campo administrativo: es la mitad de la promesa de
                poder decir de dónde salió cada dato. */}
            <p className="text-[12px] text-[var(--crm-muted)]">
              Queda guardado por campo, junto con la fecha. Es lo que permite contestar
              después de dónde salió cada contacto.
            </p>
          </div>

          <BotonEnvio className={btnPrimario} pendiente="Importando…">
            Importar
          </BotonEnvio>

          {estado.error && (
            <p className="text-[13px] text-[#96201f]">{estado.error}</p>
          )}
        </form>
      </Card>

      <div className="grid gap-4">
        {!r ? (
          <Card titulo="Qué espera el archivo">
            <p className="text-[13px] text-[var(--crm-ink-2)]">
              Una fila por empresa, con al menos <code>rut</code> y <code>razon_social</code>. Los
              nombres de columna se reconocen con o sin tildes y en cualquier mayúscula.
            </p>
            <p className="mt-2 text-[13px] text-[var(--crm-ink-2)]">
              Opcionales: <code>acteco</code>, <code>region</code>, <code>comuna</code>,{" "}
              <code>tramo_ventas</code>, <code>dominio</code>, <code>prospeo_email</code>,{" "}
              <code>fullenrich_email</code>, <code>linkedin_url</code>, <code>cargo</code>.
            </p>
            <p className="mt-2 text-[13px] text-[var(--crm-muted)]">
              El RUT se normaliza a <code>12345678-9</code> y se le recalcula el dígito
              verificador. Si no cuadra, la fila se rechaza y aparece listada — un RUT que no
              cuadra no cruza contra el SII ni contra ChileCompra.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile etiqueta="Filas leídas" valor={String(r.filas)} />
              <StatTile etiqueta="Empresas nuevas" valor={String(r.empresasNuevas)} contexto={`${r.empresasActualizadas} ya existían`} />
              <StatTile etiqueta="Contactos nuevos" valor={String(r.personasNuevas)} />
              <StatTile
                etiqueta="Rechazadas"
                valor={String(r.rechazadas.length)}
                contexto={r.rechazadas.length ? "revisa el detalle" : "ninguna"}
              />
            </div>

            <Card titulo="Columnas">
              <div className="flex flex-wrap gap-1.5">
                {r.columnasReconocidas.map((c) => (
                  <Badge key={c} tono="bueno">
                    {c}
                  </Badge>
                ))}
                {r.columnasIgnoradas.map((c) => (
                  <Badge key={c} tono="neutro">
                    {c} · ignorada
                  </Badge>
                ))}
              </div>
            </Card>

            {r.rechazadas.length > 0 && (
              <Card titulo={`Filas rechazadas (${r.rechazadas.length})`}>
                <ul className="grid gap-1 text-[13px] text-[var(--crm-ink-2)]">
                  {r.rechazadas.slice(0, 50).map((x, i) => (
                    <li key={i}>
                      <span className="text-[var(--crm-muted)]">línea {x.fila}:</span> {x.motivo}
                    </li>
                  ))}
                </ul>
                {r.rechazadas.length > 50 && (
                  <p className="mt-2 text-[12px] text-[var(--crm-muted)]">
                    …y {r.rechazadas.length - 50} más. Se muestran las primeras 50 para que la
                    página siga siendo legible; el resto está en el mismo patrón.
                  </p>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
