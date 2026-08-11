import Link from "next/link";
import {
  Badge,
  Card,
  Estado,
  Lectura,
  PageHeader,
  StatTile,
  Vacio,
  btnPrimario,
  btnFantasma,
} from "@/components/crm/ui";
import BotonEnvio from "@/components/crm/BotonEnvio";
import {
  accionAprobarMensaje,
  accionAprobarTodos,
  accionDescartarMensaje,
} from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { fechaHora, numero, relativo } from "@/lib/crm/formato";
import { formatearTelefono } from "@/lib/crm/telefono";
import { bandeja, porRevisar } from "@/lib/crm/whatsapp";
import { estadoCandados } from "@/lib/crm/whatsapp-dispatch";

export const dynamic = "force-dynamic";

export default async function Whatsapp() {
  await requireSession();

  const [conversaciones, pendientes, candados] = await Promise.all([
    bandeja(),
    porRevisar(),
    estadoCandados(),
  ]);

  const borradores = pendientes.filter((p) => p.m.estado === "draft");
  const problemas = pendientes.filter((p) => p.m.estado !== "draft");

  return (
    <>
      <PageHeader
        titulo="WhatsApp"
        bajada="La bandeja comercial. Nada sale sin pasar por los candados de abajo, y nada se envía sin que una persona lo apruebe."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Conversaciones" valor={numero(conversaciones.length)} />
        <StatTile
          etiqueta="Borradores por revisar"
          valor={numero(borradores.length)}
          contexto="esperan aprobación humana"
        />
        <StatTile
          etiqueta="Retenidos o fallidos"
          valor={numero(problemas.length)}
          contexto="con el motivo escrito"
          deltaBueno="abajo"
        />
        <StatTile
          etiqueta="Modo"
          valor={candados.simulado ? "Simulado" : "Real"}
          contexto={
            candados.simulado
              ? "los mensajes no salen a la red"
              : `${candados.autorizados} números en lista blanca`
          }
        />
      </div>

      <div className="mb-6">
        <Lectura titulo="Cómo está protegido esto">
          <p>
            Todo mensaje saliente atraviesa cuatro controles antes de existir siquiera
            como intento: <strong>aprobación de una persona</strong> (nada nace
            aprobado),{" "}
            <strong>
              {candados.habilitado ? "interruptor general encendido" : "interruptor general APAGADO"}
            </strong>
            , <strong>respeto de la palabra BAJA</strong> y{" "}
            <strong>lista blanca de destinatarios</strong>, que falla cerrado: si la
            lista está vacía, no sale nada.
          </p>
          <p>
            {candados.simulado
              ? "Ahora mismo el módulo está en modo simulado: los mensajes se registran con estado «Simulado» y no tocan la red. Es el modo correcto para mostrar el flujo sin escribirle a nadie de verdad."
              : `El módulo está en modo real: los mensajes salen por WaSender a los ${candados.autorizados} números autorizados.`}{" "}
            Se cambia en Configuración.
          </p>
        </Lectura>
      </div>

      {borradores.length > 0 && (
        <div className="mb-6">
          <Card
            titulo={`${borradores.length} borradores esperando aprobación`}
            descripcion="Generados por las acciones sugeridas de las alertas. Léelos antes de aprobar."
            acciones={
              <form action={accionAprobarTodos}>
                <input
                  type="hidden"
                  name="messageIds"
                  value={borradores.map((b) => b.m.id).join(",")}
                />
                <BotonEnvio className={btnPrimario} pendiente="Enviando…">
                  Aprobar y enviar los {borradores.length}
                </BotonEnvio>
              </form>
            }
            padding={false}
          >
            <ul className="divide-y divide-[var(--crm-grid)]">
              {borradores.map((b) => (
                <li key={b.m.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 text-[13px]">
                        <span className="font-medium">
                          {b.cuenta ?? b.nombre ?? "Sin cuenta"}
                        </span>
                        <span className="crm-num text-[var(--crm-muted)]">
                          {formatearTelefono(b.telefono)}
                        </span>
                      </div>
                      <p className="whitespace-pre-line rounded-lg bg-[#f4f6f8] px-3 py-2 text-[13px] text-[var(--crm-ink)]">
                        {b.m.cuerpo}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <form action={accionAprobarMensaje}>
                        <input type="hidden" name="messageId" value={b.m.id} />
                        <BotonEnvio className={btnPrimario} pendiente="Enviando…">
                          Aprobar y enviar
                        </BotonEnvio>
                      </form>
                      <form action={accionDescartarMensaje}>
                        <input type="hidden" name="messageId" value={b.m.id} />
                        <button type="submit" className={btnFantasma} title="Descartar">
                          ✕
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {problemas.length > 0 && (
        <div className="mb-6">
          <Card
            titulo="Mensajes retenidos o fallidos"
            descripcion="Retenido no es un error: es el sistema funcionando como se diseñó"
            padding={false}
          >
            <ul className="divide-y divide-[var(--crm-grid)]">
              {problemas.map((p) => (
                <li key={p.m.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Estado estado={p.m.estado} />
                      <span className="crm-num text-[12px] text-[var(--crm-muted)]">
                        {formatearTelefono(p.telefono)}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--crm-ink-2)]">{p.m.cuerpo}</p>
                    {p.m.motivo && (
                      <p className="mt-1 text-[12px] text-[#96201f]">{p.m.motivo}</p>
                    )}
                  </div>
                  <form action={accionAprobarMensaje}>
                    <input type="hidden" name="messageId" value={p.m.id} />
                    <button type="submit" className={btnFantasma}>
                      Reintentar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <Card titulo="Conversaciones" padding={false}>
        {conversaciones.length === 0 ? (
          <div className="p-5">
            <Vacio
              mensaje="Todavía no hay conversaciones"
              sugerencia="Se abren desde las acciones sugeridas en Alertas, o desde la ficha de un contacto."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--crm-grid)]">
            {conversaciones.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/crm/conversaciones/${c.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#f4f6f8]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-[var(--crm-ink)]">
                        {c.cuenta ?? c.nombre ?? formatearTelefono(c.telefono)}
                      </span>
                      {c.baja && (
                        <Badge tono="critico" icono="⛔">
                          Pidió baja
                        </Badge>
                      )}
                      {c.porRevisar > 0 && (
                        <Badge tono="alerta" icono="✎">
                          {c.porRevisar} por revisar
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-[var(--crm-ink-2)]">
                      {c.ultimaDireccion === "in" ? "↩ " : "→ "}
                      {c.ultimoTexto ?? "Sin mensajes"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[12px] text-[var(--crm-muted)]">
                    <div className="crm-num">{formatearTelefono(c.telefono)}</div>
                    <div>{c.ultimoMensajeEn ? relativo(c.ultimoMensajeEn) : "—"}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
