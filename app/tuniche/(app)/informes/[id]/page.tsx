import Link from "next/link";
import { notFound } from "next/navigation";
import { nombreArea } from "@/lib/tuniche/areas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { informePorId, textoWhatsApp } from "@/lib/tuniche/informes";
import {
  aprobarInformeAction,
  enviarInformeAction,
  marcarEnviadoAction,
  retirarInformeAction,
} from "@/lib/tuniche/informes.actions";
import { puedeEnviarAlAgricultor } from "@/lib/tuniche/session";
import type { ContenidoMensual, ContenidoVisita } from "@/db/tuniche";
import Demo from "@/components/tuniche/Demo";

export const dynamic = "force-dynamic";

function fechaLarga(iso: string | Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
function fechaCorta(iso: string | Date): string {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(new Date(iso));
}
function colorNota(n: number): string {
  if (n >= 80) return "var(--tun-ok)";
  if (n >= 60) return "var(--tun-alerta)";
  return "var(--tun-critico)";
}

function Fotos({ fotos }: { fotos: { url: string; tipo: string }[] }) {
  if (!fotos.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {fotos.map((f, i) => (
        <figure key={i} className="w-[150px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.url}
            alt={f.tipo}
            className="h-[110px] w-[150px] rounded-lg object-cover"
            style={{ border: "1px solid var(--tun-border)" }}
          />
          <figcaption
            className="mt-1 text-[11px] capitalize"
            style={{ color: "var(--tun-muted)" }}
          >
            {f.tipo}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export default async function InformeDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireSesion();
  const alcance = await alcanceActual();
  const informe = await informePorId(Number(id), alcance);
  // notFound() y no un mensaje de permisos: decir "no te corresponde" ya
  // confirmaría que ese informe existe.
  if (!informe) notFound();

  const puede = puedeEnviarAlAgricultor(s);
  const esVisita = informe.tipo === "visita";
  const cv = esVisita ? (informe.contenido as unknown as ContenidoVisita) : null;
  const cm = !esVisita ? (informe.contenido as unknown as ContenidoMensual) : null;

  return (
    <div className="space-y-6">
      {/* La barra de acciones no se imprime: en la hoja que recibe el cliente no
          pinta un botón de "dar visto bueno". */}
      <div className="tun-no-print">
        <Link href="/tuniche/informes" className="text-[13px]" style={{ color: "var(--tun-brand)" }}>
          ← Informes
        </Link>
      </div>

      {/* ── El documento ─────────────────────────────────────────────────── */}
      <article className="tun-tarjeta tun-documento p-7">
        {/* Fuera de `tun-no-print` a propósito: si la marca desapareciera al
            imprimir, una hoja de demostración podría llegar a un cliente sin
            nada que la distinga de una real. */}
        {informe.demo && <Demo enDocumento />}
        <header
          className="mb-6 border-b pb-5"
          style={{ borderColor: "var(--tun-border)" }}
        >
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--tun-brand)" }}
          >
            Semillas Tuniche · {nombreArea(informe.area)}
          </div>
          <h1 className="mt-2 text-[24px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            {esVisita ? "Informe de visita a campo" : "Informe mensual de producción"}
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
            {esVisita
              ? `${cv!.agricultor}${cv!.localidad ? ` · ${cv!.localidad}` : ""} · ${fechaLarga(cv!.fecha)}`
              : `${cm!.cliente} · ${fechaCorta(cm!.desde)} al ${fechaLarga(cm!.hasta)}`}
          </p>
        </header>

        {esVisita && cv && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Dato etiqueta="Lote" valor={cv.lote} />
              {cv.cultivo && <Dato etiqueta="Cultivo" valor={cv.cultivo} />}
              {cv.variedad && <Dato etiqueta="Variedad" valor={cv.variedad} />}
              {cv.hectareas && <Dato etiqueta="Superficie" valor={`${cv.hectareas} ha`} />}
              {cv.etapa && <Dato etiqueta="Etapa" valor={cv.etapa} />}
              <Dato etiqueta="Visita realizada por" valor={cv.zonal} />
            </div>

            {cv.resumen && (
              <p className="mt-6 text-[15px] leading-relaxed" style={{ color: "var(--tun-ink)" }}>
                {cv.resumen}
              </p>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {cv.campos.map((c) => (
                <Dato key={c.etiqueta} etiqueta={c.etiqueta} valor={c.valor} />
              ))}
            </div>

            {cv.notaAgronomica != null && (
              <div className="mt-6">
                <div
                  className="text-[11px] uppercase tracking-[0.08em]"
                  style={{ color: "var(--tun-muted)" }}
                >
                  Nota agronómica
                </div>
                <div
                  className="mt-1 text-[32px] font-semibold leading-none"
                  style={{ color: colorNota(cv.notaAgronomica) }}
                >
                  {cv.notaAgronomica}%
                </div>
              </div>
            )}

            <Fotos fotos={cv.fotos} />
          </>
        )}

        {!esVisita && cm && (
          <div className="space-y-8">
            {cm.lotes.map((l) => (
              <section key={l.codigo}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 className="text-[17px] font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {l.codigo}
                    <span
                      className="ml-2 text-[14px] font-normal"
                      style={{ color: "var(--tun-ink-2)" }}
                    >
                      {l.agricultor}
                      {l.localidad ? ` · ${l.localidad}` : ""}
                    </span>
                  </h2>
                  {l.notaPromedio != null && (
                    <span
                      className="text-[18px] font-semibold"
                      style={{ color: colorNota(l.notaPromedio) }}
                      title="Promedio de las notas del periodo"
                    >
                      {l.notaPromedio}%
                    </span>
                  )}
                </div>
                <div
                  className="mt-1 flex flex-wrap gap-x-4 text-[12.5px]"
                  style={{ color: "var(--tun-muted)" }}
                >
                  {l.cultivo && <span>{l.cultivo}</span>}
                  {l.variedad && <span>{l.variedad}</span>}
                  {l.hectareas && <span>{l.hectareas} ha</span>}
                  {l.objetivo && <span>objetivo {l.objetivo}</span>}
                </div>

                {l.visitas.length === 0 ? (
                  <p className="mt-3 text-[13.5px]" style={{ color: "var(--tun-alerta)" }}>
                    Sin visitas registradas en este periodo.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {l.visitas.map((v, i) => (
                      <div
                        key={i}
                        className="border-l-2 pl-4"
                        style={{ borderColor: "var(--tun-border-fuerte)" }}
                      >
                        <div className="flex flex-wrap items-baseline gap-3">
                          <span
                            className="text-[13px] font-medium"
                            style={{ color: "var(--tun-ink)" }}
                          >
                            {fechaCorta(v.fecha)}
                            {v.etapa ? ` · ${v.etapa}` : ""}
                          </span>
                          <span className="text-[12px]" style={{ color: "var(--tun-muted)" }}>
                            {v.zonal}
                          </span>
                          {v.notaAgronomica != null && (
                            <span
                              className="text-[13px] font-semibold"
                              style={{ color: colorNota(v.notaAgronomica) }}
                            >
                              {v.notaAgronomica}%
                            </span>
                          )}
                        </div>
                        {v.resumen && (
                          <p className="mt-1 text-[13.5px]" style={{ color: "var(--tun-ink-2)" }}>
                            {v.resumen}
                          </p>
                        )}
                        <Fotos fotos={v.fotos} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        <footer
          className="mt-8 border-t pt-4 text-[11.5px]"
          style={{ borderColor: "var(--tun-border)", color: "var(--tun-muted)" }}
        >
          Informe generado el {fechaLarga(informe.generadoEn)}
          {informe.generadoPorNombre ? ` por ${informe.generadoPorNombre}` : ""}.
          {informe.aprobadoEn && informe.aprobadoPorNombre
            ? ` Visto bueno de ${informe.aprobadoPorNombre} el ${fechaLarga(informe.aprobadoEn)}.`
            : ""}
        </footer>
      </article>

      {/* ── Lo que pasa con el documento ─────────────────────────────────── */}
      <section className="tun-no-print tun-tarjeta p-5">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--tun-muted)" }}
        >
          Salida
        </h2>

        {informe.estado === "enviado" ? (
          <p className="mt-3 text-[14px]" style={{ color: "var(--tun-ok)" }}>
            ✓ Enviado el {fechaLarga(informe.enviadoEn!)}
            {informe.enviadoA ? ` a ${informe.enviadoA}` : ""}. Este documento ya no se
            puede modificar ni retirar: el destinatario lo tiene.
          </p>
        ) : informe.estado === "aprobado" ? (
          <div className="mt-3 space-y-4">
            <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
              Con visto bueno de <b>{informe.aprobadoPorNombre}</b>. Puede salir.
            </p>
            {puede && esVisita && (
              <form action={enviarInformeAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={informe.id} />
                <button type="submit" className="tun-boton">
                  Enviar al agricultor por WhatsApp
                </button>
              </form>
            )}
            {puede && !esVisita && (
              // El mensual va al cliente en el extranjero y hoy no tenemos su
              // canal. En vez de inventar una integración que nadie pidió, se
              // registra el hecho, que es lo que hoy no queda escrito en ninguna
              // parte: quién lo despachó, cuándo y a quién.
              <form action={marcarEnviadoAction} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={informe.id} />
                <div className="min-w-[260px] flex-1">
                  <label htmlFor="destinatario" className="tun-etiqueta">
                    ¿A quién se lo enviaste?
                  </label>
                  <input
                    id="destinatario"
                    name="destinatario"
                    required
                    className="tun-campo"
                    placeholder="correo o nombre del contacto del cliente"
                  />
                </div>
                <button type="submit" className="tun-boton">
                  Marcar como enviado
                </button>
              </form>
            )}
            {puede && (
              <form action={retirarInformeAction}>
                <input type="hidden" name="id" value={informe.id} />
                <button type="submit" className="tun-boton-suave">
                  Retirar visto bueno
                </button>
              </form>
            )}
          </div>
        ) : puede ? (
          <div className="mt-3 space-y-3">
            <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
              Este informe está en borrador. <b>Nada sale de Tuniche sin visto bueno</b>, y
              se da sobre el documento de arriba: lo que apruebas es exactamente lo que
              va a recibir el destinatario.
            </p>
            <form action={aprobarInformeAction}>
              <input type="hidden" name="id" value={informe.id} />
              <button type="submit" className="tun-boton">
                Dar visto bueno
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-3 text-[14px]" style={{ color: "var(--tun-muted)" }}>
            En borrador, esperando el visto bueno de la jefatura de tu área. Nada sale de
            Tuniche sin eso.
          </p>
        )}
      </section>

      {/* La vista previa del mensaje que realmente sale, armada con la MISMA
          función que lo envía. Si la pantalla lo reconstruyera por su cuenta,
          alguien estaría dando el visto bueno a algo distinto de lo que se manda. */}
      {esVisita && cv && (
        <section className="tun-no-print tun-tarjeta p-5">
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--tun-muted)" }}
          >
            Lo que va a recibir por WhatsApp
          </h2>
          <pre
            className="mt-3 whitespace-pre-wrap rounded-lg p-4 text-[13px]"
            style={{
              background: "var(--tun-plane)",
              color: "var(--tun-ink)",
              fontFamily: "inherit",
            }}
          >
            {textoWhatsApp(cv)}
          </pre>
        </section>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "var(--tun-muted)" }}>
        {etiqueta}
      </div>
      <div className="mt-0.5 text-[14px]" style={{ color: "var(--tun-ink)" }}>
        {valor}
      </div>
    </div>
  );
}
