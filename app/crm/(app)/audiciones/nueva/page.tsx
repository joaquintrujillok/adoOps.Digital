import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { crmContacts } from "@/db/crm";
import { Card, PageHeader, Tabla, Vacio } from "@/components/crm/ui";
import CierreAudicion from "@/components/crm/CierreAudicion";
import { requireSession } from "@/lib/crm/auth.actions";
import { contactosParaAudicion, salas } from "@/lib/crm/audiciones";
import { queLePregunto, completitudDe } from "@/lib/crm/preguntas";
import { mapaDe } from "@/lib/crm/mapa-sistema";
import { clp } from "@/lib/crm/formato";

export const dynamic = "force-dynamic";

const ESTADO_TONO: Record<string, { fondo: string; borde: string; texto: string; etiqueta: string }> = {
  registrado: {
    fondo: "bg-white",
    borde: "border-[var(--crm-border)]",
    texto: "text-[var(--crm-ink)]",
    etiqueta: "registrado",
  },
  declarado: {
    fondo: "bg-white",
    borde: "border-[var(--crm-border)]",
    texto: "text-[var(--crm-ink)]",
    etiqueta: "lo dijo",
  },
  no_tiene: {
    fondo: "bg-[var(--crm-brand-soft)]",
    borde: "border-[var(--crm-brand)]",
    texto: "text-[var(--crm-brand-dark)]",
    etiqueta: "oportunidad",
  },
  sin_dato: {
    fondo: "bg-transparent",
    borde: "border-dashed border-[var(--crm-muted)]",
    texto: "text-[var(--crm-muted)]",
    etiqueta: "sin dato",
  },
};

export default async function NuevaAudicion({
  searchParams,
}: {
  searchParams: Promise<{ contacto?: string }>;
}) {
  await requireSession();
  const { contacto: contactoParam } = await searchParams;
  const contactId = contactoParam ? Number(contactoParam) : null;

  const listaSalas = await salas();

  // Sin persona elegida, se muestra el selector. Es un paso más, y se justifica:
  // registrar una audición sin saber de quién es guardar que "alguien escuchó
  // algo", que no sirve para nada.
  if (!contactId) {
    const contactos = await contactosParaAudicion();
    return (
      <>
        <PageHeader
          titulo="Cerrar una audición"
          bajada="Primero, ¿a quién atendiste? Sin persona, la audición no sirve para nada."
        />
        <Card>
          {contactos.length === 0 ? (
            <Vacio mensaje="No hay contactos todavía" />
          ) : (
            <div className="max-h-[560px] overflow-y-auto crm-scroll">
              <Tabla columnas={["Cliente", "Teléfono", ""]}>
                {contactos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nombre}</td>
                    <td className="crm-num text-[var(--crm-ink-2)]">{c.telefono ?? "—"}</td>
                    <td className="text-right">
                      <Link
                        href={`/crm/audiciones/nueva?contacto=${c.id}`}
                        className="text-[13px] font-medium text-[var(--crm-brand-dark)] hover:underline"
                      >
                        Es él →
                      </Link>
                    </td>
                  </tr>
                ))}
              </Tabla>
            </div>
          )}
        </Card>
      </>
    );
  }

  const [contacto] = await db
    .select({ id: crmContacts.id, nombre: crmContacts.nombre })
    .from(crmContacts)
    .where(eq(crmContacts.id, contactId))
    .limit(1);

  if (!contacto) {
    return (
      <>
        <PageHeader titulo="Cerrar una audición" />
        <Vacio mensaje="Ese contacto no existe" />
      </>
    );
  }

  const [preguntas, mapa, completitud] = await Promise.all([
    queLePregunto(contactId, "audicion", 3),
    mapaDe(contactId),
    completitudDe(contactId),
  ]);

  return (
    <>
      <PageHeader
        titulo={`Audición de ${contacto.nombre}`}
        bajada="Menos de un minuto. Todo es opcional salvo la sala."
        acciones={
          <Link
            href="/crm/audiciones/nueva"
            className="text-[13px] text-[var(--crm-ink-2)] hover:underline"
          >
            Cambiar de persona
          </Link>
        }
      />

      {/* ── El mapa, como contexto de la conversación ──
          Va arriba del formulario a propósito: el vendedor ve qué sabemos de
          esta persona ANTES de escribir, y eso cambia qué le pregunta. */}
      <Card
        titulo="Su sistema, hasta donde sabemos"
        descripcion={`Sabemos el ${completitud.puntaje}% de lo que valdría la pena saber.`}
        className="mb-6"
      >
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {mapa.eslabones.map((e) => {
            const tono = ESTADO_TONO[e.estado];
            return (
              <div key={e.clave} className={`rounded-xl border p-3.5 ${tono.fondo} ${tono.borde}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
                  {e.nombre}
                </div>
                <div className={`mt-2 text-[15px] font-semibold ${tono.texto}`}>
                  {e.marca ?? <span className="italic font-normal">sin dato</span>}
                </div>
                {e.detalle ? (
                  <div className="mt-0.5 truncate text-[11px] text-[var(--crm-muted)]" title={e.detalle}>
                    {e.detalle}
                  </div>
                ) : null}
                <div className="mt-2.5">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      e.estado === "no_tiene"
                        ? "bg-[var(--crm-brand)] text-white"
                        : e.estado === "sin_dato"
                          ? "bg-transparent text-[var(--crm-muted)] ring-1 ring-[var(--crm-muted)]/40"
                          : "bg-[var(--crm-brand-soft)] text-[var(--crm-brand-dark)]"
                    }`}
                  >
                    {tono.etiqueta}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[13px] text-[var(--crm-ink-2)]">
          {mapa.sinDato > 0 ? (
            <>
              <strong>
                {mapa.sinDato} {mapa.sinDato === 1 ? "eslabón" : "eslabones"} sin dato
              </strong>{" "}
              no {mapa.sinDato === 1 ? "es" : "son"} {mapa.sinDato === 1 ? "una carencia" : "carencias"}: {mapa.sinDato === 1 ? "es" : "son"}{" "}
              {mapa.sinDato === 1 ? "una pregunta" : "preguntas"} que nadie hizo. Ofrecerle algo ahí
              es arriesgarse a ofrecerle lo que ya tiene.
            </>
          ) : (
            <>Conocemos su cadena completa. Lo que falta ahora es saber hacia dónde quiere ir.</>
          )}
          {mapa.nivel > 0 ? <> El nivel de su equipo está en {clp(mapa.nivel)}.</> : null}
        </p>
      </Card>

      <Card>
        <CierreAudicion salas={listaSalas} preguntas={preguntas} contacto={contacto} />
      </Card>
    </>
  );
}
