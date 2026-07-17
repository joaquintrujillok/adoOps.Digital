"use client";

/**
 * TV Mix — pantalla de salida (/tv/[sala]).
 *
 * Se abre en el navegador del televisor (o en una pestaña casteada / segunda
 * pantalla). Reproduce los dos decks de YouTube y obedece a la consola:
 *  - BroadcastChannel: latencia ~0 cuando consola y TV corren en el mismo equipo.
 *  - Polling a /api/mix/[sala]: sincronización entre dispositivos distintos.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  broadcastChannelName,
  deckGain,
  deckVolume,
  type DeckId,
  type MixBroadcast,
  type RoomProgress,
  type RoomSnapshot,
  type RoomState,
  type RtcChannel,
} from "@/lib/mix-types";
import { useHost } from "./useHost";
import { attachLiveAudio, playFx, unlockFxAudio } from "./fx";
import { RTC_CONFIG, waitIceComplete } from "./live";
import { loadYouTubeApi, type YTPlayer } from "./youtube";
import "./mixer.css";

const DECKS: DeckId[] = ["a", "b"];
const DECK_LABEL: Record<DeckId, string> = { a: "DECK A", b: "DECK B" };
const DECK_COLOR: Record<DeckId, string> = { a: "text-emerald-400", b: "text-fuchsia-400" };

// Fullscreen con fallback webkit: Safari viejo y varios navegadores de TV no
// tienen la API sin prefijo.
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

function enterFullscreen() {
  const el = document.documentElement as FsElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else el.webkitRequestFullscreen?.();
}

function exitFullscreen() {
  const doc = document as FsDocument;
  if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  else doc.webkitExitFullscreen?.();
}

function fullscreenActive(): boolean {
  const doc = document as FsDocument;
  return !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
}

export default function TvScreen({ room }: { room: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [started, setStarted] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [live, setLive] = useState<{ active: boolean; video: boolean }>({
    active: false,
    video: false,
  });
  const host = useHost();

  const stateRef = useRef<RoomState | null>(null);
  const startedRef = useRef(false);
  const playersRef = useRef<Record<DeckId, YTPlayer | null>>({ a: null, b: null });
  const readyRef = useRef<Record<DeckId, boolean>>({ a: false, b: false });
  const currentVideoRef = useRef<Record<DeckId, string | null>>({ a: null, b: null });
  const playerErrorRef = useRef<Record<DeckId, number | null>>({ a: null, b: null });
  const appliedSeekRef = useRef<Record<DeckId, number>>({ a: 0, b: 0 });
  const appliedFxRef = useRef(0);
  const versionRef = useRef(0);
  const lastLocalAtRef = useRef(0);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const hudTimerRef = useRef(0);
  const progressTickRef = useRef(0);
  const livePcRef = useRef<RTCPeerConnection | null>(null);
  const liveIdRef = useRef<string | null>(null);
  const liveAudioStopRef = useRef<(() => void) | null>(null);
  const liveVideoElRef = useRef<HTMLVideoElement | null>(null);
  const liveActiveRef = useRef(false);

  /** Aplica el estado de la sala a los reproductores y a la UI. */
  const applyState = useCallback((next: RoomState) => {
    stateRef.current = next;
    setState(next);

    setHudVisible(true);
    window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => setHudVisible(false), 4500);

    if (!startedRef.current) return;

    if (next.fx && next.fx.nonce !== appliedFxRef.current) {
      appliedFxRef.current = next.fx.nonce;
      playFx(next.fx.sound, next.master / 100);
    }

    for (const deck of DECKS) {
      const player = playersRef.current[deck];
      if (!player || !readyRef.current[deck]) continue;
      const target = next.decks[deck];

      if (target.videoId !== currentVideoRef.current[deck]) {
        currentVideoRef.current[deck] = target.videoId;
        playerErrorRef.current[deck] = null;
        if (target.videoId) {
          if (target.playing) player.loadVideoById(target.videoId);
          else player.cueVideoById(target.videoId);
        } else {
          player.pauseVideo();
        }
      }

      if (target.seekNonce !== appliedSeekRef.current[deck]) {
        appliedSeekRef.current[deck] = target.seekNonce;
        if (target.videoId) player.seekTo(target.seekTo, true);
      }

      player.setPlaybackRate(target.rate);
      // ducking: con el micrófono en vivo, la música baja para que se escuche la voz
      player.setVolume(Math.round(deckVolume(next, deck) * (liveActiveRef.current ? 0.4 : 1)));
      if (target.videoId) {
        if (target.playing) player.playVideo();
        else player.pauseVideo();
      }
    }
  }, []);

  /** Cierra la sesión en vivo y restaura los volúmenes de los decks. */
  const teardownLive = useCallback(() => {
    try {
      livePcRef.current?.close();
    } catch {
      // ya cerrada
    }
    livePcRef.current = null;
    liveIdRef.current = null;
    liveAudioStopRef.current?.();
    liveAudioStopRef.current = null;
    if (liveVideoElRef.current) liveVideoElRef.current.srcObject = null;
    liveActiveRef.current = false;
    setLive({ active: false, video: false });
    if (stateRef.current) applyState(stateRef.current); // des-duck
  }, [applyState]);

  /** Atiende la señalización del modo en vivo (offer/end de la consola). */
  const handleRtcSignal = useCallback(
    async (role: "offer" | "answer" | "end", id: string, sdp?: string) => {
      if (role === "answer") return; // nuestra propia respuesta, eco del canal
      if (role === "end") {
        if (liveIdRef.current === id || !id) teardownLive();
        return;
      }
      if (!sdp || !startedRef.current) return; // sin iniciar: el offer persiste y se reintenta
      if (liveIdRef.current === id) return; // sesión ya atendida

      teardownLive();
      liveIdRef.current = id;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      livePcRef.current = pc;

      pc.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        const el = liveVideoElRef.current;
        // el <video> (muteado) consume el stream; el audio va por Web Audio
        if (el && el.srcObject !== stream) {
          el.srcObject = stream;
          el.play().catch(() => {});
        }
        if (event.track.kind === "audio") {
          liveAudioStopRef.current?.();
          liveAudioStopRef.current = attachLiveAudio(stream);
        }
        if (event.track.kind === "video") {
          setLive((prev) => ({ ...prev, video: true }));
        }
      };
      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "connected") {
          liveActiveRef.current = true;
          setLive((prev) => ({ ...prev, active: true }));
          if (stateRef.current) applyState(stateRef.current); // aplica el duck
        } else if (st === "failed" || st === "disconnected" || st === "closed") {
          if (livePcRef.current === pc) teardownLive();
        }
      };

      try {
        await pc.setRemoteDescription({ type: "offer", sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await waitIceComplete(pc);
        const answerSdp = pc.localDescription?.sdp;
        if (!answerSdp) throw new Error("sin SDP de respuesta");
        bcRef.current?.postMessage({
          kind: "rtc",
          role: "answer",
          id,
          sdp: answerSdp,
        } satisfies MixBroadcast);
        await fetch(`/api/mix/${room}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rtc: { role: "answer", id, sdp: answerSdp } }),
        });
      } catch {
        if (livePcRef.current === pc) teardownLive();
      }
    },
    [room, applyState, teardownLive],
  );

  // Sincronización remota: polling liviano contra el API.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/mix/${room}?v=${versionRef.current}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Partial<RoomSnapshot> & { unchanged?: boolean };
        // señalización del modo en vivo (viene también en respuestas unchanged)
        if ("rtc" in data) {
          const rtc = data.rtc as RtcChannel;
          if (rtc?.offer) {
            void handleRtcSignal("offer", rtc.offer.id, rtc.offer.sdp);
          } else if (liveIdRef.current) {
            void handleRtcSignal("end", liveIdRef.current);
          }
        }
        if (data.unchanged || typeof data.version !== "number") return;
        if (data.version === versionRef.current) return;
        // Si la consola está en este mismo equipo (BroadcastChannel activo hace
        // <3s), ella es la fuente viva. OJO: la versión se avanza solo al
        // aplicar — si no, un cambio llegado por API durante ese lapso (p. ej.
        // desde una segunda consola) quedaría tragado para siempre.
        if (data.state && Date.now() - lastLocalAtRef.current > 3000) {
          versionRef.current = data.version;
          applyState(data.state);
        }
      } catch {
        // sin red: se reintenta en el próximo tick
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [room, applyState, handleRtcSignal]);

  // Sincronización local (mismo equipo): BroadcastChannel.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(broadcastChannelName(room));
    bcRef.current = bc;
    bc.onmessage = (event: MessageEvent<MixBroadcast>) => {
      if (event.data?.kind === "state") {
        lastLocalAtRef.current = Date.now();
        applyState(event.data.state);
      } else if (event.data?.kind === "rtc") {
        void handleRtcSignal(event.data.role, event.data.id, event.data.sdp);
      }
    };
    return () => {
      bcRef.current = null;
      bc.close();
    };
  }, [room, applyState, handleRtcSignal]);

  // Telemetría: la TV reporta tiempos para que la consola muestre el progreso.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!startedRef.current) return;
      const current = stateRef.current;
      if (!current) return;

      const decks: RoomProgress["decks"] = { a: null, b: null };
      let hasAny = false;
      for (const deck of DECKS) {
        const player = playersRef.current[deck];
        if (!player || !readyRef.current[deck] || !current.decks[deck].videoId) continue;
        try {
          decks[deck] = {
            t: player.getCurrentTime() || 0,
            d: player.getDuration() || 0,
            ...(playerErrorRef.current[deck] ? { err: playerErrorRef.current[deck] } : {}),
          };
          hasAny = true;
        } catch {
          // el player puede no estar listo aún
        }
      }
      if (!hasAny) return;

      const progress: RoomProgress = { decks, at: Date.now() };
      bcRef.current?.postMessage({ kind: "progress", progress } satisfies MixBroadcast);

      progressTickRef.current += 1;
      if (progressTickRef.current % 2 === 0) {
        fetch(`/api/mix/${room}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress: { decks } }),
        }).catch(() => {});
      }
    }, 2000);
    return () => window.clearInterval(id);
  }, [room]);

  /** El toque del usuario habilita el audio y crea los reproductores. */
  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true);

    // Antes de cualquier await: la activación de usuario del toque expira y
    // el navegador rechazaría fullscreen / el desbloqueo de audio en silencio.
    enterFullscreen();
    unlockFxAudio();

    const initial = stateRef.current;
    if (initial) {
      appliedSeekRef.current = {
        a: initial.decks.a.seekNonce,
        b: initial.decks.b.seekNonce,
      };
      // efectos anteriores al inicio de la pantalla no se re-disparan
      appliedFxRef.current = initial.fx?.nonce ?? 0;
    }

    const YT = await loadYouTubeApi();
    for (const deck of DECKS) {
      const element = document.getElementById(`tv-player-${deck}`);
      if (!element) continue;
      // La IFrame API lanza "Invalid video id" si videoId viene undefined;
      // con el deck vacío hay que omitir la clave (embed vacío + onReady OK).
      const initialVideoId = initial?.decks[deck].videoId;
      playersRef.current[deck] = new YT.Player(element, {
        ...(initialVideoId ? { videoId: initialVideoId } : {}),
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            readyRef.current[deck] = true;
            currentVideoRef.current[deck] = initial?.decks[deck].videoId ?? null;
            const latest = stateRef.current;
            if (latest) applyState(latest);
          },
          onError: (event) => {
            // La consola muestra el motivo (ej: embedding bloqueado por derechos).
            playerErrorRef.current[deck] = event.data;
          },
        },
      });
    }
  }, [applyState]);

  const toggleFullscreen = useCallback(() => {
    if (fullscreenActive()) exitFullscreen();
    else enterFullscreen();
  }, []);

  useEffect(() => {
    return () => teardownLive();
  }, [teardownLive]);

  const layerOpacity = (deck: DeckId): number => {
    if (!state || !state.decks[deck].videoId) return 0;
    const gain = deckGain(deck, state.crossfader);
    return Math.round(gain * gain * 100) / 100;
  };

  const nothingLoaded =
    !!state && !state.decks.a.videoId && !state.decks.b.videoId;

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: "var(--font-sora), var(--font-inter), sans-serif" }}
    >
      {/* Capas de video (una por deck), mezcladas por opacidad. */}
      {DECKS.map((deck) => (
        <div
          key={deck}
          className="mix-tv-layer pointer-events-none absolute inset-0 transition-opacity duration-200"
          style={{ opacity: started ? layerOpacity(deck) : 0, zIndex: deck === "a" ? 1 : 2 }}
        >
          <div id={`tv-player-${deck}`} className="h-full w-full" />
        </div>
      ))}

      {/* Pantalla de inicio: el toque habilita el audio (política de autoplay). */}
      {!started && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-zinc-950 via-black to-zinc-900 px-8 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-emerald-400">
            adoOps · TV Mix
          </p>
          <h1 className="text-5xl font-bold tracking-[0.3em] sm:text-7xl">{room}</h1>
          <p className="max-w-xl text-base text-zinc-400 sm:text-lg">
            En tu celular o computador abre{" "}
            <span className="font-semibold text-white">
              {host || "…"}/mix/{room}
            </span>{" "}
            para controlar esta pantalla.
          </p>
          <button
            onClick={start}
            disabled={!state}
            className="rounded-full bg-emerald-500 px-10 py-4 text-xl font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-40"
          >
            ▶ Iniciar pantalla
          </button>
          <p className="text-xs text-zinc-500">
            El toque es necesario para que el navegador permita reproducir audio.
          </p>
        </div>
      )}

      {/* Sin videos cargados todavía. */}
      {started && nothingLoaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <h2 className="text-3xl font-semibold text-zinc-300">Sala {room} lista</h2>
          <p className="max-w-lg text-zinc-500">
            Carga un video de YouTube en un deck desde la consola (
            {host || "…"}/mix/{room}) y aparecerá aquí.
          </p>
        </div>
      )}

      {/* Modo en vivo: cámara de la consola (PiP) y aviso. El <video> vive
          siempre en el DOM (muteado: el audio va por Web Audio). */}
      <video
        ref={liveVideoElRef}
        muted
        playsInline
        autoPlay
        className={`absolute bottom-6 right-6 z-20 w-[30%] max-w-xl rounded-xl border border-zinc-700 shadow-2xl transition-opacity duration-300 ${
          live.active && live.video ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {live.active && (
        <div className="absolute left-6 top-6 z-30 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-red-400 backdrop-blur">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          EN VIVO
        </div>
      )}

      {/* HUD: qué suena en cada deck. Se desvanece solo. */}
      <div
        className={`absolute bottom-6 left-6 z-30 flex flex-col gap-1 rounded-xl bg-black/60 px-4 py-3 backdrop-blur transition-opacity duration-500 ${
          hudVisible && started ? "opacity-100" : "opacity-0"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">
          Sala {room}
        </p>
        {DECKS.map((deck) => {
          const d = state?.decks[deck];
          if (!d?.videoId) return null;
          return (
            <p key={deck} className="max-w-[70vw] truncate text-sm">
              <span className={`font-bold ${DECK_COLOR[deck]}`}>{DECK_LABEL[deck]}</span>{" "}
              <span className="text-zinc-200">{d.title ?? d.videoId}</span>
              {d.playing ? "" : " · pausado"}
            </p>
          );
        })}
      </div>

      {started && (
        <button
          onClick={toggleFullscreen}
          className="absolute right-4 top-4 z-30 rounded-lg bg-black/50 px-3 py-2 text-xs text-zinc-400 opacity-40 backdrop-blur transition hover:opacity-100"
        >
          ⛶ Pantalla completa
        </button>
      )}
    </div>
  );
}
