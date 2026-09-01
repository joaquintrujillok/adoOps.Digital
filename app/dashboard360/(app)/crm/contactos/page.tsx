// Contactos y empresas, en una pantalla.
//
// Van juntas y no en dos porque el alta de un contacto necesita la empresa al
// lado: separarlas obliga a ir, crear la empresa, volver y buscarla, que es el
// camino por el que la gente termina dejando el campo vacío.
//
// La empresa es opcional a propósito. Al principio uno conoce a una persona, no
// a un área de compras, y exigir la empresa desde el primer día es cómo se
// llenan los CRM de fichas con "Empresa S.A." adentro.

import { Card, PageHeader, Tabla, Vacio, btnPrimario } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { contactos, disponible, empresas } from "@/lib/venta/consultas";
import { crearContactoAction, crearEmpresaAction } from "@/lib/venta/acciones";

export const dynamic = "force-dynamic";

const campo =
  "rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]";

export default async function ContactosPage() {
  await requireSession();
  const [hay, gente, casas] = await Promise.all([disponible(), contactos(), empresas()]);

  if (!hay) {
    return (
      <>
        <PageHeader titulo="Contactos" bajada="Con quién se habla y dónde trabaja." />
        <Card>
          <Vacio
            mensaje="El CRM no está desplegado acá"
            sugerencia="Faltan las tablas venta_*. Corre node scripts/venta-setup.mjs."
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Contactos"
        bajada={
          gente.length === 0
            ? "Con quién se habla y dónde trabaja."
            : `${gente.length} ${gente.length === 1 ? "persona" : "personas"} · ${casas.length} ${casas.length === 1 ? "empresa" : "empresas"}`
        }
      />

      <Card titulo="Personas">
        {gente.length === 0 ? (
          <Vacio
            mensaje="Todavía no hay nadie"
            sugerencia="Agrega el primero abajo. La empresa se puede dejar en blanco."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cargo</th>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Abiertas</th>
              </tr>
            </thead>
            <tbody>
              {gente.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium text-[var(--d360-ink)]">{c.nombre}</td>
                  <td className="text-[var(--d360-ink-2)]">{c.cargo ?? "—"}</td>
                  <td className="text-[var(--d360-ink-2)]">{c.empresa ?? "—"}</td>
                  <td className="d360-num text-[var(--d360-muted)]">
                    {c.email ?? c.telefono ?? "—"}
                  </td>
                  <td className="d360-num">
                    {/* Cero se pinta apagado: una persona sin oportunidades no
                        es un problema, es alguien a quien todavía no le toca. */}
                    <span className={c.abiertas > 0 ? "" : "text-[var(--d360-muted)]"}>
                      {c.abiertas}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      <Card className="mt-6" titulo="Agregar una persona" descripcion="La empresa es opcional">
        <form action={crearContactoAction} className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Nombre</span>
            <input name="nombre" required className={`${campo} w-56`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Cargo</span>
            <input name="cargo" className={`${campo} w-48`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Empresa</span>
            <select name="empresaId" className={`${campo} w-48`}>
              <option value="">Sin empresa</option>
              {casas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Email</span>
            <input name="email" type="email" className={`${campo} w-56`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Teléfono</span>
            <input name="telefono" className={`${campo} w-36`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">LinkedIn</span>
            <input name="linkedin" className={`${campo} w-56`} placeholder="https://…" />
          </label>
          <button className={btnPrimario} type="submit">
            Agregar
          </button>
        </form>
      </Card>

      <Card className="mt-6" titulo="Empresas" descripcion={`${casas.length} registradas`}>
        {casas.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {casas.map((e) => (
              <span
                key={e.id}
                className="rounded-md border border-[var(--d360-border)] px-2.5 py-1 text-[12.5px] text-[var(--d360-ink-2)]"
              >
                {e.nombre}
                {e.rubro ? (
                  <span className="text-[var(--d360-muted)]"> · {e.rubro}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        <form action={crearEmpresaAction} className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Nombre</span>
            <input name="nombre" required className={`${campo} w-56`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Rubro</span>
            <input name="rubro" className={`${campo} w-48`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Tamaño</span>
            <input name="tamano" className={`${campo} w-32`} placeholder="11-50" />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Ciudad</span>
            <input name="ciudad" className={`${campo} w-40`} />
          </label>
          <label className="text-[12px] text-[var(--d360-ink-2)]">
            <span className="mb-1 block">Sitio</span>
            <input name="sitio" className={`${campo} w-52`} placeholder="https://…" />
          </label>
          <button className={btnPrimario} type="submit">
            Agregar
          </button>
        </form>
      </Card>
    </>
  );
}
