// El panel de despacho: la vista central del motor.
//
// ── Por qué es una cola y no un tablero ──────────────────────────────────────
//
// Un motor con pacing tiene un estado normal incómodo: **la mayoría de las cosas
// no salen**. Cuota agotada, fuera de ventana, sin señal vigente, emisor
// frenado. Un panel que solo muestra lo que sí salió se ve exactamente igual el
// día que todo funciona y el día que nada funciona: vacío.
//
// Por eso hay tres bandas y la tercera es la que casi nadie construye.
//
// El criterio es el mismo de la tarjeta "Cuadratura de leads" del Panel 360:
// *responder la pregunta antes de que la hagan*. Allá la pregunta es por qué el
// número no calza con el CRM; acá es por qué hoy no salió nada.

import Link from "next/link";
import {
  Badge,
  Card,
  PageHeader,
  Tabla,
  Vacio,
  btnPrimario,
  btnSecundario,
} from "@/components/dashboard360/ui";
import BotonEnvio from "@/components/leads/BotonEnvio";
import { panelDespacho } from "@/lib/dashboard360/motor";
import {
  alternarMotorAction,
  aprobarLoteAction,
  correrTickAction,
} from "@/lib/leads/motor.actions";
import { requireSesionMotor, puedeDespachar } from "@/lib/leads/sesion";
import { faltan, haceCuanto, numero } from "@/lib/leads/formato";
import { horaCorta } from "@/lib/leads/reloj";

export const dynamic = "force-dynamic";

export default async function Despacho() {
  const sesion = await requireSesionMotor();
  const p = await panelDespacho();
  const manda = puedeDespachar(sesion);

  if (!p.disponible) {
    return (
      <>
        <PageHeader titulo="Despacho" />
        <Vacio
          mensaje="Las tablas del motor no existen todavía en esta base"
          sugerencia="Corre el setup: POST /api/leads/cron/setup con Authorization: Bearer $LEADS_SETUP_SECRET"
        />
      </>
    );
  }

  const faltanPasos = p.bloqueos.filter((b) => !b.listo);
  const enSimulado = p.cola.some((c) => c.campanaSimulada);

  return (
    <>
      <PageHeader
        titulo="Despacho"
        bajada="A quién le toca hoy, por cuál canal y con qué señal. Y lo que se frenó, con el motivo — que es la mitad del trabajo de un motor con cuotas."
        acciones={
          manda ? (
            <div className="flex items-center gap-2">
              <form action={correrTickAction}>
                <BotonEnvio className={btnSecundario} pendiente="Corriendo…">
                  Correr ahora
                </BotonEnvio>
              </form>
              <form action={alternarMotorAction}>
                <input type="hidden" name="encender" value={p.encendido ? "0" : "1"} />
                <BotonEnvio
                  className={p.encendido ? btnSecundario : btnPrimario}
                  pendiente="…"
                  title={
                    p.encendido
                      ? "Deja de despachar. Lo agendado se conserva."
                      : "Habilita el despacho automático."
                  }
                >
                  {p.encendido ? "Apagar el motor" : "Encender el motor"}
                </BotonEnvio>
              </form>
            </div>
          ) : undefined
        }
      />

      {/* ── Estado general, en una línea ────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <Badge tono={p.encendido ? "bueno" : "alerta"}>
          <span aria-hidden>{p.encendido ? "●" : "○"}</span>
          {p.encendido ? "Motor encendido" : "Motor apagado"}
        </Badge>
        {enSimulado && (
          <Badge tono="marca">
            <span aria-hidden>◐</span>
            Campaña en modo simulado
          </Badge>
        )}
        <span className="text-[var(--d360-muted)]">
          {p.encendido
            ? "El cron despacha una acción por invocación, dentro de la ventana horaria de cada emisor."
            : "Nada sale mientras esté apagado. Lo agendado se conserva y espera."}
        </span>
      </div>

      {/* ── Lo que falta para arrancar ──────────────────────────────────────
          Desaparece sola cuando los seis pasos están listos. Un embudo vacío
          no dice por qué está vacío, y eso es justo lo que hay que saber al
          principio. Es la hermana de la banda C en otra escala de tiempo:
          bloqueos responde "por qué no puede arrancar", la banda C responde
          "por qué hoy no salió". */}
      {faltanPasos.length > 0 && (
        <Card
          className="mb-5"
          titulo="Para poder mandar el primer mensaje"
          descripcion="Van en orden de dependencia: sin dominio no hay email, sin email no hay a quién escribirle, sin señal el mensaje no tiene qué decir"
          acciones={
            <span className="text-[12px] text-[var(--d360-muted)]">
              {p.bloqueos.length - faltanPasos.length} de {p.bloqueos.length} listos
            </span>
          }
        >
          <ol className="space-y-2">
            {p.bloqueos.map((b, i) => (
              <li key={b.titulo} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: b.listo ? "var(--status-good)" : "var(--d360-axis)",
                  }}
                />
                <span className="d360-num w-5 text-[12px] text-[var(--d360-muted)]">{i + 1}</span>
                <span className="min-w-[10rem] text-[13px] font-medium text-[var(--d360-ink)]">
                  {b.titulo}
                </span>
                <span className="flex-1 text-[12.5px] text-[var(--d360-ink-2)]">{b.detalle}</span>
                {b.listo ? (
                  <Badge tono="bueno">listo</Badge>
                ) : b.href ? (
                  <Link
                    href={b.href}
                    className="text-[12px] font-medium text-[var(--d360-brand)] hover:underline"
                  >
                    {b.accion}
                  </Link>
                ) : (
                  <span className="text-[12px] text-[var(--d360-muted)]">{b.accion}</span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* ══ BANDA A · Emisores ═══════════════════════════════════════════════
          Va primero porque es la causa más frecuente de que la cola no avance,
          y sin esto el diagnóstico es adivinar. */}
      <Card
        className="mb-5"
        titulo="Emisores"
        descripcion="Cuánto queda hoy y qué tan sana está cada cuenta. El cupo se cuenta sobre lo efectivamente enviado, no sobre un contador aparte"
        acciones={
          <Link href="/dashboard360/motor/emisores" className={btnSecundario}>
            Configurar
          </Link>
        }
      >
        {p.emisores.length === 0 ? (
          <Vacio
            mensaje="No hay emisores configurados"
            sugerencia="Sin emisor no hay cuota ni warm-up, y sin eso se queman cuentas."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {p.emisores.map((e) => {
              const uso = e.cuotaDiaria > 0 ? Math.min(100, (e.usadosHoy / e.cuotaDiaria) * 100) : 0;
              const color =
                e.tono === "risk"
                  ? "var(--status-critical)"
                  : e.tono === "warn"
                    ? "var(--status-warning)"
                    : "var(--d360-brand)";
              return (
                <div
                  key={e.id}
                  className="rounded-lg border p-3"
                  style={{
                    borderColor:
                      e.tono === "risk" ? "var(--status-critical)" : "var(--d360-border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-[var(--d360-ink)]">
                      {e.identificador}
                    </span>
                    <Badge
                      tono={e.tono === "risk" ? "critico" : e.tono === "warn" ? "alerta" : "bueno"}
                    >
                      {e.resumen}
                    </Badge>
                  </div>
                  <div className="d360-num mt-1 text-[11px] text-[var(--d360-muted)]">
                    {e.tipo} · warm-up día {e.diaWarmup} · {e.ventanaInicio}:00–{e.ventanaFin}:00
                    {!e.conectado && " · sin conectar"}
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full"
                    style={{ background: "var(--d360-grid)" }}
                  >
                    <div style={{ width: `${uso}%`, height: "100%", background: color }} />
                  </div>
                  <div className="d360-num mt-1.5 flex justify-between text-[11px] text-[var(--d360-ink-2)]">
                    <span>
                      {e.usadosHoy} / {e.cuotaDiaria} hoy
                    </span>
                    <span>
                      {typeof e.tasaAceptacion7d === "number"
                        ? `acept. 7d ${e.tasaAceptacion7d}%`
                        : "sin datos de aceptación"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ══ BANDA B · La cola ════════════════════════════════════════════════ */}
      <Card
        className="mb-5"
        titulo={`Cola de hoy · ${numero(p.cola.length)} acciones`}
        descripcion="Si una fila no puede justificar por qué se le escribe a esa persona, la acción no debería existir. Por eso la señal va con su fecha y su vencimiento"
        acciones={
          manda && p.porAprobar > 0 ? (
            <form action={aprobarLoteAction}>
              <BotonEnvio className={btnPrimario} pendiente="Aprobando…">
                Aprobar las {p.porAprobar}
              </BotonEnvio>
            </form>
          ) : undefined
        }
      >
        {p.cola.length === 0 ? (
          <Vacio
            mensaje="No hay nada agendado para hoy"
            sugerencia={
              p.frenados.length > 0
                ? "Mira la banda de abajo: hay acciones que el motor descartó y dicen por qué."
                : "Cargá una señal y inscribí a los contactos de esa empresa."
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Señal</th>
                <th>Carril</th>
                <th className="text-right">Paso</th>
                <th className="text-right">Sale</th>
                <th className="text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {p.cola.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="font-medium text-[var(--d360-ink)]">{c.nombre}</div>
                    <div className="text-[11.5px] text-[var(--d360-muted)]">
                      {[c.empresa, c.cargo].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </td>
                  <td className="max-w-[26rem]">
                    <div className="text-[12.5px] text-[var(--d360-ink-2)]">
                      {c.senalResumen ?? (
                        <span className="text-[var(--d360-muted)]">
                          sin señal · la secuencia ya empezó
                        </span>
                      )}
                    </div>
                    {c.senalFechaHecho && (
                      <div className="d360-num text-[11px] text-[var(--d360-muted)]">
                        {haceCuanto(c.senalFechaHecho)} · {faltan(c.senalVenceEn)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="text-[12.5px] text-[var(--d360-ink)]">{c.carril}</div>
                    <div className="text-[11px] text-[var(--d360-muted)]">
                      {c.emisor ?? "sin emisor"}
                    </div>
                  </td>
                  <td className="d360-num text-right">
                    {c.paso} de {c.totalPasos || "?"}
                  </td>
                  <td className="d360-num text-right">{horaCorta(c.programadaEn)}</td>
                  <td className="text-right">
                    {c.estado === "aprobada" ? (
                      <Badge tono="bueno">aprobada</Badge>
                    ) : (
                      <Badge tono="neutro">por aprobar</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      {/* ══ BANDA C · Lo que no va a salir ═══════════════════════════════════
          Esta banda es la que evita repetir el bug de los seis días silenciosos
          del CRM de CDC: el cron corría cada dos minutos, respondía 200, y no
          mandaba nada. El síntoma solo era visible mirando qué devolvía la
          consulta de candidatas — o sea, en ningún lado. */}
      <Card
        titulo={`Frenado hoy · ${numero(p.frenados.reduce((a, f) => a + f.cuantos, 0))} acciones`}
        descripcion="Cada descarte con el candado que lo produjo y qué lo desbloquea. Un motor con cuotas frena más de lo que manda: si esto no se ve, un motor detenido se ve igual que uno tranquilo"
      >
        {p.frenados.length === 0 ? (
          <Vacio mensaje="Nada frenado hoy" />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th className="text-right">Cuántas</th>
                <th>Motivo</th>
                <th>Candado</th>
                <th>Qué lo desbloquea</th>
                <th>Reintenta</th>
              </tr>
            </thead>
            <tbody>
              {p.frenados.map((f) => (
                <tr key={`${f.tipo}-${f.motivo}`}>
                  <td className="d360-num text-right font-medium text-[var(--d360-ink)]">
                    {numero(f.cuantos)}
                  </td>
                  <td>
                    <div className="text-[12.5px] text-[var(--d360-ink-2)]">{f.motivo}</div>
                    {f.ejemplos.length > 0 && (
                      <div className="text-[11px] text-[var(--d360-muted)]">
                        {f.ejemplos.join(", ")}
                        {f.cuantos > f.ejemplos.length && " …"}
                      </div>
                    )}
                  </td>
                  <td>
                    {f.candado ? (
                      <Badge tono={f.candado === 2 || f.candado === 4 ? "alerta" : "neutro"}>
                        candado {f.candado}
                      </Badge>
                    ) : (
                      <Badge tono="neutro">pre-cola</Badge>
                    )}
                  </td>
                  <td className="text-[12.5px] text-[var(--d360-ink-2)]">{f.desbloquea}</td>
                  <td className="text-[12px] text-[var(--d360-muted)]">{f.reintenta}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      <p className="mt-5 text-[12px] text-[var(--d360-muted)]">
        Las horas son de Chile, no UTC. La cuota diaria de cada emisor se reinicia a la
        medianoche de Santiago — con el desfase real del día, que alterna entre −3 y −4
        según el horario de verano.
      </p>
    </>
  );
}
