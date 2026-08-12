import Link from "next/link";
import QRCode from "qrcode";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  StatTile,
  Tabla,
  Vacio,
  btnFantasma,
  btnPrimario,
  btnSecundario,
} from "@/components/crm/ui";
import { BarrasH, Figura } from "@/components/crm/charts";
import BotonEnvio from "@/components/crm/BotonEnvio";
import { accionConvertirVisita, accionEstadoVisita } from "@/lib/crm/showroom.actions";
import { requireSession } from "@/lib/crm/auth.actions";
import { fecha, numero, porcentaje, relativo } from "@/lib/crm/formato";
import { listarVisitas, resumenShowroom } from "@/lib/crm/showroom";
import { formatearTelefono } from "@/lib/crm/telefono";

export const dynamic = "force-dynamic";

const BOUTIQUES = ["Alonso de Córdova", "Casa Costanera", "Viña del Mar"];

const ESTADO = {
  pendiente: { tono: "alerta" as const, icono: "◷", texto: "Por contactar" },
  contactado: { tono: "info" as const, icono: "✆", texto: "Contactado" },
  convertido: { tono: "bueno" as const, icono: "✓", texto: "Convertido" },
  descartado: { tono: "neutro" as const, icono: "✕", texto: "Descartado" },
};

const FILTROS = [
  { id: "pendiente", etiqueta: "Por contactar" },
  { id: "", etiqueta: "Todas" },
  { id: "contactado", etiqueta: "Contactadas" },
  { id: "convertido", etiqueta: "Convertidas" },
  { id: "descartado", etiqueta: "Descartadas" },
];

export default async function ShowroomInterno({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; qr?: string }>;
}) {
  await requireSession();
  const { estado = "pendiente", qr } = await searchParams;

  const [visitas, resumen] = await Promise.all([
    listarVisitas({ estado: estado || undefined }),
    resumenShowroom(),
  ]);

  // El QR se genera en el servidor como SVG embebido: sin llamadas a servicios
  // externos, sin JavaScript en el cliente, y se imprime nítido a cualquier
  // tamaño porque es vectorial.
  const boutiqueQr = qr && BOUTIQUES.includes(qr) ? qr : BOUTIQUES[0];
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.adoops.digital";
  const url = `${base}/showroom?b=${encodeURIComponent(boutiqueQr)}`;
  const svgQr = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 220,
    color: { dark: "#0b0b0b", light: "#ffffff" },
  });

  const sinContactar = visitas.filter((v) => v.estado === "pendiente" && v.diasEsperando >= 2);

  return (
    <>
      <PageHeader
        titulo="Showroom"
        bajada="Quién entró a la tienda y dejó sus datos. Es la única forma de que una visita que no compró hoy siga existiendo mañana."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Visitas en 30 días"
          valor={numero(resumen.total30d)}
          contexto={`${numero(resumen.pendientes)} sin contactar`}
        />
        <StatTile
          etiqueta="Autorizan contacto"
          valor={porcentaje(resumen.tasaConsentimiento, 0)}
          contexto={`${numero(resumen.conConsentimiento)} de ${numero(resumen.total30d)}`}
        />
        <StatTile
          etiqueta="Se convirtieron"
          valor={porcentaje(resumen.tasaConversion, 0)}
          contexto="de las visitas ya trabajadas"
        />
        <StatTile
          etiqueta="Convertidas"
          valor={numero(resumen.convertidos)}
          contexto="pasaron a ser contactos del CRM"
        />
      </div>

      {sinContactar.length > 0 && (
        <div className="mb-6">
          <Lectura titulo="Lo que se está enfriando">
            <p>
              {sinContactar.length} visitas llevan más de dos días sin que nadie las contacte. En
              alta gama la ventana es corta: quien entró a mirar un reloj el sábado ya visitó otras
              dos tiendas el fin de semana.
            </p>
          </Lectura>
        </div>
      )}

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card
          titulo="El código para el mostrador"
          descripcion="Imprímelo y déjalo a la vista. El visitante lo escanea con su teléfono."
        >
          <div className="flex flex-col items-center">
            <div
              className="rounded-xl border border-[var(--crm-grid)] bg-white p-3"
              // El SVG viene de QRCode.toString, no de una entrada del usuario.
              dangerouslySetInnerHTML={{ __html: svgQr }}
            />
            <p className="crm-num mt-3 break-all text-center text-[12px] text-[var(--crm-muted)]">
              {url}
            </p>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
              Código por boutique
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BOUTIQUES.map((b) => (
                <Link key={b} href={`/crm/showroom?estado=${estado}&qr=${encodeURIComponent(b)}`}>
                  <Badge tono={b === boutiqueQr ? "marca" : "neutro"}>{b}</Badge>
                </Link>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-[var(--crm-muted)]">
              Cada boutique tiene su propio código: así la visita queda registrada en el local
              correcto sin que el visitante tenga que elegirlo.
            </p>
          </div>

          <Link href="/showroom" target="_blank" className={`${btnSecundario} mt-4 w-full`}>
            Ver el formulario
          </Link>
        </Card>

        <Card className="lg:col-span-2">
          <Figura
            titulo="Qué vienen a ver"
            subtitulo="Lo que declara el visitante al registrarse"
            pie="Sirve para dos cosas: preparar la conversación de seguimiento y saber qué exhibir."
          >
            <BarrasH
              datos={resumen.porInteres.map((i) => ({
                etiqueta: i.interes,
                valor: i.visitas,
                texto: numero(i.visitas),
              }))}
            />
          </Figura>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
                Por boutique
              </div>
              <BarrasH
                datos={resumen.porBoutique.map((b) => ({
                  etiqueta: b.boutique,
                  valor: b.visitas,
                  texto: numero(b.visitas),
                }))}
                colorUnico="var(--series-3)"
                anchoEtiqueta={120}
              />
            </div>
            <div>
              <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
                Cómo se capturó
              </div>
              <BarrasH
                datos={resumen.porMedio.map((m) => ({
                  etiqueta:
                    m.medio === "qr" ? "QR del mostrador" : m.medio === "tablet" ? "Tablet del vendedor" : "Evento",
                  valor: m.visitas,
                  texto: numero(m.visitas),
                }))}
                colorUnico="var(--series-2)"
                anchoEtiqueta={120}
              />
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--crm-grid)] px-5 py-3">
          {FILTROS.map((f) => (
            <Link
              key={f.id}
              href={f.id ? `/crm/showroom?estado=${f.id}` : "/crm/showroom?estado="}
              className={`rounded-md px-3 py-1.5 text-[13px] ${
                estado === f.id
                  ? "bg-[var(--crm-brand-soft)] font-medium text-[var(--crm-brand-dark)]"
                  : "text-[var(--crm-ink-2)] hover:bg-[#f0f1f3]"
              }`}
            >
              {f.etiqueta}
            </Link>
          ))}
        </div>

        {visitas.length === 0 ? (
          <div className="p-5">
            <Vacio
              mensaje="No hay visitas en este estado"
              sugerencia="El código QR del mostrador es lo que llena esta lista."
            />
          </div>
        ) : (
          <Tabla
            columnas={[
              "Visitante",
              "Vino a ver",
              "Boutique",
              "Cuándo",
              "Estado",
              { titulo: "Acciones", alinear: "der" },
            ]}
          >
            {visitas.map((v) => {
              const e = ESTADO[v.estado as keyof typeof ESTADO];
              return (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium">{v.nombre}</div>
                    <div className="crm-num text-[12px] text-[var(--crm-muted)]">
                      {v.telefono ? formatearTelefono(v.telefono) : v.email ?? "—"}
                    </div>
                    {!v.consentimiento && (
                      <Badge tono="critico" icono="⛔">
                        No autorizó contacto
                      </Badge>
                    )}
                  </td>
                  <td>
                    <div className="text-[13px]">{v.interes ?? "—"}</div>
                    {v.detalle && (
                      <div className="text-[12px] text-[var(--crm-muted)]">{v.detalle}</div>
                    )}
                    {v.evento && <Badge tono="info">{v.evento}</Badge>}
                  </td>
                  <td className="text-[13px] text-[var(--crm-ink-2)]">{v.boutique ?? "—"}</td>
                  <td>
                    <div className="text-[13px]">{fecha(v.createdAt)}</div>
                    <div className="text-[12px] text-[var(--crm-muted)]">
                      {relativo(v.createdAt)}
                    </div>
                  </td>
                  <td>
                    <Badge tono={e?.tono ?? "neutro"} icono={e?.icono}>
                      {e?.texto ?? v.estado}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {v.contactId ? (
                        <Link href={`/crm/contactos/${v.contactId}`} className={btnSecundario}>
                          Ver ficha
                        </Link>
                      ) : (
                        <form action={accionConvertirVisita}>
                          <input type="hidden" name="visitaId" value={v.id} />
                          <BotonEnvio className={btnPrimario} pendiente="Creando…">
                            Crear contacto
                          </BotonEnvio>
                        </form>
                      )}
                      {v.estado === "pendiente" && (
                        <form action={accionEstadoVisita}>
                          <input type="hidden" name="visitaId" value={v.id} />
                          <input type="hidden" name="estado" value="contactado" />
                          <BotonEnvio className={btnFantasma} pendiente="…">
                            Ya lo contacté
                          </BotonEnvio>
                        </form>
                      )}
                      {v.estado !== "descartado" && v.estado !== "convertido" && (
                        <form action={accionEstadoVisita}>
                          <input type="hidden" name="visitaId" value={v.id} />
                          <input type="hidden" name="estado" value="descartado" />
                          <BotonEnvio className={btnFantasma} pendiente="…">
                            ✕
                          </BotonEnvio>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Card>
    </>
  );
}
