import Link from "next/link";
import { Fragment } from "react";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { vanniContactos, vanniMensajes, vanniOportunidades, vanniPedidos, vanniSesiones } from "@/db/vanni";
import ScrollAlFinal from "@/components/vanni/ScrollAlFinal";
import { ESTADO_OPORTUNIDAD, ESTADO_PEDIDO } from "@/lib/vanni/etiquetas";
import { formatoTelefono } from "@/lib/vanni/telefono";

export const dynamic = "force-dynamic";

const HORA = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
const DIA = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Santiago" });
const CLAVE_DIA = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" });

function etiquetaDia(d: Date): string {
  const hoy = CLAVE_DIA.format(new Date());
  const ayer = CLAVE_DIA.format(new Date(Date.now() - 86_400_000));
  const k = CLAVE_DIA.format(d);
  if (k === hoy) return "Hoy";
  if (k === ayer) return "Ayer";
  const t = DIA.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** El formato de WhatsApp: *negrita* y _cursiva_. Nada más, y sin HTML crudo. */
function FormatoWhatsApp({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {partes.map((p, i) =>
        /^\*[^*]+\*$/.test(p) ? <b key={i}>{p.slice(1, -1)}</b> : /^_[^_]+_$/.test(p) ? <i key={i}>{p.slice(1, -1)}</i> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

const NOMBRE_FLUJO: Record<string, string> = { ofertas: "Campaña", tienda: "Tienda", sistema: "Sistema" };

function iniciales(nombre: string | null, telefono: string): string {
  const base = (nombre ?? "").replace(/[^\p{L}\s]/gu, " ").trim();
  if (!base) return telefono.slice(-2);
  const p = base.split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

export default async function Conversacion({ params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params;
  const tel = telefono.replace(/\D/g, "");
  const [mensajes, [contacto], [sesion], [oportunidad], [pedido]] = await Promise.all([
    db.select().from(vanniMensajes).where(eq(vanniMensajes.telefono, tel)).orderBy(asc(vanniMensajes.createdAt), asc(vanniMensajes.id)),
    db.select().from(vanniContactos).where(eq(vanniContactos.telefono, tel)),
    db.select().from(vanniSesiones).where(eq(vanniSesiones.telefono, tel)),
    db
      .select({ id: vanniOportunidades.id, estado: vanniOportunidades.estado })
      .from(vanniOportunidades)
      .innerJoin(vanniContactos, eq(vanniContactos.id, vanniOportunidades.contactoId))
      .where(and(eq(vanniContactos.telefono, tel), ne(vanniOportunidades.estado, "perdida")))
      .orderBy(desc(vanniOportunidades.createdAt))
      .limit(1),
    db.select().from(vanniPedidos).where(eq(vanniPedidos.telefono, tel)).orderBy(desc(vanniPedidos.createdAt)).limit(1),
  ]);
  const nombre = contacto?.razonSocial || contacto?.nombre || null;

  return (
    <>
      <header className="vn-chat-cabecera">
        <span className={`vn-avatar ${tel.startsWith("569000") ? "vn-avatar-ejemplo" : ""}`}>{iniciales(nombre, tel)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: "block", fontSize: 16 }}>{nombre ?? formatoTelefono(tel)}</b>
          <span style={{ fontSize: 13, color: "var(--vn-muted)" }}>
            {formatoTelefono(tel)}
            {contacto?.nombre && contacto.razonSocial ? ` · ${contacto.nombre}` : ""}
            {contacto?.sucursal ? ` · ${contacto.sucursal}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {sesion && <span className="vn-chip vn-chip-oscuro">En {NOMBRE_FLUJO[sesion.flujo] ?? sesion.flujo}</span>}
          {contacto && contacto.segmento !== "Sin historial" && <span className="vn-chip vn-chip-teal">{contacto.segmento}</span>}
          {contacto?.estado === "baja" && <span className="vn-chip vn-chip-rojo">Pidió baja</span>}
          {tel.startsWith("569000") && <span className="vn-chip vn-chip-aviso">Simulador / ejemplo</span>}
          {oportunidad && (
            <Link href="/vanni/oportunidades" className={`vn-chip ${ESTADO_OPORTUNIDAD[oportunidad.estado]?.clase ?? ""}`}>
              Oportunidad: {ESTADO_OPORTUNIDAD[oportunidad.estado]?.texto}
            </Link>
          )}
          {pedido && (
            <Link href={`/vanni/tienda/pedidos/${pedido.id}`} className={`vn-chip ${ESTADO_PEDIDO[pedido.estado]?.clase ?? ""}`}>
              {pedido.codigo}: {ESTADO_PEDIDO[pedido.estado]?.texto}
            </Link>
          )}
        </div>
      </header>

      <ScrollAlFinal cantidad={mensajes.length}>
        {mensajes.map((m, i) => {
          const antes = mensajes[i - 1];
          const nuevoDia = !antes || CLAVE_DIA.format(antes.createdAt) !== CLAVE_DIA.format(m.createdAt);
          // Un cambio de flujo es un evento de la conversación: se marca como
          // en WhatsApp se marca un cambio de grupo, no como un mensaje.
          const cambioFlujo = antes && antes.flujo !== m.flujo && m.flujo !== "sistema";
          const mismoAutor = antes && !nuevoDia && !cambioFlujo && antes.direccion === m.direccion;
          return (
            <Fragment key={m.id}>
              {nuevoDia && <div className="vn-chat-dia"><span>{etiquetaDia(m.createdAt)}</span></div>}
              {cambioFlujo && <div className="vn-chat-evento">Entró a {NOMBRE_FLUJO[m.flujo] ?? m.flujo}</div>}
              <div className={`vn-msg ${m.direccion === "in" ? "vn-msg-in" : "vn-msg-out"} ${mismoAutor ? "seguido" : ""}`}>
                {m.imagenUrl && <img src={m.imagenUrl} alt="" />}
                <div className="vn-msg-texto"><FormatoWhatsApp texto={m.texto} /></div>
                <div className="vn-msg-meta">
                  {m.simulado && <span>simulado · </span>}
                  {HORA.format(m.createdAt)}
                  {m.direccion === "out" && <span className="vn-check">{m.simulado ? " ✓" : " ✓✓"}</span>}
                </div>
              </div>
            </Fragment>
          );
        })}
        {!mensajes.length && <p className="vn-vacio">Sin mensajes.</p>}
      </ScrollAlFinal>

      <footer className="vn-chat-pie">
        El motor responde solo por WhatsApp. Si el cliente necesita a una persona, aparece en <Link href="/vanni/oportunidades">Por llamar</Link>.
      </footer>
    </>
  );
}
