// El detalle de una oportunidad: mover, editar y registrar lo que pasó.
//
// La historia va abajo y ocupa lo que necesite. Es lo que convierte una ficha en
// algo que se puede retomar tres meses después: el estado actual lo dice la
// etapa, pero "¿por qué se movió y cuándo?" solo lo dice el registro.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  PageHeader,
  btnPrimario,
  btnSecundario,
} from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { detalle } from "@/lib/venta/consultas";
import {
  editarOportunidadAction,
  moverEtapaAction,
  registrarActividadAction,
} from "@/lib/venta/acciones";
import {
  ETAPAS,
  esCerrada,
  nombreEtapa,
  nombreFuente,
  TIPOS_ACTIVIDAD,
} from "@/lib/venta/etapas";

export const dynamic = "force-dynamic";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

const campo =
  "rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]";

export default async function OportunidadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  const dato = await detalle(numero);
  if (!dato) notFound();

  const { oportunidad: o, contacto, empresa, actividades } = dato;
  const cerrada = esCerrada(o.etapa);

  return (
    <>
      <div className="mb-3">
        <Link
          href="/dashboard360/crm"
          className="text-[12.5px] text-[var(--d360-muted)] hover:text-[var(--d360-brand-dark)]"
        >
          ← Pipeline
        </Link>
      </div>

      <PageHeader
        titulo={o.titulo}
        bajada={[
          contacto.nombre,
          contacto.cargo,
          empresa?.nombre,
          nombreFuente(o.fuente),
        ]
          .filter(Boolean)
          .join(" · ")}
        acciones={
          <Badge
            tono={
              o.etapa === "ganado" ? "bueno" : o.etapa === "perdido" ? "critico" : "neutro"
            }
          >
            {nombreEtapa(o.etapa)}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {!cerrada ? (
            <Card titulo="Mover" descripcion="Cada movimiento queda registrado abajo">
              <div className="flex flex-wrap gap-2">
                {ETAPAS.filter((e) => e.id !== o.etapa).map((e) => (
                  <form key={e.id} action={moverEtapaAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <input type="hidden" name="etapa" value={e.id} />
                    <button
                      className={e.id === "ganado" ? btnPrimario : btnSecundario}
                      type="submit"
                    >
                      {e.nombre}
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          ) : (
            <Card titulo={nombreEtapa(o.etapa)}>
              <p className="text-[13px] text-[var(--d360-ink-2)]">
                Cerrada el {o.cerradoEn ? FECHA.format(o.cerradoEn) : "—"}.
                {o.motivoPerdida ? ` Motivo: ${o.motivoPerdida}` : ""}
              </p>
              <form action={moverEtapaAction} className="mt-3">
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="etapa" value="negociacion" />
                {/* Reabrir existe porque los negocios vuelven. Deja su propia
                    línea en la historia, así que no borra el cierre. */}
                <button className={btnSecundario} type="submit">
                  Reabrir en negociación
                </button>
              </form>
            </Card>
          )}

          <Card titulo="Registrar lo que pasó">
            <form action={registrarActividadAction} className="space-y-3">
              <input type="hidden" name="id" value={o.id} />
              <div className="flex flex-wrap gap-3">
                <label className="text-[12px] text-[var(--d360-ink-2)]">
                  <span className="mb-1 block">Tipo</span>
                  <select name="tipo" className={campo}>
                    {TIPOS_ACTIVIDAD.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <textarea
                name="detalle"
                required
                rows={3}
                className={`${campo} w-full`}
                placeholder="Qué se conversó, qué quedó pendiente"
              />
              <button className={btnPrimario} type="submit">
                Registrar
              </button>
            </form>
          </Card>

          <Card
            titulo="Historia"
            descripcion={
              actividades.length === 0
                ? "Nada todavía"
                : `${actividades.length} ${actividades.length === 1 ? "registro" : "registros"}`
            }
          >
            {actividades.length === 0 ? (
              <p className="text-[13px] text-[var(--d360-muted)]">
                Todo lo que pase con esta oportunidad va a quedar acá.
              </p>
            ) : (
              <div className="space-y-3">
                {actividades.map((a) => (
                  <div
                    key={a.id}
                    className="border-l-2 border-[var(--d360-border)] pl-3"
                  >
                    <p className="d360-num text-[11px] text-[var(--d360-muted)]">
                      {FECHA.format(a.ocurrioEn)} · {a.tipo}
                      {a.autor ? ` · ${a.autor}` : ""}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
                      {a.detalle}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Números">
            <form action={editarOportunidadAction} className="space-y-3">
              <input type="hidden" name="id" value={o.id} />
              <label className="block text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Monto (CLP)</span>
                <input
                  name="monto"
                  type="number"
                  min="0"
                  step="1000"
                  defaultValue={o.monto}
                  className={`${campo} w-full`}
                />
              </label>
              <label className="block text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Probabilidad (%)</span>
                {/* Se puede corregir a mano: la etapa dice en qué parte del
                    proceso está, pero la probabilidad es un juicio sobre ESTE
                    negocio y quien vende sabe más que la tabla. Ojo: mover de
                    etapa la vuelve a sembrar. */}
                <input
                  name="probabilidad"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={o.probabilidad}
                  className={`${campo} w-full`}
                />
              </label>
              <label className="block text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Cierre estimado</span>
                <input
                  name="cierreEstimado"
                  type="date"
                  defaultValue={o.cierreEstimado ?? ""}
                  className={`${campo} w-full`}
                />
              </label>
              <button className={btnSecundario} type="submit">
                Guardar
              </button>
            </form>
            <p className="d360-num mt-3 border-t border-[var(--d360-border)] pt-3 text-[12px] text-[var(--d360-muted)]">
              Ponderado: {CLP.format((o.monto * o.probabilidad) / 100)}
            </p>
          </Card>

          <Card titulo="Contacto">
            <p className="text-[13.5px] font-medium text-[var(--d360-ink)]">
              {contacto.nombre}
            </p>
            {contacto.cargo ? (
              <p className="text-[12.5px] text-[var(--d360-muted)]">{contacto.cargo}</p>
            ) : null}
            {empresa ? (
              <p className="mt-1 text-[12.5px] text-[var(--d360-ink-2)]">{empresa.nombre}</p>
            ) : null}
            <div className="d360-num mt-3 space-y-1 text-[12px] text-[var(--d360-ink-2)]">
              {contacto.email ? <p>{contacto.email}</p> : null}
              {contacto.telefono ? <p>{contacto.telefono}</p> : null}
              {contacto.linkedin ? (
                <a
                  href={contacto.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[var(--d360-brand-dark)] hover:underline"
                >
                  LinkedIn
                </a>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
