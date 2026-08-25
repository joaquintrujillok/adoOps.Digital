// Señales de compra: el permiso para escribir.
//
// ── Por qué esta pantalla existe teniendo una API pendiente ──────────────────
//
// El ticket de la API de Mercado Público todavía no llega, y esperarlo dejaría
// el motor sin poder inscribir a nadie: ningún primer contacto sale sin señal
// vigente. La propia especificación del MVP anticipa este caso — si hay que
// recortar algo, se recorta la ingesta automática y las señales se cargan a mano
// por un mes.
//
// Cuando el ticket llegue, esta pantalla no se borra. Sigue sirviendo para lo
// que ninguna API va a traer: una nota de prensa, un cambio de gerencia, algo
// que alguien vio pasar. Lo que cambia es que la mayoría entrará sola con
// `origen = 'chilecompra'` en vez de `'manual'`, y esa diferencia queda
// registrada por fila.

import Link from "next/link";
import { Badge, Card, PageHeader, StatTile, Tabla, Vacio, btnSecundario } from "@/components/dashboard360/ui";
import FormularioSenal from "@/components/leads/FormularioSenal";
import { buscarEmpresas, listarSenales, TIPOS_SENAL, tipoSenal } from "@/lib/leads/senales";
import { requireSesionMotor } from "@/lib/leads/sesion";
import { faltan, fecha, numero } from "@/lib/leads/formato";

export const dynamic = "force-dynamic";

export default async function Senales({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string }>;
}) {
  await requireSesionMotor();
  const { q, empresa } = await searchParams;

  const empresaId = Number(empresa);
  const elegida = Number.isInteger(empresaId) && empresaId > 0 ? empresaId : null;

  const [resultados, senales] = await Promise.all([
    q ? buscarEmpresas(q) : Promise.resolve([]),
    listarSenales(),
  ]);

  const nombreElegida =
    resultados.find((r) => r.id === elegida)?.razonSocial ??
    senales.find((s) => s.empresaId === elegida)?.empresa ??
    "esta empresa";

  const vigentes = senales.filter((s) => s.estado === "vigente" && s.venceEn > new Date());
  const sinContactos = vigentes.filter((s) => s.personas === 0);
  const accionables = vigentes.filter((s) => s.personas > 0 && s.inscritas === 0);

  return (
    <>
      <PageHeader
        titulo="Señales"
        bajada="El hecho verificable que justifica el primer contacto. Ningún prospecto entra a una campaña sin una vigente: sube la aceptación, da algo concreto que decir, y es la diferencia entre «traté sus datos porque estaban ahí» y «lo contacté por un hecho público y pertinente»."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Vigentes" valor={numero(vigentes.length)} nota="habilitan un primer contacto hoy" />
        <StatTile
          etiqueta="Accionables"
          valor={numero(accionables.length)}
          nota="con contactos cargados y nadie inscrito todavía"
        />
        <StatTile
          etiqueta="Sin contactos"
          valor={numero(sinContactos.length)}
          nota="hay que enriquecer antes de que venzan"
        />
        <StatTile etiqueta="Registradas" valor={numero(senales.length)} nota="incluyendo las vencidas" />
      </div>

      {/* ── Alta ──────────────────────────────────────────────────────────
          Dos pasos y sin JavaScript de por medio: primero se busca la empresa,
          después se carga el hecho. Un buscador que escribe mientras tecleás es
          más lindo, pero acá el paso lento es escribir el resumen, no encontrar
          la empresa. */}
      <Card
        className="mb-8"
        titulo="Registrar una señal"
        descripcion="Mientras no esté la API de Mercado Público, se cargan a mano. El motor funciona igual: lo que exige es que la señal exista y esté vigente, no de dónde vino"
      >
        <form action="/dashboard360/motor/senales" className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar empresa por razón social o RUT"
            className="min-w-[16rem] flex-1 rounded-md border border-[var(--d360-border)] bg-white px-2.5 py-2 text-[13px]"
          />
          <button type="submit" className={btnSecundario}>
            Buscar
          </button>
        </form>

        {q && resultados.length === 0 && (
          <Vacio
            mensaje={`Ninguna empresa calza con «${q}»`}
            sugerencia="Las señales cuelgan de una empresa que ya esté en la base. Cargala primero desde Prospectos."
          />
        )}

        {resultados.length > 0 && !elegida && (
          <ul className="divide-y divide-[var(--d360-grid)]">
            {resultados.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="flex-1 text-[13px] font-medium text-[var(--d360-ink)]">
                  {r.razonSocial}
                </span>
                <span className="d360-num text-[12px] text-[var(--d360-muted)]">
                  {r.rut ?? "sin RUT"} · {r.personas} contacto{r.personas === 1 ? "" : "s"}
                </span>
                <Link
                  href={`/dashboard360/motor/senales?q=${encodeURIComponent(q ?? "")}&empresa=${r.id}`}
                  className="text-[12.5px] font-medium text-[var(--d360-brand)] hover:underline"
                >
                  Cargar señal →
                </Link>
              </li>
            ))}
          </ul>
        )}

        {elegida && (
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[var(--d360-ink)]">
                {nombreElegida}
              </span>
              <Link
                href={`/dashboard360/motor/senales?q=${encodeURIComponent(q ?? "")}`}
                className="text-[12px] text-[var(--d360-muted)] hover:underline"
              >
                Cambiar empresa
              </Link>
            </div>
            <FormularioSenal empresaId={elegida} empresaNombre={nombreElegida} />
          </div>
        )}
      </Card>

      {/* ── Las ventanas ───────────────────────────────────────────────── */}
      <Card
        className="mb-8"
        titulo="Cuánto vale cada señal"
        descripcion="La ventana se cuenta desde la fecha del hecho, no desde la carga: una adjudicación de hace 25 días ya casi no sirve, y contarla desde hoy la trataría como fresca un mes más"
      >
        <Tabla>
          <thead>
            <tr>
              <th>Señal</th>
              <th className="text-right">Vale</th>
              <th>Cómo se lee en el mensaje</th>
              <th>Fuente</th>
            </tr>
          </thead>
          <tbody>
            {TIPOS_SENAL.map((t) => (
              <tr key={t.id}>
                <td className="font-medium">{t.nombre}</td>
                <td className="d360-num text-right">{t.ventanaDias} d</td>
                <td className="text-[var(--d360-ink-2)]">…{t.ejemplo}</td>
                <td className="text-[var(--d360-muted)]">{t.fuente}</td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Card>

      {/* ── Las cargadas ───────────────────────────────────────────────── */}
      <Card
        titulo="Señales registradas"
        descripcion="«Contactos» y «inscritas» juntos son lo accionable: con contactos y nadie inscrito es trabajo pendiente; sin contactos es una empresa que hay que enriquecer antes de que la ventana se cierre"
      >
        {senales.length === 0 ? (
          <Vacio
            mensaje="Todavía no hay señales"
            sugerencia="Sin al menos una, el motor no puede inscribir a nadie: es la regla que separa nurturing de spam."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Qué pasó</th>
                <th>Hecho</th>
                <th>Ventana</th>
                <th className="text-right">Contactos</th>
                <th className="text-right">Inscritas</th>
              </tr>
            </thead>
            <tbody>
              {senales.map((s) => {
                const vigente = s.estado === "vigente" && s.venceEn > new Date();
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="font-medium text-[var(--d360-ink)]">{s.empresa}</div>
                      <div className="d360-num text-[11px] text-[var(--d360-muted)]">
                        {s.rut ?? "sin RUT"} · {s.origen}
                      </div>
                    </td>
                    <td className="max-w-[24rem] text-[12.5px] text-[var(--d360-ink-2)]">
                      {s.resumen}
                      {s.evidenciaUrl && (
                        <>
                          {" "}
                          <a
                            href={s.evidenciaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--d360-brand)] hover:underline"
                          >
                            evidencia ↗
                          </a>
                        </>
                      )}
                      <div className="text-[11px] text-[var(--d360-muted)]">
                        {tipoSenal(s.tipo)?.nombre ?? s.tipo}
                      </div>
                    </td>
                    <td className="d360-num text-[12px] text-[var(--d360-ink-2)]">
                      {fecha(s.fechaHecho)}
                    </td>
                    <td>
                      <Badge tono={vigente ? "bueno" : "neutro"}>
                        {vigente ? faltan(s.venceEn) : "vencida"}
                      </Badge>
                    </td>
                    <td className="d360-num text-right">
                      {s.personas === 0 ? (
                        <span className="text-[var(--status-critical)]">0</span>
                      ) : (
                        numero(s.personas)
                      )}
                    </td>
                    <td className="d360-num text-right">{numero(s.inscritas)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
      </Card>
    </>
  );
}
