import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fieldReports, workSheets, type FieldReport, type WorkSheet } from "@/db/schema";
import AutoRefresh from "./AutoRefresh";
import { completeTask, validateReport } from "./actions";

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

function ReportCard({ r }: { r: FieldReport }) {
  const e = r.extraction;
  const fields: [string, string | null][] = [
    ["Campo", r.cliente],
    ["Sector", r.sector],
    ["Cuarteles", r.cuarteles],
    ["Responsable", r.responsable],
    ["Equipo", r.equipoPersonas != null ? `${r.equipoPersonas} personas` : null],
    ["Avance", r.avancePct != null ? `${r.avancePct}%` : null],
    ["Hectáreas", r.hectareas != null ? `${r.hectareas}` : null],
    ["Estado tarea", r.estadoTarea],
    ["Fotos", e?.evidencias.fotos != null ? `${e.evidencias.fotos}` : null],
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            {r.cliente || "Reporte de terreno"}
            {r.sector ? ` · ${r.sector}` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {r.senderName ? `${r.senderName} · ` : ""}
            {r.source === "audio" ? "🎧 audio" : "💬 texto"} ·{" "}
            {new Date(r.createdAt).toLocaleString("es-CL", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {fields
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="text-sm font-medium text-slate-800">{v}</dd>
            </div>
          ))}
      </dl>

      {r.incidencias && r.incidencias.length > 0 && (
        <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
            Incidencias
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm text-rose-800">
            {r.incidencias.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      {r.executiveSummary && (
        <p className="mt-4 border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-600">
          {r.executiveSummary}
        </p>
      )}

      {r.status === "pendiente" && (
        <form action={validateReport.bind(null, r.id)} className="mt-4">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700">
            ✓ Validar reporte
          </button>
        </form>
      )}

      {r.transcript && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
            Ver transcripción
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            {r.transcript}
          </p>
        </details>
      )}
    </article>
  );
}

function TaskRow({ t, cliente }: { t: WorkSheet; cliente: string | null }) {
  const done = t.estado === "completada";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-slate-100 p-3 ${done ? "opacity-50" : ""}`}
    >
      <form action={completeTask.bind(null, t.id)} className="pt-0.5">
        <button
          title={done ? "Completada" : "Marcar completada"}
          className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"}`}
        >
          ✓
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PriorityBadge p={t.prioridad} />
          {cliente && <span className="text-[11px] text-slate-400">{cliente}</span>}
        </div>
        <p className={`mt-1 text-sm font-medium text-slate-800 ${done ? "line-through" : ""}`}>
          {t.tarea}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {[t.responsableSugerido, t.plazo, t.recursos].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

export default async function TerrenoDashboard() {
  const reports = await db
    .select()
    .from(fieldReports)
    .orderBy(desc(fieldReports.createdAt))
    .limit(50);

  const tasks = await db
    .select({
      task: workSheets,
      cliente: fieldReports.cliente,
      reportStatus: fieldReports.status,
    })
    .from(workSheets)
    .innerJoin(fieldReports, eq(workSheets.reportId, fieldReports.id))
    .orderBy(desc(workSheets.createdAt))
    .limit(50);

  // KPIs
  const total = reports.length;
  const pendientes = reports.filter((r) => r.status === "pendiente").length;
  const avances = reports.map((r) => r.avancePct).filter((v): v is number => v != null);
  const avgAvance = avances.length
    ? Math.round(avances.reduce((a, b) => a + b, 0) / avances.length)
    : null;
  const hectareas = reports.reduce((a, r) => a + (r.hectareas ?? 0), 0);
  const incidenciasAbiertas = reports.filter(
    (r) => r.incidencias && r.incidencias.length > 0 && r.status !== "corregido"
  ).length;
  const tareasPendientes = tasks.filter((t) => t.task.estado !== "completada").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              adoOps · demo
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Reportes de Terreno
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              De un audio de WhatsApp a datos estructurados, tareas accionables y reportes
              consistentes.
            </p>
          </div>
          <AutoRefresh />
        </header>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Reportes" value={`${total}`} hint={`${pendientes} por validar`} />
          <StatCard label="Avance prom." value={avgAvance != null ? `${avgAvance}%` : "—"} />
          <StatCard label="Hectáreas" value={hectareas ? `${hectareas}` : "—"} />
          <StatCard
            label="Incidencias"
            value={`${incidenciasAbiertas}`}
            hint="reportes con alertas"
          />
          <StatCard label="Tareas" value={`${tareasPendientes}`} hint="pendientes" />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Reportes recientes
            </h2>
            {reports.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
                Aún no hay reportes. Envía un audio de terreno por WhatsApp para verlo aparecer
                aquí.
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((r) => (
                  <ReportCard key={r.id} r={r} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Hojas de trabajo
            </h2>
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                Las tareas accionables aparecerán al procesar reportes.
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <TaskRow key={t.task.id} t={t.task} cliente={t.cliente} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
