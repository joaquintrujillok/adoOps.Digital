import Link from "next/link";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  StatTile,
  Vacio,
  btnFantasma,
  btnPrimario,
  btnSecundario,
} from "@/components/crm/ui";
import BotonEnvio from "@/components/crm/BotonEnvio";
import {
  accionEnviarSenal,
  accionRecalcularSenales,
  accionResolverSenal,
} from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { numero, relativo } from "@/lib/crm/formato";
import { listarSenales, resumirSenales, TIPOS, type TipoSenal } from "@/lib/crm/senales";
import { ownerScope, veTodo } from "@/lib/crm/session";
import { formatearTelefono } from "@/lib/crm/telefono";
import { estadoCandados } from "@/lib/crm/whatsapp-dispatch";

export const dynamic = "force-dynamic";

const PRIORIDAD = {
  alta: { tono: "critico" as const, icono: "▲", texto: "Alta" },
  media: { tono: "serio" as const, icono: "◆", texto: "Media" },
  baja: { tono: "info" as const, icono: "▼", texto: "Baja" },
};

export default async function Senales({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; mias?: string }>;
}) {
  const sesion = await requireSession();
  const { tipo, mias } = await searchParams;

  const alcance = mias === "1" ? sesion.userId : ownerScope(sesion);
  const [senales, resumen, candados] = await Promise.all([
    listarSenales({ ownerId: alcance, tipo }),
    resumirSenales(),
    estadoCandados(),
  ]);

  return (
    <>
      <PageHeader
        titulo="Señales"
        bajada="Motivos concretos para llamar o escribir hoy. Cada una trae el hecho que la justifica y un borrador para editar — el sistema propone, tú decides."
        acciones={
          <>
            {veTodo(sesion) && (
              <div className="flex rounded-lg border border-[var(--crm-border)] bg-white p-0.5 text-[13px]">
                <Link
                  href="/crm/senales"
                  className={`rounded-md px-3 py-1.5 ${mias !== "1" ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]" : "text-[var(--crm-ink-2)]"}`}
                >
                  Todo el equipo
                </Link>
                <Link
                  href="/crm/senales?mias=1"
                  className={`rounded-md px-3 py-1.5 ${mias === "1" ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]" : "text-[var(--crm-ink-2)]"}`}
                >
                  Solo mías
                </Link>
              </div>
            )}
            <form action={accionRecalcularSenales}>
              <BotonEnvio className={btnSecundario} pendiente="Buscando…">
                ↻ Buscar señales
              </BotonEnvio>
            </form>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Señales pendientes" valor={numero(resumen.total)} />
        <StatTile etiqueta="De prioridad alta" valor={numero(resumen.altas)} contexto="clientes que valen mucho" />
        <StatTile
          etiqueta="Tipos activos"
          valor={numero(resumen.porTipo.length)}
          contexto="de 6 reglas configuradas"
        />
        <StatTile
          etiqueta="Modo de envío"
          valor={candados.simulado ? "Simulado" : "Real"}
          contexto={candados.simulado ? "los mensajes no salen a la red" : "salen por WhatsApp"}
        />
      </div>

      <div className="mb-6">
        <Lectura titulo="Para qué sirve esto">
          <p>
            La lista de a quién contactar sale del RFM. Esta pantalla resuelve la otra mitad:{" "}
            <strong>qué decirle</strong>. Cada señal nace de un hecho —pasó su ciclo de compra,
            cumple años, su reloj toca mantención, gente como él compra algo que él no tiene— y ese
            hecho es lo que hace que el mensaje no suene a plantilla.
          </p>
          <p>
            Una señal se acciona o se descarta, nunca se acumula, y todas vencen. Un panel que solo
            crece se convierte en otra bandeja que nadie mira.
          </p>
        </Lectura>
      </div>

      {resumen.porTipo.length > 0 && (
        <div className="crm-no-print mb-5 flex flex-wrap items-center gap-2">
          <Link href={mias === "1" ? "/crm/senales?mias=1" : "/crm/senales"}>
            <Badge tono={!tipo ? "marca" : "neutro"}>Todas · {numero(resumen.total)}</Badge>
          </Link>
          {resumen.porTipo.map((t) => (
            <Link
              key={t.tipo}
              href={`/crm/senales?tipo=${t.tipo}${mias === "1" ? "&mias=1" : ""}`}
              title={t.descripcion}
            >
              <Badge tono={tipo === t.tipo ? "marca" : "neutro"}>
                {t.nombre} · {numero(t.senales)}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {senales.length === 0 ? (
        <Card>
          <Vacio
            mensaje="No hay señales pendientes"
            sugerencia="Usa «Buscar señales» para que el motor revise la base: ventanas de recompra, aniversarios, mantenciones, cumpleaños, complementos y clientes que se están yendo."
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {senales.map((s) => {
            const p = PRIORIDAD[s.prioridad as keyof typeof PRIORIDAD] ?? PRIORIDAD.baja;
            const tipoInfo = TIPOS[s.tipo as TipoSenal];
            return (
              <li key={s.id}>
                <Card padding={false}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--crm-grid)] px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge tono={p.tono} icono={p.icono}>
                          {p.texto}
                        </Badge>
                        <Badge tono="neutro">{tipoInfo?.nombre ?? s.tipo}</Badge>
                        <span className="text-[12px] text-[var(--crm-muted)]">
                          {relativo(s.generadaEn)}
                        </span>
                        {!s.optIn && (
                          <Badge tono="critico" icono="⛔">
                            No autoriza WhatsApp
                          </Badge>
                        )}
                      </div>
                      <div className="text-[15px] font-medium text-[var(--crm-ink)]">
                        {s.titulo}
                      </div>
                      {s.evidencia && (
                        <p className="mt-1 text-[13px] text-[var(--crm-ink-2)]">
                          <span className="font-medium text-[var(--crm-muted)]">Porque: </span>
                          {s.evidencia}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Link href={`/crm/contactos/${s.contactId}`} className={btnSecundario}>
                        Ver ficha
                      </Link>
                      <form action={accionResolverSenal}>
                        <input type="hidden" name="senalId" value={s.id} />
                        <input type="hidden" name="estado" value="descartada" />
                        <BotonEnvio className={btnFantasma} pendiente="…" title="No aplica">
                          ✕
                        </BotonEnvio>
                      </form>
                    </div>
                  </div>

                  {s.borrador && (
                    <form action={accionEnviarSenal} className="space-y-2 p-5">
                      <input type="hidden" name="senalId" value={s.id} />
                      <input type="hidden" name="contactId" value={s.contactId} />
                      <label className="block text-[12px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
                        Borrador · ajústalo antes de mandarlo
                      </label>
                      <textarea
                        name="cuerpo"
                        rows={3}
                        defaultValue={s.borrador}
                        className="w-full resize-y rounded-lg border border-[var(--crm-border)] px-3.5 py-2.5 text-[13px] leading-relaxed outline-none focus:border-[var(--crm-brand)]"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="crm-num text-[12px] text-[var(--crm-muted)]">
                          {s.contacto}
                          {s.telefono ? ` · ${formatearTelefono(s.telefono)}` : " · sin teléfono"}
                        </span>
                        <div className="flex items-center gap-2">
                          <form action={accionResolverSenal}>
                            <input type="hidden" name="senalId" value={s.id} />
                            <input type="hidden" name="estado" value="accionada" />
                            <BotonEnvio className={btnFantasma} pendiente="…">
                              Lo llamé
                            </BotonEnvio>
                          </form>
                          <BotonEnvio
                            className={btnPrimario}
                            pendiente="Enviando…"
                            disabled={!s.telefono || !s.optIn}
                          >
                            Enviar por WhatsApp
                          </BotonEnvio>
                        </div>
                      </div>
                    </form>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
