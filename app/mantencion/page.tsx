import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  incidencias,
  ordenesTrabajo,
  type Incidencia,
  type OrdenTrabajo,
} from "@/db/schema";
import AutoRefresh from "./AutoRefresh";
import { completeOrden, validateIncidencia } from "./actions";

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

function SeverityBadge({ s }: { s: string | null }) {
  if (!s) return null;
  const map: Record<string, string> = {
    critica: "bg-rose-50 text-rose-700 ring-rose-200",
    alta: "bg-orange-50 text-orange-700 ring-orange-200",
    media: "bg-amber-50 text-amber-700 ring-amber-200",
    baja: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  const icon: Record<string, string> = {
    critica: "🔴",
    alta: "🟠",
    media: "🟡",
    baja: "🟢",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${map[s] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
    >
      {icon[s] ?? ""} {s}
    </span>
  );
}

function EstadoEquipoBadge({ e }: { e: string | null }) {
  if (!e) return null;
  const label: Record<string, string> = {
    detenido: "Detenido",
    operativo_con_riesgo: "Operativo c/ riesgo",
    operativo: "Operativo",
  };
  const map: Record<string, string> = {
    detenido: "bg-rose-50 text-rose-700 ring-rose-200",
    operativo_con_riesgo: "bg-amber-50 text-amber-700 ring-amber-200",
    operativo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${map[e] ?? "bg-slate-50 text-slate-600 ring-slate-200"}`}
    >
      {label[e] ?? e}
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

function IncidenciaCard({ i }: { i: Incidencia }) {
  const e = i.extraction;
  const fields: [string, string | null][] = [
    ["Activo", i.codigoActivo],
    ["Ubicación", i.ubicacion],
    ["Tipo de falla", i.tipoFalla],
    ["Reportó", i.reportadoPor],
  ];

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            {i.equipo || "Incidencia de equipo"}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {i.senderName ? `${i.senderName} · ` : ""}
            {i.source === "audio" ? "🎧 audio" : "💬 texto"} ·{" "}
            {new Date(i.createdAt).toLocaleString("es-CL", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
        <StatusBadge status={i.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SeverityBadge s={i.severidad} />
        <EstadoEquipoBadge e={i.estadoEquipo} />
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

      {e?.sintomas && e.sintomas.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Síntomas:</span> {e.sintomas.join(", ")}
        </p>
      )}

      {i.alertas && i.alertas.length > 0 && (
        <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-600">
            Alertas
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm text-rose-800">
            {i.alertas.map((a, idx) => (
              <li key={idx}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {e?.repuestos && e.repuestos.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-medium text-slate-600">Repuestos:</span> {e.repuestos.join(", ")}
        </p>
      )}

      {i.executiveSummary && (
        <p className="mt-4 border-l-2 border-slate-200 pl-3 text-sm leading-relaxed text-slate-600">
          {i.executiveSummary}
        </p>
      )}

      {i.status === "pendiente" && (
        <form action={validateIncidencia.bind(null, i.id)} className="mt-4">
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700">
            ✓ Validar incidencia
          </button>
        </form>
      )}

      {i.transcript && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
            Ver transcripción
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            {i.transcript}
          </p>
        </details>
      )}
    </article>
  );
}

function OrdenRow({ o, equipo }: { o: OrdenTrabajo; equipo: string | null }) {
  const done = o.estado === "completada";
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-slate-100 p-3 ${done ? "opacity-50" : ""}`}
    >
      <form action={completeOrden.bind(null, o.id)} className="pt-0.5">
        <button
          title={done ? "Completada" : "Marcar completada"}
          className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-emerald-400"}`}
        >
          ✓
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <PriorityBadge p={o.prioridad} />
          {equipo && <span className="text-[11px] text-slate-400">{equipo}</span>}
        </div>
        <p className={`mt-1 text-sm font-medium text-slate-800 ${done ? "line-through" : ""}`}>
          {o.tarea}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {[o.responsableSugerido, o.plazo, o.repuestos].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  );
}

export default async function MantencionDashboard() {
  const items = await db
    .select()
    .from(incidencias)
    .orderBy(desc(incidencias.createdAt))
    .limit(50);

  const tasks = await db
    .select({
      task: ordenesTrabajo,
      equipo: incidencias.equipo,
    })
    .from(ordenesTrabajo)
    .innerJoin(incidencias, eq(ordenesTrabajo.incidenciaId, incidencias.id))
    .orderBy(desc(ordenesTrabajo.createdAt))
    .limit(50);

  // KPIs
  const total = items.length;
  const pendientes = items.filter((i) => i.status === "pendiente").length;
  const criticas = items.filter(
    (i) => (i.severidad === "critica" || i.severidad === "alta") && i.status !== "corregido"
  ).length;
  const detenidos = items.filter((i) => i.estadoEquipo === "detenido").length;
  const ordenesPendientes = tasks.filter((t) => t.task.estado !== "completada").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
              adoOps · demo
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Incidencias y Mantención
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              De un audio de WhatsApp a una incidencia estructurada con severidad, alertas y
              órdenes de trabajo.
            </p>
          </div>
          <AutoRefresh />
        </header>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Incidencias" value={`${total}`} hint={`${pendientes} por validar`} />
          <StatCard label="Críticas/altas" value={`${criticas}`} hint="abiertas" />
          <StatCard label="Equipos detenidos" value={`${detenidos}`} />
          <StatCard label="Órdenes" value={`${ordenesPendientes}`} hint="pendientes" />
          <StatCard label="Por validar" value={`${pendientes}`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Incidencias recientes
            </h2>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
                Aún no hay incidencias. Envía un audio reportando una falla por WhatsApp para
                verlo aparecer aquí.
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((i) => (
                  <IncidenciaCard key={i.id} i={i} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Órdenes de trabajo
            </h2>
            {tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
                Las órdenes de trabajo aparecerán al procesar incidencias.
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => (
                  <OrdenRow key={t.task.id} o={t.task} equipo={t.equipo} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
