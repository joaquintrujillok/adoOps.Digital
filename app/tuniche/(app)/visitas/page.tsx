import Image from "next/image";
import Link from "next/link";
import { VISITA } from "@/lib/tuniche/plantillas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { lotesCandidatos, visitasRecientes, type VisitaConContexto } from "@/lib/tuniche/visitas";
import {
  asignarLoteAction,
  descartarVisitaAction,
  recuperarVisitaAction,
  validarVisitaAction,
} from "@/lib/tuniche/visitas.actions";
import EditarVisita from "@/components/tuniche/EditarVisita";
import { valoresDeEtapa } from "@/lib/tuniche/plantillas";
import type { AreaId } from "@/lib/tuniche/areas";
import { generarInformeAction } from "@/lib/tuniche/informes.actions";
import Demo from "@/components/tuniche/Demo";

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
  descartada: { texto: "Descartada", fondo: "var(--tun-plane)", color: "var(--tun-muted)" },
  validada: { texto: "Validada", fondo: "var(--tun-ok-soft)", color: "var(--tun-ok)" },
  corregida: { texto: "Corregida", fondo: "var(--tun-ok-soft)", color: "var(--tun-ok)" },
};

const ESTADO_INFORME: Record<string, string> = {
  borrador: "Informe en borrador · falta el visto bueno",
  aprobado: "Informe con visto bueno · listo para enviar",
  enviado: "Informe enviado al agricultor",
};

/**
 * El puente entre la visita y su informe.
 *
 * **Acá no se aprueba nada, y esa es la decisión.** El visto bueno se da en el
 * informe, mirando el documento completo que va a salir. Aprobar desde una
 * tarjeta resumida sería aprobar algo distinto de lo que se envía — el error
 * clásico que este repo ya evitó una vez en el CRM al separar el texto de la
 * cotización de la pantalla que lo muestra.
 */
function BloqueInforme({ v }: { v: VisitaConContexto }) {
  // Una visita que el zonal todavía no confirmó no tiene qué informar: sería
  // documentar lo que entendió la IA, no lo que vio una persona.
  if (v.estado === "pendiente") return null;

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--tun-border)" }}>
      {v.informeId ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/tuniche/informes/${v.informeId}`}
            className="text-[13.5px] font-medium"
            style={{ color: "var(--tun-brand)" }}
          >
            Ver informe →
          </Link>
          <span
            className="text-[12.5px]"
            style={{
              color: v.informeEstado === "enviado" ? "var(--tun-ok)" : "var(--tun-muted)",
            }}
          >
            {ESTADO_INFORME[v.informeEstado ?? ""] ?? ""}
          </span>
        </div>
      ) : !v.loteId ? (
        <p className="text-[12.5px]" style={{ color: "var(--tun-alerta)" }}>
          Sin lote asignado no se puede generar el informe: no habría a qué campo ni a
          qué agricultor referirse.
        </p>
      ) : (
        <form action={generarInformeAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="visitaId" value={v.id} />
          <button type="submit" className="tun-boton-suave">
            Generar informe
          </button>
          <span className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            Queda en borrador. Nada sale sin el visto bueno de la jefatura.
          </span>
        </form>
      )}
    </div>
  );
}

function Tarjeta({
  v,
  lotes,
}: {
  v: VisitaConContexto;
  lotes: { id: number; area: string; agricultorId: number; codigo: string; agricultor: string }[];
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
            {v.demo && <Demo />}
            {v.origen === "audio" && (
              <span className="text-[12px]" style={{ color: "var(--tun-muted)" }}>
                🎧 audio
              </span>
            )}
            {v.fotos.length > 0 && (
              <span className="text-[12px]" style={{ color: "var(--tun-muted)" }}>
                📷 {v.fotos.length}
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
            {/* Cuando se identificó al agricultor pero no el lote, el desplegable
                se acota a los suyos. Ofrecer los catorce del área obligaría a
                buscar de nuevo lo que el sistema ya sabía. */}
            {v.agricultorId && (
              <p className="mb-1.5 text-[12.5px]" style={{ color: "var(--tun-ink-2)" }}>
                Se identificó a <b>{v.agricultorNombre ?? "el agricultor"}</b>, pero tiene
                más de un lote. Elige cuál.
              </p>
            )}
            <select name="loteId" className="tun-campo" required defaultValue="">
              <option value="" disabled>
                Elige el lote…
              </option>
              {/* Solo los del área de ESTA visita: se levantó con una plantilla
                  y el lote tiene que pertenecer a la misma. La acción lo vuelve
                  a comprobar en el servidor. */}
              {lotes
                .filter(
                  (l) =>
                    l.area === v.area &&
                    (v.agricultorId ? l.agricultorId === v.agricultorId : true),
                )
                .map((l) => (
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

      {v.estado === "descartada" ? (
        <form action={recuperarVisitaAction} className="mt-4">
          <input type="hidden" name="id" value={v.id} />
          <button type="submit" className="tun-boton-suave">
            Recuperar
          </button>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {v.estado === "pendiente" && (
            <form action={validarVisitaAction}>
              <input type="hidden" name="id" value={v.id} />
              <button type="submit" className="tun-boton">
                Validar visita
              </button>
            </form>
          )}
          {/* Descartar está al lado de validar y no escondido: el caso que
              resuelve —un audio mandado por error— aparece justo acá, y si
              obliga a buscarlo, la bandeja se llena de basura que nadie limpia. */}
          <form action={descartarVisitaAction}>
            <input type="hidden" name="id" value={v.id} />
            <button type="submit" className="tun-boton-suave">
              Descartar
            </button>
          </form>
        </div>
      )}

      {v.estado !== "descartada" && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-medium" style={{ color: "var(--tun-brand)" }}>
            Corregir lo que entendió la IA
          </summary>
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--tun-border)" }}>
            <EditarVisita
              visitaId={v.id}
              etapa={v.etapa}
              etapas={valoresDeEtapa(v.area as AreaId)}
              datos={datos}
              nota={v.notaAgronomica}
              resumen={v.resumen ?? ""}
            />
          </div>
        </details>
      )}

      {/* Las fotos, a la vista. Van ANTES del botón de validar y no escondidas
          tras un desplegable: quien confirma tiene que haberlas mirado, y algo
          que hay que abrir para ver es algo que la mitad de las veces no se
          abre. Cada una se amplía en una pestaña nueva. */}
      {v.fotos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {v.fotos.map((f, i) => (
            <a
              key={i}
              href={f.url}
              target="_blank"
              rel="noreferrer"
              className="block"
              title={`Ampliar la foto ${f.tipo}`}
            >
              <figure className="w-[132px]">
                {/* `next/image` para las de Blob, que baja una miniatura en vez
                    de la foto entera; `img` para las de demostración, que son
                    data URIs y no pasan por el optimizador. La diferencia real
                    es de 180 KB a unos pocos: quien mira esta pantalla suele
                    estar en un campo, con el dato justo. */}
                {f.url.startsWith("http") ? (
                  <Image
                    src={f.url}
                    alt={`Foto ${f.tipo} de la visita`}
                    width={132}
                    height={96}
                    className="h-[96px] w-[132px] rounded-lg object-cover"
                    style={{ border: "1px solid var(--tun-border)" }}
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={f.url}
                    alt={`Foto ${f.tipo} de la visita`}
                    loading="lazy"
                    className="h-[96px] w-[132px] rounded-lg object-cover"
                    style={{ border: "1px solid var(--tun-border)" }}
                  />
                )}
                <figcaption
                  className="mt-1 text-[11px] capitalize"
                  style={{ color: "var(--tun-muted)" }}
                >
                  {f.tipo}
                </figcaption>
              </figure>
            </a>
          ))}
        </div>
      )}

      <BloqueInforme v={v} />

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

  const pendientes = todas.filter((v) => v.estado === "pendiente");
  const resto = todas.filter((v) => v.estado === "validada" || v.estado === "corregida");
  const descartadas = todas.filter((v) => v.estado === "descartada");
  const sinInforme = resto.filter((v) => v.loteId && !v.informeId).length;

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
        {sinInforme > 0 && (
          <p className="mt-3 text-[13.5px]" style={{ color: "var(--tun-alerta)" }}>
            {sinInforme}{" "}
            {sinInforme === 1
              ? "visita validada todavía no tiene informe generado"
              : "visitas validadas todavía no tienen informe generado"}
            .
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
              <Tarjeta key={v.id} v={v} lotes={lotes} />
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
              <Tarjeta key={v.id} v={v} lotes={lotes} />
            ))}
          </div>
        </section>
      )}

      {/* Plegadas: son las que alguien decidió que no cuentan, y ocupar la
          pantalla con ellas es al revés de para qué se descartaron. Pero siguen
          ahí: descartar por error el audio de una visita que sí ocurrió no
          puede ser irreversible — el audio en WhatsApp también expira. */}
      {descartadas.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[15px] font-semibold" style={{ color: "var(--tun-muted)" }}>
            Descartadas ({descartadas.length})
          </summary>
          <div className="mt-3 space-y-3">
            {descartadas.map((v) => (
              <Tarjeta key={v.id} v={v} lotes={lotes} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
