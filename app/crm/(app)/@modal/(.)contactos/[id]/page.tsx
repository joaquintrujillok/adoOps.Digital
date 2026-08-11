// El contacto en un modal, sin sacar a nadie de donde estaba.
//
// Es una ruta interceptada: el mismo `/crm/contactos/[id]` de siempre. Navegando
// desde adentro del CRM se abre acá encima; recargando o llegando por un link
// pegado se pinta la ficha 360 completa. Esa es la ventaja de resolverlo con el
// mecanismo de Next en vez de con un estado local: la URL sigue sirviendo para
// mandársela a alguien.
//
// Lo que va acá es identidad, plata y trazabilidad —de dónde salió y qué pasó
// después—, no la ficha entera. Si el modal repitiera la ficha, no habría razón
// para tener las dos.

import Link from "next/link";
import { notFound } from "next/navigation";
import Modal from "@/components/crm/Modal";
import { Badge, Estado, btnPrimario, btnSecundario } from "@/components/crm/ui";
import { requireSession } from "@/lib/crm/auth.actions";
import { fichaCliente } from "@/lib/crm/contactos";
import { clp, fecha, numero, relativo } from "@/lib/crm/formato";
import { formatearTelefono } from "@/lib/crm/telefono";

export const dynamic = "force-dynamic";

const ICONO: Record<string, string> = {
  nota: "✎",
  llamada: "✆",
  correo: "✉",
  whatsapp: "✆",
  reunion: "◍",
  tarea: "☑",
};

export default async function ContactoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const ficha = await fichaCliente(Number(id));
  if (!ficha) notFound();

  const { contacto, totales } = ficha;
  const origen = ficha.recorrido[ficha.recorrido.length - 1];
  const movimientos = ficha.actividades.slice(0, 6);

  return (
    <Modal
      titulo={contacto.nombre}
      bajada={[formatearTelefono(contacto.telefono), contacto.email, contacto.ciudad]
        .filter(Boolean)
        .join(" · ")}
      pie={
        <>
          {ficha.conversationId && (
            <Link
              href={`/crm/conversaciones?hilo=${ficha.conversationId}`}
              className={btnSecundario}
            >
              ✆ Conversación
            </Link>
          )}
          <Link href={`/crm/contactos/${contacto.id}`} className={btnSecundario}>
            Ficha completa
          </Link>
          <Link
            href={`/crm/cotizaciones?nueva=1&contacto=${contacto.id}`}
            className={btnPrimario}
          >
            + Cotizar
          </Link>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Estado estado={contacto.estado} />
        {(contacto.etiquetas ?? []).map((e) => (
          <Badge key={e} tono="marca">
            {e}
          </Badge>
        ))}
        {contacto.fuente && <Badge tono="info">Llegó por {contacto.fuente}</Badge>}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
        <div>
          <dt className="text-[var(--crm-muted)]">Comprado</dt>
          <dd className="crm-num font-medium">{clp(totales.facturado)}</dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Compras</dt>
          <dd className="crm-num font-medium">{numero(totales.compras)}</dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Ticket</dt>
          <dd className="crm-num font-medium">{clp(totales.ticketPromedio)}</dd>
        </div>
        <div>
          <dt className="text-[var(--crm-muted)]">Pipeline</dt>
          <dd className="crm-num font-medium">{clp(totales.montoAbierto)}</dd>
        </div>
      </dl>

      <dl className="mt-3 space-y-1.5 border-t border-[var(--crm-grid)] pt-3 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--crm-muted)]">Dueño</dt>
          <dd className="text-right">{ficha.owner ?? "sin asignar"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--crm-muted)]">Recompra</dt>
          <dd className="text-right">
            {totales.cicloRecompraDias
              ? `cada ${totales.cicloRecompraDias} días · lleva ${totales.diasSinComprar}`
              : "sin patrón todavía"}
          </dd>
        </div>
        {totales.marcaHabitual && (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--crm-muted)]">Suele elegir</dt>
            <dd className="text-right">{totales.marcaHabitual}</dd>
          </div>
        )}
      </dl>

      {/* Trazabilidad: de dónde salió y qué pasó después. Un modal que solo
          muestra los datos de contacto no dice nada que no diga la lista. */}
      <div className="mt-4 border-t border-[var(--crm-grid)] pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
          Trazabilidad
        </div>

        {origen ? (
          <p className="mt-1.5 text-[13px] text-[var(--crm-ink-2)]">
            Primer toque el {fecha(origen.fecha)}
            {origen.campana ? ` · ${origen.campana}` : ""}
            {origen.canal ? ` (${origen.canal})` : ""}
          </p>
        ) : (
          <p className="mt-1.5 text-[13px] text-[var(--crm-muted)]">
            Sin recorrido de marketing registrado.
          </p>
        )}

        {movimientos.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--crm-muted)]">
            Todavía no hay actividad registrada.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {movimientos.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2 text-[13px]">
                <span aria-hidden className="w-4 shrink-0 text-center text-[var(--crm-muted)]">
                  {ICONO[a.tipo] ?? "•"}
                </span>
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
