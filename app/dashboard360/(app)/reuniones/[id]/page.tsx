// El detalle de una reunión: el resumen arriba, la transcripción al fondo.
//
// ── Por qué la transcripción va plegada y no en otra pantalla ────────────────
//
// Porque la pregunta que la hace falta es siempre la misma —"¿de verdad dijo
// eso?"— y aparece justo mientras se lee el resumen. Un clic para abrirla, en
// la misma página, es la distancia correcta: lejos para no estorbar, cerca para
// poder desconfiar del resumen sin perder el hilo.
//
// Y hay que poder desconfiar. Esto es un modelo leyendo lo que el reconocedor
// de voz de Google creyó escuchar: dos capas de error antes de la primera
// palabra en pantalla. El texto original es la única forma de verificar, y por
// eso nunca se borra ni se edita.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, btnPrimario, btnSecundario } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { detalle } from "@/lib/dashboard360/reuniones";
import {
  alternarCompromisoAction,
  reintentarResumenAction,
} from "@/lib/reuniones/acciones";

export const dynamic = "force-dynamic";

// Zona explícita, misma razón que en la lista: el servidor corre en UTC.
const FMT = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

const TONO_PRIORIDAD = { alta: "critico", media: "alerta", baja: "neutro" } as const;

// Misma escala que en la lista: cuatro decimales, porque un resumen cuesta del
// orden de dos milésimas de dólar.
const USD = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card className="mt-6" titulo={titulo} descripcion={`${items.length}`}>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
            <span aria-hidden className="text-[var(--d360-muted)]">
              ·
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function ReunionDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const numero = Number(id);
  if (!Number.isInteger(numero)) notFound();

  const dato = await detalle(numero);
  if (!dato) notFound();

  const { reunion: r, compromisos } = dato;
  const e = r.extraccion;

  return (
    <>
      <div className="mb-3">
        <Link
          href="/dashboard360/reuniones"
          className="text-[12.5px] text-[var(--d360-muted)] hover:text-[var(--d360-brand-dark)]"
        >
          ← Reuniones
        </Link>
      </div>

      <PageHeader
        titulo={r.titulo || "Reunión sin título"}
        bajada={[
          r.inicioEn ? FMT.format(r.inicioEn) : `Recibida el ${FMT.format(r.createdAt)}`,
          r.duracionMin !== null ? `${r.duracionMin} min` : null,
          r.plataforma,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {r.participantes && r.participantes.length > 0 ? (
        <p className="mb-5 text-[12.5px] text-[var(--d360-muted)]">
          Hablaron: {r.participantes.join(", ")}
          {/* Se dice "hablaron" y no "participantes" porque es lo único que el
              transcript puede afirmar: quien estuvo callado no aparece. */}
        </p>
      ) : null}

      {r.estado !== "resumida" ? (
        <div
          className={`mb-6 rounded-lg border p-4 text-[13px] ${
            r.estado === "error"
              ? "border-[#f0c2c2] bg-[#fdf1f1] text-[#8f2c2c]"
              : "border-[#e6d9b0] bg-[#fdf8e9] text-[#7a6417]"
          }`}
        >
          <p className="mb-3">
            {r.estado === "error"
              ? "La IA no pudo resumir esta reunión. La transcripción está guardada completa, así que no se perdió nada."
              : "El resumen todavía no está listo. Si lleva más de un par de minutos así, el proceso se cortó."}
          </p>
          {r.error ? (
            <p className="d360-num mb-3 break-words text-[11.5px] opacity-80">
              {r.error}
              {r.intentos > 1 ? ` · ${r.intentos} intentos` : ""}
            </p>
          ) : null}
          <form action={reintentarResumenAction}>
            <input type="hidden" name="id" value={r.id} />
            <button className={btnPrimario} type="submit">
              Reintentar el resumen
            </button>
          </form>
        </div>
      ) : null}

      {r.resumen ? (
        <Card titulo="Resumen" descripcion="Generado por IA a partir de la transcripción">
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--d360-ink)]">
            {r.resumen}
          </p>
          {/* El costo va acá abajo, chico, y no en un tablero de gastos aparte:
              la pregunta "¿valió la pena?" se hace mirando el resumen, no una
              planilla. */}
          {r.modelo ? (
            <p className="d360-num mt-4 border-t border-[var(--d360-border)] pt-3 text-[11.5px] text-[var(--d360-muted)]">
              {r.modelo} · {(r.tokensEntrada ?? 0).toLocaleString("es-CL")} tokens de
              entrada
              {r.tokensEntradaCache ? ` (${r.tokensEntradaCache.toLocaleString("es-CL")} en caché)` : ""}
              {" · "}
              {(r.tokensSalida ?? 0).toLocaleString("es-CL")} de salida ·{" "}
              {/* El "aprox." no es coquetería: los modelos gpt-5.6 cobran el
                  doble pasado cierto largo de contexto, la página de precios no
                  dice dónde está el corte y la API no informa qué tramo aplicó.
                  Ese número es un piso, no una certeza. */}
              {r.costoUsd !== null
                ? `${USD.format(Number(r.costoUsd))}${r.costoAproximado ? " aprox." : ""}`
                : "costo desconocido: el modelo no está en la tabla de tarifas"}
            </p>
          ) : null}
        </Card>
      ) : null}

      <Lista titulo="Decisiones" items={e?.decisiones ?? []} />

      {compromisos.length > 0 ? (
        <Card
          className="mt-6"
          titulo="Compromisos"
          descripcion={`${compromisos.filter((c) => c.estado !== "hecho").length} pendientes de ${compromisos.length}`}
        >
          <div className="space-y-2">
            {compromisos.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--d360-border)] p-3"
              >
                <div className="min-w-0">
                  <div
                    className={`text-[13px] leading-relaxed ${
                      c.estado === "hecho"
                        ? "text-[var(--d360-muted)] line-through"
                        : "text-[var(--d360-ink)]"
                    }`}
                  >
                    {c.compromiso}
                  </div>
                  <div className="d360-num mt-1 text-[11.5px] text-[var(--d360-muted)]">
                    {c.responsable || "sin responsable asignado"}
                    {c.plazo ? ` · ${c.plazo}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tono={TONO_PRIORIDAD[c.prioridad as keyof typeof TONO_PRIORIDAD] ?? "neutro"}>
                    {c.prioridad}
                  </Badge>
                  <form action={alternarCompromisoAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="reunionId" value={r.id} />
                    <button className={btnSecundario} type="submit">
                      {c.estado === "hecho" ? "Reabrir" : "Hecho"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Lista titulo="Riesgos y temas trabados" items={e?.riesgos ?? []} />
      <Lista titulo="Temas tratados" items={e?.temas ?? []} />

      {e?.proximaReunion ? (
        <Card className="mt-6" titulo="Próxima reunión">
          <p className="text-[13px] text-[var(--d360-ink-2)]">{e.proximaReunion}</p>
        </Card>
      ) : null}

      <Card
        className="mt-6"
        titulo="Transcripción"
        descripcion="El texto literal. Es lo que la IA leyó."
      >
        <details>
          <summary className="cursor-pointer text-[13px] text-[var(--d360-brand-dark)]">
            Ver la transcripción completa
          </summary>
          <pre className="mt-3 max-h-[600px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#f6f8fa] p-4 text-[12.5px] leading-relaxed text-[var(--d360-ink-2)]">
            {r.transcripcion}
          </pre>
        </details>
      </Card>
    </>
  );
}
