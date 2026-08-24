import Markdown from "@/components/dashboard360/Markdown";
import {
  Badge,
  Card,
  PageHeader,
  Vacio,
  btnFantasma,
  btnPrimario,
  btnSecundario,
} from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import {
  generarInformeAction,
  listarInformes,
  publicarInformeAction,
} from "@/lib/dashboard360/informe.actions";
import { puedePublicar } from "@/lib/dashboard360/session";

export const dynamic = "force-dynamic";

export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const sesion = await requireSession();
  const informes = await listarInformes();
  const { id } = await searchParams;

  const seleccionado = id
    ? informes.find((i) => String(i.id) === id)
    : informes[0];

  return (
    <>
      <PageHeader
        titulo="Informe al directorio"
        bajada="El tablero muestra métricas; el directorio necesita una lectura. Esto redacta la lectura a partir de los datos del período, sin pasar por PowerPoint."
        acciones={
          <form action={generarInformeAction}>
            <button type="submit" className={btnPrimario}>
              Generar del período reciente
            </button>
          </form>
        }
      />

      {informes.length === 0 ? (
        <Vacio
          mensaje="Todavía no hay informes."
          sugerencia="Genera el primero con el botón de arriba: toma los últimos 30 días con datos."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <nav className="d360-no-print space-y-1.5">
            {informes.map((inf) => {
              const activo = seleccionado?.id === inf.id;
              return (
                <a
                  key={inf.id}
                  href={`/dashboard360/informe?id=${inf.id}`}
                  className={`block rounded-lg border px-3 py-2.5 transition ${
                    activo
                      ? "border-[var(--d360-brand)] bg-[var(--d360-brand-soft)]"
                      : "border-[var(--d360-border)] bg-[var(--d360-surface)] hover:border-[var(--d360-brand)]"
                  }`}
                >
                  <div className="d360-num text-[13px] font-medium text-[var(--d360-ink)]">
                    {inf.desde} → {inf.hasta}
                  </div>
                  <div className="mt-1.5">
                    <Badge tono={inf.estado === "publicado" ? "bueno" : "alerta"}>
                      <span aria-hidden>{inf.estado === "publicado" ? "●" : "○"}</span>
                      {inf.estado === "publicado" ? "Publicado" : "Borrador"}
                    </Badge>
                  </div>
                </a>
              );
            })}
          </nav>

          {seleccionado && (
            <Card
              titulo={seleccionado.titulo}
              acciones={
                <div className="d360-no-print flex items-center gap-2">
                  {seleccionado.estado === "borrador" && puedePublicar(sesion) && (
                    <form action={publicarInformeAction}>
                      <input type="hidden" name="id" value={seleccionado.id} />
                      <button type="submit" className={btnSecundario}>
                        Publicar
                      </button>
                    </form>
                  )}
                  {seleccionado.estado === "borrador" && !puedePublicar(sesion) && (
                    <span className="text-[12px] text-[var(--d360-muted)]">
                      Publicar requiere gerencia
                    </span>
                  )}
                  {/* La impresión es del navegador y no un PDF generado en el
                      servidor: el informe cabe en una hoja, y una dependencia
                      de PDF para esto es peso que no se paga solo. */}
                  <a href="#" className={btnFantasma} data-imprimir>
                    Imprimir
                  </a>
                </div>
              }
            >
              <Markdown>{seleccionado.cuerpoMd}</Markdown>

              <p className="d360-no-print mt-6 border-t border-[var(--d360-grid)] pt-4 text-[12px] text-[var(--d360-muted)]">
                Redactado a partir de los datos del período. Las cifras salen de
                consultas, no de un modelo de lenguaje: el texto puede pulirse, los
                números no se inventan.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Un handler de tres líneas no justifica convertir la página en
          componente de cliente. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-imprimir]')?.addEventListener('click',function(e){e.preventDefault();window.print()})`,
        }}
      />
    </>
  );
}
