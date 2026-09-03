"use client";

// El copiloto de reunión: tres paneles, mientras la conversación ocurre.
//
//   Izquierda   la transcripción
//   Derecha     el contexto que se va construyendo solo
//   Abajo       las preguntas que convendría hacer ahora
//
// ── Por qué graba por tramos y no en tiempo real ─────────────────────────────
//
// La primera versión abría una sesión WebRTC con `gpt-live-transcribe`: texto en
// menos de un segundo, y **US$1,02 la hora**. Se pagó una reunión real a ese
// precio —27 minutos, US$0,46— y el número dejó ver el error de diseño: se
// pagaba una prima por latencia que después se tiraba a la basura, porque el
// copiloto razona cada 20 segundos igual.
//
// Ahora se graba en tramos de 20 segundos y cada uno se transcribe con
// `gpt-transcribe`, que cuesta US$0,0045 el minuto. El texto aparece por bloques
// en vez de fluir palabra por palabra, que es exactamente la cadencia a la que
// esta pantalla ya trabajaba.
//
// ── El silencio no se transcribe ─────────────────────────────────────────────
//
// Antes se pagaba por transcribir las pausas. Ahora se mide el nivel de audio de
// cada tramo y los que no llegan al umbral no se mandan. En una reunión con
// pausas eso es otro tanto de ahorro, y además evita que el modelo invente
// palabras sobre ruido de sala, que es lo que hace cuando no hay habla.
//
// ── La trampa acústica ───────────────────────────────────────────────────────
//
// El navegador aplica cancelación de eco al micrófono POR DEFECTO, pensada para
// borrar lo que sale por los parlantes. Acá lo que sale por el parlante ES la
// otra persona de la reunión. Las tres restricciones van en `false` explícito.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EstadoCopiloto } from "@/lib/reuniones/copiloto";

type Estado = "detenido" | "pidiendo-permiso" | "grabando" | "error";
type Linea = { id: string; texto: string };

const VACIO: EstadoCopiloto = {
  contexto: { tema: "", objetivo: null, puntosClave: [], tensiones: [] },
  preguntas: [],
};

/** Largo de cada tramo de audio. Es también la cadencia del copiloto. */
const TRAMO_MS = 20_000;

/**
 * Palabras nuevas mínimas para gastar una pasada de copiloto.
 *
 * Veinte segundos de "ajá, claro" no cambian el contexto. Sin este piso, una
 * reunión con pausas paga por confirmar que no pasó nada.
 */
const MINIMO_PALABRAS = 12;

/**
 * Nivel de audio bajo el cual un tramo se considera silencio y no se transcribe.
 *
 * Es amplitud normalizada sobre 1. El habla por un parlante ronda 0,05 y el
 * ruido de una sala vacía queda bajo 0,01. El umbral va holgado hacia abajo a
 * propósito: perder un tramo con habla baja es peor que pagar por uno con ruido.
 * El nivel medido de cada tramo se anota en el panel de eventos para poder
 * calibrarlo con datos y no con intuición.
 */
const UMBRAL_SILENCIO = 0.02;

function tipoSoportado(): string {
  const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of candidatos) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

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
  const [costoEscucha, setCostoEscucha] = useState(0);
  const [titulo, setTitulo] = useState("");
  const [guardada, setGuardada] = useState<number | null>(null);
  /**
   * Si la transcripción sigue al texto nuevo. Se apaga al subir a leer y se
   * vuelve a encender al bajar al final, como cualquier consola: mientras miras
   * el final quieres que avance solo, y cuando te vas a buscar algo, manda quien
   * lee.
   */
  const [pegado, setPegado] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const grabadorRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analizadorRef = useRef<AnalyserNode | null>(null);
  const medidorRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const picoRef = useRef(0);
  const activoRef = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lineasRef = useRef<Linea[]>([]);
  const copilotoRef = useRef<EstadoCopiloto>(VACIO);
  /** Hasta qué carácter de cada tramo se le mandó al copiloto. */
  const enviadoHastaRef = useRef<Map<string, number>>(new Map());
  const ocupadoRef = useRef(false);
  /**
   * `grabarTramo` se encadena a sí mismo al terminar cada tramo, y una función
   * de `useCallback` no puede referirse a su propia identidad: la que capture
   * quedaría congelada en la primera versión. El ref siempre apunta a la actual.
   */
  const grabarRef = useRef<() => void>(() => {});
  const claveRef = useRef("");
  const inicioRef = useRef("");
  const tituloRef = useRef("");
  const contadorRef = useRef(0);

  const registrar = useCallback((linea: string) => {
    setEventos((prev) => [...prev.slice(-60), linea]);
  }, []);

  useEffect(() => {
    lineasRef.current = lineas;
  }, [lineas]);
  useEffect(() => {
    copilotoRef.current = copiloto;
  }, [copiloto]);
  useEffect(() => {
    tituloRef.current = titulo;
  }, [titulo]);

  useEffect(() => {
    if (!pegado) return;
    const el = panelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lineas, pegado]);

  useEffect(() => {
    if (desdeMs === null) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [desdeMs]);

  const detener = useCallback(() => {
    activoRef.current = false;
    try {
      const g = grabadorRef.current;
      if (g && g.state === "recording") g.stop();
    } catch {
      // Un grabador ya detenido lanza. No es un error que le importe a nadie.
    }
    grabadorRef.current = null;
    if (medidorRef.current) clearInterval(medidorRef.current);
    medidorRef.current = null;
    analizadorRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setEstado("detenido");
    setDesdeMs(null);
  }, []);

  // Cortar al salir de la pantalla: sin esto el micrófono queda abierto.
  useEffect(() => () => detener(), [detener]);

  // ── El copiloto ────────────────────────────────────────────────────────────
  const pasada = useCallback(async () => {
    if (ocupadoRef.current) return;

    const lineasAhora = lineasRef.current;
    const transcripcion = lineasAhora.map((l) => l.texto).join("\n");
    if (!transcripcion.trim()) return;

    const colas = lineasAhora
      .map((l) => {
        const desde = enviadoHastaRef.current.get(l.id) ?? 0;
        return { id: l.id, cola: l.texto.slice(desde), largo: l.texto.length };
      })
      .filter((x) => x.cola.trim().length > 0);
    const fragmento = colas.map((x) => x.cola).join(" ").trim();
    const suficiente =
      fragmento.split(/\s+/).filter(Boolean).length >= MINIMO_PALABRAS;

    ocupadoRef.current = true;
    setPensando(suficiente);
    if (suficiente) colas.forEach((x) => enviadoHastaRef.current.set(x.id, x.largo));

    try {
      const res = await fetch("/api/dashboard360/reuniones/vivo/contexto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: copilotoRef.current,
          fragmento: suficiente ? fragmento : "",
          clave: claveRef.current,
          titulo: tituloRef.current,
          inicioEn: inicioRef.current,
          transcripcion,
        }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? `HTTP ${res.status}`);
      if (datos.estado) setCopiloto(datos.estado);
      if (typeof datos.costoUsd === "number") {
        setCostoCopiloto((c) => c + datos.costoUsd);
      }
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

  // ── Un tramo de audio ──────────────────────────────────────────────────────
  const transcribirTramo = useCallback(
    async (blob: Blob, pico: number, segundos: number) => {
      const n = ++contadorRef.current;
      const nivel = pico.toFixed(3);

      if (pico < UMBRAL_SILENCIO) {
        registrar(`tramo ${n}: silencio (nivel ${nivel}), no se transcribe`);
        return;
      }

      const form = new FormData();
      form.append("audio", blob, `tramo-${n}.webm`);
      form.append("clave", claveRef.current);
      form.append("segundos", String(segundos));
      // La cola del texto anterior orienta al modelo sobre el tema. Cortar cada
      // veinte segundos parte frases, y sin esto el tramo siguiente empieza a
      // ciegas justo donde se juegan los nombres propios.
      form.append(
        "contexto",
        lineasRef.current.slice(-2).map((l) => l.texto).join(" ").slice(-400),
      );

      try {
        const res = await fetch("/api/dashboard360/reuniones/vivo/transcribir", {
          method: "POST",
          body: form,
        });
        const datos = await res.json();
        if (!res.ok) throw new Error(datos.error ?? `HTTP ${res.status}`);

        const texto = (datos.texto ?? "").trim();
        if (typeof datos.costoUsd === "number") {
          setCostoEscucha((c) => c + datos.costoUsd);
        }
        if (!texto) {
          registrar(`tramo ${n}: sin texto (nivel ${nivel})`);
          return;
        }
        setLineas((prev) => [...prev, { id: `t${n}`, texto }]);
      } catch (e) {
        // Un tramo perdido son veinte segundos, no la reunión. Se anota y se
        // sigue grabando: cortar la sesión por un error de red sería cambiar un
        // problema chico por uno grande.
        registrar(`ERROR tramo ${n}: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [registrar],
  );

  /**
   * Graba un tramo y encadena el siguiente.
   *
   * Se crea un `MediaRecorder` nuevo por tramo en vez de usar uno solo con
   * `timeslice`. Con un solo grabador, solo el primer trozo lleva las cabeceras
   * del contenedor y los siguientes son fragmentos que ningún decodificador
   * abre. Un grabador por tramo entrega archivos completos, que es lo que la API
   * de transcripción necesita. El costo es una interrupción de milisegundos
   * entre tramos.
   */
  const grabarTramo = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !activoRef.current) return;

    const tipo = tipoSoportado();
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    grabadorRef.current = rec;
    picoRef.current = 0;
    const arranque = Date.now();
    const trozos: Blob[] = [];

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) trozos.push(e.data);
    };
    rec.onstop = () => {
      const segundos = (Date.now() - arranque) / 1000;
      const pico = picoRef.current;
      if (trozos.length > 0) {
        void transcribirTramo(new Blob(trozos, { type: tipo || "audio/webm" }), pico, segundos);
      }
      if (activoRef.current) grabarRef.current();
    };

    rec.start();
    setTimeout(() => {
      try {
        if (rec.state === "recording") rec.stop();
      } catch {
        // Ver el comentario de `detener`.
      }
    }, TRAMO_MS);
  }, [transcribirTramo]);

  useEffect(() => {
    grabarRef.current = grabarTramo;
  }, [grabarTramo]);

  // ── La cadencia del copiloto ───────────────────────────────────────────────
  //
  // Va desfasada seis segundos respecto de los tramos, a propósito: si el
  // copiloto corriera justo cuando el tramo se cierra, leería el texto de la
  // vuelta anterior porque la transcripción todavía está viajando. Seis segundos
  // le dan tiempo a llegar.
  useEffect(() => {
    if (estado !== "grabando") return;
    let intervalo: ReturnType<typeof setInterval> | null = null;
    const primera = setTimeout(() => {
      void pasada();
      intervalo = setInterval(() => void pasada(), TRAMO_MS);
    }, TRAMO_MS + 6_000);
    return () => {
      clearTimeout(primera);
      if (intervalo) clearInterval(intervalo);
    };
  }, [estado, pasada]);

  async function finalizar() {
    const clave = claveRef.current;
    detener();
    if (!clave) return;

    // Una última pasada arrastra lo que llegó desde la anterior. Sin esto se
    // pierden hasta veinte segundos del final, que suele ser donde se acuerdan
    // las cosas.
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
        p.id === id ? { ...p, estado: p.estado === "hecha" ? "pendiente" : "hecha" } : p,
      ),
    }));
  }

  async function empezar() {
    setError(null);
    setLineas([]);
    setEventos([]);
    setCopiloto(VACIO);
    setCostoCopiloto(0);
    setCostoEscucha(0);
    setGuardada(null);
    enviadoHastaRef.current = new Map();
    contadorRef.current = 0;

    try {
      setEstado("pidiendo-permiso");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Ver la trampa acústica en la cabecera. Estas tres son la diferencia
          // entre oír la reunión y oír solo a quien tiene el computador.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      // Medidor de nivel, para no pagar por transcribir silencio.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const fuente = ctx.createMediaStreamSource(stream);
      const analizador = ctx.createAnalyser();
      analizador.fftSize = 1024;
      fuente.connect(analizador);
      analizadorRef.current = analizador;

      const datos = new Uint8Array(analizador.fftSize);
      medidorRef.current = setInterval(() => {
        const a = analizadorRef.current;
        if (!a) return;
        a.getByteTimeDomainData(datos);
        let pico = 0;
        for (let i = 0; i < datos.length; i++) {
          const v = Math.abs(datos[i] - 128) / 128;
          if (v > pico) pico = v;
        }
        if (pico > picoRef.current) picoRef.current = pico;
      }, 200);

      const arranque = Date.now();
      inicioRef.current = new Date(arranque).toISOString();
      claveRef.current = `vivo-${inicioRef.current}`;
      activoRef.current = true;
      setDesdeMs(arranque);
      setAhora(arranque);
      setEstado("grabando");
      registrar(`micrófono abierto · tramos de ${TRAMO_MS / 1000}s · ${tipoSoportado() || "formato por defecto"}`);
      grabarTramo();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEstado("error");
      detener();
    }
  }

  const grabando = estado === "grabando";
  const minutos = desdeMs && ahora > desdeMs ? (ahora - desdeMs) / 60000 : 0;
  const costoTotal = costoEscucha + costoCopiloto;
  const pendientes = copiloto.preguntas.filter((p) => p.estado === "pendiente");
  const hechas = copiloto.preguntas.filter((p) => p.estado === "hecha");
  const c = copiloto.contexto;
  const hayContexto = Boolean(c.tema || c.puntosClave.length || c.tensiones.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] px-4 py-3">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título de la reunión"
          className="w-56 rounded-md border border-[var(--d360-border)] px-3 py-2 text-[13px] text-[var(--d360-ink)]"
        />

        {grabando ? (
          <button
            onClick={finalizar}
            className="rounded-lg bg-[#8f2c2c] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#7a2424]"
          >
            Detener y guardar
          </button>
        ) : (
          <button
            onClick={empezar}
            disabled={estado === "pidiendo-permiso"}
            className="rounded-lg bg-[var(--d360-brand)] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[var(--d360-brand-dark)] disabled:opacity-50"
          >
            {estado === "pidiendo-permiso" ? "Pidiendo el micrófono…" : "Empezar a escuchar"}
          </button>
        )}

        {grabando ? (
          <span className="flex items-center gap-2 text-[12.5px] text-[var(--d360-ink-2)]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2fa36b] opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#2fa36b]" />
            </span>
            escuchando
          </span>
        ) : null}

        <span className="d360-num ml-auto text-[12px] text-[var(--d360-muted)]">
          {grabando
            ? `${Math.floor(minutos)} min · ${lineas.length} tramos · ~US$${costoTotal.toFixed(3)}`
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
          <p className="mb-1 font-semibold">No se pudo empezar</p>
          <p className="d360-num break-words text-[11.5px]">{error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="flex min-h-[560px] flex-col rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-5">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--d360-muted)]">
            Transcripción
          </h2>
          {lineas.length === 0 ? (
            <p className="text-[13px] text-[var(--d360-muted)]">
              {grabando
                ? `Grabando. El primer bloque de texto aparece a los ${TRAMO_MS / 1000} segundos.`
                : "Aprieta empezar."}
            </p>
          ) : (
            <div className="relative">
              <div
                ref={panelRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const alFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
                  if (alFinal !== pegado) setPegado(alFinal);
                }}
                className="max-h-[600px] space-y-2.5 overflow-y-auto pr-2"
              >
                {lineas.map((l) => (
                  <p key={l.id} className="text-[15px] leading-relaxed text-[var(--d360-ink)]">
                    {l.texto}
                  </p>
                ))}
              </div>

              {!pegado ? (
                <button
                  type="button"
                  onClick={() => {
                    const el = panelRef.current;
                    if (el) el.scrollTop = el.scrollHeight;
                    setPegado(true);
                  }}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[var(--d360-border)] bg-white/95 px-3 py-1.5 text-[12px] font-medium text-[var(--d360-ink-2)] shadow-[0_2px_10px_rgba(11,21,35,0.12)] backdrop-blur hover:border-[var(--d360-brand)] hover:text-[var(--d360-brand-dark)]"
                >
                  ↓ Seguir el texto{grabando ? " · sigue entrando" : ""}
                </button>
              ) : null}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="min-h-[240px] rounded-xl border border-[var(--d360-border)] bg-[#0f1722] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-[#7f93a8]">
              Contexto
              {pensando ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7be9ae]" /> : null}
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
                        <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-[#c6d4e1]">
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
                        <li key={i} className="text-[13.5px] leading-relaxed text-[#e8d9a8]">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="min-h-[280px] rounded-xl border border-[var(--d360-border)] bg-[var(--d360-surface)] p-5">
            <h2 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--d360-muted)]">
              Preguntas
            </h2>
            <p className="mb-3 text-[11.5px] text-[var(--d360-muted)]">
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
