// Pulso IA: el tablero de las charlas.
//
// Dos pantallas en una, según venga o no `?s=`:
//
//   - sin sesión elegida, la lista de charlas y el formulario para crear una;
//   - con una elegida, su tablero: el QR y sus controles, cómo quedó la sala en
//     gráficos, y quiénes dejaron sus datos.
//
// Es un módulo propio del tablero, encendido solo en la cuenta adoOps. No vive
// bajo /crm: ese es el demo de Highend, con datos sembrados y otra sesión. Acá
// hay respuestas y contactos de personas reales.
//
// La consola y los gráficos son los del tablero. Lo único que conserva el dibujo
// de la web es el mapa de la sala, que es el mismo que se proyecta: por eso va
// dentro de `Marco`, que le da los tokens con que está pintado.

import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import Marco from "@/components/pulso/Marco";
import Mapa from "@/components/pulso/Mapa";
import { BarrasH } from "@/components/dashboard360/charts";
import {
  Badge,
  Card,
  PageHeader,
  StatTile,
  Tabla,
  Vacio,
  btnFantasma,
  btnPrimario,
  btnSecundario,
} from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { contactosDe, estadoSala, listarSesiones } from "@/lib/pulso/datos";
import { CUADRANTES, FRENOS, ROLES, textoDe, type Cuadrante } from "@/lib/pulso/modelo";
import { formatearTelefono } from "@/lib/crm/telefono";
import { url } from "@/lib/site";
import { borrarSesion, cambiarFase, crearSesion, enviarResultados, pausarSesion } from "./acciones";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pulso IA", robots: { index: false, follow: false } };

const FASE: Record<string, string> = { inicio: "Inicio abierto", cierre: "Cierre abierto", cerrada: "Cerrada" };

const campo =
  "w-full rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]";
const etiqueta = "mb-1 block text-[12px] text-[var(--d360-ink-2)]";

type Sesion = Awaited<ReturnType<typeof listarSesiones>>[number];

/** El estado en una palabra: lo que hay que saber antes de pararse frente a la sala. */
function Estado({ s }: { s: Sesion }) {
  if (s.fase === "cerrada") return <Badge>Cerrada</Badge>;
  if (s.pausada) return <Badge tono="alerta">QR en pausa</Badge>;
  return <Badge tono="bueno">{FASE[s.fase]}</Badge>;
}

export default async function PanelPulso({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireSession();
  const { s } = await searchParams;
  const sesiones = await listarSesiones();
  const elegida = s ? sesiones.find((x) => x.id === Number(s)) : undefined;

  if (elegida) return <Detalle sesion={elegida} />;

  const respuestas = sesiones.reduce((a, x) => a + x.respuestas, 0);
  const contactos = sesiones.reduce((a, x) => a + x.contactos, 0);
  const pendientes = sesiones.reduce((a, x) => a + x.pendientes, 0);

  return (
    <>
      <PageHeader
        titulo="Pulso IA"
        bajada="El diagnóstico en vivo de las charlas: un QR, cinco preguntas, el mapa de la sala en la pantalla y, al final, quién quiso seguir la conversación."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile etiqueta="Charlas" valor={String(sesiones.length)} />
        <StatTile etiqueta="Respuestas" valor={String(respuestas)} nota="personas que respondieron el QR" />
        <StatTile
          etiqueta="Dejaron sus datos"
          valor={String(contactos)}
          nota={respuestas ? `${Math.round((contactos / respuestas) * 100)}% de quienes respondieron` : undefined}
        />
        <StatTile etiqueta="Resultados sin enviar" valor={String(pendientes)} nota="esperan el envío desde su charla" />
      </div>

      <Card titulo="Charlas" descripcion="Entra a una para ver su tablero, su QR y sus controles.">
        {sesiones.length === 0 ? (
          <Vacio mensaje="Todavía no hay charlas" sugerencia="Crea la primera acá abajo, antes de la sesión." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Charla</th>
                <th>Fecha</th>
                <th>Código</th>
                <th>Estado</th>
                <th className="text-right">Respuestas</th>
                <th className="text-right">Con datos</th>
                <th className="text-right">Sin enviar</th>
              </tr>
            </thead>
            <tbody>
              {sesiones.map((x) => (
                <tr key={x.id}>
                  <td>
                    <Link href={`/dashboard360/pulso?s=${x.id}`} className="font-medium text-[var(--d360-brand)] hover:underline">
                      {x.titulo}
                    </Link>
                    <div className="text-[12px] text-[var(--d360-muted)]">{x.organizacion}</div>
                  </td>
                  <td>{x.fecha.toLocaleDateString("es-CL")}</td>
                  <td className="d360-num">{x.codigo}</td>
                  <td><Estado s={x} /></td>
                  <td className="d360-num text-right">{x.respuestas}</td>
                  <td className="d360-num text-right">{x.contactos}</td>
                  <td className="d360-num text-right">{x.pendientes}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      <Card className="mt-6" titulo="Nueva charla" descripcion="Una sesión por charla. El código y el QR se generan solos.">
        <form action={crearSesion} className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={etiqueta}>Título de la charla</span>
            <input name="titulo" required className={campo} placeholder="IA en el día a día — sesión mañana" />
          </label>
          <label>
            <span className={etiqueta}>Organización</span>
            <input name="organizacion" required className={campo} placeholder="Como se la nombra en la sala" />
          </label>
          <label>
            <span className={etiqueta}>RUT (opcional, para cruzarla en el motor)</span>
            <input name="rut" className={campo} placeholder="76.123.456-7" />
          </label>
          <label>
            <span className={etiqueta}>Relator</span>
            <input name="relator" className={campo} defaultValue="Nelson García" />
          </label>
          <label>
            <span className={etiqueta}>Fecha</span>
            <input name="fecha" type="date" className={campo} />
          </label>
          <div className="sm:col-span-2">
            <button className={btnPrimario} type="submit">Crear charla</button>
          </div>
        </form>
      </Card>
    </>
  );
}

async function Detalle({ sesion }: { sesion: Sesion }) {
  const [sala, contactos, qr] = await Promise.all([
    estadoSala(sesion.codigo),
    contactosDe(sesion.id),
    QRCode.toString(url(`/p/${sesion.codigo}`), { type: "svg", margin: 1, width: 640 }),
  ]);
  const total = sala?.total ?? 0;
  const enviados = contactos.filter((c) => c.resultadoEnviadoEn).length;
  // Con correo y sin enviar: los únicos a los que el botón les llega hoy.
  const porCorreo = contactos.filter((c) => !c.resultadoEnviadoEn && c.email).length;
  const soloWhatsapp = contactos.filter((c) => !c.resultadoEnviadoEn && !c.email).length;
  const abierta = sesion.fase !== "cerrada";

  const porRol = ROLES.map((r) => ({
    etiqueta: r.texto,
    valor: sala?.puntos.filter((p) => p.rol === r.valor).length ?? 0,
  }));

  return (
    <>
      <PageHeader
        titulo={sesion.titulo}
        bajada={`${sesion.organizacion} · ${sesion.fecha.toLocaleDateString("es-CL")} · relator ${sesion.relator}`}
        acciones={
          <Link href="/dashboard360/pulso" className={btnFantasma}>
            ← Todas las charlas
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile etiqueta="Respuestas" valor={String(total)} nota="personas en el mapa" />
        <StatTile
          etiqueta="Respondieron el cierre"
          valor={String(sala?.conCierre ?? 0)}
          nota={total ? `${Math.round(((sala?.conCierre ?? 0) / total) * 100)}% de la sala` : undefined}
        />
        <StatTile
          etiqueta="Dejaron sus datos"
          valor={String(contactos.length)}
          nota={total ? `${Math.round((contactos.length / total) * 100)}% de la sala` : undefined}
        />
        <StatTile
          etiqueta="Resultados enviados"
          valor={`${enviados} de ${contactos.length}`}
          nota={contactos.length - enviados > 0 ? `${contactos.length - enviados} sin enviar` : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* ── El QR y sus controles ─────────────────────────────────────────── */}
        <Card titulo="QR de la charla" acciones={<Estado s={sesion} />}>
          <div
            className={`mx-auto w-full max-w-[220px] ${sesion.pausada || !abierta ? "opacity-30" : ""}`}
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <p className="d360-num mt-3 text-center text-[13px] font-medium text-[var(--d360-ink)]">
            adoops.digital/p/{sesion.codigo}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <a className={btnSecundario} href={`/pulso/${sesion.codigo}`} target="_blank" rel="noreferrer">
              Pantalla
            </a>
            <a className={btnSecundario} href={`/p/${sesion.codigo}`} target="_blank" rel="noreferrer">
              Celular
            </a>
            <a
              className={btnSecundario}
              download={`pulso-${sesion.codigo}.svg`}
              href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`}
            >
              Descargar QR
            </a>
          </div>

          <div className="mt-5 space-y-3 border-t border-[var(--d360-grid)] pt-4">
            {abierta && (
              <form action={pausarSesion}>
                <input type="hidden" name="id" value={sesion.id} />
                <input type="hidden" name="pausada" value={sesion.pausada ? "no" : "si"} />
                <button className={`${sesion.pausada ? btnPrimario : btnSecundario} w-full justify-center`} type="submit">
                  {sesion.pausada ? "Reactivar el QR" : "Pausar el QR"}
                </button>
                <p className="mt-1 text-[11.5px] text-[var(--d360-muted)]">
                  {sesion.pausada
                    ? "En pausa: nadie puede responder ni dejar sus datos."
                    : "Pausar deja de recibir respuestas sin cerrar la charla."}
                </p>
              </form>
            )}

            {sesion.fase === "inicio" && (
              <form action={cambiarFase}>
                <input type="hidden" name="id" value={sesion.id} />
                <input type="hidden" name="fase" value="cierre" />
                <button className={`${btnPrimario} w-full justify-center`} type="submit">Abrir el cierre</button>
                <p className="mt-1 text-[11.5px] text-[var(--d360-muted)]">
                  Las dos preguntas del final y el formulario de contacto.
                </p>
              </form>
            )}
            {sesion.fase === "cierre" && (
              <form action={cambiarFase}>
                <input type="hidden" name="id" value={sesion.id} />
                <input type="hidden" name="fase" value="cerrada" />
                <button className={`${btnPrimario} w-full justify-center`} type="submit">Cerrar la charla</button>
                <p className="mt-1 text-[11.5px] text-[var(--d360-muted)]">
                  Definitivo: el QR deja de funcionar y queda la señal en el motor.
                </p>
              </form>
            )}
            {sesion.fase !== "inicio" && (
              <form action={cambiarFase}>
                <input type="hidden" name="id" value={sesion.id} />
                <input type="hidden" name="fase" value="inicio" />
                <button className={`${btnFantasma} w-full justify-center`} type="submit">Volver a inicio</button>
              </form>
            )}
          </div>

          {/* ── El gatillante ──────────────────────────────────────────────── */}
          <div className="mt-5 border-t border-[var(--d360-grid)] pt-4">
            <form action={enviarResultados}>
              <input type="hidden" name="id" value={sesion.id} />
              <button className={`${btnPrimario} w-full justify-center`} type="submit" disabled={porCorreo === 0}>
                {porCorreo === 0 ? "Sin resultados por enviar" : `Enviar ${porCorreo} ${porCorreo === 1 ? "resultado" : "resultados"}`}
              </button>
            </form>
            <p className="mt-1 text-[11.5px] text-[var(--d360-muted)]">
              Le manda a cada persona su perfil y cómo quedó la sala. Hoy sale por correo; el WhatsApp todavía no está
              conectado.
              {soloWhatsapp > 0 &&
                ` ${soloWhatsapp} ${soloWhatsapp === 1 ? "persona dejó" : "personas dejaron"} solo WhatsApp y ${soloWhatsapp === 1 ? "queda" : "quedan"} pendiente${soloWhatsapp === 1 ? "" : "s"}.`}
            </p>
          </div>
        </Card>

        {/* ── Cómo quedó la sala ────────────────────────────────────────────── */}
        <div className="space-y-6">
          {total === 0 || !sala ? (
            <Card titulo="La sala">
              <Vacio mensaje="Todavía nadie responde" sugerencia="El mapa y los gráficos aparecen con la primera respuesta." />
            </Card>
          ) : (
            <>
              <Card
                titulo="El mapa de la sala"
                descripcion="Cada punto es una persona: a la derecha, cuánto usa la IA; arriba, cuánto espera de ella. Es el que se proyecta."
              >
                <Marco>
                  <div className="pz-panel-d360 mx-auto max-w-[560px] py-4">
                    <Mapa puntos={sala.puntos} cuadrantes={sala.cuadrantes} cierre={sesion.fase !== "inicio"} />
                  </div>
                </Marco>
              </Card>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card titulo="Perfiles" descripcion="En qué cuadrante cayó cada persona.">
                  <BarrasH
                    anchoEtiqueta={110}
                    anchoTexto={36}
                    datos={(Object.keys(CUADRANTES) as Cuadrante[]).map((q) => ({
                      etiqueta: CUADRANTES[q].nombre,
                      valor: sala.cuadrantes[q] ?? 0,
                    }))}
                  />
                </Card>
                <Card titulo="Quiénes vinieron" descripcion="El rol que declaró cada persona.">
                  <BarrasH anchoEtiqueta={150} anchoTexto={36} datos={porRol} />
                </Card>
              </div>

              <Card
                titulo="Qué los frena"
                descripcion={
                  sala.conCierre > 0
                    ? "Al inicio de la charla y al cierre. El cierre solo cuenta a quienes lo respondieron."
                    : "Lo que respondieron al inicio. El cierre aparece cuando se abra."
                }
              >
                <div className={sala.conCierre > 0 ? "grid gap-6 xl:grid-cols-2" : ""}>
                  <div>
                    {sala.conCierre > 0 && (
                      <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--d360-muted)]">Inicio</p>
                    )}
                    <BarrasH
                      anchoEtiqueta={190}
                      anchoTexto={36}
                      datos={sala.frenos.map((f) => ({ etiqueta: f.texto, valor: f.inicio }))}
                    />
                  </div>
                  {sala.conCierre > 0 && (
                    <div>
                      <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--d360-muted)]">Cierre</p>
                      <BarrasH
                        anchoEtiqueta={190}
                        anchoTexto={36}
                        colorUnico="var(--d360-accent)"
                        datos={sala.frenos.map((f) => ({ etiqueta: f.texto, valor: f.cierre }))}
                      />
                    </div>
                  )}
                </div>
                {sala.expectativaInicio != null && (
                  <p className="mt-4 text-[13px] text-[var(--d360-ink-2)]">
                    Expectativa promedio (de 1 a 5):{" "}
                    <strong className="text-[var(--d360-ink)]">{String(sala.expectativaInicio).replace(".", ",")}</strong> al
                    inicio
                    {sala.expectativaCierre != null && (
                      <>
                        {" "}→ <strong className="text-[var(--d360-ink)]">{String(sala.expectativaCierre).replace(".", ",")}</strong>{" "}
                        al cierre
                      </>
                    )}
                    .
                  </p>
                )}
              </Card>

              {sala.palabras.length > 0 && (
                <Card titulo="Qué quieren automatizar" descripcion="Las palabras que más se repiten en la tarea que no volverían a hacer a mano.">
                  <BarrasH
                    anchoEtiqueta={150}
                    anchoTexto={36}
                    datos={sala.palabras.slice(0, 10).map((p) => ({ etiqueta: p.palabra, valor: p.n }))}
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <Card className="mt-6" titulo={`Quienes dejaron sus datos · ${contactos.length}`} descripcion="Quedan también en Contactos del CRM.">
        {contactos.length === 0 ? (
          <Vacio mensaje="Nadie todavía" sugerencia="El formulario aparece cuando se abre el cierre." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Contacto</th>
                <th>Perfil</th>
                <th>Rol</th>
                <th>Freno</th>
                <th>Quiere automatizar</th>
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {contactos.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.nombre}
                    {c.cargo && <div className="text-[12px] text-[var(--d360-muted)]">{c.cargo}</div>}
                  </td>
                  <td>
                    {c.telefono && <div>{formatearTelefono(c.telefono)}</div>}
                    {c.email && <div className="text-[12px] text-[var(--d360-muted)]">{c.email}</div>}
                  </td>
                  <td>{CUADRANTES[c.cuadrante as Cuadrante]?.nombre}</td>
                  <td>{textoDe(ROLES, c.rol)}</td>
                  <td>{textoDe(FRENOS, c.freno)}</td>
                  <td>{c.tarea ?? "—"}</td>
                  <td>{c.resultadoEnviadoEn ? <Badge tono="bueno">Enviado</Badge> : <Badge>Sin enviar</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </Card>

      <Card className="mt-6" titulo="Borrar la charla" descripcion="Solo para sesiones de prueba. Una charla real se cierra, no se borra.">
        <form action={borrarSesion} className="space-y-3">
          <input type="hidden" name="id" value={sesion.id} />
          <label className="flex items-start gap-2 text-[13px] text-[var(--d360-ink-2)]">
            <input type="checkbox" name="confirmar" value="si" required className="mt-0.5" />
            <span>Borra la sesión y todas sus respuestas. Las personas que ya pasaron al motor y al CRM se quedan allá.</span>
          </label>
          <button className={btnSecundario} type="submit">Borrar la charla</button>
        </form>
      </Card>
    </>
  );
}
