"use client";

import { useActionState } from "react";
import { crearCampanaAction } from "@/lib/vanni/backoffice.actions";
import SubirImagen from "./SubirImagen";

// La campaña con que parte el formulario: la de bandejas y blondas, lista para
// mostrar en vivo (texto, pieza y segmento Demo). Se puede cambiar todo antes de
// crearla. Las tres variantes terminan igual: piden un OK (con eso se deriva al
// ejecutivo, sin más preguntas) y dicen cómo darse de baja.
const CAMPANA_INICIAL = {
  nombre: "Reactivación bandejas y blondas",
  promocion: "15% de descuento",
  condiciones: "Aplica a bandejas y blondas.",
  imagenUrl: "https://vo46dbyvby1mduok.public.blob.vercel-storage.com/vanni/campanas/promo1-bandejas-HYhi3e0x.png",
  segmento: "Demo",
};

const CIERRE = "\n\n_Si no quieres recibir más mensajes, responde BAJA._";

const PLANTILLAS = {
  A: {
    nombre: "Te extrañamos",
    texto:
      "Hola {nombre} 👋 Te escribimos de *Vanni Chile*.\n\n" +
      "Hace un tiempo que no te vemos en nuestras sucursales y queremos regalarte una *promoción exclusiva*: *{promocion}* en *bandejas y blondas*.\n\n" +
      "Si te interesa, respóndenos *OK* y una ejecutiva te llamará dentro de las próximas 24 horas para cerrar tu pedido. ¡Será un gusto atenderte!" +
      CIERRE,
  },
  B: {
    nombre: "Beneficio reservado",
    texto:
      "Hola {nombre}, ¿cómo estás? Somos *Vanni Chile* 🙌\n\n" +
      "Te reservamos *{promocion}* en *bandejas y blondas*, solo para clientes como tú.\n\n" +
      "Responde *OK* y una ejecutiva te contacta en menos de 24 horas para aplicarlo." +
      CIERRE,
  },
  C: {
    nombre: "Directo",
    texto:
      "Hola {nombre}, te habla *Vanni Chile*. Tienes *{promocion}* en *bandejas y blondas* esperándote 🎁\n\n" +
      "¿Lo aprovechamos? Responde *OK* y una ejecutiva te llama dentro de 24 horas." +
      CIERRE,
  },
};

export default function FormCampana({
  ejecutivas,
  ejecutivaPorDefecto,
  segmentos,
  sucursales,
}: {
  ejecutivas: { id: number; nombre: string }[];
  ejecutivaPorDefecto?: number | null;
  segmentos: { nombre: string; n: number }[];
  sucursales: string[];
}) {
  const [estado, accion, pendiente] = useActionState(crearCampanaAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 16 }}>
      <section className="vn-card" style={{ display: "grid", gap: 12 }}>
        <h2>La promoción</h2>
        <div className="vn-grid vn-grid-2" style={{ gap: 12 }}>
          <div><label className="vn-label">Nombre de la campaña *</label><input name="nombre" required className="vn-input" defaultValue={CAMPANA_INICIAL.nombre} /></div>
          <div><label className="vn-label">Promoción *</label><input name="promocion" required className="vn-input" defaultValue={CAMPANA_INICIAL.promocion} /><p className="vn-ayuda">Lo único que el agente puede ofrecer. Se inserta en {"{promocion}"}.</p></div>
        </div>
        <div><label className="vn-label">Condiciones</label><textarea name="condiciones" className="vn-textarea" defaultValue={CAMPANA_INICIAL.condiciones} /><p className="vn-ayuda">El agente las usa para responder preguntas sin inventar. Lo que no esté acá, lo deriva a la ejecutiva.</p></div>
        <div className="vn-grid vn-grid-2" style={{ gap: 12 }}>
          <div>
            <label className="vn-label">Ejecutiva que recibe a los interesados</label>
            <select name="ejecutivaId" className="vn-select" defaultValue={ejecutivaPorDefecto ?? ""}>
              <option value="">La del contacto, o el administrador</option>
              {ejecutivas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="vn-label">Recordatorio</label>
            <select name="recordatorioHoras" className="vn-select" defaultValue="48">
              <option value="0">Sin recordatorio</option>
              <option value="24">Uno, a las 24 horas</option>
              <option value="48">Uno, a las 48 horas</option>
              <option value="72">Uno, a las 72 horas</option>
            </select>
          </div>
        </div>
      </section>

      <section className="vn-card" style={{ display: "grid", gap: 12 }}>
        <h2>A quién</h2>
        <div>
          <label className="vn-label">Segmentos RFM (sin marcar = todos)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {segmentos.map((s) => (
              <label key={s.nombre} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" name="segmentos" value={s.nombre} defaultChecked={s.nombre === CAMPANA_INICIAL.segmento} /> {s.nombre} <span style={{ color: "var(--vn-muted)" }}>({s.n})</span>
              </label>
            ))}
          </div>
        </div>
        {sucursales.length > 0 && (
          <div>
            <label className="vn-label">Sucursales (sin marcar = todas)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {sucursales.map((s) => (
                <label key={s} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}><input type="checkbox" name="sucursales" value={s} /> {s}</label>
              ))}
            </div>
          </div>
        )}
        <p className="vn-ayuda">Los contactos dados de baja nunca entran. Cada contacto recibe una sola variante, repartidas en orden A, B, C.</p>
      </section>

      <section className="vn-card" style={{ display: "grid", gap: 12 }}>
        <h2>La imagen</h2>
        <p className="vn-sub">La pieza del descuento. Va en todas las variantes, con el texto como epígrafe.</p>
        <SubirImagen name="imagenUrl" inicial={CAMPANA_INICIAL.imagenUrl} />
      </section>

      <section className="vn-card" style={{ display: "grid", gap: 12 }}>
        <h2>Los mensajes</h2>
        <p className="vn-sub">Variables: {"{nombre}"}, {"{promocion}"}, {"{categoria}"}, {"{sucursal}"}. Deja vacía una variante para no usarla.</p>
        {(["A", "B", "C"] as const).map((k) => (
          <div key={k} className="vn-grid" style={{ gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "start" }}>
            <div><label className="vn-label">Variante {k}</label><input name={`nombre${k}`} defaultValue={PLANTILLAS[k].nombre} className="vn-input" /></div>
            <div><label className="vn-label">Texto</label><textarea name={`plantilla${k}`} defaultValue={PLANTILLAS[k].texto} className="vn-textarea" rows={8} /></div>
          </div>
        ))}
      </section>

      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      <div><button className="vn-btn" disabled={pendiente}>{pendiente ? "Creando…" : "Crear campaña (queda en borrador)"}</button></div>
    </form>
  );
}
