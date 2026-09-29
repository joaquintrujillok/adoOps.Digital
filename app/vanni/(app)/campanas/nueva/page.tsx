import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { vanniUsuarios } from "@/db/vanni";
import FormCampana from "@/components/vanni/FormCampana";
import { requireAdmin } from "@/lib/vanni/auth.actions";
import { sucursales } from "@/lib/vanni/contactos";
import { contactosPorSegmento } from "@/lib/vanni/metricas";
import { SEGMENTOS } from "@/lib/vanni/rfm";

export const dynamic = "force-dynamic";

export default async function NuevaCampana() {
  await requireAdmin();
  const [ejecutivas, resumen, sucs] = await Promise.all([
    db.select({ id: vanniUsuarios.id, nombre: vanniUsuarios.nombre }).from(vanniUsuarios).where(and(eq(vanniUsuarios.activo, true), ne(vanniUsuarios.rol, "caja"))).orderBy(asc(vanniUsuarios.nombre)),
    contactosPorSegmento(false),
    sucursales(false),
  ]);
  const orden = SEGMENTOS.map((s) => s.nombre as string);
  const segmentos = resumen
    .map((r) => ({ nombre: r.segmento, n: r.n - r.bajas }))
    .sort((a, b) => orden.indexOf(a.nombre) - orden.indexOf(b.nombre));

  return (
    <>
      <div className="vn-top"><div><h1>Nueva campaña</h1><p>Se crea en borrador: puedes mandarte una prueba antes de lanzarla.</p></div></div>
      {!segmentos.length && <p className="vn-aviso" style={{ marginBottom: 14 }}>No hay contactos reales cargados. La campaña se puede crear, pero no tendrá a quién enviar hasta cargar la base.</p>}
      <FormCampana ejecutivas={ejecutivas} segmentos={segmentos} sucursales={sucs} />
    </>
  );
}
