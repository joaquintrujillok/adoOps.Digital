import Link from "next/link";
import { AREAS, nombreArea, type AreaId } from "@/lib/tuniche/areas";
import { requireSesion } from "@/lib/tuniche/auth.actions";
import { clientesDe } from "@/lib/tuniche/informes";
import { generarMensualAction } from "@/lib/tuniche/informes.actions";
import { puedeEnviarAlAgricultor } from "@/lib/tuniche/session";

export const dynamic = "force-dynamic";

/** El mes calendario anterior, que es la cadencia real de este informe. */
function mesAnterior(): { desde: string; hasta: string } {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: f(desde), hasta: f(hasta) };
}

export default async function InformeMensual({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const s = await requireSesion();
  if (!puedeEnviarAlAgricultor(s)) {
    return (
      <div className="max-w-[520px] space-y-3">
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Esta pantalla no te corresponde
        </h1>
        <p className="text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          El informe mensual va a un cliente fuera de Tuniche y lo prepara la jefatura
          del área.
        </p>
        <Link href="/tuniche/informes" className="text-[14px]" style={{ color: "var(--tun-brand)" }}>
          ← Informes
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  // Un admin cruza áreas, así que elige; un jefe tiene la suya y no hay nada que
  // elegir. Ofrecerle un selector le sugeriría que puede mirar la otra.
  const areasDisponibles = s.area ? AREAS.filter((a) => a.id === s.area) : AREAS;
  const area = (sp.area && areasDisponibles.some((a) => a.id === sp.area)
    ? sp.area
    : areasDisponibles[0].id) as AreaId;

  const clientes = await clientesDe(area);
  const { desde, hasta } = mesAnterior();

  return (
    <div className="max-w-[680px] space-y-6">
      <header>
        <Link href="/tuniche/informes" className="text-[13px]" style={{ color: "var(--tun-brand)" }}>
          ← Informes
        </Link>
        <h1 className="mt-2 text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Informe mensual al cliente
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Junta los lotes de un cliente con las visitas validadas del periodo y sus
          fotos. Es el reemplazo del PowerPoint que hoy se arma a mano bajando fotos
          de Drive, agricultor por agricultor.
        </p>
      </header>

      {areasDisponibles.length > 1 && (
        <form className="tun-tarjeta flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="area" className="tun-etiqueta">
              Área
            </label>
            <select id="area" name="area" defaultValue={area} className="tun-campo">
              {areasDisponibles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="tun-boton-suave">
            Cambiar
          </button>
        </form>
      )}

      {clientes.length === 0 ? (
        // No se inventa un agrupador. En Altué la columna CLIENTE vino en blanco
        // en las 23 filas, y agrupar por otra cosa produciría un informe que
        // nadie reconocería como el suyo.
        <div
          className="rounded-lg border p-5"
          style={{
            borderColor: "var(--tun-alerta)",
            background: "var(--tun-alerta-soft)",
            color: "var(--tun-alerta)",
          }}
        >
          <p className="text-[14px] font-semibold">
            No hay clientes cargados en {nombreArea(area)}.
          </p>
          <p className="mt-2 text-[13.5px]">
            Este informe se agrupa por cliente, y la sábana de Producción Altué vino con
            la columna <code>CLIENTE</code> en blanco en sus 23 filas. Hay que pedirle esa
            columna a René antes de poder armarlo. En Mercado Nacional el agrupador es el
            distribuidor, que sí venía.
          </p>
        </div>
      ) : (
        <form action={generarMensualAction} className="tun-tarjeta space-y-4 p-5">
          <input type="hidden" name="area" value={area} />
          <div>
            <label htmlFor="cliente" className="tun-etiqueta">
              Cliente
            </label>
            <select id="cliente" name="cliente" required className="tun-campo" defaultValue="">
              <option value="" disabled>
                Elige el cliente…
              </option>
              {clientes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="desde" className="tun-etiqueta">
                Desde
              </label>
              <input id="desde" name="desde" type="date" defaultValue={desde} required className="tun-campo" />
            </div>
            <div>
              <label htmlFor="hasta" className="tun-etiqueta">
                Hasta
              </label>
              <input id="hasta" name="hasta" type="date" defaultValue={hasta} required className="tun-campo" />
            </div>
          </div>

          <p className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
            Entran solo las visitas <b>validadas</b>. Una visita pendiente es lo que la IA
            entendió y nadie confirmó todavía; mandarla a un cliente en el extranjero
            sería la peor forma de estrenar esto.
          </p>

          <button type="submit" className="tun-boton">
            Generar borrador
          </button>
        </form>
      )}
    </div>
  );
}
