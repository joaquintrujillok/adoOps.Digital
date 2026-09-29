import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vanniContactos, vanniMensajes, vanniSesiones } from "@/db/vanni";
import { fechaHora } from "@/lib/vanni/formato";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

export default async function Conversacion({ params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params;
  const tel = telefono.replace(/\D/g, "");
  const [mensajes, [contacto], [sesion]] = await Promise.all([
    db.select().from(vanniMensajes).where(eq(vanniMensajes.telefono, tel)).orderBy(asc(vanniMensajes.createdAt), asc(vanniMensajes.id)),
    db.select().from(vanniContactos).where(eq(vanniContactos.telefono, tel)),
    db.select().from(vanniSesiones).where(eq(vanniSesiones.telefono, tel)),
  ]);

  return (
    <>
      <div className="vn-top">
        <div>
          <p style={{ marginBottom: 4 }}><Link href="/vanni/conversaciones" style={{ color: "var(--vn-teal)" }}>← Conversaciones</Link></p>
          <h1>{contacto?.razonSocial || contacto?.nombre || formatoTelefono(tel)}</h1>
          <p>
            {formatoTelefono(tel)}
            {contacto && <> · Segmento {contacto.segmento}{contacto.estado === "baja" ? " · Dado de baja" : ""}</>}
            {sesion && <> · Flujo actual: <b>#{sesion.flujo}</b></>}
          </p>
        </div>
      </div>
      <section className="vn-card" style={{ maxWidth: 760 }}>
        <div className="vn-chat" style={{ height: "auto", maxHeight: 700 }}>
          {mensajes.map((m) => (
            <div key={m.id} className={`vn-burbuja ${m.direccion === "in" ? "vn-burbuja-in" : "vn-burbuja-out"}`}>
              {m.imagenUrl && <img src={m.imagenUrl} alt="" />}
              {m.texto}
              <time>{fechaHora(m.createdAt)} · #{m.flujo}{m.simulado ? " · simulado" : ""}</time>
            </div>
          ))}
          {!mensajes.length && <p className="vn-vacio">Sin mensajes.</p>}
        </div>
      </section>
    </>
  );
}
