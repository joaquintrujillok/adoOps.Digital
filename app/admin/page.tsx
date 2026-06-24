import { getActiveDemoSetting, type DemoVertical } from "@/lib/demo-settings";
import { switchDemo } from "./actions";

export const dynamic = "force-dynamic";

const DEMOS: { key: DemoVertical; label: string; desc: string; path: string; icon: string }[] = [
  {
    key: "terreno",
    label: "Reportes de Terreno",
    desc: "WhatsApp → campo, cuarteles, avance, incidencias, hoja de trabajo.",
    path: "/terreno",
    icon: "🌱",
  },
  {
    key: "actas",
    label: "Actas de Reunión",
    desc: "WhatsApp → título, participantes, decisiones, compromisos y riesgos.",
    path: "/actas",
    icon: "📋",
  },
  {
    key: "mantencion",
    label: "Incidencias y Mantención",
    desc: "WhatsApp → equipo, falla, severidad, alertas y órdenes de trabajo.",
    path: "/mantencion",
    icon: "🔧",
  },
];

export default async function AdminPage() {
  const active = await getActiveDemoSetting();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
          adoOps · admin
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Selector de demo</h1>
        <p className="mt-1 text-sm text-slate-500">
          El demo activo define a qué dashboard van los mensajes de WhatsApp. Solo puede haber uno
          activo a la vez.
        </p>

        <div className="mt-8 space-y-3">
          {DEMOS.map((d) => {
            const isActive = active === d.key;
            return (
              <div
                key={d.key}
                className={`rounded-2xl border p-5 transition ${
                  isActive
                    ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{d.icon}</span>
                      <span className="font-semibold text-slate-900">{d.label}</span>
                      {isActive && (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Activo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{d.desc}</p>
                    <a
                      href={d.path}
                      className="mt-1 inline-block text-xs text-emerald-600 hover:underline"
                    >
                      Ver dashboard →
                    </a>
                  </div>

                  {!isActive && (
                    <form action={switchDemo.bind(null, d.key)}>
                      <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-400">
                        Activar
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Los mensajes de WhatsApp se procesan en el demo activo. Cambia el selector antes de cada
          demostración.
        </p>
      </div>
    </main>
  );
}
