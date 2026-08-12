import Link from "next/link";
import {
  Badge,
  Card,
  Lectura,
  PageHeader,
  StatTile,
  Tabla,
  Vacio,
  btnPrimario,
} from "@/components/crm/ui";
import { requireSession } from "@/lib/crm/auth.actions";
import { listarAudiciones, resumenAudiciones } from "@/lib/crm/audiciones";
import { huecosDeCartera } from "@/lib/crm/preguntas";
import { clp, fecha, numero, relativo } from "@/lib/crm/formato";

export const dynamic = "force-dynamic";

export default async function Audiciones() {
  await requireSession();
  const [lista, resumen, huecos] = await Promise.all([
    listarAudiciones(40),
    resumenAudiciones(),
    huecosDeCartera(10),
  ]);

  return (
    <>
      <PageHeader
        titulo="Audiciones"
        bajada="Lo más valioso que pasa en el negocio. Acá queda escrito."
        acciones={
          <Link href="/crm/audiciones/nueva" className={btnPrimario}>
            Cerrar una audición
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          etiqueta="Audiciones · 30 días"
          valor={numero(resumen.total30d)}
          contexto={`${numero(resumen.conCita30d)} con cita previa`}
        />
        <StatTile
          etiqueta="Por cada venta"
          valor={resumen.porVenta.toFixed(1)}
          contexto="personas que se sientan a escuchar"
        />
        <StatTile
          etiqueta="Con próximo paso"
          valor={numero(resumen.conProximoPaso)}
          contexto={`de ${numero(resumen.total30d)} registradas`}
          deltaBueno="arriba"
        />
        <StatTile
          etiqueta="Sin nada anotado"
          valor={numero(resumen.sinContenido)}
          contexto="solo la sala, sin qué dijo"
          deltaBueno="abajo"
        />
      </div>

      {/*
        El panel que convierte este módulo en algo que se usa todos los días.
        Sin él, "audiciones" es un archivo histórico; con él, es una lista de
        llamadas por hacer con el motivo ya escrito.
      */}
      <Card
        titulo="A quién le falta preguntarle"
        descripcion="Ordenado por plata invertida contra lo poco que sabemos de esa persona."
        className="mb-6"
      >
        {huecos.length === 0 ? (
          <Vacio mensaje="Todavía no hay cartera con compras" />
        ) : (
          <>
            <Tabla
              columnas={[
                "Cliente",
                { titulo: "Ha invertido", alinear: "der" },
                { titulo: "Sabemos", alinear: "der" },
                "La pregunta que más vale",
                "",
              ]}
            >
              {huecos.map((h) => (
                <tr key={h.contactId}>
                  <td>
                    <Link href={`/crm/contactos/${h.contactId}`} className="crm-link">
                      {h.cliente}
                    </Link>
                    <div className="text-[12px] text-[var(--crm-muted)]">
                      {h.ultimaAudicion
                        ? `Última audición ${relativo(h.ultimaAudicion)}`
                        : "Nunca ha venido a una audición"}
                    </div>
                  </td>
                  <td className="crm-num text-right font-medium">{clp(h.invertido)}</td>
                  <td className="crm-num text-right">
                    <Badge tono={h.puntaje >= 60 ? "bueno" : h.puntaje >= 35 ? "alerta" : "critico"}>
                      {h.puntaje}%
                    </Badge>
                  </td>
                  <td className="max-w-[340px] text-[13px] text-[var(--crm-ink-2)]">
                    {h.siguiente?.texto ?? "Ya sabemos lo importante"}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/crm/audiciones/nueva?contacto=${h.contactId}`}
                      className="text-[13px] font-medium text-[var(--crm-brand-dark)] hover:underline"
                    >
                      Registrar →
                    </Link>
                  </td>
                </tr>
              ))}
            </Tabla>
            <p className="mt-3 text-[12px] text-[var(--crm-muted)]">
              El orden combina las dos cosas en una cifra: un cliente de ochenta millones del que no
              sabemos qué amplificación tiene es un problema más caro que un desconocido del que
              tampoco sabemos nada.
            </p>
          </>
        )}
      </Card>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card titulo="Uso de las salas" descripcion="Últimos 90 días" className="lg:col-span-1">
          <Tabla columnas={["Sala", { titulo: "Audiciones", alinear: "der" }]}>
            {resumen.porSala.map((s) => (
              <tr key={s.sala}>
                <td>
                  {s.sala}
                  <div className="text-[11px] text-[var(--crm-muted)]">
                    {"◆".repeat(s.nivel)}
                    <span className="opacity-25">{"◆".repeat(5 - s.nivel)}</span>
                  </div>
                </td>
                <td className="crm-num text-right font-medium">{numero(s.audiciones)}</td>
              </tr>
            ))}
          </Tabla>
        </Card>

        <Card titulo="Las últimas audiciones" className="lg:col-span-2">
          {lista.length === 0 ? (
            <Vacio
              mensaje="Todavía no hay audiciones registradas"
              sugerencia="Cierra la primera al terminar la próxima visita: toma menos de un minuto."
            />
          ) : (
            <Tabla columnas={["Cuándo", "Quién", "Sala", "Qué dijo", "Próximo paso"]}>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className="crm-num whitespace-nowrap">
                    {fecha(a.fecha)}
                    {a.conCita ? (
                      <div className="text-[11px] text-[var(--crm-muted)]">con cita</div>
                    ) : null}
                  </td>
                  <td>
                    {a.contactId ? (
                      <Link href={`/crm/contactos/${a.contactId}`} className="crm-link">
                        {a.cliente}
                      </Link>
                    ) : (
                      <span className="crm-muted">Sin identificar</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{a.sala ?? "—"}</td>
                  <td className="max-w-[280px] text-[13px] text-[var(--crm-ink-2)]">
                    {a.queDijo ?? <span className="crm-muted">— nada anotado —</span>}
                  </td>
                  <td className="max-w-[200px] text-[13px]">
                    {a.proximoPaso ?? <span className="crm-muted">—</span>}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
        </Card>
      </div>

      <Lectura titulo="Por qué esto importa acá más que en cualquier otro rubro">
        <p>
          La audición <strong>es</strong> el producto. Alguien que dedicó dos horas a escuchar en la
          Sala Reference es la persona más calificada que va a entrar al negocio este mes, compre o
          no compre ese día.
        </p>
        <p>
          Si no queda registro, en seis meses no hay forma de saber que existió ni con qué argumento
          volver a llamarlo. Por eso el formulario tiene un solo campo obligatorio —la sala— y todo
          lo demás es opcional: <strong>media audición registrada vale infinitamente más que
          ninguna</strong>.
        </p>
      </Lectura>
    </>
  );
}
