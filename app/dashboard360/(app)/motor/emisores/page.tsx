// Los emisores: cuota, warm-up, ventana horaria y salud de cada cuenta.
//
// Va en el grupo "Datos" del menú y no en "Prospección" porque responde la misma
// pregunta que Fuentes conectadas: ¿está saliendo lo que debería, o hay algo
// caído? Los dos badges son el mismo tipo de aviso.
//
// ── Por qué el pacing es código propio y no del proveedor ────────────────────
//
// Unipile declara literalmente que no impone límites de su lado: envía
// exactamente lo que le pidas, al volumen que le pidas. Todo el warm-up, la
// cuota, el jitter y la ventana horaria son nuestros. Es trabajo, y es también
// donde está el valor — es lo que evita quemar la cuenta.

import { Badge, Card, PageHeader, Tabla, Vacio } from "@/components/dashboard360/ui";
import BotonEnvio from "@/components/leads/BotonEnvio";
import { btnSecundario } from "@/components/dashboard360/ui";
import { estadoEmisores } from "@/lib/leads/cola";
import { actualizarEmisorAction } from "@/lib/leads/motor.actions";
import { PISO_ACEPTACION } from "@/lib/leads/motivo";
import { puedeDespachar, requireSesionMotor } from "@/lib/leads/sesion";

export const dynamic = "force-dynamic";

const WARMUP = [
  { semana: "1", invitaciones: "5", mensajes: "10" },
  { semana: "2", invitaciones: "8", mensajes: "20" },
  { semana: "3", invitaciones: "12", mensajes: "35" },
  { semana: "4", invitaciones: "16", mensajes: "50" },
  { semana: "5 y siguientes", invitaciones: "20–25 · techo", mensajes: "80–100" },
];

const ESTADOS = ["warmup", "activo", "frenado", "pausado", "restringido"];

export default async function Emisores() {
  const sesion = await requireSesionMotor();
  const manda = puedeDespachar(sesion);
  const emisores = await estadoEmisores();

  return (
    <>
      <PageHeader
        titulo="Emisores"
        bajada="La cuenta que envía. Sin cuota ni warm-up se queman cuentas, y una cuenta de LinkedIn restringida se lleva su historial con ella."
      />

      <Card
        className="mb-6"
        titulo="Cuentas configuradas"
        descripcion="Ninguno de estos números va en el código: LinkedIn no los publica y los modula por cuenta. La detección opera sobre la desviación respecto del baseline de cada cuenta, no sobre umbrales absolutos"
      >
        {emisores.length === 0 ? (
          <Vacio
            mensaje="No hay emisores"
            sugerencia="El setup crea uno en warm-up. Si no aparece, corré POST /api/leads/cron/setup."
          />
        ) : (
          <div className="space-y-4">
            {emisores.map((e) => (
              <form
                key={e.id}
                action={actualizarEmisorAction}
                className="rounded-lg border border-[var(--d360-border)] p-4"
              >
                <input type="hidden" name="id" value={e.id} />

                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--d360-ink)]">
                      {e.identificador}
                    </div>
                    <div className="d360-num text-[11.5px] text-[var(--d360-muted)]">
                      {e.tipo} · {e.usadosHoy} de {e.cuotaDiaria} usadas hoy ·{" "}
                      {typeof e.tasaAceptacion7d === "number"
                        ? `aceptación 7d ${e.tasaAceptacion7d}%`
                        : "sin datos de aceptación todavía"}
                    </div>
                  </div>
                  <Badge
                    tono={e.tono === "risk" ? "critico" : e.tono === "warn" ? "alerta" : "bueno"}
                  >
                    {e.resumen}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-[var(--d360-ink-2)]">
                      Cuota diaria
                    </span>
                    <input
                      type="number"
                      name="cuotaDiaria"
                      min={1}
                      max={25}
                      defaultValue={e.cuotaDiaria}
                      disabled={!manda}
                      className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2 py-1.5 text-[13px]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-[var(--d360-ink-2)]">
                      Día de warm-up
                    </span>
                    <input
                      type="number"
                      name="diaWarmup"
                      min={1}
                      defaultValue={e.diaWarmup}
                      disabled={!manda}
                      className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2 py-1.5 text-[13px]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-[var(--d360-ink-2)]">
                      Desde (hora CL)
                    </span>
                    <input
                      type="number"
                      name="ventanaInicio"
                      min={0}
                      max={23}
                      defaultValue={e.ventanaInicio}
                      disabled={!manda}
                      className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2 py-1.5 text-[13px]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-[var(--d360-ink-2)]">
                      Hasta (hora CL)
                    </span>
                    <input
                      type="number"
                      name="ventanaFin"
                      min={1}
                      max={24}
                      defaultValue={e.ventanaFin}
                      disabled={!manda}
                      className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2 py-1.5 text-[13px]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11.5px] text-[var(--d360-ink-2)]">
                      Estado
                    </span>
                    <select
                      name="estado"
                      defaultValue={e.estado}
                      disabled={!manda}
                      className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2 py-1.5 text-[13px]"
                    >
                      {ESTADOS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-3 block">
                  <span className="mb-1 block text-[11.5px] text-[var(--d360-ink-2)]">
                    Cuenta de Unipile
                  </span>
                  <input
                    type="text"
                    name="unipileAccountId"
                    defaultValue={""}
                    placeholder={
                      e.conectado ? "ya configurada · escribí para reemplazar" : "sin conectar"
                    }
                    disabled={!manda}
                    className="w-full rounded-md border border-[var(--d360-border)] bg-white px-2 py-1.5 text-[13px]"
                  />
                  <span className="mt-1 block text-[11px] text-[var(--d360-muted)]">
                    Mientras no esté, las campañas tienen que quedarse en modo simulado: el
                    despacho arma y registra todo, pero corta antes de la red.
                  </span>
                </label>

                {manda && (
                  <div className="mt-3">
                    <BotonEnvio className={btnSecundario} pendiente="Guardando…">
                      Guardar
                    </BotonEnvio>
                  </div>
                )}
              </form>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Warm-up · no negociable"
          descripcion="Una cuenta nueva que arranca en 20 invitaciones diarias es la forma más rápida de perderla, y el historial no se recupera"
        >
          <Tabla>
            <thead>
              <tr>
                <th>Semana</th>
                <th className="text-right">Invitaciones/día</th>
                <th className="text-right">Mensajes/día</th>
              </tr>
            </thead>
            <tbody>
              {WARMUP.map((w) => (
                <tr key={w.semana}>
                  <td>{w.semana}</td>
                  <td className="d360-num text-right">{w.invitaciones}</td>
                  <td className="d360-num text-right">{w.mensajes}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Card>

        <Card titulo="El freno automático">
          <p className="text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
            Si la tasa de aceptación de los últimos 7 días cae bajo{" "}
            <strong className="text-[var(--d360-ink)]">{PISO_ACEPTACION}%</strong>, el emisor
            deja de despachar y sus acciones aparecen en la banda «Frenado hoy» del panel con
            ese motivo.
          </p>
          <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
            <strong className="text-[var(--d360-ink)]">No es una alerta para que alguien
            decida.</strong> Es el sistema frenando solo, porque para cuando una persona lee la
            alerta la cuenta ya está en camino a una restricción. Reanudar es manual y a
            propósito: obliga a mirar qué se está mandando antes de volver a mandarlo.
          </p>
          <p className="mt-2.5 text-[12px] text-[var(--d360-muted)]">
            La aceptación es la única métrica que puede cerrar la cuenta. Las demás dicen si el
            negocio funciona; esta dice si el canal sigue existiendo.
          </p>
        </Card>
      </div>
    </>
  );
}
