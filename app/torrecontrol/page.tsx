import Link from "next/link";
import type { Metadata } from "next";
import ChipModulo from "@/components/ChipModulo";
import { getActiveDemoSetting, type DemoVertical } from "@/lib/demo-settings";

// TorreControl: WhatsApp → IA → tablero.
//
// Las tres verticales —terreno, actas, mantención— eran hasta ahora tres rutas
// hermanas y sueltas (/terreno, /actas, /mantencion) más un selector en /admin.
// Nunca fueron tres cosas: comparten la tubería de `lib/whatsapp-router.ts`, el
// mismo extractor y la tabla `demo_settings`. Que estuvieran separadas era un
// accidente de cómo se fueron construyendo, y el costo era que nadie podía ver
// el sistema completo ni saber cuál estaba escuchando.
//
// Este índice es la respuesta a esa pregunta —cuál está activa— y nada más. El
// control vive en /torrecontrol/consola, que sí exige sesión.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "TorreControl | adoOps",
  // No es contenido público: es la vitrina de un demo que se abre por link.
  robots: { index: false, follow: false },
};

const VERTICALES: { key: DemoVertical; label: string; desc: string; icon: string }[] = [
  {
    key: "terreno",
    label: "Reportes de Terreno",
    desc: "Campo, cuarteles, avance, incidencias y hoja de trabajo.",
    icon: "🌱",
  },
  {
    key: "actas",
    label: "Actas de Reunión",
    desc: "Título, participantes, decisiones, compromisos y riesgos.",
    icon: "📋",
  },
  {
    key: "mantencion",
    label: "Incidencias y Mantención",
    desc: "Equipo, falla, severidad, alertas y órdenes de trabajo.",
    icon: "🔧",
  },
];

export default async function TorreControl() {
  const activa = await getActiveDemoSetting();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
          adoOps · TorreControl
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">
          De un mensaje de WhatsApp a un tablero
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Alguien manda un audio o una foto por WhatsApp desde donde está trabajando. La misma
          tubería lo transcribe, lo entiende y lo deja estructurado en el tablero de la vertical
          activa. Solo una escucha a la vez.
        </p>

        <div className="mt-8 space-y-3">
          {VERTICALES.map((v) => {
            const esActiva = activa === v.key;
            return (
              <Link
                key={v.key}
                href={`/torrecontrol/${v.key}`}
                className={`block rounded-2xl border p-5 transition hover:border-slate-400 ${
                  esActiva
                    ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{v.icon}</span>
                  <span className="font-semibold text-slate-900">{v.label}</span>
                  {esActiva && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Escuchando
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{v.desc}</p>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-slate-400">
          Para cambiar qué vertical escucha, entra a{" "}
          <Link href="/torrecontrol/consola" className="text-emerald-600 hover:underline">
            la consola
          </Link>
          . Pide la sesión del tablero.
        </p>
      </div>
      <ChipModulo id="torrecontrol" />
    </main>
  );
}
