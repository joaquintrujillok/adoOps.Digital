"use client";

import { useActionState } from "react";
import { crearCampanaAction } from "@/lib/vanni/backoffice.actions";

const PLANTILLAS = {
  A: {
    nombre: "Descuento directo",
    texto: "Hola {nombre}, este mes tienes {promocion} en {categoria}. ¿Te llama tu ejecutiva de Vanni?",
  },
  B: {
    nombre: "Novedades del mes",
    texto: "Hola {nombre}, llegaron novedades en {categoria} y tenemos {promocion} para ti. ¿Quieres que una ejecutiva te cuente?",
  },
  C: {
    nombre: "Recordatorio de cuenta",
    texto: "Hola {nombre}, hace tiempo no te vemos en Vanni. Te guardamos {promocion}. ¿Te contactamos?",
  },
};

export default function FormCampana({
  ejecutivas,
  segmentos,
  sucursales,
}: {
  ejecutivas: { id: number; nombre: string }[];
  segmentos: { nombre: string; n: number }[];
  sucursales: string[];
}) {
  const [estado, accion, pendiente] = useActionState(crearCampanaAction, null);
  return (
    <form action={accion} style={{ display: "grid", gap: 16 }}>
      <section className="vn-card" style={{ display: "grid", gap: 12 }}>
        <h2>La promoción</h2>
        <div className="vn-grid vn-grid-2" style={{ gap: 12 }}>
          <div><label className="vn-label">Nombre de la campaña *</label><input name="nombre" required className="vn-input" placeholder="Reactivación octubre" /></div>
          <div><label className="vn-label">Promoción *</label><input name="promocion" required className="vn-input" placeholder="15% de descuento" /><p className="vn-ayuda">Lo único que el agente puede ofrecer. Se inserta en {"{promocion}"}.</p></div>
        </div>
        <div><label className="vn-label">Condiciones</label><textarea name="condiciones" className="vn-textarea" placeholder="Válido hasta el 31 de octubre en compras sobre $50.000. No acumulable." /><p className="vn-ayuda">El agente las usa para responder preguntas sin inventar. Lo que no esté acá, lo deriva a la ejecutiva.</p></div>
        <div className="vn-grid vn-grid-2" style={{ gap: 12 }}>
          <div>
            <label className="vn-label">Ejecutiva que recibe a los interesados</label>
            <select name="ejecutivaId" className="vn-select">
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
                <input type="checkbox" name="segmentos" value={s.nombre} /> {s.nombre} <span style={{ color: "var(--vn-muted)" }}>({s.n})</span>
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
        <h2>Los mensajes</h2>
        <p className="vn-sub">Variables: {"{nombre}"}, {"{promocion}"}, {"{categoria}"}, {"{sucursal}"}. Deja vacía una variante para no usarla.</p>
        {(["A", "B", "C"] as const).map((k) => (
          <div key={k} className="vn-grid" style={{ gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "start" }}>
            <div><label className="vn-label">Variante {k}</label><input name={`nombre${k}`} defaultValue={PLANTILLAS[k].nombre} className="vn-input" /></div>
            <div><label className="vn-label">Texto</label><textarea name={`plantilla${k}`} defaultValue={PLANTILLAS[k].texto} className="vn-textarea" /></div>
          </div>
        ))}
      </section>

      {estado?.error && <p className="vn-aviso vn-aviso-rojo">{estado.error}</p>}
      <div><button className="vn-btn" disabled={pendiente}>{pendiente ? "Creando…" : "Crear campaña (queda en borrador)"}</button></div>
    </form>
  );
}
