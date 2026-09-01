// Reuniones: lo que se conversó, guardado, corregido y buscable.
//
// La entrada de este módulo no es una pantalla sino un webhook: una extensión
// de navegador (TranscripTonic) manda la transcripción de Google Meet al
// colgar. No hay ningún bot que se una a la reunión —la captura la hace el
// navegador de quien ya está adentro—, así que en la llamada no aparece un
// participante extra.
//
// ── Por qué el buscador entra al texto y no solo al título ───────────────────
//
// El título que manda Meet es el código de la sala: "Meet - ppb-cxec-ujo".
// Nadie recuerda una reunión por eso. Se recuerda por una palabra que se dijo
// adentro —el nombre de un cliente, un número, una idea—, y por eso la búsqueda
// va contra la transcripción completa. Un buscador que solo mirara el título
// sería un buscador que nunca encuentra nada.
//
// ── La cuenta activa es el filtro, y no hay pestañas ─────────────────────────
//
// Acá hubo pestañas de ámbito y duraron poco: eran un segundo eje que decía casi
// lo mismo que la cuenta del tablero. Ahora el selector de la barra lateral
// manda —ver `lib/cuentas.ts`— y esta pantalla muestra solo las reuniones de la
// cuenta en la que estás parado.
//
// Es más estricto que unas pestañas, y a propósito: con pestañas, mostrar el
// tablero en una reunión de venta dejaba las conversaciones personales a un clic
// de distancia. Con cuentas, para verlas hay que cambiarse de mundo.

import Link from "next/link";
import { Badge, Card, PageHeader, Vacio, btnPrimario, btnSecundario } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { disponible, gasto, huerfanas, listar } from "@/lib/dashboard360/reuniones";
import { resolverCuenta } from "@/lib/cuentas";

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

const USD = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const campo =
  "rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]";

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    sinCuenta?: string;
  }>;
}) {
  const sesion = await requireSession();
  const { q, desde, hasta, sinCuenta } = await searchParams;
  const cuenta = resolverCuenta(sesion.cuenta, sesion.cuentas);
  const rescate = sinCuenta === "1";

  const [hay, reuniones, plata, sueltas] = await Promise.all([
    disponible(),
    listar(
      rescate
        ? { q, desde, hasta, sinCuenta: true }
        : { q, desde, hasta, ambito: cuenta.id },
    ),
    gasto(cuenta.id),
    huerfanas(),
  ]);

  const hayFiltro = Boolean(q || desde || hasta);
  const pendientes = reuniones.filter((r) => r.estado !== "resumida").length;

  return (
    <>
      <PageHeader
        titulo="Reuniones"
        bajada="Lo que se dijo en cada Meet, corregido y buscable. Entra solo cuando la reunión termina."
        acciones={
          <Link className={btnSecundario} href="/dashboard360/reuniones/vivo">
            Escuchar en vivo
          </Link>
        }
      />

      {/* Las huérfanas se avisan y no se esconden. La lista filtra por cuenta,
          así que una fila sin cuenta no aparece en ninguna: sin este aviso se
          perdería en silencio, que es la peor forma de perder algo. */}
      {sueltas > 0 && !rescate ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e6d9b0] bg-[#fdf8e9] p-3 text-[12.5px] text-[#7a6417]">
          <span>
            Hay {sueltas} {sueltas === 1 ? "reunión" : "reuniones"} sin cuenta
            asignada, de antes de que existieran las cuentas.
          </span>
          <Link className={btnSecundario} href="/dashboard360/reuniones?sinCuenta=1">
            Verlas
          </Link>
        </div>
      ) : null}

      {rescate ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--d360-border)] bg-white p-3 text-[12.5px] text-[var(--d360-ink-2)]">
          <span>
            Reuniones sin cuenta. Se asignan desde el detalle de cada una.
          </span>
          <Link className={btnSecundario} href="/dashboard360/reuniones">
            Volver a {cuenta.nombre}
          </Link>
        </div>
      ) : null}

      <Card className="mb-4" titulo="Buscar" descripcion="El texto se busca adentro de la transcripción, no solo en el título">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {rescate ? <input type="hidden" name="sinCuenta" value="1" /> : null}
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Qué se dijo</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="una palabra, un nombre, un número"
              className={`${campo} w-72`}
            />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Desde</span>
            <input type="date" name="desde" defaultValue={desde ?? ""} className={campo} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Hasta</span>
            <input type="date" name="hasta" defaultValue={hasta ?? ""} className={campo} />
          </label>
          <button className={btnPrimario} type="submit">
            Buscar
          </button>
          {hayFiltro ? (
            <Link
              className={btnSecundario}
              href={`/dashboard360/reuniones${rescate ? "?sinCuenta=1" : ""}`}
            >
              Limpiar
            </Link>
          ) : null}
        </form>
      </Card>

      {plata.reuniones > 0 ? (
        <p className="d360-num mb-4 text-[12px] text-[var(--d360-muted)]">
          Costo de la IA: {USD.format(plata.totalUsd)}
          {plata.aproximado ? " aprox." : ""} en {plata.reuniones}{" "}
          {plata.reuniones === 1 ? "reunión" : "reuniones"} ·{" "}
          {USD.format(plata.totalUsd / plata.reuniones)} cada una en promedio
        </p>
      ) : null}

      <Card
        titulo={
          rescate ? "Sin cuenta" : hayFiltro ? "Resultados" : `Reuniones de ${cuenta.nombre}`
        }
        descripcion={
          reuniones.length === 0
            ? hayFiltro
              ? "Ninguna calza con el filtro"
              : "Ninguna todavía"
            : pendientes > 0
              ? `${reuniones.length} · ${pendientes} sin procesar`
              : `${reuniones.length} guardadas`
        }
      >
        {!hay ? (
          <Vacio
            mensaje="El módulo de reuniones no está desplegado acá"
            sugerencia="Faltan las tablas reunion_*. Corre node scripts/reuniones-setup.mjs."
          />
        ) : reuniones.length === 0 ? (
          <Vacio
            mensaje={
              hayFiltro
                ? "Nada calza con esa búsqueda"
                : `Ninguna reunión en ${cuenta.nombre} todavía`
            }
            sugerencia={
              hayFiltro
                ? "Prueba con menos palabras, o quita el filtro de fechas."
                : `Las reuniones llegan con el token cuyo ámbito es "${cuenta.id}". Está explicado en docs/reuniones.md.`
            }
          />
        ) : (
          <div className="space-y-3">
            {reuniones.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-[var(--d360-border)] p-4 transition-colors hover:border-[var(--d360-brand)]"
              >
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="d360-num text-[11.5px] text-[var(--d360-muted)]">
                    {/* Sin fecha parseable se muestra cuándo llegó, y se dice
                        que es eso. Una hora sin etiqueta se lee como la hora de
                        la reunión, y no lo es. */}
                    {r.inicioEn ? FMT.format(r.inicioEn) : `recibida ${FMT.format(r.createdAt)}`}
                    {r.duracionMin !== null ? ` · ${r.duracionMin} min` : ""}
                    {rescate && r.ambito ? ` · ${r.ambito}` : ""}
                  </div>
                  {r.estado !== "resumida" ? (
                    <Badge tono={r.estado === "error" ? "critico" : "alerta"}>
                      {r.estado === "error" ? "falló el procesamiento" : "procesando"}
                    </Badge>
                  ) : null}
                </div>

                <Link
                  href={`/dashboard360/reuniones/${r.id}`}
                  className="mb-1 block text-[14px] font-semibold text-[var(--d360-ink)] hover:text-[var(--d360-brand-dark)]"
                >
                  {r.titulo || "Reunión sin título"}
                </Link>

                <p className="line-clamp-2 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
                  {r.resumen ||
                    (r.estado === "error"
                      ? "La IA no pudo procesarla. La transcripción está guardada: se puede reintentar."
                      : "Se está corrigiendo y resumiendo.")}
                </p>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11.5px] text-[var(--d360-muted)]">
                    {r.participantes && r.participantes.length > 0
                      ? r.participantes.join(" · ")
                      : "sin hablantes identificados"}
                  </div>
                  {/* Enlace y no botón: es una descarga, o sea una navegación.
                      Va en la lista además del detalle porque bajar el txt es la
                      acción más frecuente y no debería costar dos pantallas. */}
                  <a
                    className={btnSecundario}
                    href={`/api/dashboard360/reuniones/${r.id}/txt`}
                    download
                  >
                    Descargar .txt
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
