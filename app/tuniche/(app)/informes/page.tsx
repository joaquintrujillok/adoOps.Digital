import Link from "next/link";
import { nombreArea } from "@/lib/tuniche/areas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { listarInformes, type FiltrosInforme } from "@/lib/tuniche/informes";
import { puedeEnviarAlAgricultor } from "@/lib/tuniche/session";
import Demo from "@/components/tuniche/Demo";

export const dynamic = "force-dynamic";

function fecha(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

const ESTADO: Record<string, { texto: string; fondo: string; color: string }> = {
  borrador: { texto: "Borrador", fondo: "var(--tun-plane)", color: "var(--tun-muted)" },
  aprobado: { texto: "Con visto bueno", fondo: "var(--tun-alerta-soft)", color: "var(--tun-alerta)" },
  enviado: { texto: "Enviado", fondo: "var(--tun-ok-soft)", color: "var(--tun-ok)" },
};

export default async function Informes({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; estado?: string; q?: string }>;
}) {
  const s = await requireSesion();
  const alcance = await alcanceActual();
  const sp = await searchParams;

  const filtros: FiltrosInforme = {
    tipo: sp.tipo === "visita" || sp.tipo === "mensual" ? sp.tipo : undefined,
    estado:
      sp.estado === "borrador" || sp.estado === "aprobado" || sp.estado === "enviado"
        ? sp.estado
        : undefined,
    texto: sp.q,
  };

  const informes = await listarInformes(alcance, filtros);
  const puedeMensual = puedeEnviarAlAgricultor(s);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
            Informes
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
            Todo lo que se comunicó hacia afuera: qué se dijo, a quién y cuándo. Cada
            informe queda congelado al generarse — corregir una visita después no
            cambia lo que ya se envió.
          </p>
        </div>
        {puedeMensual && (
          <Link href="/tuniche/informes/mensual" className="tun-boton shrink-0">
            Informe mensual al cliente
          </Link>
        )}
      </header>

      {/* Filtros por GET: la búsqueda queda en la URL y por lo tanto se puede
          compartir y volver a ella. Un filtro que solo vive en memoria obliga a
          rehacerlo cada vez que alguien entra a un informe y vuelve. */}
      <form className="tun-tarjeta flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label htmlFor="q" className="tun-etiqueta">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            className="tun-campo"
            placeholder="Agricultor, lote, cliente…"
          />
        </div>
        <div className="min-w-[150px]">
          <label htmlFor="tipo" className="tun-etiqueta">
            Tipo
          </label>
          <select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="tun-campo">
            <option value="">Todos</option>
            <option value="visita">De visita</option>
            <option value="mensual">Mensual al cliente</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label htmlFor="estado" className="tun-etiqueta">
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={sp.estado ?? ""} className="tun-campo">
            <option value="">Todos</option>
            <option value="borrador">Borrador</option>
            <option value="aprobado">Con visto bueno</option>
            <option value="enviado">Enviado</option>
          </select>
        </div>
        <button type="submit" className="tun-boton-suave">
          Filtrar
        </button>
      </form>

      {informes.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--tun-muted)" }}>
          No hay informes que calcen. Los de visita se generan desde{" "}
          <Link href="/tuniche/visitas" style={{ color: "var(--tun-brand)" }}>
            Visitas
          </Link>
          , una vez que el zonal valida lo que mandó.
        </p>
      ) : (
        <div className="space-y-2">
          {informes.map((i) => {
            const e = ESTADO[i.estado] ?? ESTADO.borrador;
            return (
              <Link
                key={i.id}
                href={`/tuniche/informes/${i.id}`}
                className="tun-tarjeta block p-4 transition hover:border-[var(--tun-brand)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[15px] font-semibold"
                        style={{ color: "var(--tun-ink)" }}
                      >
                        {i.titulo}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: e.fondo, color: e.color }}
                      >
                        {e.texto}
                      </span>
                      {i.demo && <Demo />}
                      {i.tipo === "mensual" && (
                        <span className="text-[12px]" style={{ color: "var(--tun-muted)" }}>
                          mensual
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]"
                      style={{ color: "var(--tun-ink-2)" }}
                    >
                      <span>{nombreArea(i.area)}</span>
                      <span>Generado {fecha(i.generadoEn)}</span>
                      {i.generadoPorNombre && <span>por {i.generadoPorNombre}</span>}
                      {i.aprobadoPorNombre && <span>VB: {i.aprobadoPorNombre}</span>}
                      {i.enviadoEn && (
                        <span style={{ color: "var(--tun-ok)" }}>
                          Enviado {fecha(i.enviadoEn)}
                          {i.enviadoA ? ` a ${i.enviadoA}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
