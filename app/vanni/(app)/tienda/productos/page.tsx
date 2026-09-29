import Image from "next/image";
import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { vanniProductos } from "@/db/vanni";
import { actualizarProductoAction } from "@/lib/vanni/backoffice.actions";
import { categoriasPrincipales } from "@/lib/vanni/catalogo";
import { clp, miles } from "@/lib/vanni/formato";

export const dynamic = "force-dynamic";

const POR_PAGINA = 40;

export default async function Productos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; pagina?: string; stock?: string }>;
}) {
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const filtros: SQL[] = [];
  if (sp.q) filtros.push(or(ilike(vanniProductos.nombre, `%${sp.q}%`), ilike(vanniProductos.sku, `%${sp.q}%`))!);
  if (sp.categoria) filtros.push(eq(vanniProductos.categoria, sp.categoria));
  if (sp.stock === "agotados") filtros.push(eq(vanniProductos.stock, 0));
  const donde = filtros.length ? and(...filtros) : undefined;

  const [filas, [total], categorias, [resumen]] = await Promise.all([
    db.select().from(vanniProductos).where(donde).orderBy(desc(vanniProductos.destacado), asc(vanniProductos.nombre)).limit(POR_PAGINA).offset((pagina - 1) * POR_PAGINA),
    db.select({ n: sql<number>`count(*)::int` }).from(vanniProductos).where(donde),
    categoriasPrincipales(),
    db
      .select({
        n: sql<number>`count(*)::int`,
        activos: sql<number>`count(*) filter (where ${vanniProductos.activo})::int`,
        agotados: sql<number>`count(*) filter (where ${vanniProductos.stock} = 0)::int`,
        conVector: sql<number>`count(*) filter (where ${vanniProductos.embedding} is not null)::int`,
      })
      .from(vanniProductos),
  ]);
  const paginas = Math.max(1, Math.ceil((total?.n ?? 0) / POR_PAGINA));
  const enlace = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: sp.q, categoria: sp.categoria, stock: sp.stock, ...extra })) if (v) p.set(k, v);
    return `/vanni/tienda/productos?${p}`;
  };

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Productos</h1>
          <p>El catálogo de vannichile.cl que vende la tienda por WhatsApp. Lo que se desactiva acá deja de aparecer en el chat.</p>
        </div>
      </div>

      <p className="vn-aviso" style={{ marginBottom: 14 }}>
        <b>Precios y stock ficticios de demostración.</b> En el sitio todos los productos figuran a $1: estos valores se inventaron para mostrar la tienda y se pueden editar.
        {resumen && resumen.conVector < resumen.n && <> La búsqueda por significado se activa cuando los productos tienen vector ({resumen.conVector}/{resumen.n}); mientras tanto el chat busca por palabras.</>}
      </p>

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16, gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <div className="vn-kpi"><label>Productos</label><b>{miles(resumen?.n ?? 0)}</b><span>{miles(resumen?.activos ?? 0)} visibles en el chat</span></div>
        <div className="vn-kpi"><label>Categorías</label><b>{categorias.length}</b><span>familias de producto</span></div>
        <div className="vn-kpi"><label>Sin stock</label><b>{miles(resumen?.agotados ?? 0)}</b><span><Link href={enlace({ stock: "agotados", pagina: undefined })} style={{ color: "var(--vn-teal)" }}>ver agotados</Link></span></div>
      </div>

      <section className="vn-card">
        <form style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input name="q" defaultValue={sp.q} placeholder="Buscar por nombre o SKU" className="vn-input" style={{ maxWidth: 320 }} />
          <select name="categoria" defaultValue={sp.categoria ?? ""} className="vn-select" style={{ maxWidth: 320 }}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre} ({c.productos})</option>)}
          </select>
          <button className="vn-btn vn-btn-sec">Filtrar</button>
        </form>
        <div className="vn-scroll">
          <table className="vn-tabla">
            <thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Precio · Stock · Visible · Destacado</th></tr></thead>
            <tbody>
              {filas.map((p) => (
                <tr key={p.id}>
                  <td>{p.imagenUrl?.includes(".blob.vercel-storage.com") ? <Image src={p.imagenUrl} alt="" width={44} height={44} className="vn-thumb" /> : <div className="vn-thumb" />}</td>
                  <td>
                    <b>{p.nombre}</b>
                    <div style={{ fontSize: 12.5, color: "var(--vn-muted)" }}>SKU {p.sku ?? "—"}{p.permalink && <> · <a href={p.permalink} target="_blank" rel="noreferrer" style={{ color: "var(--vn-teal)" }}>ver en vannichile.cl</a></>}</div>
                    {p.descripcion && <div style={{ fontSize: 12.5, color: "var(--vn-ink-2)", marginTop: 2, maxWidth: 520 }}>{p.descripcion.slice(0, 160)}</div>}
                  </td>
                  <td style={{ fontSize: 13 }}>{p.categoria ?? "—"}</td>
                  <td>
                    <form action={actualizarProductoAction} className="vn-fila-form">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="precio" defaultValue={p.precio} inputMode="numeric" className="vn-input" aria-label="Precio" title={clp(p.precio)} />
                      <input name="stock" defaultValue={p.stock} inputMode="numeric" className="vn-input" style={{ width: 72 }} aria-label="Stock" />
                      <label title="Visible en el chat"><input type="checkbox" name="activo" defaultChecked={p.activo} /></label>
                      <label title="Destacado"><input type="checkbox" name="destacado" defaultChecked={p.destacado} /></label>
                      <button className="vn-btn vn-btn-sm vn-btn-sec">Guardar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filas.length && <p className="vn-vacio">Sin productos con esos filtros.</p>}
        </div>
        {paginas > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10, alignItems: "center" }}>
            {pagina > 1 && <Link className="vn-btn vn-btn-sm vn-btn-sec" href={enlace({ pagina: String(pagina - 1) })}>Anterior</Link>}
            <span style={{ fontSize: 13, color: "var(--vn-muted)" }}>Página {pagina} de {paginas} · {miles(total?.n ?? 0)} productos</span>
            {pagina < paginas && <Link className="vn-btn vn-btn-sm vn-btn-sec" href={enlace({ pagina: String(pagina + 1) })}>Siguiente</Link>}
          </div>
        )}
      </section>
    </>
  );
}
