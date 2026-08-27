import Link from "next/link";
import { VISITA } from "@/lib/tuniche/plantillas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { lotesCandidatos, visitasRecientes, type VisitaConContexto } from "@/lib/tuniche/visitas";
import {
  aprobarEnvioAction,
  asignarLoteAction,
  retirarAprobacionAction,
  validarVisitaAction,
} from "@/lib/tuniche/visitas.actions";
import { puedeEnviarAlAgricultor } from "@/lib/tuniche/session";

export const dynamic = "force-dynamic";

function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const ESTADO: Record<string, { texto: string; fondo: string; color: string }> = {
  pendiente: { texto: "Por validar", fondo: "var(--tun-alerta-soft)", color: "var(--tun-alerta)" },
  validada: { texto: "Validada", fondo: "var(--tun-ok-soft)", color: "var(--tun-ok)" },
  corregida: { texto: "Corregida", fondo: "var(--tun-ok-soft)", color: "var(--tun-ok)" },
};

function fechaCorta(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(d);
}

/**
 * El bloque del visto bueno.
 *
 * **Va abajo del todo y separado por una línea a propósito.** Todo lo de arriba
 * pasa dentro de Tuniche; esto es lo único que sale hacia afuera, hacia un
 * cliente. Mezclarlo con los otros botones invitaría a despacharlo con el mismo
 * clic distraído, y es la única acción de esta pantalla que no se puede deshacer
 * una vez ejecutada.
 */
function VistoBueno({ v, puede }: { v: VisitaConContexto; puede: boolean }) {
  // Una visita que el zonal todavía no confirmó no tiene qué aprobar: sería dar
  // el visto bueno a lo que entendió la IA, no a lo que vio una persona.
  if (v.estado === "pendiente") return null;

  const enviada = v.enviadaAlAgricultorEn;
  const aprobada = v.aprobadaEn;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--tun-border)" }}>
      {enviada ? (
        <p className="text-[13px]" style={{ color: "var(--tun-ok)" }}>
          ✓ Enviada al agricultor el {fechaCorta(enviada)}
          {v.aprobadaPorNombre ? ` · visto bueno de ${v.aprobadaPorNombre}` : ""}
        </p>
      ) : aprobada ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px]" style={{ color: "var(--tun-ok)" }}>
            ✓ Visto bueno de {v.aprobadaPorNombre ?? "jefatura"} · {fechaCorta(aprobada)}
          </span>
          {!v.agricultorTelefono && (
            <span className="text-[12.5px]" style={{ color: "var(--tun-alerta)" }}>
              — pero este agricultor no tiene teléfono, así que todavía no puede salir.
            </span>
          )}
          {puede && (
            <form action={retirarAprobacionAction}>
              <input type="hidden" name="id" value={v.id} />
              <button type="submit" className="tun-boton-suave">
                Retirar visto bueno
              </button>
            </form>
          )}
        </div>
      ) : puede ? (
        <div className="flex flex-wrap items-center gap-3">
          <form action={aprobarEnvioAction}>
            <input type="hidden" name="id" value={v.id} />
            <button type="submit" className="tun-boton-suave">
              Dar visto bueno para enviar al agricultor
            </button>
          </form>
          <span className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            Nada sale de Tuniche sin esto. Nunca es automático.
          </span>
        </div>
      ) : (
        <p className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
          Esperando el visto bueno de la jefatura de tu área para poder enviarse al
          agricultor.
        </p>
      )}
    </div>
  );
}

function Tarjeta({
  v,
  lotes,
  puedeAprobar,
}: {
  v: VisitaConContexto;
  lotes: { id: number; codigo: string; agricultor: string }[];
  puedeAprobar: boolean;
}) {
  const e = ESTADO[v.estado] ?? ESTADO.pendiente;
  const datos = (v.datos ?? {}) as Record<string, unknown>;
  const mencionado = datos._loteMencionado as string | undefined;

  return (
    <div className="tun-tarjeta p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {v.loteCodigo ? (
              <Link
                href={`/tuniche/lotes/${v.loteId}`}
                className="text-[15px] font-semibold"
                style={{ color: "var(--tun-ink)" }}
              >
                {v.loteCodigo}
              </Link>
            ) : (
              <span className="text-[15px] font-semibold" style={{ color: "var(--tun-alerta)" }}>
                Sin lote asignado
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: e.fondo, color: e.color }}
            >
              {e.texto}
            </span>
            {v.origen === "audio" && (
              <span className="text-[12px]" style={{ color: "var(--tun-muted)" }}>
                🎧 audio
              </span>
            )}
            {v.fotos > 0 && (
              <span className="text-[12px]" style={{ color: "var(--tun-muted)" }}>
                📷 {v.fotos}
              </span>
            )}
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
            {v.agricultorNombre ?? "—"} · {fecha(v.fecha)}
            {v.etapa ? ` · ${v.etapa}` : ""}
          </div>
        </div>

        {v.notaAgronomica != null && (
          <span className="text-[20px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            {v.notaAgronomica}%
          </span>
        )}
      </div>

      {v.resumen && (
        <p className="mt-3 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          {v.resumen}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]" style={{ color: "var(--tun-ink-2)" }}>
        {VISITA.filter((c) => c.id !== "etapa" && c.tipo !== "fotos" && c.id !== "nota_agronomica").map(
          (c) => {
            const val = datos[c.id];
            if (val == null || (Array.isArray(val) && !val.length)) return null;
            return (
              <span key={c.id}>
                <span style={{ color: "var(--tun-muted)" }}>{c.etiqueta}:</span>{" "}
                {Array.isArray(val) ? val.join("; ") : String(val)}
              </span>
            );
          },
        )}
      </div>

      {/* Sin lote, la visita no entra al historial de nadie: el audio se levantó
          y se perdió. Por eso el selector va acá arriba y no escondido en una
          pantalla de edición. */}
      {!v.loteId && (
        <form action={asignarLoteAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="visitaId" value={v.id} />
          <div className="min-w-[280px] flex-1">
            <label className="tun-etiqueta">
              Asignar lote
              {mencionado && (
                <span style={{ color: "var(--tun-muted)" }}> — el zonal dijo «{mencionado}»</span>
              )}
            </label>
            <select name="loteId" className="tun-campo" required defaultValue="">
              <option value="" disabled>
                Elige el lote…
              </option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} — {l.agricultor}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="tun-boton-suave">
            Asignar
          </button>
        </form>
      )}

      {v.estado === "pendiente" && (
        <form action={validarVisitaAction} className="mt-4">
          <input type="hidden" name="id" value={v.id} />
          <button type="submit" className="tun-boton">
            Validar visita
          </button>
        </form>
      )}

      <VistoBueno v={v} puede={puedeAprobar} />

      {v.transcripcion && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px]" style={{ color: "var(--tun-brand)" }}>
            Lo que dijo el zonal
          </summary>
          <p
            className="mt-2 whitespace-pre-wrap rounded-lg p-3 text-[13px]"
            style={{ background: "var(--tun-plane)", color: "var(--tun-ink-2)" }}
          >
            {v.transcripcion}
          </p>
        </details>
      )}
    </div>
  );
}

export default async function Visitas() {
  const s = await requireSesion();
  const alcance = await alcanceActual();
  const [todas, lotes] = await Promise.all([visitasRecientes(alcance), lotesCandidatos(alcance)]);

  const puedeAprobar = puedeEnviarAlAgricultor(s);
  const pendientes = todas.filter((v) => v.estado === "pendiente");
  const resto = todas.filter((v) => v.estado !== "pendiente");
  const porAprobar = resto.filter((v) => !v.aprobadaEn && !v.enviadaAlAgricultorEn).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Visitas
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Manda un audio por WhatsApp desde el campo y aparece acá para que lo
          confirmes. Nada entra al historial sin que el zonal lo valide, y nada sale
          al agricultor sin el visto bueno de la jefatura.
        </p>
        {puedeAprobar && porAprobar > 0 && (
          <p className="mt-3 text-[13.5px]" style={{ color: "var(--tun-alerta)" }}>
            {porAprobar}{" "}
            {porAprobar === 1
              ? "visita validada espera tu visto bueno"
              : "visitas validadas esperan tu visto bueno"}{" "}
            para poder enviarse.
          </p>
        )}
      </header>

      {todas.length === 0 && (
        <div className="tun-tarjeta p-5">
          <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
            Todavía no hay visitas. Manda un audio al número de WhatsApp del sistema
            desde el teléfono registrado en tu cuenta —
            {s.rol === "admin"
              ? " y revisa en Mi cuenta desde qué área estás probando."
              : " el que está en Mi cuenta."}
          </p>
        </div>
      )}

      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Por validar ({pendientes.length})
          </h2>
          <div className="space-y-3">
            {pendientes.map((v) => (
              <Tarjeta key={v.id} v={v} lotes={lotes} puedeAprobar={puedeAprobar} />
            ))}
          </div>
        </section>
      )}

      {resto.length > 0 && (
        <section>
          <h2 className="mb-3 text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Registradas
          </h2>
          <div className="space-y-3">
            {resto.map((v) => (
              <Tarjeta key={v.id} v={v} lotes={lotes} puedeAprobar={puedeAprobar} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
