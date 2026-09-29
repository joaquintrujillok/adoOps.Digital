import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { vanniCampanas, vanniContactos, vanniEnvios, vanniUsuarios, vanniVariantes } from "@/db/vanni";
import EnviarPrueba from "@/components/vanni/EnviarPrueba";
import Refrescar from "@/components/vanni/Refrescar";
import { actualizarEstadosAction, lanzarCampanaAction, pausarCampanaAction } from "@/lib/vanni/backoffice.actions";
import { ENTREGA, ESTADO_CAMPANA, RESULTADO } from "@/lib/vanni/etiquetas";
import { fechaHora, miles, pct } from "@/lib/vanni/formato";
import { embudo, porVariante } from "@/lib/vanni/metricas";
import { formatoTelefono } from "@/lib/vanni/telefono";
import { modoWhatsApp } from "@/lib/vanni/wa";

export const dynamic = "force-dynamic";

export default async function DetalleCampana({ params }: { params: Promise<{ id: string }> }) {
  const { id: idTexto } = await params;
  const id = Number(idTexto);
  const [c] = await db.select().from(vanniCampanas).where(eq(vanniCampanas.id, id));
  if (!c) notFound();

  const [variantes, e, vars, envios, [ejecutiva]] = await Promise.all([
    db.select().from(vanniVariantes).where(eq(vanniVariantes.campanaId, id)).orderBy(asc(vanniVariantes.codigo)),
    embudo({ ejemplo: c.ejemplo, campanaId: id }),
    porVariante({ ejemplo: c.ejemplo, campanaId: id }),
    db
      .select({ e: vanniEnvios, contacto: vanniContactos, variante: vanniVariantes.codigo })
      .from(vanniEnvios)
      .innerJoin(vanniContactos, eq(vanniContactos.id, vanniEnvios.contactoId))
      .leftJoin(vanniVariantes, eq(vanniVariantes.id, vanniEnvios.varianteId))
      .where(eq(vanniEnvios.campanaId, id))
      .orderBy(desc(vanniEnvios.respondioAt), desc(vanniEnvios.id))
      .limit(120),
    c.ejecutivaId
      ? db.select({ nombre: vanniUsuarios.nombre }).from(vanniUsuarios).where(and(eq(vanniUsuarios.id, c.ejecutivaId)))
      : Promise.resolve([] as { nombre: string }[]),
  ]);
  const pendientes = e.encolados - e.enviados - e.errores;
  const modo = modoWhatsApp();

  return (
    <>
      {c.estado === "enviando" && <Refrescar segundos={10} />}
      <div className="vn-top">
        <div>
          <p style={{ marginBottom: 4 }}><Link href="/vanni/campanas" style={{ color: "var(--vn-teal)" }}>← Campañas</Link></p>
          <h1>{c.nombre} {c.ejemplo && <span className="vn-chip vn-chip-aviso">Ejemplo</span>}</h1>
          <p>
            <span className={`vn-chip ${ESTADO_CAMPANA[c.estado]?.clase ?? ""}`}>{ESTADO_CAMPANA[c.estado]?.texto}</span>{" "}
            Promoción: <b>{c.promocion}</b> · Ejecutiva: {ejecutiva?.nombre ?? "la del contacto o el administrador"}
            {c.recordatorioHoras ? ` · Recordatorio a las ${c.recordatorioHoras} h` : " · Sin recordatorio"}
          </p>
        </div>
        <div className="vn-top-acciones">
          {!c.ejemplo && (c.estado === "borrador" || c.estado === "terminada") && (
            <form action={lanzarCampanaAction.bind(null, id)}>
              <button className="vn-btn">{c.estado === "borrador" ? "Lanzar campaña" : "Enviar a contactos nuevos"}</button>
            </form>
          )}
          {c.estado === "enviando" && <form action={pausarCampanaAction.bind(null, id, true)}><button className="vn-btn vn-btn-sec">Pausar</button></form>}
          {c.estado === "pausada" && <form action={pausarCampanaAction.bind(null, id, false)}><button className="vn-btn">Reanudar</button></form>}
          {!c.ejemplo && <form action={actualizarEstadosAction.bind(null, id)}><button className="vn-btn vn-btn-sec">Actualizar entregas</button></form>}
        </div>
      </div>

      {modo === "simulado" && !c.ejemplo && (
        <p className="vn-aviso" style={{ marginBottom: 14 }}>
          WhatsApp está en <b>modo simulado</b> (falta VANNI_WASENDER_API_KEY o está VANNI_WHATSAPP_SIMULADO=1): la campaña corre completa pero ningún mensaje sale.
        </p>
      )}

      <div className="vn-grid vn-grid-kpi" style={{ marginBottom: 16 }}>
        <div className="vn-kpi"><label>Enviados</label><b>{miles(e.enviados)}</b><span>{pendientes > 0 ? `${pendientes} en cola` : "cola vacía"}{e.errores ? ` · ${e.errores} con error` : ""}</span></div>
        <div className="vn-kpi"><label>Entregados</label><b>{miles(e.entregados)}</b><span>{pct(e.entregados, e.enviados)} · {e.leidos} leídos</span></div>
        <div className="vn-kpi"><label>Respondieron</label><b>{miles(e.respondieron)}</b><span>{pct(e.respondieron, e.enviados)} de enviados</span></div>
        <div className="vn-kpi vn-kpi-hi"><label>Interesados</label><b>{miles(e.interesados)}</b><span>{pct(e.interesados, e.enviados)} de enviados</span></div>
        <div className="vn-kpi"><label>Bajas</label><b>{miles(e.bajas)}</b><span>{pct(e.bajas, e.enviados)} de enviados</span></div>
      </div>

      <div className="vn-grid vn-grid-2" style={{ marginBottom: 16 }}>
        <section className="vn-card">
          <h2>Mensajes</h2>
          <table className="vn-tabla" style={{ marginTop: 8 }}>
            <thead><tr><th>Variante</th><th>Texto</th><th className="vn-num">Enviados</th><th className="vn-num">Interés</th></tr></thead>
            <tbody>
              {variantes.map((v) => {
                const m = vars.find((x) => x.codigo === v.codigo);
                return (
                  <tr key={v.id}>
                    <td><b>{v.codigo}</b> · {v.nombre}</td>
                    <td style={{ fontSize: 13.5 }}>{v.plantilla}</td>
                    <td className="vn-num">{m?.enviados ?? 0}</td>
                    <td className="vn-num">{pct(m?.interesados ?? 0, m?.enviados ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        <section className="vn-card">
          <h2>Probar antes de lanzar</h2>
          <p className="vn-sub" style={{ marginBottom: 10 }}>Te llega el mensaje tal como lo verá un cliente.</p>
          <EnviarPrueba campanaId={id} variantes={variantes.map((v) => v.codigo)} />
          {c.condiciones && <p className="vn-ayuda" style={{ marginTop: 12 }}><b>Condiciones:</b> {c.condiciones}</p>}
        </section>
      </div>

      <section className="vn-card">
        <h2>Envíos</h2>
        <p className="vn-sub">Primero los que respondieron. Se muestran los últimos 120.</p>
        <div className="vn-scroll" style={{ marginTop: 8 }}>
          <table className="vn-tabla">
            <thead><tr><th>Cliente</th><th>Teléfono</th><th>Segmento</th><th>Var.</th><th>Envío</th><th>WhatsApp</th><th>Respuesta</th><th>Enviado</th></tr></thead>
            <tbody>
              {envios.map(({ e: x, contacto, variante }) => (
                <tr key={x.id}>
                  <td><Link href={`/vanni/conversaciones/${x.telefono}`} style={{ color: "var(--vn-ink)", fontWeight: 600 }}>{contacto.razonSocial || contacto.nombre || "—"}</Link></td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatoTelefono(x.telefono)}</td>
                  <td>{contacto.segmento}</td>
                  <td>{variante ?? "—"}</td>
                  <td>{x.estado === "error" ? <span className="vn-chip vn-chip-rojo" title={x.error ?? ""}>Error</span> : x.estado === "enviado" ? "Enviado" : <span className="vn-chip vn-chip-aviso">{x.estado === "pendiente" ? "En cola" : x.estado}</span>}</td>
                  <td>{x.entrega ? <span className={`vn-chip ${ENTREGA[x.entrega]?.clase ?? ""}`}>{ENTREGA[x.entrega]?.texto ?? x.entrega}</span> : x.waMsgId?.startsWith("sim-") ? <span className="vn-chip">Simulado</span> : "—"}</td>
                  <td>{x.resultado ? <span className={`vn-chip ${RESULTADO[x.resultado]?.clase ?? ""}`}>{RESULTADO[x.resultado]?.texto ?? x.resultado}</span> : "—"}</td>
                  <td>{fechaHora(x.enviadoAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!envios.length && <p className="vn-vacio">Todavía no hay envíos. Lanza la campaña para encolar a los contactos.</p>}
        </div>
      </section>
    </>
  );
}
