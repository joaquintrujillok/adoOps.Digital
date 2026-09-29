"use client";

import { useState, useTransition } from "react";
import { buscarRutAction, completarCapturaAction } from "@/lib/vanni/captura.actions";
import type { ResultadoRut } from "@/lib/vanni/captura";

/** 12.345.678-5 mientras se escribe. */
function formatearRut(v: string): string {
  const l = v.toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9);
  if (l.length < 2) return l;
  const cuerpo = l.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${l.slice(-1)}`;
}

export default function FormDescuento({ sucursal }: { sucursal: string | null }) {
  const [rut, setRut] = useState("");
  const [datos, setDatos] = useState<ResultadoRut | null>(null);
  const [confirma, setConfirma] = useState<boolean | null>(null);
  const [telefono, setTelefono] = useState("");
  const [consentimiento, setConsentimiento] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await buscarRutAction(rut, sucursal);
      if (!r.ok) return setError(r.error ?? "No pudimos revisar tu RUT.");
      setDatos(r);
      setConfirma(r.telefonoMascarado ? null : false);
    });
  };

  const activar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!datos?.codigo) return;
    setError(null);
    iniciar(async () => {
      const r = await completarCapturaAction({
        codigo: datos.codigo!,
        confirmaTelefono: confirma === true,
        telefono: confirma === true ? null : telefono,
        consentimiento,
      });
      if (!r.ok || !r.whatsappUrl) return setError(r.error ?? "No pudimos guardar tus datos.");
      // Botón y no redirección automática: varios navegadores de celular
      // bloquean un salto a otra app que no nace directo de un toque.
      setWhatsapp(r.whatsappUrl);
    });
  };

  // ── Paso 3: a WhatsApp ────────────────────────────────────────────────────
  if (whatsapp) {
    return (
      <div className="vn-card vn-qr-card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🎁</div>
        <h1 className="vn-qr-titulo">¡Tu descuento está listo!</h1>
        <p>Abre WhatsApp y envía el mensaje que aparece escrito. Te contamos cómo usarlo y armamos tu pedido por ahí.</p>
        <a href={whatsapp} className="vn-btn vn-qr-boton vn-qr-boton-wsp">Abrir WhatsApp</a>
      </div>
    );
  }

  // ── Paso 1: RUT ───────────────────────────────────────────────────────────
  if (!datos) {
    return (
      <form onSubmit={buscar} className="vn-card vn-qr-card">
        <h1 className="vn-qr-titulo">Descubre tu descuento</h1>
        <p>Ingresa tu RUT y te mostramos el beneficio que tienes como cliente de Vanni.</p>
        <label className="vn-label" htmlFor="rut">RUT</label>
        <input
          id="rut"
          value={rut}
          onChange={(e) => setRut(formatearRut(e.target.value))}
          inputMode="text"
          autoComplete="off"
          placeholder="12.345.678-9"
          className="vn-input vn-qr-input"
          autoFocus
          required
        />
        {error && <p className="vn-aviso vn-aviso-rojo">{error}</p>}
        <button className="vn-btn vn-qr-boton" disabled={pendiente || rut.length < 3}>
          {pendiente ? "Buscando…" : "Ver mi descuento"}
        </button>
      </form>
    );
  }

  // ── Paso 2: descuento y teléfono ─────────────────────────────────────────
  const conTelefono = Boolean(datos.telefonoMascarado);
  return (
    <form onSubmit={activar} className="vn-card vn-qr-card">
      {datos.encontrado ? (
        <>
          <h1 className="vn-qr-titulo">¡Hola{datos.nombre ? `, ${datos.nombre}` : ""}!</h1>
          <div className="vn-qr-premio">
            <span>Tienes un descuento</span>
            <b>{datos.descuento || "especial esperándote"}</b>
          </div>
        </>
      ) : (
        <>
          <h1 className="vn-qr-titulo">¡Tenemos descuentos para ti!</h1>
          <p>No encontramos tu RUT en nuestra base de clientes, pero igual puedes aprovechar los descuentos vigentes.</p>
        </>
      )}

      {conTelefono && confirma === null && (
        <div className="vn-qr-bloque">
          <p><b>¿Este es tu número de WhatsApp?</b></p>
          <p className="vn-qr-telefono">{datos.telefonoMascarado}</p>
          <div className="vn-qr-opciones">
            <button type="button" className="vn-btn" onClick={() => setConfirma(true)}>Sí, es mi número</button>
            <button type="button" className="vn-btn vn-btn-sec" onClick={() => setConfirma(false)}>No, es otro</button>
          </div>
        </div>
      )}

      {conTelefono && confirma === true && (
        <div className="vn-qr-bloque">
          <p>Te escribiremos al <b>{datos.telefonoMascarado}</b>. <button type="button" className="vn-qr-link" onClick={() => setConfirma(false)}>Usar otro número</button></p>
        </div>
      )}

      {confirma === false && (
        <div className="vn-qr-bloque">
          <label className="vn-label" htmlFor="tel">{conTelefono ? "Tu número de WhatsApp" : "Déjanos tu número de WhatsApp"}</label>
          <input
            id="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            placeholder="+56 9 1234 5678"
            className="vn-input vn-qr-input"
            required
          />
        </div>
      )}

      {confirma !== null && (
        <>
          <label className="vn-qr-check">
            <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
            <span>Quiero recibir ofertas y novedades de Vanni por WhatsApp. Puedo darme de baja cuando quiera.</span>
          </label>
          {error && <p className="vn-aviso vn-aviso-rojo">{error}</p>}
          <button className="vn-btn vn-qr-boton vn-qr-boton-wsp" disabled={pendiente}>
            {pendiente ? "Un momento…" : "Activar mi descuento por WhatsApp"}
          </button>
        </>
      )}

      <button type="button" className="vn-qr-link" onClick={() => { setDatos(null); setConfirma(null); setError(null); }}>
        Ingresar otro RUT
      </button>
    </form>
  );
}
