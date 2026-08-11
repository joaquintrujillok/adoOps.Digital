import Link from "next/link";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  Severidad,
  StatTile,
  Vacio,
  btnPrimario,
  btnSecundario,
  btnFantasma,
} from "@/components/crm/ui";
import { Medidor } from "@/components/crm/charts";
import BotonEnvio from "@/components/crm/BotonEnvio";
import {
  accionPrepararWhatsapp,
  accionRecalcularAlertas,
  accionResolverAlerta,
} from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, numero, relativo } from "@/lib/crm/formato";
import { listarAlertas, type AccionSugerida } from "@/lib/crm/insights";
import { narrar } from "@/lib/crm/narrador";
import { scoresDeCuentas } from "@/lib/crm/scoring";

export const dynamic = "force-dynamic";

/** Cada acción sugerida se traduce a un control concreto. */
function Accion({ alertaId, accion }: { alertaId: number; accion: AccionSugerida }) {
  if (accion.accion === "whatsapp") {
    return (
      <form action={accionPrepararWhatsapp}>
        <input type="hidden" name="alertaId" value={alertaId} />
        <BotonEnvio className={btnPrimario} pendiente="Preparando…">
          ✆ {accion.etiqueta}
        </BotonEnvio>
      </form>
    );
  }

  const destino =
    accion.accion === "abrir_deal"
      ? `/crm/oportunidades/${accion.dealId}`
      : accion.accion === "abrir_cuenta"
        ? `/crm/cuentas/${accion.accountId}`
        : accion.accion === "abrir_producto"
          ? "/crm/productos"
          : "/crm/marketing";

  return (
    <Link href={destino} className={btnSecundario}>
      {accion.etiqueta} →
    </Link>
  );
}

export default async function Inteligencia() {
  await requireSession();

  const [alertas, scores] = await Promise.all([
    listarAlertas("abierta"),
    scoresDeCuentas(),
  ]);

  const porSeveridad = {
    alta: alertas.filter((a) => a.severidad === "alta"),
    media: alertas.filter((a) => a.severidad === "media"),
    baja: alertas.filter((a) => a.severidad === "baja"),
  };
  const conAccion = alertas.filter((a) => a.accionSugerida).length;
  const topCuentas = scores.slice(0, 6);

  const respaldo = alertas.length
    ? `Hay ${alertas.length} alertas abiertas: ${porSeveridad.alta.length} altas, ${porSeveridad.media.length} medias y ${porSeveridad.baja.length} bajas. ${conAccion} traen una acción concreta asociada. Conviene partir por las de severidad alta, que son las que tienen plata o plazo comprometido.`
    : "No hay alertas abiertas. El motor revisa oportunidades estancadas, cierres vencidos, caídas de facturación, ventanas de recompra, stock comprometido, cuentas de alto potencial desatendidas, cross-selling y campañas sin retorno.";

  const narracion = await narrar(
    {
      alertasAbiertas: alertas.length,
      altas: porSeveridad.alta.length,
      medias: porSeveridad.media.length,
      bajas: porSeveridad.baja.length,
      conAccionSugerida: conAccion,
      tiposPresentes: [...new Set(alertas.map((a) => a.tipo))],
      titulares: alertas.slice(0, 5).map((a) => a.titulo),
    },
    "Bandeja de alertas comerciales: por dónde debería partir el equipo hoy",
    respaldo,
  );

  return (
    <>
      <PageHeader
        titulo="Alertas y acciones"
        bajada="Lo que el CRM detectó solo, con qué hacer al respecto. Las reglas y sus umbrales se editan en Configuración."
        acciones={
          <form action={accionRecalcularAlertas}>
            <BotonEnvio className={btnSecundario} pendiente="Analizando…">
              ↻ Volver a analizar
            </BotonEnvio>
          </form>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Alertas abiertas" valor={numero(alertas.length)} deltaBueno="abajo" />
        <StatTile etiqueta="Severidad alta" valor={numero(porSeveridad.alta.length)} deltaBueno="abajo" />
        <StatTile etiqueta="Con acción lista" valor={numero(conAccion)} contexto="ejecutables desde acá" />
        <StatTile
          etiqueta="Cuentas de alto potencial"
          valor={numero(scores.filter((s) => s.score >= 70).length)}
          contexto="puntaje 70 o más"
        />
      </div>

      <div className="mb-6">
        <Lectura
          titulo="Por dónde partir"
          fuente={
            narracion.origen === "ia"
              ? "Redactado por el asistente sobre alertas calculadas por reglas."
              : "Redactado con plantilla sobre alertas calculadas por reglas."
          }
        >
          <p>{narracion.texto}</p>
        </Lectura>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card titulo="Bandeja de alertas" padding={false}>
            {alertas.length === 0 ? (
              <div className="p-5">
                <Vacio
                  mensaje="Sin alertas abiertas"
                  sugerencia="Usa «Volver a analizar» después de cargar datos o de cambiar los umbrales."
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--crm-grid)]">
                {alertas.map((a) => (
                  <li key={a.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <Severidad nivel={a.severidad} />
                          <Badge tono="neutro">{a.tipo.replace(/_/g, " ")}</Badge>
                          <span className="text-[12px] text-[var(--crm-muted)]">
                            {relativo(a.generadaEn)}
                          </span>
                        </div>
                        <div className="text-[14px] font-medium text-[var(--crm-ink)]">
                          {a.titulo}
                        </div>
                        {a.detalle && (
                          <p className="mt-0.5 text-[13px] text-[var(--crm-ink-2)]">
                            {a.detalle}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {a.accionSugerida ? (
                          <Accion
                            alertaId={a.id}
                            accion={a.accionSugerida as AccionSugerida}
                          />
                        ) : null}
                        <form action={accionResolverAlerta}>
                          <input type="hidden" name="alertaId" value={a.id} />
                          <input type="hidden" name="estado" value="atendida" />
                          <button type="submit" className={btnFantasma} title="Marcar como atendida">
                            ✓ Atendida
                          </button>
                        </form>
                        <form action={accionResolverAlerta}>
                          <input type="hidden" name="alertaId" value={a.id} />
                          <input type="hidden" name="estado" value="descartada" />
                          <button type="submit" className={btnFantasma} title="Descartar">
                            ✕
                          </button>
                        </form>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card
          titulo="Cuentas con más potencial"
          descripcion="Puntaje explicable, no una caja negra"
          padding={false}
        >
          {topCuentas.length === 0 ? (
            <div className="p-5">
              <Vacio mensaje="Sin cuentas para puntuar" />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--crm-grid)]">
              {topCuentas.map((s) => (
                <li key={s.accountId} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <Medidor score={s.score} tamano={42} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/crm/cuentas/${s.accountId}`}
                        className="text-[14px] font-medium hover:text-[var(--crm-brand-dark)]"
                      >
                        {s.nombre}
                      </Link>
                      <p className="mt-0.5 text-[12px] leading-snug text-[var(--crm-ink-2)]">
                        {s.resumen}
                      </p>
                      <div className="crm-num mt-1 text-[12px] text-[var(--crm-muted)]">
                        {clp(s.facturado12m)} en 12 meses ·{" "}
                        {s.montoAbierto > 0 ? `${clp(s.montoAbierto)} abiertos` : "sin pipeline"}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
