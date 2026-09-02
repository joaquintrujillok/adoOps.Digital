import { Card, EstadoFuente, PageHeader, Tabla } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { fuentes } from "@/lib/dashboard360/metricas";

export const dynamic = "force-dynamic";

/** «hace 2 h», «hace 3 días». Un timestamp exacto no dice si el dato está viejo. */
function haceCuanto(d: Date | null): string {
  if (!d) return "nunca";
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

/** Una fuente diaria que lleva más del doble de su frecuencia sin traer nada. */
function atrasada(ultima: Date | null, frecuenciaMin: number): boolean {
  if (!ultima) return true;
  return Date.now() - ultima.getTime() > frecuenciaMin * 60_000 * 2;
}

export default async function FuentesPage() {
  await requireSession();
  const lista = await fuentes();

  const conectadas = lista.filter((f) => f.estado === "conectada").length;
  const conProblema = lista.filter(
    (f) => f.estado === "error" || f.estado === "pendiente",
  ).length;

  return (
    <>
      <PageHeader
        titulo="Fuentes conectadas"
        bajada="Cada fuente entra por un conector de Airbyte que escribe directo en la base del tablero. Esta pantalla existe porque la falla más común no es un número equivocado: es un número viejo que nadie sabe que está viejo."
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { t: "Conectadas", v: conectadas },
          { t: "Con problema", v: conProblema },
          { t: "Total", v: lista.length },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-4"
          >
            <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--d360-muted)]">
              {x.t}
            </div>
            <div className="d360-num mt-1.5 text-[26px] font-semibold leading-none text-[var(--d360-ink)]">
              {x.v}
            </div>
          </div>
        ))}
      </div>

      <Card titulo="Detalle">
        <Tabla>
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Tipo</th>
              <th>Cuenta</th>
              <th>Estado</th>
              <th>Última sincronía</th>
              <th>Frecuencia</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => (
              <tr key={f.id}>
                <td className="font-medium">
                  {f.nombre}
                  {f.ultimoError && (
                    <div className="mt-0.5 text-[12px] text-[#96201f]">{f.ultimoError}</div>
                  )}
                  {/* La nota es diagnóstico, no error: explica por qué un número
                      correcto igual se ve mal. Hoy dice si la cuenta tiene
                      acciones de conversión configuradas, que es la diferencia
                      entre «el tablero falla» y «el anunciante no mide». */}
                  {!f.ultimoError && f.nota && (
                    <div className="mt-0.5 max-w-[70ch] text-[12px] text-[var(--d360-muted)]">
                      {f.nota}
                    </div>
                  )}
                </td>
                <td className="capitalize text-[var(--d360-ink-2)]">{f.tipo}</td>
                <td className="text-[var(--d360-ink-2)]">{f.cuenta ?? "—"}</td>
                <td>
                  <EstadoFuente estado={f.estado} />
                </td>
                <td className="text-[var(--d360-ink-2)]">
                  {haceCuanto(f.ultimaSync)}
                  {atrasada(f.ultimaSync, f.frecuenciaMin) && f.estado === "conectada" && (
                    <span className="ml-1.5 text-[12px] text-[#8a5d00]">
                      <span aria-hidden>▲</span> atrasada
                    </span>
                  )}
                </td>
                <td className="d360-num text-[var(--d360-ink-2)]">
                  {f.frecuenciaMin >= 1440
                    ? `cada ${Math.round(f.frecuenciaMin / 1440)} día(s)`
                    : `cada ${Math.round(f.frecuenciaMin / 60)} h`}
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      </Card>

      <Card
        className="mt-5"
        titulo="Cómo llegan los datos"
        descripcion="Arquitectura de la ingesta"
      >
        <div className="d360-prosa">
          <p>
            Los conectores corren en una instancia propia de <strong>Airbyte</strong>{" "}
            self-hosted, que escribe en el mismo Postgres de la aplicación. No hay un
            almacén separado ni una suscripción por fuente: el costo de traer los datos
            es la máquina que corre los conectores.
          </p>
          <p>
            Cada plataforma impone su propio calendario de versiones —LinkedIn apaga
            versiones en fecha fija, Meta publica una cada trimestre y su API de
            marketing puede expirar a los 90 días— y por eso la sincronía se monitorea
            acá en vez de asumir que funciona.
          </p>
          <p>
            <strong>Este ambiente muestra datos de demostración.</strong> El esquema es
            el mismo que escriben los conectores reales, de modo que conectar una cuenta
            productiva es configuración y no reescritura.
          </p>
        </div>
      </Card>
    </>
  );
}
