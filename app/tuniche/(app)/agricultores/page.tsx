import Link from "next/link";
import { nombreArea } from "@/lib/tuniche/areas";
import { alcanceActual } from "@/lib/tuniche/auth.actions";
import { listarAgricultores } from "@/lib/tuniche/visitas";
import Demo from "@/components/tuniche/Demo";
import ContactoAgricultor from "@/components/tuniche/ContactoAgricultor";

export const dynamic = "force-dynamic";

/** Sin tildes ni mayúsculas: nadie escribe "AGRÍCOLA" con tilde al buscar. */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default async function Agricultores({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sin?: string }>;
}) {
  const alcance = await alcanceActual();
  const sp = await searchParams;
  const todos = await listarAgricultores(alcance);

  const sinContacto = todos.filter((a) => !a.telefono).length;

  // Se filtra en memoria: son decenas de agricultores por área y por temporada,
  // y buscar también dentro de sus lotes —por código o variedad— en la base
  // costaría un join y un índice de texto que nadie va a mantener.
  const q = normalizar((sp.q ?? "").trim());
  const soloSinTelefono = sp.sin === "1";
  const agricultores = todos.filter((a) => {
    if (soloSinTelefono && a.telefono) return false;
    if (!q) return true;
    const heno = normalizar(
      [
        a.razonSocial,
        a.nombreContacto,
        a.localidad,
        a.region,
        a.distribuidor,
        a.zonalNombre,
        a.telefono,
        ...a.lotes.flatMap((l) => [l.codigo, l.cultivo, l.variedad]),
      ]
        .filter(Boolean)
        .join(" "),
    );
    // Todas las palabras, en cualquier orden: "martina talagante" encuentra lo
    // mismo que "talagante martina", que es como la gente busca de verdad.
    return q.split(/\s+/).every((palabra) => heno.includes(palabra));
  });

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--tun-ink)" }}>
          Agricultores
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tun-ink-2)" }}>
          {q || soloSinTelefono
            ? `${agricultores.length} de ${todos.length} agricultores`
            : `${todos.length} agricultores`}{" "}
          · {agricultores.reduce((n, a) => n + a.lotes.length, 0)} lotes
        </p>
      </header>

      {/* Filtro por GET, igual que la sábana: la búsqueda queda en la URL, así
          que se puede compartir y sobrevive a entrar a un lote y volver. Un
          filtro que solo vive en memoria obliga a rehacerlo cada vez. */}
      <form className="tun-tarjeta flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[260px] flex-1">
          <label htmlFor="q" className="tun-etiqueta">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={sp.q ?? ""}
            className="tun-campo"
            placeholder="Agricultor, contacto, localidad, zonal, lote o variedad…"
          />
        </div>
        <label
          className="flex items-center gap-2 pb-2.5 text-[13.5px]"
          style={{ color: "var(--tun-ink-2)" }}
        >
          <input type="checkbox" name="sin" value="1" defaultChecked={soloSinTelefono} />
          Solo los que no tienen teléfono
        </label>
        <button type="submit" className="tun-boton-suave">
          Buscar
        </button>
        {(q || soloSinTelefono) && (
          <a href="/tuniche/agricultores" className="pb-2.5 text-[13px]" style={{ color: "var(--tun-brand)" }}>
            Limpiar
          </a>
        )}
      </form>

      {/* Sin teléfono no hay a quién mandarle el informe, y ese es el último paso
          del flujo completo. Decirlo acá arriba y no en cada ficha: es un
          problema de la carga de datos, no de un agricultor en particular. */}
      {sinContacto > 0 && (
        <p
          className="rounded-lg border px-3.5 py-2.5 text-[13px]"
          style={{
            borderColor: "var(--tun-alerta)",
            background: "var(--tun-alerta-soft)",
            color: "var(--tun-alerta)",
          }}
        >
          <b>{sinContacto} de {todos.length} agricultores no tienen teléfono.</b>{" "}
          Ninguna de las dos planillas lo traía — MN mandó las columnas vacías y Altué
          venía anonimizada. <b>Hoy no bloquea nada</b>: durante la prueba de concepto el
          informe llega a quien recibe los de cada área y esa persona lo reenvía. Hace
          falta el día que el sistema le escriba al agricultor directo.
        </p>
      )}

      <div className="space-y-3">
        {agricultores.map((a) => (
          <div key={a.id} className="tun-tarjeta p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {a.razonSocial}
                  </span>
                  {a.demo && <Demo />}
                </div>
                <div
                  className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px]"
                  style={{ color: "var(--tun-ink-2)" }}
                >
                  <span>{nombreArea(a.area)}</span>
                  {a.localidad && <span>{a.localidad}</span>}
                  {a.distribuidor && <span title="Distribuidor">{a.distribuidor}</span>}
                  {a.zonalNombre && <span title="Zonal a cargo">Zonal: {a.zonalNombre}</span>}
                  <span style={{ color: a.telefono ? undefined : "var(--tun-alerta)" }}>
                    {a.telefono ? `+${a.telefono}` : "sin teléfono"}
                  </span>
                </div>
              </div>
              <span className="text-[13px]" style={{ color: "var(--tun-muted)" }}>
                {a.lotes.length} {a.lotes.length === 1 ? "lote" : "lotes"}
              </span>
            </div>

            <details className="mt-4">
              <summary
                className="cursor-pointer text-[13px] font-medium"
                style={{ color: a.telefono ? "var(--tun-brand)" : "var(--tun-alerta)" }}
              >
                {a.telefono ? "Editar contacto" : "Cargar teléfono y contacto"}
              </summary>
              <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--tun-border)" }}>
                <ContactoAgricultor
                  id={a.id}
                  nombreContacto={a.nombreContacto}
                  telefono={a.telefono}
                  email={a.email}
                />
              </div>
            </details>

            <div className="mt-4 flex flex-wrap gap-2">
              {a.lotes.map((l) => (
                <Link
                  key={l.id}
                  href={`/tuniche/lotes/${l.id}`}
                  className="rounded-lg border px-3 py-2 text-[12.5px] transition hover:border-[var(--tun-brand)]"
                  style={{ borderColor: "var(--tun-border)", color: "var(--tun-ink-2)" }}
                >
                  <span className="font-semibold" style={{ color: "var(--tun-ink)" }}>
                    {l.codigo}
                  </span>
                  {l.cultivo && <span className="ml-2">{l.cultivo}</span>}
                  {l.variedad && <span className="ml-1.5">{l.variedad}</span>}
                  {l.hectareas && <span className="ml-2">{l.hectareas} ha</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {agricultores.length === 0 && (
        <p className="text-[14px]" style={{ color: "var(--tun-muted)" }}>
          {q || soloSinTelefono
            ? "Ningún agricultor calza con lo que buscaste."
            : "No hay agricultores en tu alcance. Si eres zonal, todavía no tienes ninguno asignado — pídeselo a quien administra el sistema."}
        </p>
      )}
    </div>
  );
}
