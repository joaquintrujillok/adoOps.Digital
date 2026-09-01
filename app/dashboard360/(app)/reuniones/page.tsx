// Reuniones: lo que se conversó, guardado y resumido.
//
// La entrada de este módulo no es una pantalla sino un webhook: una extensión
// de navegador (TranscripTonic) manda la transcripción de Google Meet al
// colgar, y acá se lee el resultado. No hay ningún bot que se una a la reunión
// —la captura la hace el navegador de quien ya está adentro—, así que en la
// llamada no aparece un participante extra.
//
// ── Por qué la lista muestra el resumen y no el título ───────────────────────
//
// El título que manda Meet es casi siempre inútil: "Reunión de Joaquín" o el
// código de la sala. Lo que permite reconocer una reunión un mes después es de
// qué se trató, y eso está en la primera línea del resumen. El título queda,
// pero como dato secundario.

import Link from "next/link";
import { Badge, Card, PageHeader, Vacio } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { disponible, gasto, listar } from "@/lib/dashboard360/reuniones";

export const dynamic = "force-dynamic";

// La zona va explícita y no se deja al servidor: en Vercel el proceso corre en
// UTC, así que sin esto una reunión de las 10 de la mañana se leería a las 14.
// Ver la nota de `inicioEn` en `db/reuniones.ts`.
const FMT = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Santiago",
});

export default async function ReunionesPage() {
  await requireSession();
  const [hay, reuniones, plata] = await Promise.all([disponible(), listar(), gasto()]);

  const pendientes = reuniones.filter((r) => r.estado !== "resumida").length;

  // Cuatro decimales y no dos: un resumen cuesta del orden de dos milésimas de
  // dólar, y redondear a centavos mostraría "US$0,00" para siempre. El promedio
  // va al lado del total porque el total solo crece y no dice nada por sí solo
  // —lo que permite decidir es cuánto cuesta una reunión más—.
  const USD = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

  return (
    <>
      <PageHeader
        titulo="Reuniones"
        bajada="Lo que se dijo en cada Meet, resumido. Entra solo cuando la reunión termina."
      />

      {plata.reuniones > 0 ? (
        <p className="d360-num mb-4 text-[12px] text-[var(--d360-muted)]">
          Costo de los resúmenes: {USD.format(plata.totalUsd)}
          {plata.aproximado ? " aprox." : ""} en {plata.reuniones}{" "}
          {plata.reuniones === 1 ? "reunión" : "reuniones"} ·{" "}
          {USD.format(plata.totalUsd / plata.reuniones)} cada una en promedio
        </p>
      ) : null}

      <Card
        titulo="Últimas reuniones"
        descripcion={
          reuniones.length === 0
            ? "Ninguna todavía"
            : pendientes > 0
              ? `${reuniones.length} guardadas · ${pendientes} sin resumen`
              : `${reuniones.length} guardadas y resumidas`
        }
      >
        {!hay ? (
          <Vacio
            mensaje="El módulo de reuniones no está desplegado acá"
            sugerencia="Faltan las tablas reunion_*. Corré node scripts/reuniones-setup.mjs."
          />
        ) : reuniones.length === 0 ? (
          <Vacio
            mensaje="No ha llegado ninguna reunión"
            sugerencia="Falta conectar la extensión del navegador al webhook. Está explicado en docs/reuniones.md."
          />
        ) : (
          <div className="space-y-3">
            {reuniones.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard360/reuniones/${r.id}`}
                className="block rounded-lg border border-[var(--d360-border)] p-4 transition-colors hover:border-[var(--d360-brand)]"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="d360-num text-[11.5px] text-[var(--d360-muted)]">
                    {/* Sin fecha parseable se muestra cuándo llegó, y se dice
                        que es eso. Una hora sin etiqueta se lee como la hora de
                        la reunión, y no lo es. */}
                    {r.inicioEn
                      ? FMT.format(r.inicioEn)
                      : `recibida ${FMT.format(r.createdAt)}`}
                    {r.duracionMin !== null ? ` · ${r.duracionMin} min` : ""}
                    {r.plataforma ? ` · ${r.plataforma}` : ""}
                  </div>
                  <Badge
                    tono={
                      r.estado === "resumida"
                        ? "bueno"
                        : r.estado === "error"
                          ? "critico"
                          : "alerta"
                    }
                  >
                    {r.estado === "resumida"
                      ? "resumida"
                      : r.estado === "error"
                        ? "falló el resumen"
                        : "resumiendo"}
                  </Badge>
                </div>

                <div className="mb-1 text-[14px] font-semibold text-[var(--d360-ink)]">
                  {r.titulo || "Reunión sin título"}
                </div>

                <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
                  {r.resumen ||
                    (r.estado === "error"
                      ? "La IA no pudo resumirla. La transcripción está guardada: se puede reintentar."
                      : "El resumen se está generando.")}
                </p>

                {r.participantes && r.participantes.length > 0 ? (
                  <div className="mt-2 text-[11.5px] text-[var(--d360-muted)]">
                    {r.participantes.join(" · ")}
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
