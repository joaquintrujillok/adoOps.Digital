import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import Marco from "@/components/pulso/Marco";
import { requireSession } from "@/lib/crm/auth.actions";
import { contactosDe, listarSesiones } from "@/lib/pulso/datos";
import { CUADRANTES, FRENOS, ROLES, textoDe, type Cuadrante } from "@/lib/pulso/modelo";
import { formatearTelefono } from "@/lib/crm/telefono";
import { url } from "@/lib/site";
import { borrarSesion, cambiarFase, crearSesion } from "./acciones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pulso IA · panel", robots: { index: false, follow: false } };

const FASE: Record<string, string> = { inicio: "Inicio abierto", cierre: "Cierre abierto", cerrada: "Cerrada" };

/**
 * El panel de Pulso IA: crear la sesión de una charla, sacar el QR, abrir el
 * cierre y ver quién dejó sus datos. Vive bajo /crm por la sesión, pero fuera
 * del grupo (app): no es parte del demo del CRM y no lleva su menú.
 */
export default async function PanelPulso({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireSession();
  const { s } = await searchParams;
  const sesiones = await listarSesiones();
  const elegida = s ? sesiones.find((x) => x.id === Number(s)) : undefined;
  const contactos = elegida ? await contactosDe(elegida.id) : [];
  const qr = elegida
    ? await QRCode.toString(url(`/p/${elegida.codigo}`), { type: "svg", margin: 1, width: 640 })
    : null;

  return (
    <Marco>
      <header className="nav">
        <div className="wrap">
          <Link className="brand" href="/crm/pulso"><Image src="/logo.png" alt="adoOps" width={110} height={32} /></Link>
          <span className="eyebrow" style={{ fontSize: 11 }}>Pulso IA · panel</span>
        </div>
      </header>

      <main className="wrap pz-panel">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <span className="eyebrow">Charlas</span>
          <h1 className="display h-lg">El mapa de la sala, y quién quiso seguir la conversación</h1>
          <p className="lede">
            Crea una sesión por charla. El QR abre las cinco preguntas; la pantalla se proyecta; al terminar, abre el
            cierre y después ciérrala para dejar la señal en el motor.
          </p>
        </div>

        <form action={crearSesion} className="pz-tarjeta">
          <span className="eyebrow">Nueva sesión</span>
          <div className="form">
            <div className="field full">
              <label htmlFor="titulo">Título de la charla</label>
              <input id="titulo" name="titulo" required placeholder="IA en el día a día — sesión mañana" />
            </div>
            <div className="field">
              <label htmlFor="organizacion">Organización</label>
              <input id="organizacion" name="organizacion" required placeholder="Como se la nombra en la sala" />
            </div>
            <div className="field">
              <label htmlFor="rut">RUT (opcional, para cruzarla en el motor)</label>
              <input id="rut" name="rut" placeholder="76.123.456-7" />
            </div>
            <div className="field">
              <label htmlFor="relator">Relator</label>
              <input id="relator" name="relator" defaultValue="Nelson García" />
            </div>
            <div className="field">
              <label htmlFor="fecha">Fecha</label>
              <input id="fecha" name="fecha" type="date" />
            </div>
          </div>
          <div>
            <button className="btn btn-primary arrow" type="submit">Crear sesión</button>
          </div>
        </form>

        <section className="pz-bloque">
          {sesiones.length === 0 && <p className="muted">Todavía no hay sesiones.</p>}
          {sesiones.map((x) => (
            <div className="pz-fila" key={x.id}>
              <div>
                <h3>{x.titulo}</h3>
                <div className="pz-meta">
                  <span>{x.organizacion}</span>
                  <span>{x.fecha.toLocaleDateString("es-CL")}</span>
                  <span>código <b>{x.codigo}</b></span>
                  <span className="fase">{FASE[x.fase]}</span>
                  <span>{x.respuestas} respuestas · {x.contactos} con datos</span>
                  {x.senalId && <span>señal #{x.senalId} en el motor</span>}
                </div>
              </div>
              <div className="pz-botones">
                <a className="btn btn-ghost btn-sm" href={`/pulso/${x.codigo}`} target="_blank" rel="noreferrer">Pantalla</a>
                <a className="btn btn-ghost btn-sm" href={`/p/${x.codigo}`} target="_blank" rel="noreferrer">Celular</a>
                <Link className="btn btn-ghost btn-sm" href={`/crm/pulso?s=${x.id}`}>QR y contactos</Link>
                {x.fase === "inicio" && (
                  <form action={cambiarFase}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="fase" value="cierre" />
                    <button className="btn btn-primary btn-sm" type="submit">Abrir cierre</button></form>
                )}
                {x.fase === "cierre" && (
                  <form action={cambiarFase}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="fase" value="cerrada" />
                    <button className="btn btn-primary btn-sm" type="submit">Cerrar sesión</button></form>
                )}
                {x.fase !== "inicio" && (
                  <form action={cambiarFase}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="fase" value="inicio" />
                    <button className="btn btn-text btn-sm" type="submit">Volver a inicio</button></form>
                )}
              </div>
            </div>
          ))}
        </section>

        {elegida && (
          <section className="pz-bloque" id="detalle">
            <div className="section-head" style={{ marginBottom: 8 }}>
              <span className="eyebrow">{elegida.codigo}</span>
              <h2 className="display h-lg" style={{ fontSize: 30 }}>{elegida.titulo}</h2>
            </div>
            <div className="pz-qr" style={{ alignSelf: "flex-start" }}>
              <div className="svg" style={{ width: 160 }} dangerouslySetInnerHTML={{ __html: qr! }} />
              <div>
                <span>Para la slide</span>
                <b>adoops.digital/p/{elegida.codigo}</b>
                <a
                  className="btn btn-text btn-sm"
                  download={`pulso-${elegida.codigo}.svg`}
                  href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr!)}`}
                >
                  Descargar QR (SVG)
                </a>
              </div>
            </div>

            <h3 className="display" style={{ fontSize: 18, marginTop: 16 }}>Quienes dejaron sus datos · {contactos.length}</h3>
            {contactos.length === 0 ? (
              <p className="muted">Nadie todavía.</p>
            ) : (
              <div className="pz-scroll">
                <table className="pz-tabla">
                  <thead>
                    <tr>
                      <th>Nombre</th><th>Cargo</th><th>Contacto</th><th>Perfil</th><th>Rol</th><th>Freno</th><th>Quiere automatizar</th><th>Motor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactos.map((c) => (
                      <tr key={c.id}>
                        <td>{c.nombre}</td>
                        <td>{c.cargo ?? "—"}</td>
                        <td>
                          {c.email && <div>{c.email}</div>}
                          {c.telefono && <div>{formatearTelefono(c.telefono)}</div>}
                          <div className="muted" style={{ fontSize: 12 }}>{c.resultadoEnviadoEn ? "resultado enviado" : "resultado sin enviar"}</div>
                        </td>
                        <td>{CUADRANTES[c.cuadrante as Cuadrante]?.nombre}</td>
                        <td>{textoDe(ROLES, c.rol)}</td>
                        <td>{textoDe(FRENOS, c.freno)}</td>
                        <td>{c.tarea ?? "—"}</td>
                        <td>{c.leadPersonaId ? `#${c.leadPersonaId}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={borrarSesion} className="pz-tarjeta" style={{ marginTop: 24 }}>
              <span className="eyebrow">Borrar (solo sesiones de prueba)</span>
              <input type="hidden" name="id" value={elegida.id} />
              <label className="pz-check">
                <input type="checkbox" name="confirmar" value="si" required />
                <span>Borra la sesión y todas sus respuestas. Las personas que ya pasaron al motor se quedan allá.</span>
              </label>
              <div><button className="btn btn-ghost btn-sm" type="submit">Borrar sesión</button></div>
            </form>
          </section>
        )}
      </main>
    </Marco>
  );
}
