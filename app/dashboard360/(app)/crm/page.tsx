// El pipeline de adoOps: una columna por etapa, las tarjetas adentro.
//
// ── Por qué columnas y no una tabla ──────────────────────────────────────────
//
// Porque la pregunta que se le hace a un pipeline no es "¿qué oportunidades
// tengo?" sino "¿dónde está atascado esto?", y esa se contesta mirando de qué
// altura es cada columna. Una tabla ordenada por monto responde otra cosa.
//
// ── Por qué sí se arrastra, y por qué el botón sigue estando ────────────────
//
// Antes esta pantalla movía las tarjetas solo con botones, con el argumento de
// que arrastrar exige JavaScript, estado optimista y una forma de deshacer. El
// argumento era cierto y el costo se pagó: el tablero es `TableroPipeline`, un
// componente cliente. Lo que lo justificó fue el uso real: mover una tarjeta era
// entrar a la ficha, elegir etapa, volver, y eso se hace decenas de veces al
// revisar el pipeline.
//
// Los botones por etapa siguen en la ficha de la oportunidad, y esa es la ruta
// que funciona en el teléfono: el arrastre nativo de HTML no responde al tacto.
// El arrastre es un atajo del escritorio, no el único camino.
//
// Los datos siguen calculándose en el servidor. El cliente solo pinta y arrastra.

import Link from "next/link";
import { Card, PageHeader, Vacio, btnPrimario } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { cerradas, contactos, disponible, tablero } from "@/lib/venta/consultas";
import { crearOportunidadAction } from "@/lib/venta/acciones";
import { FUENTES, FUENTE_POR_DEFECTO, nombreEtapa } from "@/lib/venta/etapas";
import TableroPipeline from "@/components/dashboard360/TableroPipeline";

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

      {/* El tablero es cliente porque se arrastra. Los datos siguen viniendo
          del servidor: acá solo se le da la forma que la vista necesita, y
          `diasSin` se calcula en el servidor para que el «14 días sin
          actividad» no dependa del reloj del navegador. */}
      <div className="mb-6">
        <TableroPipeline
          columnas={columnas.map((col) => ({
            id: col.etapa,
            nombre: col.nombre,
            tarjetas: col.tarjetas.map((t) => ({
              id: t.id,
              titulo: t.titulo,
              etapa: t.etapa,
              monto: t.monto,
              contacto: t.contacto,
              empresa: t.empresa,
              cierreEstimado: t.cierreEstimado,
              dias: diasSin(t.ultimaActividad),
            })),
          }))}
        />
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
