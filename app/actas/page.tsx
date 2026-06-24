import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { actaReports, compromisos, type ActaReport, type Compromiso } from "@/db/schema";
import AutoRefresh from "./AutoRefresh";
import { completeCompromiso, validateActa } from "./actions";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
    validado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    corregido: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[status] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    alta: "bg-rose-50 text-rose-700 ring-rose-200",
    media: "bg-amber-50 text-amber-700 ring-amber-200",
    baja: "bg-slate-50 text-slate-600 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${map[p] ?? map.media}`}
    >
      {p}
    </span>
  );
}

function ActaCard({ a }: { a: ActaReport }) {
  const e = a.extraction;
  const fields: [string, string | null][] = [
    ["Fecha", a.fecha],
    ["Lugar", a.lugar],
    ["Participantes", a.participantes?.length ? `${a.participantes.length}` : null],
    ["Duración", e?.reunion.duracion ?? null],
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{a.titulo || "Acta de reunión"}</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {a.senderName ? `${a.senderName} · ` : ""}
            {a.source === "audio" ? "🎧 audio" : "💬 texto"} ·{" "}
            {new Date(a.createdAt).toLocaleString("es-CL", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <StatusBadge status={a.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {fields
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="text-sm font-medium text-slate-800">{v}</dd>
            </div>
          ))}
      </dl>

      {a.participantes && a.participantes.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Asistentes:</span>{" "}
          {a.participantes.join(", ")}
        </p>
      )}

      {a.decisiones && a.decisiones.length > 0 && (
        <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            Decisiones
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm text-emerald-800">
            {a.decisiones.map((d, idx) => (
              <li key={idx}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {e?.riesgos && e.riesgos.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
            Riesgos / pendientes
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm text-amber-800">
            {e.riesgos.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {a.executiveSummary && (
        <p className="mt-4 border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-600">
          {a.executiveSummary}
        </p>
      )}

      {e?.proximaReunion && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Próxima reunión:</span> {e.proximaReunion}
        </p>
      )}

      {a.status === "pendiente" && (
        <form action={validateActa.bind(null, a.id)} className="mt-4">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700">
            ✓ Validar acta
          </button>
        </form>
      )}

      {a.transcript && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
            Ver transcripción
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            {a.transcript}
          </p>
        </details>
      )}
    </article>
  );
}

function CompromisoRow({ c, titulo }: { c: Compromiso; titulo: string | null }) {
  const done = c.estado === "completada";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-slate-100 p-3 ${done ? "opacity-50" : ""}`}
    >
      <form action={completeCompromiso.bind(null, c.id)} className="pt-0.5">
        <button
          title={done ? "Completado" : "Marcar completado"}
          className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"}`}
        >
          ✓
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PriorityBadge p={c.prioridad} />
          {titulo && <span className="text-[11px] text-slate-400">{titulo}</span>}
        </div>
        <p className={`mt-1 text-sm font-medium text-slate-800 ${done ? "line-through" : ""}`}>
          {c.compromiso}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {[c.responsable, c.plazo].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

export default async function ActasDashboard() {
  const actas = await db
    .select()
    .from(actaReports)
    .orderBy(desc(actaReports.createdAt))
    .limit(50);

  const tasks = await db
    .select({
      task: compromisos,
      titulo: actaReports.titulo,
    })
    .from(compromisos)
    .innerJoin(actaReports, eq(compromisos.actaId, actaReports.id))
    .orderBy(desc(compromisos.createdAt))
    .limit(50);

  // KPIs
  const total = actas.length;
  const pendientes = actas.filter((a) => a.status === "pendiente").length;
  const decisiones = actas.reduce((acc, a) => acc + (a.decisiones?.length ?? 0), 0);
  const compromisosPendientes = tasks.filter((t) => t.task.estado !== "completada").length;
  const participantes = actas.reduce((acc, a) => acc + (a.participantes?.length ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              adoOps · demo
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Actas de Reunión
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              De un audio de WhatsApp a un acta estructurada con decisiones y compromisos
              accionables.
            </p>
          </div>
          <AutoRefresh />
        </header>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Actas" value={`${total}`} hint={`${pendientes} por validar`} />
          <StatCard label="Decisiones" value={`${decisiones}`} />
          <StatCard
            label="Compromisos"
            value={`${compromisosPendientes}`}
            hint="pendientes"
          />
          <StatCard label="Participantes" value={`${participantes}`} hint="acumulados" />
          <StatCard label="Por validar" value={`${pendientes}`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Actas recientes
            </h2>
            {actas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
                Aún no hay actas. Envía un audio de tu reunión por WhatsApp para verlo aparecer
                aquí.
              </div>
            ) : (
              <div className="space-y-4">
                {actas.map((a) => (
                  <ActaCard key={a.id} a={a} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Compromisos
            </h2>
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                Los compromisos accionables aparecerán al procesar actas.
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <CompromisoRow key={t.task.id} c={t.task} titulo={t.titulo} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
