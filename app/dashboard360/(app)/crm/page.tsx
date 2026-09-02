// El pipeline de adoOps: una columna por etapa, las tarjetas adentro.
//
// ── Por qué columnas y no una tabla ──────────────────────────────────────────
//
// Porque la pregunta que se le hace a un pipeline no es "¿qué oportunidades
// tengo?" sino "¿dónde está atascado esto?", y esa se contesta mirando de qué
// altura es cada columna. Una tabla ordenada por monto responde otra cosa.
//
// ── Por qué no se arrastra ───────────────────────────────────────────────────
//
// Mover una tarjeta es un formulario con un botón por etapa, no un drag and
// drop. Arrastrar exige JavaScript en el cliente, estado optimista y una forma
// de deshacer cuando el servidor rechaza; con un pipeline de decenas de
// oportunidades, un clic en un menú es igual de rápido y no puede quedar en un
// estado que la base no tenga. Si algún día son cientos y el arrastre se
// justifica, se agrega encima de estas mismas acciones.

import Link from "next/link";
import { Card, PageHeader, Vacio, btnPrimario } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { cerradas, contactos, disponible, tablero } from "@/lib/venta/consultas";
import { crearOportunidadAction } from "@/lib/venta/acciones";
import { FUENTES, FUENTE_POR_DEFECTO, nombreEtapa } from "@/lib/venta/etapas";

export const dynamic = "force-dynamic";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Santiago",
});

const campo =
  "rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]";

/** Hace cuántos días que nadie toca esto. Null si nunca hubo actividad. */
function diasSin(fecha: Date | null): number | null {
  if (!fecha) return null;
  return Math.floor((Date.now() - fecha.getTime()) / 86_400_000);
}

export default async function CrmPage() {
  await requireSession();
  const [hay, columnas, gente, historial] = await Promise.all([
    disponible(),
    tablero(),
    contactos(),
    cerradas(10),
  ]);

  const abiertas = columnas.reduce((a, c) => a + c.tarjetas.length, 0);
  const total = columnas.reduce((a, c) => a + c.total, 0);
  // El ponderado es la única cifra honesta para un pronóstico: sumar el pipeline
  // entero cuenta como ingreso lo que todavía es una conversación.
  const ponderado = columnas.reduce(
    (a, c) => a + c.tarjetas.reduce((b, t) => b + (t.monto * t.probabilidad) / 100, 0),
    0,
  );

  if (!hay) {
    return (
      <>
        <PageHeader titulo="CRM" bajada="El pipeline comercial de adoOps." />
        <Card>
          <Vacio
            mensaje="El CRM no está desplegado acá"
            sugerencia="Faltan las tablas venta_*. Corre node scripts/venta-setup.mjs."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="CRM"
        bajada={
          abiertas === 0
            ? "El pipeline comercial de adoOps. Todavía vacío."
            : `${abiertas} oportunidades abiertas · ${CLP.format(total)} en juego · ${CLP.format(ponderado)} ponderado por probabilidad`
        }
      />

      {/* El tablero. Scroll horizontal propio: siete columnas no caben en un
          portátil, y hacer scroll a la página entera para ver la última pierde
          de vista los totales. */}
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3 px-1">
          {columnas.map((col) => (
            <section
              key={col.etapa}
              className="flex w-[260px] shrink-0 flex-col rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-3"
            >
              <header className="mb-3">
                <h2 className="text-[12.5px] font-semibold text-[var(--d360-ink)]">
                  {col.nombre}
                </h2>
                <p className="d360-num text-[11px] text-[var(--d360-muted)]">
                  {col.tarjetas.length} · {CLP.format(col.total)}
                </p>
              </header>

              <div className="space-y-2">
                {col.tarjetas.length === 0 ? (
                  <p className="py-3 text-center text-[11.5px] text-[var(--d360-muted)]">
                    vacía
                  </p>
                ) : (
                  col.tarjetas.map((t) => {
                    const dias = diasSin(t.ultimaActividad);
                    // Catorce días es el umbral de "fría". Se pinta en la tarjeta
                    // y no solo en un contador, porque el contador dice cuántas
                    // hay y la tarjeta dice cuál.
                    const fria = dias !== null && dias >= 14;
                    return (
                      <Link
                        key={t.id}
                        href={`/dashboard360/crm/oportunidades/${t.id}`}
                        className={`block rounded-lg border p-3 transition-colors hover:border-[var(--d360-brand)] ${
                          fria
                            ? "border-[#e6d9b0] bg-[#fdf8e9]"
                            : "border-[var(--d360-border)] bg-white"
                        }`}
                      >
                        <p className="text-[13px] font-medium leading-snug text-[var(--d360-ink)]">
                          {t.titulo}
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-[var(--d360-muted)]">
                          {t.contacto}
                          {t.empresa ? ` · ${t.empresa}` : ""}
                        </p>
                        <p className="d360-num mt-1.5 text-[11.5px] text-[var(--d360-ink-2)]">
                          {t.monto > 0 ? CLP.format(t.monto) : "sin monto"}
                          {t.cierreEstimado ? ` · cierra ${t.cierreEstimado}` : ""}
                        </p>
                        {fria ? (
                          <p className="mt-1 text-[11px] font-medium text-[#8a6d1f]">
                            {dias} días sin actividad
                          </p>
                        ) : null}
                      </Link>
                    );
                  })
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Card
        className="mt-6"
        titulo="Nueva oportunidad"
        descripcion="Siempre va a nombre de una persona. Si es nueva, se crea acá mismo."
      >
        <form action={crearOportunidadAction} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Título</span>
              <input
                name="titulo"
                required
                className={`${campo} w-64`}
                placeholder="Qué se le vende"
              />
            </label>
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Monto (CLP)</span>
              <input name="monto" type="number" min="0" step="1000" className={`${campo} w-36`} />
            </label>
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Origen</span>
              <select
                name="fuente"
                defaultValue={FUENTE_POR_DEFECTO}
                className={`${campo} w-48`}
              >
                {FUENTES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-[var(--d360-ink-2)]">
              <span className="mb-1 block">Cierre estimado</span>
              <input name="cierreEstimado" type="date" className={campo} />
            </label>
          </div>

          {/* ── La persona ────────────────────────────────────────────────────
              Las dos vías conviven en el mismo formulario, sin pestañas ni
              JavaScript: se elige de la lista, o se escribe abajo. Con la cartera
              vacía la lista viene en "persona nueva" y el camino es uno solo.

              La versión anterior exigía que el contacto ya existiera y, sin
              contactos, no mostraba formulario: decía "agrega un contacto
              primero" y no llevaba a ninguna parte. La regla era correcta; el
              momento de cobrarla, el peor posible. */}
          <div className="rounded-lg border border-[var(--d360-border)] bg-[#f9fbfc] p-4">
            <p className="mb-3 text-[12px] font-medium text-[var(--d360-ink-2)]">
              ¿Con quién se habla?
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">De la cartera</span>
                <select name="contactoId" className={`${campo} w-56`} defaultValue="">
                  <option value="">— persona nueva —</option>
                  {gente.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                      {c.empresa ? ` · ${c.empresa}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <span className="pb-2 text-[12px] text-[var(--d360-muted)]">o</span>

              <label className="text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Nombre</span>
                <input name="contactoNuevo" className={`${campo} w-48`} placeholder="Nombre y apellido" />
              </label>
              <label className="text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Cargo</span>
                <input name="cargoNuevo" className={`${campo} w-44`} />
              </label>
              <label className="text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Empresa</span>
                {/* Por nombre y no por lista: si ya existe se reusa, y si no se
                    crea. Obligar a darla de alta aparte es el mismo callejón
                    otra vez, un piso más abajo. */}
                <input name="empresaNueva" className={`${campo} w-48`} />
              </label>

              {/* Correo y teléfono se piden acá y no «después, en la ficha».
                  Este formulario se llena mientras se cuelga el teléfono o se
                  cierra una clase, que es justo cuando se tiene el dato. Media
                  hora después nadie vuelve a completarlo, y un contacto sin
                  forma de contactarlo es una fila que no sirve para nada.

                  Ninguno es obligatorio: exigirlos convertiría el formulario en
                  un peaje y la gente dejaría de registrar oportunidades, que es
                  peor que registrarlas incompletas. */}
              <label className="text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Correo</span>
                <input
                  name="emailNuevo"
                  type="email"
                  className={`${campo} w-56`}
                  placeholder="nombre@empresa.cl"
                />
              </label>
              <label className="text-[12px] text-[var(--d360-ink-2)]">
                <span className="mb-1 block">Teléfono</span>
                <input
                  name="telefonoNuevo"
                  type="tel"
                  className={`${campo} w-40`}
                  placeholder="+56 9 …"
                />
              </label>
            </div>
          </div>

          <button className={btnPrimario} type="submit">
            Crear oportunidad
          </button>
        </form>
      </Card>

      {historial.length > 0 ? (
        <Card className="mt-6" titulo="Cerradas" descripcion="Las últimas que salieron del tablero">
          <div className="space-y-1.5">
            {historial.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard360/crm/oportunidades/${c.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-[#f4f7f9]"
              >
                <span className="text-[var(--d360-ink)]">
                  <span
                    className={
                      c.etapa === "ganado" ? "text-[#1c6b39]" : "text-[var(--d360-muted)]"
                    }
                  >
                    {nombreEtapa(c.etapa)}
                  </span>{" "}
                  · {c.titulo}
                  <span className="text-[var(--d360-muted)]"> · {c.contacto}</span>
                </span>
                <span className="d360-num text-[12px] text-[var(--d360-muted)]">
                  {CLP.format(c.monto)}
                  {c.cerradoEn ? ` · ${FECHA.format(c.cerradoEn)}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}
