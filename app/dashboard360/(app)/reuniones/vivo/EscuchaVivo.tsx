"use client";

// Prueba de humo de la escucha en vivo.
//
// Su trabajo no es verse bien: es responder tres preguntas que deciden si el
// copiloto de reuniones es viable, y ninguna se puede contestar desde un
// escritorio.
//
//   1. ¿La cuenta de OpenAI tiene habilitada la Realtime API?
//   2. ¿Cuánta latencia hay de verdad entre hablar y ver el texto?
//   3. ¿El micrófono capta a la otra persona saliendo por el parlante del Mac,
//      con calidad suficiente para transcribir?
//
// Por eso muestra el registro de eventos crudos al lado del transcript. Cuando
// esto falle —y va a fallar alguna vez— la diferencia entre "no anduvo" y una
// respuesta útil está en ese panel.
//
// ── La trampa acústica, que es el detalle que decide todo ────────────────────
//
// El navegador aplica cancelación de eco al micrófono POR DEFECTO. Está pensada
// justamente para borrar lo que sale por los parlantes y no devolvérselo al
// interlocutor. Acá eso sería fatal: lo que sale por el parlante del Mac ES la
// otra persona de la reunión, y es la mitad de lo que queremos transcribir.
//
// Por eso las tres restricciones van en `false` explícito. Con los valores por
// defecto, este panel mostraría solo la voz de quien tiene el Mac y parecería
// que el micrófono anda mal.

import { useCallback, useEffect, useRef, useState } from "react";

type Estado = "detenido" | "pidiendo-permiso" | "conectando" | "escuchando" | "error";

type Linea = { id: string; texto: string; cerrada: boolean };

export default function EscuchaVivo() {
  const [estado, setEstado] = useState<Estado>("detenido");
  const [error, setError] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [eventos, setEventos] = useState<string[]>([]);
  const [desdeMs, setDesdeMs] = useState<number | null>(null);
  /**
   * Reloj propio, que avanza solo mientras la sesión está abierta.
   *
   * Leer `Date.now()` al pintar sería impuro —React lo marca como error— y
   * además tenía un bug encubierto: el contador de costo solo se movía cuando
   * llegaba texto nuevo, o sea que en un silencio largo se quedaba quieto
   * mostrando menos de lo que la sesión estaba gastando. Justo al revés de para
   * qué existe.
   */
  const [ahora, setAhora] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);

  const registrar = useCallback((linea: string) => {
    setEventos((prev) => [...prev.slice(-60), linea]);
  }, []);

  const detener = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEstado("detenido");
    setDesdeMs(null);
  }, []);

  // Cortar la sesión al salir de la pantalla. Sin esto, navegar a otra parte
  // deja el micrófono abierto y la sesión corriendo — o sea, cobrando.
  useEffect(() => () => detener(), [detener]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lineas]);

  // El efecto solo mantiene el intervalo. El primer valor se pone donde arranca
  // la sesión, en el manejador: sembrarlo acá con un setState síncrono provoca
  // un render en cascada, y React lo marca con razón.
  useEffect(() => {
    if (desdeMs === null) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [desdeMs]);

  async function empezar() {
    setError(null);
    setLineas([]);
    setEventos([]);

    try {
      setEstado("pidiendo-permiso");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Ver la nota de la cabecera. Estas tres son la diferencia entre oír
          // la reunión y oír solo a quien tiene el computador.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;
      registrar("micrófono abierto, cancelación de eco desactivada");

      setEstado("conectando");
      const resToken = await fetch("/api/dashboard360/reuniones/vivo/token", {
        method: "POST",
      });
      const datosToken = await resToken.json();
      if (!resToken.ok) {
        throw new Error(
          `credencial: ${datosToken.error ?? resToken.status}${
            datosToken.detalle ? ` — ${String(datosToken.detalle).slice(0, 300)}` : ""
          }`,
        );
      }
      registrar("credencial efímera obtenida");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.addTrack(stream.getAudioTracks()[0], stream);

      const dc = pc.createDataChannel("oai-events");

      dc.addEventListener("open", () => {
        // No se manda `session.update`: la sesión ya viene configurada dentro de
        // la credencial efímera, del lado del servidor. Un solo lugar donde está
        // definida, y del lado que el navegador no puede cambiar.
        registrar(`canal de eventos abierto · ${datosToken.modelo ?? "modelo por defecto"}`);
        setEstado("escuchando");
        const arranque = Date.now();
        setDesdeMs(arranque);
        setAhora(arranque);
      });

      dc.addEventListener("message", (e) => {
        let evento: { type?: string; delta?: string; transcript?: string; item_id?: string; error?: unknown };
        try {
          evento = JSON.parse(e.data as string);
        } catch {
          return;
        }

        if (evento.type === "conversation.item.input_audio_transcription.delta") {
          const id = evento.item_id ?? "suelto";
          setLineas((prev) => {
            const i = prev.findIndex((l) => l.id === id);
            if (i === -1) return [...prev, { id, texto: evento.delta ?? "", cerrada: false }];
            const copia = [...prev];
            copia[i] = { ...copia[i], texto: copia[i].texto + (evento.delta ?? "") };
            return copia;
          });
          return;
        }

        if (evento.type === "conversation.item.input_audio_transcription.completed") {
          const id = evento.item_id ?? "suelto";
          setLineas((prev) => {
            const i = prev.findIndex((l) => l.id === id);
            const texto = evento.transcript ?? "";
            if (i === -1) return [...prev, { id, texto, cerrada: true }];
            const copia = [...prev];
            copia[i] = { id, texto, cerrada: true };
            return copia;
          });
          return;
        }

        // Todo lo demás va al registro. Los errores de la sesión llegan por acá
        // y son la única forma de enterarse de que el modelo no existe, que la
        // cuenta no tiene acceso, o que el formato de audio no le sirve.
        if (evento.type?.includes("error")) {
          registrar(`ERROR ${evento.type}: ${JSON.stringify(evento.error ?? evento).slice(0, 300)}`);
        } else if (evento.type) {
          registrar(evento.type);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const resSdp = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${datosToken.secreto}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!resSdp.ok) {
        throw new Error(`handshake ${resSdp.status}: ${(await resSdp.text()).slice(0, 300)}`);
      }

      await pc.setRemoteDescription({ type: "answer", sdp: await resSdp.text() });
      registrar("sesión WebRTC establecida");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("error");
      detener();
    }
  }

  const texto = lineas.map((l) => l.texto).join(" ").trim();
  const minutos = desdeMs && ahora > desdeMs ? (ahora - desdeMs) / 60000 : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {estado === "escuchando" ? (
          <button
            onClick={detener}
            className="rounded-lg bg-[#8f2c2c] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#7a2424]"
          >
            Detener
          </button>
        ) : (
          <button
            onClick={empezar}
            disabled={estado === "conectando" || estado === "pidiendo-permiso"}
            className="rounded-lg bg-[var(--d360-brand)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--d360-brand-dark)] disabled:opacity-50"
          >
            {estado === "pidiendo-permiso"
              ? "Pidiendo el micrófono…"
              : estado === "conectando"
                ? "Conectando…"
                : "Empezar a escuchar"}
          </button>
        )}

        <span className="d360-num text-[12px] text-[var(--d360-muted)]">
          {estado === "escuchando"
            ? `escuchando · ${lineas.length} intervenciones · ${texto.split(/\s+/).filter(Boolean).length} palabras`
            : estado}
          {/* El costo se muestra mientras corre y no al final: son 1,7 centavos
              de dólar por minuto, cien veces el carril de los subtítulos, y eso
              tiene que estar a la vista mientras la sesión está abierta. */}
          {estado === "escuchando" && minutos > 0
            ? ` · ~US$${(minutos * 0.017).toFixed(2)}`
            : ""}
        </span>
      </div>

      {error ? (
        <div className="rounded-lg border border-[#f0c2c2] bg-[#fdf1f1] p-4 text-[13px] text-[#8f2c2c]">
          <p className="mb-1 font-semibold">No se pudo abrir la sesión</p>
          <p className="d360-num break-words text-[11.5px]">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="min-h-[420px] rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-5">
          <h2 className="mb-3 text-[15px] font-semibold text-[var(--d360-ink)]">
            Transcripción en vivo
          </h2>
          {lineas.length === 0 ? (
            <p className="text-[13px] text-[var(--d360-muted)]">
              {estado === "escuchando"
                ? "Escuchando. Hablá y el texto debería aparecer en menos de un segundo."
                : "Todavía no hay nada. Apretá empezar."}
            </p>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-2">
              {lineas.map((l) => (
                <p
                  key={l.id}
                  className={`text-[14px] leading-relaxed ${
                    l.cerrada ? "text-[var(--d360-ink)]" : "text-[var(--d360-muted)] italic"
                  }`}
                >
                  {l.texto}
                </p>
              ))}
              <div ref={finRef} />
            </div>
          )}
        </div>

        <div className="min-h-[420px] rounded-xl border border-[var(--d360-border)] bg-[#0f1722] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[#93a4b4]">Eventos</h2>
          <div className="d360-num max-h-[520px] space-y-1 overflow-y-auto text-[11px] leading-relaxed text-[#8fa6bd]">
            {eventos.length === 0 ? (
              <p className="text-[#55677a]">nada todavía</p>
            ) : (
              eventos.map((ev, i) => (
                <p key={i} className={ev.startsWith("ERROR") ? "text-[#ff9b9b]" : ""}>
                  {ev}
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
