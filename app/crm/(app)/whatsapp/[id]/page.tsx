import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, Estado, PageHeader, btnPrimario, btnSecundario } from "@/components/crm/ui";
import { accionRedactarMensaje } from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { fechaHora } from "@/lib/crm/formato";
import { formatearTelefono } from "@/lib/crm/telefono";
import { hilo, listarPlantillas } from "@/lib/crm/whatsapp";
import { estadoCandados } from "@/lib/crm/whatsapp-dispatch";

export const dynamic = "force-dynamic";

export default async function HiloWhatsapp({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const conversationId = Number(id);

  const [datos, plantillas, candados] = await Promise.all([
    hilo(conversationId),
    listarPlantillas(),
    estadoCandados(),
  ]);
  if (!datos) notFound();

  const { conversacion, mensajes } = datos;

  return (
    <>
      <PageHeader
        titulo={datos.cuenta?.nombre ?? conversacion.nombre ?? formatearTelefono(conversacion.telefono)}
        bajada={`${formatearTelefono(conversacion.telefono)}${datos.contacto ? ` · ${datos.contacto.nombre}` : ""}`}
        acciones={
          <>
            {datos.cuenta && (
              <Link href={`/crm/cuentas/${datos.cuenta.id}`} className={btnSecundario}>
                Ver la cuenta
              </Link>
            )}
            <Link href="/crm/whatsapp" className={btnSecundario}>
              ← Bandeja
            </Link>
          </>
        }
      />

      {conversacion.baja && (
        <div className="mb-5 rounded-xl border border-[#f2c3c3] bg-[#fbe9e9] px-5 py-3.5 text-[13px] text-[#96201f]">
          <strong>Este contacto pidió no recibir más mensajes.</strong> El despacho
          retiene cualquier envío a este número, aunque alguien lo apruebe por error.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card titulo="Conversación" padding={false}>
            <ul className="max-h-[560px] space-y-3 overflow-y-auto p-5">
              {mensajes.length === 0 && (
                <li className="text-center text-[13px] text-[var(--crm-muted)]">
                  Todavía no hay mensajes en este hilo.
                </li>
              )}
              {mensajes.map((m) => (
                <li
                  key={m.id}
                  className={`flex ${m.direccion === "out" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                      m.direccion === "out"
                        ? "bg-[var(--crm-brand-soft)] text-[var(--crm-ink)]"
                        : "bg-[#f0f1f3] text-[var(--crm-ink)]"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.cuerpo}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--crm-muted)]">
                      <span>{fechaHora(m.enviadoEn ?? m.createdAt)}</span>
                      {m.direccion === "out" && <Estado estado={m.estado} />}
                      {m.automatico && <Badge tono="neutro">automático</Badge>}
                    </div>
                    {m.motivo && (
                      <p className="mt-1 text-[11px] text-[#96201f]">{m.motivo}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-[var(--crm-grid)] p-5">
              <form action={accionRedactarMensaje} className="space-y-2">
                <input type="hidden" name="conversationId" value={conversationId} />
                <textarea
                  name="cuerpo"
                  rows={3}
                  required
                  placeholder="Escribe el mensaje…"
                  className="w-full resize-y rounded-lg border border-[var(--crm-border)] px-3 py-2 text-[13px] outline-none focus:border-[var(--crm-brand)]"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-[var(--crm-muted)]">
                    {candados.simulado
                      ? "Modo simulado: quedará registrado sin salir a la red."
                      : "Modo real: sale por WaSender si el número está autorizado."}
                  </p>
                  <button type="submit" className={btnPrimario} disabled={conversacion.baja}>
                    Enviar
                  </button>
                </div>
              </form>
            </div>
          </Card>
        </div>

        <Card
          titulo="Plantillas"
          descripcion="Cópialas y ajústalas. Las variables entre llaves se reemplazan al generarlas desde una alerta."
          padding={false}
        >
          <ul className="divide-y divide-[var(--crm-grid)]">
            {plantillas.map((p) => (
              <li key={p.id} className="px-5 py-3.5">
                <div className="text-[13px] font-medium text-[var(--crm-ink)]">
                  {p.nombre}
                </div>
                <p className="mt-1 whitespace-pre-line text-[13px] text-[var(--crm-ink-2)]">
                  {p.cuerpo}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
