// Bandeja de conversaciones en tres columnas: bandeja · hilo · ficha.
//
// Una sola ruta con `?hilo=` en vez de una pantalla de lista y otra de detalle.
// Es lo que ya esperaba el resto del CRM —la ficha del contacto, la cartera y la
// cotización enviada linkean a `/crm/conversaciones?hilo=N` desde antes de que
// esta pantalla existiera— y es lo que hace que contestar no obligue a ir y
// volver: se lee el hilo, se mira con quién se está hablando y se corrige el
// correo mal tipeado sin salir de acá.

import Link from "next/link";
import {
  Badge,
  PageHeader,
  Plegable,
  Vacio,
  btnPrimario,
  btnSecundario,
} from "@/components/crm/ui";
import BotonEnvio from "@/components/crm/BotonEnvio";
import FormularioContacto from "@/components/crm/FormularioContacto";
import HiloConversacion, { type MensajeVista } from "@/components/crm/HiloConversacion";
import {
  accionAprobarTodos,
  accionDestacarConversacion,
} from "@/lib/crm/acciones";
import { requireSession } from "@/lib/crm/auth.actions";
import { clp, fecha, numero, relativo } from "@/lib/crm/formato";
import { formatearTelefono } from "@/lib/crm/telefono";
import {
  bandeja,
  fichaLateral,
  hilo as hiloDe,
  porRevisar,
  tituloConversacion,
  type ConversacionListada,
} from "@/lib/crm/whatsapp";
import { estadoCandados } from "@/lib/crm/whatsapp-dispatch";

export const dynamic = "force-dynamic";

// ─── Pestañas de la bandeja ──────────────────────────────────────────────────

const PESTANAS = [
  { id: "no-leidos", nombre: "No leídos" },
  { id: "todos", nombre: "Todos" },
  { id: "recientes", nombre: "Recientes" },
  { id: "destacados", nombre: "Destacados" },
] as const;

type PestanaId = (typeof PESTANAS)[number]["id"];

/**
 * La bandeja abre en «Todos», no en «No leídos».
 *
 * La pestaña de no leídos es la primera porque es la que más se usa, pero abrir
 * ahí significa que el día que el equipo se puso al día la pantalla arranca
 * vacía — y una bandeja vacía se lee como una bandeja rota, no como una bandeja
 * al día.
 */
const PESTANA_POR_DEFECTO: PestanaId = "todos";

const DIAS_RECIENTE = 7;

function filtrar(lista: ConversacionListada[], pestana: PestanaId, ahora: Date) {
  switch (pestana) {
    case "no-leidos":
      return lista.filter((c) => c.sinLeer > 0);
    case "recientes":
      return lista.filter(
        (c) =>
          c.ultimoMensajeEn !== null &&
          ahora.getTime() - new Date(c.ultimoMensajeEn).getTime() <
            DIAS_RECIENTE * 86_400_000,
      );
    case "destacados":
      return lista.filter((c) => c.destacada);
    default:
      return lista;
  }
}

// ─── Fechas del hilo, calculadas en el servidor ──────────────────────────────

const HORA = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" });

const claveDia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function etiquetaDia(d: Date, ahora: Date): string {
  const hoy = claveDia(ahora);
  const ayer = claveDia(new Date(ahora.getTime() - 86_400_000));
  const clave = claveDia(d);
  if (clave === hoy) return "Hoy";
  if (clave === ayer) return "Ayer";
  return fecha(d);
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default async function Conversaciones({
  searchParams,
}: {
  searchParams: Promise<{ hilo?: string; bandeja?: string }>;
}) {
  await requireSession();
  const params = await searchParams;

  const ahora = new Date();
  const [conversaciones, pendientes, candados] = await Promise.all([
    bandeja(),
    porRevisar(),
    estadoCandados(),
  ]);

  const pestana: PestanaId =
    PESTANAS.find((p) => p.id === params.bandeja)?.id ?? PESTANA_POR_DEFECTO;
  const lista = filtrar(conversaciones, pestana, ahora);

  const pedido = Number(params.hilo);
  // El hilo pedido manda aunque no esté en la pestaña abierta: si se llega acá
  // desde la ficha de un contacto, lo que se quiere ver es esa conversación, no
  // la primera de la bandeja.
  const seleccionada =
    conversaciones.find((c) => c.id === pedido) ?? lista[0] ?? conversaciones[0] ?? null;

  const [datos, ficha] = await Promise.all([
    seleccionada ? hiloDe(seleccionada.id) : Promise.resolve(null),
    seleccionada ? fichaLateral(seleccionada.contactId) : Promise.resolve(null),
  ]);

  const mensajes: MensajeVista[] = (datos?.mensajes ?? []).map((m) => {
    const cuando = m.enviadoEn ?? m.createdAt;
    return {
      id: m.id,
      direccion: m.direccion,
      cuerpo: m.cuerpo,
      estado: m.estado,
      motivo: m.motivo,
      automatico: m.automatico,
      dia: claveDia(cuando),
      diaEtiqueta: etiquetaDia(cuando, ahora),
      hora: HORA.format(cuando),
    };
  });

  const borradores = pendientes.filter((p) => p.m.estado === "draft");
  const noLeidos = conversaciones.filter((c) => c.sinLeer > 0).length;

  const urlDe = (p: PestanaId, id?: number) =>
    `/crm/conversaciones?bandeja=${p}${id ? `&hilo=${id}` : ""}`;

  const contacto = ficha?.contacto ?? null;

  return (
    <>
      <PageHeader
        titulo="Conversaciones"
        bajada="La bandeja comercial. Nada sale sin que una persona lo apruebe, y nada se envía sin cruzar los cuatro candados."
        acciones={
          <>
            <span
              title={
                candados.simulado
                  ? "Los mensajes se registran con estado «Simulado» y no tocan la red."
                  : `Salen por WaSender a los ${candados.autorizados} números de la lista blanca.`
              }
              className="rounded-full border border-[var(--crm-border)] px-2.5 py-1 text-[12px] text-[var(--crm-ink-2)]"
            >
              {candados.simulado ? "◈ Modo simulado" : "● Modo real"}
            </span>
            {borradores.length > 0 && (
              <form action={accionAprobarTodos}>
                <input
                  type="hidden"
                  name="messageIds"
                  value={borradores.map((b) => b.m.id).join(",")}
                />
                <BotonEnvio
                  className={btnPrimario}
                  pendiente="Enviando…"
                  title="Aprueba y despacha todos los borradores pendientes de la bandeja"
                >
                  Aprobar los {borradores.length} borradores
                </BotonEnvio>
              </form>
            )}
          </>
        }
      />

      <div className="mb-4">
        <Plegable
          titulo="Cómo está protegido esto"
          resumen={`Aprobación humana · BAJA · interruptor ${candados.habilitado ? "encendido" : "apagado"} · lista blanca`}
        >
        <div className="space-y-1.5 text-[13px] leading-relaxed text-[var(--crm-ink)]">
          <p>
            Todo mensaje saliente atraviesa cuatro controles antes de existir siquiera
            como intento: <strong>aprobación de una persona</strong> (nada nace
            aprobado),{" "}
            <strong>
              {candados.habilitado
                ? "interruptor general encendido"
                : "interruptor general APAGADO"}
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
        </div>
        </Plegable>
      </div>

      <div className="grid min-h-0 gap-4 lg:h-[calc(100vh-13rem)] lg:grid-cols-[minmax(0,20.5rem)_minmax(0,1fr)_minmax(0,19rem)]">
        {/* ── Izquierda: la bandeja ─────────────────────────────────────── */}
        {/* El tope de alto en pantalla chica no es cosmético: apiladas y sin
            límite, doscientas conversaciones dejan el hilo a un scroll larguísimo
            de distancia. */}
        <section className="flex max-h-[60vh] min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[0_1px_2px_rgba(11,11,11,0.04)] lg:max-h-none">
          <div className="flex shrink-0 flex-wrap gap-0.5 border-b border-[var(--crm-grid)] px-1.5 py-2">
            {PESTANAS.map((p) => {
              const activa = p.id === pestana;
              return (
                <Link
                  key={p.id}
                  href={urlDe(p.id, seleccionada?.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium transition ${
                    activa
                      ? "bg-[var(--crm-brand-soft)] text-[var(--crm-brand-dark)]"
                      : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
                  }`}
                >
                  {p.nombre}
                  {p.id === "no-leidos" && noLeidos > 0 && (
                    <span className="crm-num rounded-full bg-[var(--crm-brand)] px-1.5 text-[11px] font-semibold text-white">
                      {numero(noLeidos)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="crm-scroll min-h-0 flex-1 overflow-y-auto">
            {lista.length === 0 ? (
              <div className="p-4">
                <Vacio
                  mensaje={
                    pestana === "no-leidos"
                      ? "Nada sin leer"
                      : pestana === "destacados"
                        ? "Ninguna conversación destacada"
                        : pestana === "recientes"
                          ? `Sin movimiento en ${DIAS_RECIENTE} días`
                          : "Todavía no hay conversaciones"
                  }
                  sugerencia={
                    pestana === "destacados"
                      ? "Se destacan con la estrella del encabezado del hilo."
                      : pestana === "todos"
                        ? "Se abren desde las acciones de Alertas, o desde la ficha de un contacto."
                        : undefined
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--crm-grid)]">
                {lista.map((c) => {
                  const activa = c.id === seleccionada?.id;
                  const sinLeer = c.sinLeer > 0;
                  return (
                    <li key={c.id}>
                      <Link
                        href={urlDe(pestana, c.id)}
                        className={`block px-3.5 py-3 transition ${
                          activa
                            ? "bg-[var(--crm-brand-soft)]"
                            : "hover:bg-[#f4f6f8]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-[13.5px] ${
                              sinLeer
                                ? "font-semibold text-[var(--crm-ink)]"
                                : "font-medium text-[var(--crm-ink-2)]"
                            }`}
                          >
                            {c.destacada && <span aria-label="Destacada">★ </span>}
                            {tituloConversacion(c)}
                          </span>
                          <span className="shrink-0 text-[11px] text-[var(--crm-muted)]">
                            {c.ultimoMensajeEn ? relativo(c.ultimoMensajeEn, ahora) : "—"}
                          </span>
                        </div>

                        <p
                          className={`mt-0.5 truncate text-[12.5px] ${
                            sinLeer ? "text-[var(--crm-ink)]" : "text-[var(--crm-muted)]"
                          }`}
                        >
                          {c.ultimaDireccion === "in" ? "↩ " : "→ "}
                          {c.ultimoTexto ?? "Sin mensajes"}
                        </p>

                        {(sinLeer || c.baja || c.porRevisar > 0) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {sinLeer && (
                              <Badge tono="marca">{numero(c.sinLeer)} sin leer</Badge>
                            )}
                            {c.porRevisar > 0 && (
                              <Badge tono="alerta" icono="✎">
                                {c.porRevisar} por revisar
                              </Badge>
                            )}
                            {c.baja && (
                              <Badge tono="critico" icono="⛔">
                                Pidió baja
                              </Badge>
                            )}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Centro: el hilo ───────────────────────────────────────────── */}
        <section className="flex max-h-[80vh] min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[0_1px_2px_rgba(11,11,11,0.04)] lg:max-h-none">
          {!seleccionada || !datos ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <Vacio
                mensaje="Elige una conversación"
                sugerencia="Se abren desde las acciones de Alertas, o desde la ficha de un contacto."
              />
            </div>
          ) : (
            <>
              <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--crm-grid)] px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[15px] font-semibold text-[var(--crm-ink)]">
                      {tituloConversacion(seleccionada)}
                    </h2>
                    {seleccionada.baja && (
                      <Badge tono="critico" icono="⛔">
                        Pidió baja
                      </Badge>
                    )}
                  </div>
                  <p className="crm-num mt-0.5 text-[12px] text-[var(--crm-muted)]">
                    {formatearTelefono(seleccionada.telefono)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <form action={accionDestacarConversacion}>
                    <input type="hidden" name="conversationId" value={seleccionada.id} />
                    <BotonEnvio
                      className={`${btnSecundario} px-2.5`}
                      pendiente="…"
                      title={
                        seleccionada.destacada
                          ? "Quitar de destacados"
                          : "Destacar esta conversación"
                      }
                    >
                      {seleccionada.destacada ? "★" : "☆"}
                    </BotonEnvio>
                  </form>
                  {seleccionada.contactId && (
                    <Link
                      href={`/crm/contactos/${seleccionada.contactId}`}
                      className={btnSecundario}
                    >
                      Ficha completa
                    </Link>
                  )}
                </div>
              </header>

              <HiloConversacion
                conversationId={seleccionada.id}
                mensajes={mensajes}
                baja={seleccionada.baja}
                noLeida={seleccionada.sinLeer > 0}
                simulado={candados.simulado}
              />
            </>
          )}
        </section>

        {/* ── Derecha: la ficha del contacto ────────────────────────────── */}
        <section className="crm-scroll flex min-h-0 flex-col overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
          <div className="border-b border-[var(--crm-grid)] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-[var(--crm-ink)]">
              Ficha del contacto
            </h2>
          </div>

          {!seleccionada ? (
            <div className="p-4 text-[13px] text-[var(--crm-muted)]">
              Sin conversación abierta.
            </div>
          ) : !contacto ? (
            // Un hilo sin contacto no es un error: llega uno nuevo por WhatsApp y
            // todavía no es nadie en el CRM. Decirlo es más útil que dejar la
            // columna en blanco.
            <div className="space-y-3 p-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
                  Nombre en el hilo
                </div>
                <div className="mt-0.5 text-[13px] text-[var(--crm-ink)]">
                  {seleccionada.nombre ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
                  Teléfono
                </div>
                <div className="crm-num mt-0.5 text-[13px] text-[var(--crm-ink)]">
                  {formatearTelefono(seleccionada.telefono)}
                </div>
              </div>
              <p className="rounded-lg border border-dashed border-[var(--crm-axis)] px-3 py-2.5 text-[12px] text-[var(--crm-ink-2)]">
                Esta conversación todavía no está asociada a un contacto del CRM. Se
                asocia sola cuando se abre desde la ficha de un contacto con este mismo
                número.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tono={contacto.estado === "cliente" ? "bueno" : "info"}>
                  {contacto.estado}
                </Badge>
                {contacto.optInWhatsapp ? (
                  <Badge tono="bueno" icono="✆">
                    Autoriza WhatsApp
                  </Badge>
                ) : (
                  <Badge tono="alerta" icono="⛔">
                    Sin autorización
                  </Badge>
                )}
              </div>

              {/* El teléfono se edita como se lee, no como se guarda. En la base
                  vive en E.164 sin '+' (56943851163) y `normalizarTelefono`
                  vuelve a esa forma sola: mostrar los once dígitos pegados haría
                  que corregir un número obligue a descifrarlo primero. */}
              <FormularioContacto
                contactId={contacto.id}
                nombre={contacto.nombre}
                email={contacto.email}
                telefono={contacto.telefono ? formatearTelefono(contacto.telefono) : null}
              />

              {contacto.telefono &&
                contacto.telefono !== seleccionada.telefono && (
                  <p className="rounded-lg border border-[#f6e0a5] bg-[#fdf3d9] px-3 py-2 text-[12px] text-[#7a5600]">
                    El hilo va al {formatearTelefono(seleccionada.telefono)}, distinto del
                    teléfono de la ficha. Cambiar el número acá no mueve la conversación:
                    para escribirle al nuevo hay que abrir una desde su ficha.
                  </p>
                )}

              {/* Dueño, etiquetas y dos cifras. Nada más: la ficha 360 está a un
                  clic en el encabezado del hilo, y repetirla acá convierte la
                  columna en un muro que nadie lee mientras contesta. */}
              <dl className="space-y-2 border-t border-[var(--crm-grid)] pt-3 text-[13px]">
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[var(--crm-muted)]">Dueño</dt>
                  <dd className="text-right text-[var(--crm-ink)]">
                    {ficha?.owner ?? "sin asignar"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[var(--crm-muted)]">Comprado</dt>
                  <dd className="crm-num text-right text-[var(--crm-ink)]">
                    {clp(ficha?.totales.facturado ?? 0)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <dt className="text-[var(--crm-muted)]">Pipeline abierto</dt>
                  <dd className="crm-num text-right text-[var(--crm-ink)]">
                    {clp(ficha?.totales.pipelineAbierto ?? 0)}
                  </dd>
                </div>
              </dl>

              {(contacto.etiquetas ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-[var(--crm-grid)] pt-3">
                  {(contacto.etiquetas ?? []).map((e) => (
                    <Badge key={e} tono="marca">
                      {e}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
