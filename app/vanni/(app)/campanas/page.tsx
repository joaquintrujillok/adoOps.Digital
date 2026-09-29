import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { vanniCampanas } from "@/db/vanni";
import { ESTADO_CAMPANA } from "@/lib/vanni/etiquetas";
import { fechaHora, miles, pct } from "@/lib/vanni/formato";

export const dynamic = "force-dynamic";


export default async function Campanas() {
  const campanas = await db
    .select({
      c: vanniCampanas,
      enviados: sql<number>`(select count(*) from vanni_envios e where e.campana_id = ${vanniCampanas.id} and e.estado = 'enviado')::int`,
      pendientes: sql<number>`(select count(*) from vanni_envios e where e.campana_id = ${vanniCampanas.id} and e.estado in ('pendiente','enviando'))::int`,
      interesados: sql<number>`(select count(*) from vanni_envios e where e.campana_id = ${vanniCampanas.id} and e.resultado = 'interesado')::int`,
    })
    .from(vanniCampanas)
    .orderBy(desc(vanniCampanas.id));

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Campañas</h1>
          <p>Cada campaña tiene una promoción y hasta tres mensajes. Se envían al ritmo que permite WhatsApp y el tablero dice cuál convirtió más.</p>
        </div>
        <Link className="vn-btn" href="/vanni/campanas/nueva">Nueva campaña</Link>
      </div>
      <section className="vn-card">
        <div className="vn-scroll">
          <table className="vn-tabla">
            <thead><tr><th>Campaña</th><th>Promoción</th><th>Estado</th><th className="vn-num">Enviados</th><th className="vn-num">Pendientes</th><th className="vn-num">Interesados</th><th>Iniciada</th></tr></thead>
            <tbody>
              {campanas.map(({ c, enviados, pendientes, interesados }) => (
                <tr key={c.id}>
                  <td><Link href={`/vanni/campanas/${c.id}`} style={{ fontWeight: 600, color: "var(--vn-ink)" }}>{c.nombre}</Link>{c.ejemplo && <> <span className="vn-chip vn-chip-aviso">Ejemplo</span></>}</td>
                  <td>{c.promocion}</td>
                  <td><span className={`vn-chip ${ESTADO_CAMPANA[c.estado]?.clase ?? ""}`}>{ESTADO_CAMPANA[c.estado]?.texto ?? c.estado}</span></td>
                  <td className="vn-num">{miles(enviados)}</td>
                  <td className="vn-num">{miles(pendientes)}</td>
                  <td className="vn-num">{miles(interesados)} <span style={{ color: "var(--vn-muted)" }}>({pct(interesados, enviados)})</span></td>
                  <td>{fechaHora(c.iniciadaAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!campanas.length && <p className="vn-vacio">Todavía no hay campañas. Crea la primera.</p>}
        </div>
      </section>
    </>
  );
}
