import Link from "next/link";
import { AREAS, nombreArea, type AreaId } from "@/lib/tuniche/areas";
import { alcanceActual, requireSesion } from "@/lib/tuniche/auth.actions";
import { columnasDe, filasDe, type Vista } from "@/lib/tuniche/sabana";

export const dynamic = "force-dynamic";

function colorNota(n: number): string {
  if (n >= 80) return "var(--tun-ok)";
  if (n >= 60) return "var(--tun-alerta)";
  return "var(--tun-critico)";
}

/** Los tres estados que se leen de un vistazo. Lo demás va en texto plano. */
const SEMAFORO: Record<string, string> = {
  bien: "var(--tun-ok)",
  sano: "var(--tun-ok)",
  "sin presión": "var(--tun-ok)",
  baja: "var(--tun-ok)",
  media: "var(--tun-alerta)",
  "a mejorar": "var(--tun-alerta)",
  "en observación": "var(--tun-alerta)",
  alta: "var(--tun-critico)",
  crítico: "var(--tun-critico)",
  "con problema": "var(--tun-critico)",
};

/** Sin tildes ni mayúsculas: nadie busca escribiendo "BUNCHING" con tilde. */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default async function Sabana({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; vista?: string; q?: string }>;
}) {
  const s = await requireSesion();
  const alcance = await alcanceActual();
  const sp = await searchParams;

  // Un admin cruza áreas y elige; un jefe o un zonal tienen la suya y no hay
  // nada que elegir. Ofrecerles el selector les sugeriría que pueden mirar la
  // otra, que es justo lo que el alcance les niega.
  const disponibles = s.area ? AREAS.filter((a) => a.id === s.area) : AREAS;
  const area = (sp.area && disponibles.some((a) => a.id === sp.area)
    ? sp.area
    : disponibles[0].id) as AreaId;
  const vista: Vista = sp.vista === "completa" ? "completa" : "resumen";

  const [columnas, todas] = await Promise.all([
    Promise.resolve(columnasDe(area, vista)),
    filasDe(area, alcance),
  ]);

  // Se busca sobre TODAS las celdas de la fila, incluidas las de hitos aunque la
  // vista sea el resumen: quien escribe una fecha de trasplante espera encontrar
  // ese lote, no que el buscador dependa de qué columnas estén visibles.
  const q = normalizar((sp.q ?? "").trim());
  const filas = q
    ? todas.filter((f) => {
        const heno = normalizar(Object.values(f.celdas).filter(Boolean).join(" "));
        return q.split(/\s+/).every((palabra) => heno.includes(palabra));
      })
    : todas;

  // Se cuentan sobre la vista completa y no sobre la actual: en `resumen` no
  // hay ninguna columna de hito, y el botón terminaba ofreciendo "(+ hitos)"
  // sin decir cuántos, que es justo el número que ayuda a decidir si abrirla.
  const hitos = columnasDe(area, "completa").filter((c) => c.grupo === "hito").length;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Sábana consolidada
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          Una fila por lote, con lo precargado y lo que va entrando por las visitas.
          Es la planilla que hoy se cruza a mano, con la diferencia de que las
          columnas de estado se actualizan solas cuando llega un audio.
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          {disponibles.length > 1 &&
            disponibles.map((a) => (
              <Link
                key={a.id}
                href={`/tuniche/sabana?area=${a.id}&vista=${vista}`}
                className="rounded-lg border px-3.5 py-2 text-[13px] font-medium"
                style={
                  a.id === area
                    ? { borderColor: "var(--tun-brand)", background: "var(--tun-brand-soft)", color: "var(--tun-brand-dark)" }
                    : { borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }
                }
              >
                {a.nombre}
              </Link>
            ))}

          {/* Resumen o sábana entera. Los hitos son 24 columnas en Altué y 30 en
              MN: quien abre esto para ver cómo va la temporada no las necesita,
              y quien va a llenar una etapa sí. */}
          {(["resumen", "completa"] as Vista[]).map((v) => (
            <Link
              key={v}
              href={`/tuniche/sabana?area=${area}&vista=${v}`}
              className="rounded-lg border px-3.5 py-2 text-[13px] font-medium"
              style={
                v === vista
                  ? { borderColor: "var(--tun-brand)", background: "var(--tun-brand-soft)", color: "var(--tun-brand-dark)" }
                  : { borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }
              }
            >
              {v === "resumen" ? "Resumen" : `Sábana completa · ${hitos} hitos`}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {/* El buscador conserva área y vista: cambiar de una a otra no puede
              hacerte perder lo que estabas buscando. */}
          <form className="flex items-end gap-2">
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="vista" value={vista} />
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              className="tun-campo"
              style={{ minWidth: 240 }}
              placeholder="Lote, agricultor, variedad, zonal…"
              aria-label="Buscar en la sábana"
            />
            <button type="submit" className="tun-boton-suave">
              Buscar
            </button>
            {q && (
              <Link
                href={`/tuniche/sabana?area=${area}&vista=${vista}`}
                className="pb-2 text-[13px]"
                style={{ color: "var(--tun-brand)" }}
              >
                Limpiar
              </Link>
            )}
          </form>

          {/* La salida a Excel no es una concesión: nadie deja una planilla de un
              día para otro, y pedirlo sería la forma más rápida de que no usen
              esto. Lo que se borra es la transcripción a mano, no la planilla.
              Exporta SIEMPRE la sábana completa, no lo filtrado: el archivo es
              para trabajar, y uno recortado por una búsqueda de hace un rato es
              una trampa que se descubre tarde. */}
          <a href={`/api/tuniche/sabana?area=${area}`} className="tun-boton-suave">
            Descargar en Excel (.csv)
          </a>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="text-[14px]" style={{ color: "var(--tun-muted)" }}>
          {q
            ? "Ningún lote calza con lo que buscaste."
            : `No hay lotes de ${nombreArea(area)} en tu alcance.`}
        </p>
      ) : (
        // La tabla scrollea dentro de su caja y no arrastra la página: con 30
        // columnas de hitos, el scroll horizontal del cuerpo dejaría el menú
        // lateral fuera de la pantalla.
        <div
          className="overflow-x-auto rounded-xl border"
          style={{ borderColor: "var(--tun-border)", background: "var(--tun-surface)" }}
        >
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {columnas.map((c, i) => (
                  <th
                    key={c.id}
                    className="whitespace-nowrap px-3 py-2.5 text-left align-bottom font-semibold"
                    style={{
                      color:
                        c.grupo === "estado"
                          ? "var(--tun-brand-dark)"
                          : c.grupo === "hito"
                            ? "var(--tun-muted)"
                            : "var(--tun-ink)",
                      background: c.grupo === "estado" ? "var(--tun-brand-soft)" : "var(--tun-plane)",
                      borderBottom: "1px solid var(--tun-border-fuerte)",
                      // La primera columna queda fija: con treinta columnas, sin
                      // esto uno no sabe de qué lote es la fila que está mirando.
                      ...(i === 0
                        ? { position: "sticky" as const, left: 0, zIndex: 2, background: "var(--tun-plane)" }
                        : {}),
                    }}
                  >
                    {c.etapa && (
                      <div className="text-[10px] font-normal uppercase tracking-wider opacity-70">
                        {c.etapa}
                      </div>
                    )}
                    {c.etiqueta}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, r) => (
                <tr key={f.loteId} style={{ background: r % 2 ? "var(--tun-plane)" : undefined }}>
                  {columnas.map((c, i) => {
                    const v = f.celdas[c.id];
                    const contenido =
                      c.id === "codigo" ? (
                        <Link
                          href={`/tuniche/lotes/${f.loteId}`}
                          className="font-semibold"
                          style={{ color: "var(--tun-brand)" }}
                        >
                          {String(v ?? "")}
                          {f.demo && (
                            <span
                              className="ml-1.5 text-[9.5px] font-bold uppercase"
                              style={{ color: "var(--tun-alerta)" }}
                              title="Ficha de demostración: no corresponde a un lote real."
                            >
                              demo
                            </span>
                          )}
                        </Link>
                      ) : c.id === "nota" && typeof v === "number" ? (
                        <span className="font-semibold" style={{ color: colorNota(v) }}>
                          {v}%
                        </span>
                      ) : typeof v === "string" && SEMAFORO[v] ? (
                        <span style={{ color: SEMAFORO[v] }}>{v}</span>
                      ) : (
                        <span style={{ color: v == null ? "var(--tun-muted)" : "var(--tun-ink-2)" }}>
                          {v == null ? "—" : String(v)}
                        </span>
                      );

                    return (
                      <td
                        key={c.id}
                        className="whitespace-nowrap px-3 py-2.5"
                        style={{
                          borderBottom: "1px solid var(--tun-border)",
                          textAlign: c.numerica ? "right" : "left",
                          ...(i === 0
                            ? {
                                position: "sticky" as const,
                                left: 0,
                                zIndex: 1,
                                background: r % 2 ? "var(--tun-plane)" : "var(--tun-surface)",
                              }
                            : {}),
                        }}
                      >
                        {contenido}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-[12.5px]" style={{ color: "var(--tun-muted)" }}>
        <p>
          {q
            ? `${filas.length} de ${todas.length} lotes`
            : `${filas.length} ${filas.length === 1 ? "lote" : "lotes"}`}{" "}
          · {columnas.length} columnas · {nombreArea(area)}.
        </p>
        {/* La tabla es de lectura, y decir dónde se edita cada cosa evita la
            pregunta obvia. No son tres restricciones arbitrarias: son tres
            naturalezas distintas de dato. */}
        <p className="mt-2">
          Las columnas sobre <b>fondo verde</b> las aporta el sistema y se actualizan solas
          con cada visita validada: no se editan porque son un reflejo, y cambiarlas acá
          crearía una segunda verdad que contradice a la visita. Los <b>hitos</b> y los
          datos del contrato se corrigen entrando al lote.
        </p>
      </div>
    </div>
  );
}
