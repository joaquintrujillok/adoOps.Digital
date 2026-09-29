import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { fechaHora } from "@/lib/vanni/formato";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

interface Fila {
  telefono: string;
  ultimo: string;
  texto: string;
  direccion: string;
  flujo: string;
  mensajes: number;
  nombre: string | null;
  simulado: boolean;
}

export default async function Conversaciones({ searchParams }: { searchParams: Promise<{ flujo?: string }> }) {
  const { flujo } = await searchParams;
  const r = await db.execute(sql`
    select distinct on (m.telefono) m.telefono, m.created_at as ultimo, m.texto, m.direccion, m.flujo, m.simulado,
      (select count(*) from vanni_mensajes x where x.telefono = m.telefono)::int as mensajes,
      coalesce(c.razon_social, c.nombre) as nombre
    from vanni_mensajes m
    left join vanni_contactos c on c.telefono = m.telefono
    ${flujo ? sql`where m.telefono in (select telefono from vanni_mensajes where flujo = ${flujo})` : sql``}
    order by m.telefono, m.created_at desc`);
  const filas = (r.rows as unknown as Fila[]).sort((a, b) => +new Date(b.ultimo) - +new Date(a.ultimo)).slice(0, 200);

  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Conversaciones</h1>
          <p>Todo lo que pasó por el motor de WhatsApp, entrante y saliente, con el flujo en que cayó cada mensaje.</p>
        </div>
        <div className="vn-top-acciones">
          <Link className={`vn-btn vn-btn-sm ${!flujo ? "" : "vn-btn-sec"}`} href="/vanni/conversaciones">Todas</Link>
          <Link className={`vn-btn vn-btn-sm ${flujo === "ofertas" ? "" : "vn-btn-sec"}`} href="/vanni/conversaciones?flujo=ofertas">#Ofertas</Link>
          <Link className={`vn-btn vn-btn-sm ${flujo === "tienda" ? "" : "vn-btn-sec"}`} href="/vanni/conversaciones?flujo=tienda">#tienda-whatsapp</Link>
        </div>
      </div>
      <section className="vn-card">
        <table className="vn-tabla">
          <thead><tr><th>Contacto</th><th>Último mensaje</th><th>Flujo</th><th className="vn-num">Mensajes</th><th>Cuándo</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.telefono}>
                <td>
                  <Link href={`/vanni/conversaciones/${f.telefono}`} style={{ fontWeight: 600, color: "var(--vn-ink)" }}>{f.nombre ?? formatoTelefono(f.telefono)}</Link>
                  {f.nombre && <div style={{ fontSize: 12.5, color: "var(--vn-muted)" }}>{formatoTelefono(f.telefono)}</div>}
                  {f.telefono.startsWith("569000") && <span className="vn-chip vn-chip-aviso">Simulador / ejemplo</span>}
                </td>
                <td style={{ maxWidth: 460, fontSize: 13.5 }}>{f.direccion === "in" ? "↙ " : "↗ "}{f.texto.slice(0, 120)}</td>
                <td><span className="vn-chip">{f.flujo === "sistema" ? "Menú" : `#${f.flujo}`}</span></td>
                <td className="vn-num">{f.mensajes}</td>
                <td>{fechaHora(f.ultimo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filas.length && <p className="vn-vacio">Todavía no hay conversaciones. Pruébalo en el simulador.</p>}
      </section>
    </>
  );
}
