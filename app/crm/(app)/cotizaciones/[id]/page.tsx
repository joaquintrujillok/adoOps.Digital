import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  Tabla,
  btnFantasma,
  btnPrimario,
  btnSecundario,
} from "@/components/crm/ui";
import BotonEnvio from "@/components/crm/BotonEnvio";
import {
  accionConvertirCotizacion,
  accionDescartarCotizacion,
  accionEnviarCotizacion,
} from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { documentoDe, obtenerCotizacion } from "@/lib/crm/cotizaciones";
import { clp, fecha, fechaHora, numero } from "@/lib/crm/formato";
import { CLAVES, leer } from "@/lib/crm/settings";
import { formatearTelefono } from "@/lib/crm/telefono";
import { estadoCandados } from "@/lib/crm/whatsapp-dispatch";

export const dynamic = "force-dynamic";

const ESTADO = {
  abierta: { tono: "neutro" as const, icono: "✎", texto: "Abierta" },
  enviada: { tono: "alerta" as const, icono: "→", texto: "Enviada" },
  convertida: { tono: "bueno" as const, icono: "✓", texto: "Convertida en venta" },
  descartada: { tono: "critico" as const, icono: "✕", texto: "Descartada" },
};

export default async function FichaCotizacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [cot, empresa, candados] = await Promise.all([
    obtenerCotizacion(Number(id)),
    leer(CLAVES.empresa),
    estadoCandados(),
  ]);
  if (!cot) notFound();

  const { cotizacion: q, items } = cot;
  const e = ESTADO[q.estado as keyof typeof ESTADO];
  const documento = documentoDe(cot, empresa ?? "la boutique");
  const cerrada = q.estado === "convertida" || q.estado === "descartada";

  return (
    <>
      <PageHeader
        titulo={`Cotización #${q.id}`}
        bajada={`${q.cotizanteNombre} · ${formatearTelefono(q.cotizanteTelefono)}${q.boutique ? ` · ${q.boutique}` : ""}`}
        acciones={
          <>
            <Link href="/crm/cotizaciones" className={btnSecundario}>
              ← Todas
            </Link>
            {q.contactId && (
              <Link href={`/crm/contactos/${q.contactId}`} className={btnSecundario}>
                Ver cliente
              </Link>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tono={e?.tono ?? "neutro"} icono={e?.icono}>
          {e?.texto ?? q.estado}
        </Badge>
        {!q.paraSiMismo && (
          <Badge tono="info" icono="🎁">
            Regalo{q.destinatarioNombre ? ` para ${q.destinatarioNombre}` : ""}
          </Badge>
        )}
        {q.editadaTrasEnvio && (
          <Badge tono="serio" icono="!">
            Editada después de enviarse
          </Badge>
        )}
        <span className="text-[13px] text-[var(--crm-muted)]">
          Creada {fecha(q.createdAt)}
          {q.enviadaEn ? ` · enviada ${fecha(q.enviadaEn)}` : ""}
        </span>
      </div>

      {q.editadaTrasEnvio && (
        <div className="mb-5 rounded-xl border border-[#f7d3c2] bg-[#fdeee7] px-5 py-3.5 text-[13px] text-[#8a3d18]">
          <strong>El cliente tiene un documento que ya no dice lo mismo.</strong> Esta
          cotización se editó después de haberse enviado. Conviene reenviarla antes de
          que llegue a la caja con otro número.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card titulo="Piezas cotizadas" padding={false}>
            <Tabla
              columnas={[
                "Pieza",
                { titulo: "Cant.", alinear: "der" },
                { titulo: "Precio", alinear: "der" },
                { titulo: "Descuento", alinear: "der" },
                { titulo: "Total", alinear: "der" },
              ]}
            >
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="font-medium">
                      {i.marca && <strong>{i.marca}</strong>} {i.productoNombre}
                    </div>
                    <div className="text-[12px] text-[var(--crm-muted)]">{i.sku}</div>
                  </td>
                  <td className="crm-num text-right">{numero(i.cantidad)}</td>
                  <td className="crm-num text-right">{clp(i.precioUnitario)}</td>
                  <td className="crm-num text-right">
                    {i.descuento > 0 ? `−${clp(i.descuento)}` : "—"}
                  </td>
                  <td className="crm-num text-right font-medium">{clp(i.total)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="text-right text-[var(--crm-ink-2)]">
                  Subtotal
                </td>
                <td className="crm-num text-right">{clp(q.subtotal)}</td>
              </tr>
              {cot.descuentoItems > 0 && (
                <tr>
                  <td colSpan={4} className="text-right text-[var(--crm-ink-2)]">
                    Descuento por pieza
                  </td>
                  <td className="crm-num text-right">−{clp(cot.descuentoItems)}</td>
                </tr>
              )}
              {q.descuentoGlobal > 0 && (
                <tr>
                  <td colSpan={4} className="text-right text-[var(--crm-ink-2)]">
                    Descuento adicional
                  </td>
                  <td className="crm-num text-right">−{clp(q.descuentoGlobal)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="text-right font-semibold">
                  Total
                </td>
                <td className="crm-num text-right text-[16px] font-semibold">
                  {clp(q.total)}
                </td>
              </tr>
            </Tabla>
          </Card>

          {!cerrada && (
            <Card
              titulo="Mensaje para el cliente"
              descripcion="Ajústalo antes de mandarlo. El cierre con la palabra BAJA se agrega solo y no se edita: es la salida del cliente."
            >
              <form action={accionEnviarCotizacion} className="space-y-3">
                <input type="hidden" name="quoteId" value={q.id} />
                <textarea
                  name="cuerpo"
                  rows={12}
                  defaultValue={documento}
                  className="w-full resize-y rounded-lg border border-[var(--crm-border)] px-3.5 py-3 font-mono text-[13px] leading-relaxed outline-none focus:border-[var(--crm-brand)]"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] text-[var(--crm-muted)]">
                    {candados.simulado
                      ? "Modo simulado: queda registrado en el hilo sin salir a la red."
                      : "Modo real: sale por WhatsApp si el número está autorizado."}
                  </p>
                  <BotonEnvio className={btnPrimario} pendiente="Enviando…">
                    {q.estado === "enviada" ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
                  </BotonEnvio>
                </div>
              </form>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card titulo="Estado">
            <dl className="space-y-2.5 text-[14px]">
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Total</dt>
                <dd className="crm-num font-semibold">{clp(q.total)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Piezas</dt>
                <dd className="crm-num">{numero(items.length)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Ejecutivo</dt>
                <dd>{cot.vendedor ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[var(--crm-ink-2)]">Creada</dt>
                <dd>{fechaHora(q.createdAt)}</dd>
              </div>
              {q.enviadaEn && (
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--crm-ink-2)]">Enviada</dt>
                  <dd>{fechaHora(q.enviadaEn)}</dd>
                </div>
              )}
              {q.convertidaEn && (
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--crm-ink-2)]">Convertida</dt>
                  <dd>{fechaHora(q.convertidaEn)}</dd>
                </div>
              )}
            </dl>
          </Card>

          {!cerrada && (
            <Card titulo="Cerrar la cotización">
              <div className="space-y-2">
                <form action={accionConvertirCotizacion}>
                  <input type="hidden" name="quoteId" value={q.id} />
                  <BotonEnvio className={`${btnPrimario} w-full`} pendiente="Registrando…">
                    ✓ Se vendió
                  </BotonEnvio>
                </form>
                <form action={accionDescartarCotizacion}>
                  <input type="hidden" name="quoteId" value={q.id} />
                  <BotonEnvio className={`${btnFantasma} w-full`} pendiente="Descartando…">
                    Descartar
                  </BotonEnvio>
                </form>
              </div>
              <p className="mt-2 text-[12px] text-[var(--crm-muted)]">
                Al marcarla como vendida se registra la venta en el historial del
                cliente y, si era prospecto, pasa a cliente.
              </p>
            </Card>
          )}

          {q.conversationId && (
            <Card titulo="Conversación">
              <Link
                href={`/crm/conversaciones?hilo=${q.conversationId}`}
                className={`${btnSecundario} w-full`}
              >
                ✆ Ver el hilo de WhatsApp
              </Link>
            </Card>
          )}

          <Lectura
            titulo="Por qué esta pantalla existe"
            resumen="El dato se captura antes de que exista una ficha"
          >
            <p>
              En el mostrador se cotiza de memoria y el teléfono se pierde. Acá el dato
              se captura antes de que exista una ficha, y la cotización queda vinculada
              al cliente y a su conversación desde el primer minuto.
            </p>
          </Lectura>
        </div>
      </div>
    </>
  );
}
