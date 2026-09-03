"use client";

// El copiloto de reunión: tres paneles, en vivo.
//
//   Izquierda   la transcripción, palabra por palabra
//   Derecha     el contexto que se va construyendo solo
//   Abajo       las preguntas que convendría hacer ahora
//
// ── Qué es tiempo real acá y qué no ──────────────────────────────────────────
//
// La transcripción sí: llega por deltas y aparece en menos de un segundo.
//
// El contexto y las preguntas **no, y no deberían serlo**. Un modelo razonando
// sobre cada palabra devolvería un panel que cambia cada dos segundos, ilegible
// justo cuando hay que leerlo de reojo mientras uno habla. La cadencia es cada
// 20 segundos, y con un piso de palabras nuevas: si nadie dijo nada, no se
// gasta una pasada en confirmar que no pasó nada.
//
// ── La trampa acústica ───────────────────────────────────────────────────────
//
// El navegador aplica cancelación de eco al micrófono POR DEFECTO, pensada para
// borrar lo que sale por los parlantes. Acá lo que sale por el parlante ES la
// otra persona de la reunión. Las tres restricciones van en `false` explícito, y
// esa es la diferencia entre oír la reunión y oír solo a quien tiene el Mac.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EstadoCopiloto } from "@/lib/reuniones/copiloto";

type Estado = "detenido" | "pidiendo-permiso" | "conectando" | "escuchando" | "error";

/**
 * Una intervención.
 *
 * ── Dos ideas equivocadas antes de llegar acá, y las dos se vieron en pantalla ─
 *
 * La primera: esperar el evento `…transcription.completed` para dar una línea
 * por utilizable. Al sacar `turn_detection` —que `gpt-live-transcribe` rechaza—
 * ese evento dejó de llegar y ninguna línea se cerró jamás; el texto se veía,
 * pero el copiloto nunca recibía nada y no se guardaba nada.
 *
 * La segunda: cerrarla por inactividad, tres segundos sin palabras nuevas. Suena
 * razonable y falla por el mismo motivo de fondo: este modelo manda **toda la
 * reunión en una sola intervención que crece**, y mientras alguien hable no hay
 * tres segundos de silencio en cincuenta minutos. Seguía sin mandarse nada.
 *
 * La conclusión es que no hay que esperar a que una intervención "termine". Con
 * el desplazamiento guardado —cuánto de esta línea ya se mandó— la cola nueva se
 * puede mandar en cualquier momento, y da lo mismo si el modelo devuelve una
 * intervención o cien.
 */
type Linea = { id: string; texto: string; cerrada: boolean; ultimo: number };

const VACIO: EstadoCopiloto = {
  contexto: { tema: "", objetivo: null, puntosClave: [], tensiones: [] },
  preguntas: [],
};

/** Cada cuánto se le pregunta al modelo. Ver la nota de la cabecera. */
const CADENCIA_MS = 20_000;
/**
 * Palabras nuevas mínimas para gastar una pasada.
 *
 * Veinte segundos de silencio, o de "ajá, claro", no cambian el contexto. Sin
 * este piso, una reunión con pausas largas paga por confirmar que no pasó nada.
 */
const MINIMO_PALABRAS = 12;

export default function EscuchaVivo() {
  const [estado, setEstado] = useState<Estado>("detenido");
  const [error, setError] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [eventos, setEventos] = useState<string[]>([]);
  const [desdeMs, setDesdeMs] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);
  const [copiloto, setCopiloto] = useState<EstadoCopiloto>(VACIO);
  const [pensando, setPensando] = useState(false);
  const [costoCopiloto, setCostoCopiloto] = useState(0);
  const [titulo, setTitulo] = useState("");
  /** Id de la reunión guardada, para poder ir a verla al terminar. */
  const [guardada, setGuardada] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finRef = useRef<HTMLDivElement | null>(null);
  /**
   * Hasta qué carácter de cada intervención se le mandó al copiloto.
   *
   * Es un mapa y no un conjunto de "ya enviadas", y la diferencia la enseñó una
   * reunión real: `gpt-live-transcribe` sin `turn_detection` no abre una
   * intervención por turno — manda TODA la reunión en una sola, que crece sin
   * parar. Con un conjunto, esa única línea se marcaba enviada la primera vez y
   * los cincuenta minutos siguientes no llegaban nunca al copiloto.
   *
   * Guardando el desplazamiento se manda solo la cola nueva, sirva el modelo una
   * intervención o cien.
   */
  const enviadoHastaRef = useRef<Map<string, number>>(new Map());
  /** Evita dos pasadas encimadas si una tarda más que la cadencia. */
  const ocupadoRef = useRef(false);
  const lineasRef = useRef<Linea[]>([]);
  /**
   * Tipos de evento ya registrados. Se anota cada uno UNA vez: sin esto el panel
   * se llena de deltas y deja de servir; sin registrar nada —como quedó al
   * rehacer la pantalla— no hay forma de saber qué está emitiendo la sesión, que
   * es exactamente lo que hizo falta para encontrar este bug.
   */
  const vistosRef = useRef<Set<string>>(new Set());
  const copilotoRef = useRef<EstadoCopiloto>(VACIO);
  /**
   * Identifica la sesión entre pasadas. Se arma con el instante de inicio, así
   * que guardar dos veces la misma sesión actualiza la misma fila en vez de
   * crear una reunión duplicada por cada 20 segundos.
   */
  const claveRef = useRef<string>("");
  const inicioRef = useRef<string>("");
  const tituloRef = useRef<string>("");

  // Los refs se sincronizan en un efecto y no al pintar. La pasada del copiloto
  // corre desde un `setInterval` que se crea una sola vez: si leyera el estado
  // directo, leería el de la primera vuelta para siempre. El ref es la forma de
  // que vea lo último — pero escribirlo durante el render es acceder a un ref
  // donde no corresponde, y React lo marca.
  useEffect(() => {
    lineasRef.current = lineas;
  }, [lineas]);

  useEffect(() => {
    copilotoRef.current = copiloto;
  }, [copiloto]);

  useEffect(() => {
    tituloRef.current = titulo;
  }, [titulo]);

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

  // Cortar al salir de la pantalla. Sin esto, navegar a otra parte deja el
  // micrófono abierto y la sesión corriendo — o sea, cobrando.
  useEffect(() => () => detener(), [detener]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lineas]);

  // El efecto solo mantiene el intervalo. El primer valor se pone donde arranca
  // la sesión: sembrarlo acá con un setState síncrono provoca render en cascada.
  useEffect(() => {
    if (desdeMs === null) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [desdeMs]);

  // ── La pasada del copiloto ─────────────────────────────────────────────────
  const pasada = useCallback(async () => {
    if (ocupadoRef.current) return;

    const lineas = lineasRef.current;
    const transcripcion = lineas.map((l) => l.texto).join("\n");
    // Sin una palabra todavía no hay nada que guardar ni que pensar.
    if (!transcripcion.trim()) return;

    // La cola de cada intervención que todavía no se mandó, cortada en el último
    // espacio: si la frase sigue en curso, la última palabra puede estar a
    // medias, y el desplazamiento se deja justo antes para que la próxima pasada
    // la mande entera.
    const colas = lineas
      .map((l) => {
        const desde = enviadoHastaRef.current.get(l.id) ?? 0;
        const pendiente = l.texto.slice(desde);
        const corte = l.cerrada ? pendiente.length : pendiente.lastIndexOf(" ") + 1;
        return { id: l.id, cola: pendiente.slice(0, corte || pendiente.length), largo: desde + (corte || pendiente.length) };
      })
      .filter((x) => x.cola.trim().length > 0);
    const fragmento = colas.map((x) => x.cola).join(" ").trim();
    // El fragmento va vacío cuando no hubo suficiente habla nueva: el servidor
    // guarda igual y devuelve el contexto sin tocarlo. Guardar y razonar son
    // cosas distintas, y atarlas hacía que una reunión callada no se guardara.
    const suficiente =
      fragmento.split(/\s+/).filter(Boolean).length >= MINIMO_PALABRAS;

    ocupadoRef.current = true;
    setPensando(suficiente);
    // Se marcan como enviadas ANTES de la llamada: si falla, este fragmento se
    // pierde pero la reunión sigue. Reintentarlo acumularía texto viejo y el
    // contexto empezaría a hablar del pasado.
    if (suficiente) colas.forEach((x) => enviadoHastaRef.current.set(x.id, x.largo));

    try {
      const res = await fetch("/api/dashboard360/reuniones/vivo/contexto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: copilotoRef.current,
          fragmento: suficiente ? fragmento : "",
          // La transcripción viaja entera y no por incrementos: así un fallo
          // aislado no pierde nada, porque el próximo envío lleva todo igual.
          clave: claveRef.current,
          titulo: tituloRef.current,
          inicioEn: inicioRef.current,
          transcripcion,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? `HTTP ${res.status}`);
      setCopiloto(datos.estado);
      if (typeof datos.costoUsd === "number") {
        setCostoCopiloto((c) => c + datos.costoUsd);
      }
      // Qué material se consultó queda en el registro. Una búsqueda semántica
      // que nadie puede inspeccionar es una caja negra adentro de otra: si el
      // copiloto propone algo raro, lo primero que hay que poder ver es de qué
      // sección lo sacó.
      if (Array.isArray(datos.fuentes) && datos.fuentes.length) {
        registrar(`base: ${datos.fuentes.join(" | ")}`);
      }
    } catch (e) {
      registrar(`ERROR copiloto: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      ocupadoRef.current = false;
      setPensando(false);
    }
  }, [registrar]);

  useEffect(() => {
    if (estado !== "escuchando") return;
    // La primera pasada a los 8 segundos y después cada 20. No es capricho: si
    // algo está mal configurado, esperar veinte segundos para enterarse ya costó
    // dos reuniones. A los ocho segundos ya hay señal de que el circuito
    // completo funciona.
    const primera = setTimeout(pasada, 8_000);
    const t = setInterval(pasada, CADENCIA_MS);
    return () => {
      clearTimeout(primera);
      clearInterval(t);
    };
  }, [estado, pasada]);

  /**
   * Detener de verdad: corta el micrófono, hace una última pasada para no perder
   * los últimos segundos, y cierra la sesión del lado del servidor.
   *
   * Si alguien cierra la pestaña sin apretar esto, no se pierde la reunión: el
   * transcript ya está guardado y queda en la lista en estado "recibida", lista
   * para que el botón de reintentar la termine de procesar.
   */
  async function finalizar() {
    const clave = claveRef.current;
    detener();
    if (!clave) return;

    // Una última pasada arrastra lo que se dijo desde la anterior. Sin esto se
    // pierden hasta veinte segundos justo del final, que suele ser donde se
    // acuerdan las cosas.
    await pasada();

    try {
      const res = await fetch("/api/dashboard360/reuniones/vivo/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clave }),
      });
      const datos = await res.json();
      if (res.ok && datos.id) {
        setGuardada(datos.id);
        registrar(`reunión guardada (id ${datos.id}), corrigiendo y resumiendo`);
      } else {
        registrar(`ERROR al cerrar: ${datos.error ?? res.status}`);
      }
    } catch (e) {
      registrar(`ERROR al cerrar: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function alternarPregunta(id: string) {
    setCopiloto((prev) => ({
      ...prev,
      preguntas: prev.preguntas.map((p) =>
        p.id === id
          ? { ...p, estado: p.estado === "hecha" ? "pendiente" : "hecha" }
          : p,
      ),
    }));
  }

  async function empezar() {
    setError(null);
    setLineas([]);
    setEventos([]);
    setCopiloto(VACIO);
    setCostoCopiloto(0);
    setGuardada(null);
    enviadoHastaRef.current = new Map();
    vistosRef.current = new Set();

    try {
      setEstado("pidiendo-permiso");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
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
        // la credencial efímera, del lado del servidor.
        registrar(`canal abierto · ${datosToken.modelo ?? "modelo por defecto"}`);
        setEstado("escuchando");
        const arranque = Date.now();
        setDesdeMs(arranque);
        setAhora(arranque);
        inicioRef.current = new Date(arranque).toISOString();
        claveRef.current = `vivo-${inicioRef.current}`;
      });

      dc.addEventListener("message", (e) => {
        let ev: {
          type?: string;
          delta?: string;
          transcript?: string;
          item_id?: string;
          error?: unknown;
        };
        try {
          ev = JSON.parse(e.data as string);
        } catch {
          return;
        }

        if (ev.type === "conversation.item.input_audio_transcription.delta") {
          const id = ev.item_id ?? "suelto";
          setLineas((prev) => {
            const i = prev.findIndex((l) => l.id === id);
            const ahora = Date.now();
            if (i === -1)
              return [...prev, { id, texto: ev.delta ?? "", cerrada: false, ultimo: ahora }];
            const copia = [...prev];
            copia[i] = {
              ...copia[i],
              texto: copia[i].texto + (ev.delta ?? ""),
              ultimo: ahora,
            };
            return copia;
          });
          return;
        }

        if (ev.type === "conversation.item.input_audio_transcription.completed") {
          const id = ev.item_id ?? "suelto";
          setLineas((prev) => {
            const i = prev.findIndex((l) => l.id === id);
            const texto = ev.transcript ?? "";
            const ahora = Date.now();
            if (i === -1) return [...prev, { id, texto, cerrada: true, ultimo: ahora }];
            const copia = [...prev];
            copia[i] = { id, texto, cerrada: true, ultimo: ahora };
            return copia;
          });
          return;
        }

        if (ev.type?.includes("error")) {
          registrar(`ERROR ${ev.type}: ${JSON.stringify(ev.error ?? ev).slice(0, 300)}`);
        } else if (ev.type && !vistosRef.current.has(ev.type)) {
          // Cada tipo de evento, la primera vez que aparece. Es barato y es lo
          // único que permite saber qué emite de verdad la sesión cuando algo no
          // llega.
          vistosRef.current.add(ev.type);
          registrar(`evento: ${ev.type}`);
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
      registrar("sesión establecida");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("error");
      detener();
    }
  }

  const escuchando = estado === "escuchando";
  const minutos = desdeMs && ahora > desdeMs ? (ahora - desdeMs) / 60000 : 0;
  const costoTotal = minutos * 0.017 + costoCopiloto;
  const pendientes = copiloto.preguntas.filter((p) => p.estado === "pendiente");
  const hechas = copiloto.preguntas.filter((p) => p.estado === "hecha");
  const c = copiloto.contexto;
  const hayContexto = Boolean(c.tema || c.puntosClave.length || c.tensiones.length);

  return (
    <div className="space-y-4">
      {/* ── Barra ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] px-4 py-3">
        {/* El título se escribe antes o durante, y se puede cambiar mientras
            corre: cada pasada lo vuelve a guardar. Al final uno sabe mejor de
            qué se trató la reunión que al empezar. */}
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la reunión"
          className="w-56 rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]"
        />

        {escuchando ? (
          <button
            onClick={finalizar}
            className="rounded-lg bg-[#8f2c2c] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#7a2424]"
          >
            Detener y guardar
          </button>
        ) : (
          <button
            onClick={empezar}
            disabled={estado === "conectando" || estado === "pidiendo-permiso"}
            className="rounded-lg bg-[var(--d360-brand)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--d360-brand-dark)] disabled:opacity-50"
          >
            {estado === "pidiendo-permiso"
              ? "Pidiendo el micrófono…"
              : estado === "conectando"
                ? "Conectando…"
                : "Empezar a escuchar"}
          </button>
        )}

        {escuchando ? (
          <span className="flex items-center gap-2 text-[12.5px] text-[var(--d360-ink-2)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2fa36b] opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2fa36b]" />
            </span>
            en vivo
          </span>
        ) : null}

        <span className="d360-num ml-auto text-[12px] text-[var(--d360-muted)]">
          {escuchando
            ? `${Math.floor(minutos)} min · ${lineas.length} intervenciones · ~US$${costoTotal.toFixed(2)}`
            : estado}
          {pensando ? " · pensando…" : ""}
        </span>
      </div>

      {guardada ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#b7dfc4] bg-[#eefaf1] p-4 text-[13px] text-[#1c6b39]">
          <span>
            Reunión guardada. La transcripción se está corrigiendo y resumiendo;
            en un momento queda con su .txt para descargar.
          </span>
          <a
            className="rounded-lg border border-[#1c6b39] px-3 py-1.5 text-[12.5px] font-medium text-[#1c6b39] hover:bg-white"
            href={`/dashboard360/reuniones/${guardada}`}
          >
            Verla
          </a>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-[#f0c2c2] bg-[#fdf1f1] p-4 text-[13px] text-[#8f2c2c]">
          <p className="mb-1 font-semibold">No se pudo abrir la sesión</p>
          <p className="d360-num break-words text-[11.5px]">{error}</p>
        </div>
      ) : null}

      {/* ── Los tres paneles ──────────────────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Transcripción */}
        <section className="flex min-h-[560px] flex-col rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-5">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--d360-muted)]">
            Transcripción
          </h2>
          {lineas.length === 0 ? (
            <p className="text-[13px] text-[var(--d360-muted)]">
              {escuchando
                ? "Escuchando. El texto debería aparecer en menos de un segundo."
                : "Aprieta empezar."}
            </p>
          ) : (
            <div className="max-h-[600px] space-y-2.5 overflow-y-auto pr-2">
              {/* Texto normal, sin itálica de "en curso". Esa distinción se
                  diseñó para intervenciones que llegan y se cierran; con este
                  modelo, que manda la reunión entera en una sola que crece,
                  dejaba la pantalla completa en gris itálico de principio a fin
                  — y sugería que nada se había asentado, justo cuando todo ya
                  estaba guardado. */}
              {lineas.map((l) => (
                <p
                  key={l.id}
                  className="text-[15px] leading-relaxed text-[var(--d360-ink)]"
                >
                  {l.texto}
                </p>
              ))}
              <div ref={finRef} />
            </div>
          )}
        </section>

        <div className="space-y-4">
          {/* Contexto */}
          <section className="min-h-[240px] rounded-xl border border-[var(--d360-border)] bg-[#0f1722] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#7f93a8]">
              Contexto
              {pensando ? (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7be9ae]" />
              ) : null}
            </h2>

            {!hayContexto ? (
              <p className="text-[13px] text-[#55677a]">
                Se construye solo, cada 20 segundos, con lo que se va diciendo.
              </p>
            ) : (
              <div className="space-y-4">
                {c.tema ? (
                  <p className="text-[16px] font-medium leading-snug text-white">{c.tema}</p>
                ) : null}

                {c.objetivo ? (
                  <div>
                    <p className="mb-1 text-[11px] uppercase tracking-wide text-[#55677a]">
                      Qué parece querer
                    </p>
                    <p className="text-[13.5px] leading-relaxed text-[#c6d4e1]">{c.objetivo}</p>
                  </div>
                ) : null}

                {c.puntosClave.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[#55677a]">
                      Establecido
                    </p>
                    <ul className="space-y-1.5">
                      {c.puntosClave.map((p, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-[13.5px] leading-relaxed text-[#c6d4e1]"
                        >
                          <span aria-hidden className="select-none text-[#55677a]">
                            ·
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {c.tensiones.length ? (
                  <div>
                    <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[#c9a227]">
                      Sin resolver
                    </p>
                    <ul className="space-y-1.5">
                      {c.tensiones.map((t, i) => (
                        <li
                          key={i}
                          className="text-[13.5px] leading-relaxed text-[#e8d9a8]"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {/* Preguntas */}
          <section className="min-h-[280px] rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-5">
            <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--d360-muted)]">
              Preguntas
            </h2>
            <p className="mb-3 text-[11.5px] text-[var(--d360-muted)]">
              {/* Se dice acá y no en un tooltip: si alguien no sabe que puede
                  marcarlas, la detección automática es lo único que hay, y se
                  equivoca. */}
              Se marcan solas cuando el tema se toca. Si se equivoca, haz clic.
            </p>

            {pendientes.length === 0 && hechas.length === 0 ? (
              <p className="text-[13px] text-[var(--d360-muted)]">
                Todavía ninguna. Prefiere no sugerir a sugerir una obvia.
              </p>
            ) : (
              <div className="space-y-2.5">
                {pendientes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => alternarPregunta(p.id)}
                    className="block w-full rounded-lg border border-[var(--d360-border)] bg-white p-3.5 text-left transition-all hover:border-[var(--d360-brand)] hover:shadow-[0_2px_8px_rgba(11,21,35,0.06)]"
                  >
                    <p className="text-[14.5px] font-medium leading-snug text-[var(--d360-ink)]">
                      {p.pregunta}
                    </p>
                    {p.porQue ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--d360-muted)]">
                        {p.porQue}
                      </p>
                    ) : null}
                  </button>
                ))}

                {hechas.length ? (
                  <div className="pt-1">
                    <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--d360-muted)]">
                      Ya se tocaron
                    </p>
                    {hechas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => alternarPregunta(p.id)}
                        className="block w-full py-1 text-left text-[13px] leading-snug text-[var(--d360-muted)] line-through hover:text-[var(--d360-ink-2)]"
                      >
                        {p.pregunta}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Eventos: abajo y chico. Deja de ser el protagonista cuando la pantalla
          ya hace algo, pero sigue siendo lo único que explica una falla. */}
      <details className="rounded-xl border border-[var(--d360-border)] bg-[#0f1722] p-4">
        <summary className="cursor-pointer text-[12px] text-[#7f93a8]">
          Eventos técnicos ({eventos.length})
        </summary>
        <div className="d360-num mt-3 max-h-[220px] space-y-1 overflow-y-auto text-[11px] leading-relaxed text-[#8fa6bd]">
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
      </details>
    </div>
  );
}
