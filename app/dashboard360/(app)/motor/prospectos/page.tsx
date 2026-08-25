import Link from "next/link";
import { Badge, PageHeader, StatTile, Tabla, Vacio, btnPrimario } from "@/components/dashboard360/ui";
import { fecha, numero } from "@/lib/leads/formato";
import { listarEmpresas, regionesEnUso, NOMBRE_REGION } from "@/lib/leads/empresas";
import { contarEmpresas } from "@/lib/leads/ingesta";

export const dynamic = "force-dynamic";

export default async function Prospectos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string; sin?: string }>;
}) {
  const { q, region, sin } = await searchParams;

  const [empresas, regiones, totales] = await Promise.all([
    listarEmpresas({
      busqueda: q,
      region: region ? Number(region) : undefined,
      // El filtro que importa en la Fase 0 no es "con dominio": es al revés.
      // Lo que hay que poder ver de un vistazo son las que NO tienen, porque
      // sin dominio ningún proveedor de enriquecimiento encuentra nada.
      conDominio: sin === "dominio" ? false : undefined,
    }),
    regionesEnUso(),
    contarEmpresas(),
  ]);

  const cobertura =
    totales.empresas > 0 ? Math.round((totales.conDominio / totales.empresas) * 100) : 0;

  return (
    <>
      <PageHeader
        titulo="Prospectos"
        bajada="Las empresas cargadas y sus contactos. Mientras el motor no esté en marcha, lo único que hay que mirar acá es la cobertura de dominio y de email: es lo que decide si el canal frío es viable en este ICP."
        acciones={
          <Link href="/dashboard360/motor/cargar" className={btnPrimario}>
            Cargar CSV
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile etiqueta="Empresas" valor={numero(totales.empresas)} nota={`${numero(empresas.length)} en la vista actual`} />
        <StatTile
          etiqueta="Con dominio"
          valor={numero(totales.conDominio)}
          nota={`${cobertura}% del total · sin dominio no hay enriquecimiento`}
        />
        <StatTile etiqueta="Contactos" valor={numero(totales.personas)} nota="personas identificadas" />
        <StatTile
          etiqueta="Con email"
          valor={numero(totales.conEmail)}
          nota="el número que decide el proyecto"
        />
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2" action="/dashboard360/motor/prospectos">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="RUT, razón social o dominio"
          className="w-72 rounded-md border border-[var(--d360-border)] bg-white px-3 py-1.5 text-sm"
        />
        <select
          name="region"
          defaultValue={region ?? ""}
          className="rounded-md border border-[var(--d360-border)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Todas las regiones</option>
          {regiones.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_REGION[r] ?? `Región ${r}`}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-[var(--d360-ink-2)]">
          <input type="checkbox" name="sin" value="dominio" defaultChecked={sin === "dominio"} />
          Solo sin dominio
        </label>
        <button type="submit" className={btnPrimario}>
          Filtrar
        </button>
      </form>

      {empresas.length === 0 ? (
        <Vacio
          mensaje="No hay prospectos cargados todavía"
          sugerencia="Genera la muestra con scripts/fase0_sii.py y súbela en Cargar CSV."
        />
      ) : (
        <Tabla>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>RUT</th>
              <th>Rubro</th>
              <th>Ubicación</th>
              <th className="text-center">Tramo</th>
              <th>Dominio</th>
              <th className="text-center">Contactos</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
          {empresas.map((e) => (
            <tr key={e.id}>
              <td className="font-medium text-[var(--d360-ink)]">{e.razonSocial}</td>
              <td className="tabular-nums">{e.rut ?? "—"}</td>
              <td>{e.acteco ?? "—"}</td>
              <td>
                {e.comuna ?? "—"}
                {e.region !== null && (
                  <span className="text-[var(--d360-muted)]"> · {NOMBRE_REGION[e.region] ?? e.region}</span>
                )}
              </td>
              <td className="text-center tabular-nums">{e.tramoVentas ?? "—"}</td>
              <td>
                {e.dominio ? (
                  e.dominio
                ) : (
                  <Badge tono="alerta">falta</Badge>
                )}
              </td>
              <td className="text-center tabular-nums">
                {e.personas === 0 ? "—" : `${e.conEmail}/${e.personas}`}
              </td>
              <td className="text-[13px] text-[var(--d360-muted)]">
                {e.origen} · {fecha(e.obtenidoEn)}
              </td>
            </tr>
          ))}
          </tbody>
        </Tabla>
      )}
    </>
  );
}
