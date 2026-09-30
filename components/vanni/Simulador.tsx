"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  conversacionSimulada,
  reiniciarSimulacion,
  simularMensaje,
  type MensajeChat,
} from "@/lib/vanni/simulador.actions";

const ATAJOS = ["Hola 👋 Quiero mi descuento Vanni (sala Centro)", "sí", "12.345.678-5", "#Ofertas", "Sí, me interesa", "Necesito bandejas para tortas", "#tienda-whatsapp", "servilletas", "1", "agregar 1 x 10", "carrito", "pagar Av. Siempre Viva 123", "estado", "#salir"];

export default function Simulador({ telefonoInicial }: { telefonoInicial: string }) {
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    iniciar(async () => setMensajes(await conversacionSimulada(telefono)));
  }, [telefono]);
  // Con llaves: en Chrome reciente scrollIntoView devuelve una promesa, y React
  // tomaría lo que devuelve el efecto como su función de limpieza.
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes]);

  const enviar = (t: string) => {
    if (!t.trim()) return;
    setError(null);
    setTexto("");
    setMensajes((m) => [...m, { id: -Date.now(), direccion: "in", texto: t, imagenUrl: null, at: new Date().toISOString() }]);
    iniciar(async () => {
      try {
        setMensajes(await simularMensaje(telefono, t));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error del motor");
      }
    });
  };

  return (
    <div className="vn-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 16 }}>
      <section className="vn-card">
        <div className="vn-chat">
          {mensajes.map((m) => (
            <div key={m.id} className={`vn-burbuja ${m.direccion === "in" ? "vn-burbuja-in" : "vn-burbuja-out"}`}>
              {m.imagenUrl && <img src={m.imagenUrl} alt="" />}
              {m.texto}
            </div>
          ))}
          {pendiente && <div className="vn-burbuja vn-burbuja-out" style={{ color: "var(--vn-muted)" }}>escribiendo…</div>}
          {!mensajes.length && !pendiente && <p className="vn-vacio">Escribe lo que quieres comprar (ej: <b>servilletas</b>), o <b>#Ofertas</b> para simular que te llegó la campaña.</p>}
          <div ref={fin} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
          style={{ display: "flex", gap: 8, marginTop: 10 }}
        >
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe como el cliente…" className="vn-input" autoFocus />
          <button className="vn-btn" disabled={pendiente}>Enviar</button>
        </form>
        {error && <p className="vn-aviso vn-aviso-rojo" style={{ marginTop: 8 }}>{error}</p>}
      </section>
      <aside style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <section className="vn-card">
          <label className="vn-label">Teléfono simulado</label>
          <select value={telefono} onChange={(e) => setTelefono(e.target.value)} className="vn-select">
            {["56900090001", "56900090002", "56900090003"].map((t) => <option key={t} value={t}>+{t}</option>)}
          </select>
          <p className="vn-ayuda">Teléfonos inventados: quedan como datos de ejemplo y nada sale por WhatsApp.</p>
          <button
            type="button"
            className="vn-btn vn-btn-sec vn-btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => iniciar(async () => setMensajes(await reiniciarSimulacion(telefono)))}
          >
            Borrar esta conversación
          </button>
        </section>
        <section className="vn-card">
          <label className="vn-label">Atajos</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ATAJOS.map((a) => (
              <button key={a} type="button" className="vn-chip" style={{ border: "none", cursor: "pointer", padding: "5px 10px" }} onClick={() => enviar(a)}>{a}</button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
