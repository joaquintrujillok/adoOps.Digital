// La oportunidad en un modal, sin salir del tablero.
//
// Misma mecánica que el modal de contacto: ruta interceptada sobre
// `/crm/oportunidades/[id]`. Desde el kanban abre encima; recargando entrega la
// ficha completa con productos, stock y bitácora entera.

import Link from "next/link";
import { notFound } from "next/navigation";
import Modal from "@/components/crm/Modal";
import { Badge, btnSecundario } from "@/components/crm/ui";
import MoverEtapa from "@/components/crm/MoverEtapa";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, fecha, numero, relativo } from "@/lib/crm/formato";
import { probabilidadDe } from "@/lib/crm/etapas";
import { fichaDeal } from "@/lib/crm/pipeline";

export const dynamic = "force-dynamic";

export default async function OportunidadModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const dealId = Number(id);
  const ficha = await fichaDeal(dealId);
  if (!ficha) notFound();

  const { deal } = ficha;
  const faltantes = ficha.items.filter(
    (i) => i.disponible !== null && i.disponible < i.cantidad,
  );

  return (
    <Modal
      titulo={deal.titulo}
      bajada={[ficha.cliente?.nombre, ficha.owner ?? "sin dueño"]
        .filter(Boolean)
        .join(" · ")}
      pie={
        <>
          {ficha.cliente && (
            <Link href={`/crm/contactos/${ficha.cliente.id}`} className={btnSecundario}>
              Ver el contacto
            </Link>
          )}
          <Link href={`/crm/oportunidades/${deal.id}`} className={btnSecundario}>
            Ficha completa
          </Link>
        </>
      }
    >
      {/* Solo el selector, sin una etiqueta de estado al lado: las dos dirían
          "Nuevo" y una de ellas además deja cambiarlo. */}
      <MoverEtapa dealId={deal.id} etapa={deal.etapa} compacto />

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-[var(--crm-muted)]">Valor</dt>
          <dd className="crm-num font-medium">{clp(deal.monto)}</dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Probabilidad</dt>
          <dd className="crm-num font-medium">{deal.probabilidad}%</dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Ponderado</dt>
          <dd className="crm-num font-medium">
            {clp(Math.round((deal.monto * deal.probabilidad) / 100))}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Cierre estimado</dt>
          <dd className="font-medium">
            {deal.cierreEstimado ? fecha(deal.cierreEstimado) : "sin fecha"}
          </dd>
        </div>
      </dl>

      {/* La probabilidad de la etapa contra la del negocio: cuando el vendedor
          la sobrescribió a mano, saberlo cambia cómo se lee la proyección. */}
      {deal.probabilidad !== probabilidadDe(deal.etapa) && (
        <p className="mt-2 text-[12px] text-[var(--crm-ink-2)]">
          La etapa {deal.etapa} vale {probabilidadDe(deal.etapa)}% por defecto; esta
          oportunidad tiene la probabilidad ajustada a mano.
        </p>
      )}

      {ficha.items.length > 0 && (
        <div className="mt-4 border-t border-[var(--crm-grid)] pt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
            Piezas
          </div>
          <ul className="mt-2 space-y-1.5">
            {ficha.items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">
                  {i.nombre}
                  {i.cantidad > 1 && (
                    <span className="text-[var(--crm-muted)]"> ×{numero(i.cantidad)}</span>
                  )}
                </span>
                {i.disponible !== null && i.disponible < i.cantidad && (
                  <Badge tono="critico" icono="!">
                    {i.disponible} en bodega
                  </Badge>
                )}
                <span className="crm-num shrink-0 text-[var(--crm-ink-2)]">
                  {clp(i.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          {faltantes.length > 0 && (
            <p className="mt-2 text-[12px] text-[#96201f]">
              Este negocio depende de reponer {faltantes.length === 1 ? "una pieza" : `${faltantes.length} piezas`} antes de cerrar.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-[var(--crm-grid)] pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
          Bitácora
        </div>
        {ficha.actividades.length === 0 ? (
          <p className="mt-1.5 text-[13px] text-[var(--crm-muted)]">
            Sin movimientos registrados.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {ficha.actividades.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{a.titulo}</span>
                <span className="shrink-0 text-[12px] text-[var(--crm-muted)]">
                  {relativo(a.ocurridoEn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
