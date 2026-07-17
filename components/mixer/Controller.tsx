"use client";

/**
 * TV Mix — consola de mixeo (/mix/[sala]).
 *
 * Corre en el celular o el computador. Cada gesto se aplica optimista en
 * local, se emite por BroadcastChannel (TV en el mismo equipo = latencia ~0)
 * y se persiste con un POST throttled al API (TV en otro dispositivo).
 */

import Link from "next/link";
import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  broadcastChannelName,
  formatTime,
  mergePatch,
  parseYouTubeId,
  thumbnailUrl,
  type ClipItem,
  type DeckId,
  type DeckPatch,
  type FxSound,
  type MixBroadcast,
  type RoomPatch,
  type RoomProgress,
  type RoomSnapshot,
  type RoomState,
} from "@/lib/mix-types";
import LibraryPanel from "./LibraryPanel";
import { useHost } from "./useHost";
import { RTC_CONFIG, newLiveSessionId, waitIceComplete } from "./live";
import { loadYouTubeApi, type YTPlayer } from "./youtube";
import "./mixer.css";

const RATES = [0.75, 1, 1.25] as const;

/** Mensajes para los códigos de onError que reporta la TV. */
const PLAYER_ERROR_MESSAGES: Record<number, string> = {
  2: "No se pudo reproducir este video",
  5: "No se pudo reproducir este video",
  100: "Video no disponible (privado o eliminado)",
  101: "🚫 El dueño no permite reproducirlo fuera de YouTube — busca otra versión (live, lyric video…)",
  150: "🚫 El dueño no permite reproducirlo fuera de YouTube — busca otra versión (live, lyric video…)",
};

/** Pad de efectos: suenan en la TV, sintetizados con Web Audio. */
const FX_PAD: { sound: FxSound; label: string }[] = [
  { sound: "horn", label: "📯 Bocina" },
  { sound: "siren", label: "🚨 Sirena" },
  { sound: "scratch", label: "💿 Scratch" },
  { sound: "rewind", label: "⏪ Rewind" },
];

/** Mix eterno: umbrales sobre el tiempo restante del deck activo. */
// s restantes cuando se dispara el mix automático (dura 8 s). Las alternativas
// ya se piden al empezar el tema, así que aquí solo se resuelve+carga y mezcla.
const AUTODJ_MIX_AT = 35;

/** Arco de la fiesta: elegido a mano pesa más que la hora local. */
type PartyArc = "auto" | "warmup" | "peak" | "cooldown";
const PARTY_ARC_OPTIONS: { id: PartyArc; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "la IA modula según la hora" },
  { id: "warmup", label: "🌅 Calentando", hint: "energía media, subiendo de a poco" },
  { id: "peak", label: "🔥 Peak", hint: "máxima energía bailable" },
  { id: "cooldown", label: "🌙 Bajando", hint: "aterrizar suave" },
];

type Suggestion = { artista: string; tema: string; motivo: string };

const DECK_META: Record<
  DeckId,
  { label: string; accent: string; badge: string; faderClass: string }
> = {
  a: {
    label: "DECK A",
    accent: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
    faderClass: "mix-fader",
  },
  b: {
    label: "DECK B",
    accent: "text-fuchsia-400",
    badge: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40",
    faderClass: "mix-fader mix-fader--b",
  },
};

/** fetch con timeout: el DJ IA (GLM) puede colgarse y dejar la UI trabada. */
async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function combinePatches(base: RoomPatch, extra: RoomPatch): RoomPatch {
  return {
    ...base,
    ...extra,
    decks: {
      a: { ...base.decks?.a, ...extra.decks?.a },
      b: { ...base.decks?.b, ...extra.decks?.b },
    },
  };
}

export default function Controller({ room }: { room: string }) {
  const [state, setState] = useState<RoomState | null>(null);
  const [progress, setProgress] = useState<RoomProgress | null>(null);
  const [urls, setUrls] = useState<Record<DeckId, string>>({ a: "", b: "" });
  const [deckError, setDeckError] = useState<Record<DeckId, string | null>>({
    a: null,
    b: null,
  });
  const [loadingDeck, setLoadingDeck] = useState<DeckId | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoMixTarget, setAutoMixTarget] = useState<DeckId | null>(null);
  const [previewOpen, setPreviewOpen] = useState<Record<DeckId, boolean>>({
    a: false,
    b: false,
  });
  const [scrub, setScrub] = useState<Record<DeckId, number | null>>({ a: null, b: null });
  const [autoDj, setAutoDj] = useState(false);
  const [autoDjStatus, setAutoDjStatus] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState<"off" | "mic" | "cam">("off");
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const host = useHost();

  const [vibe, setVibe] = useState("");
  const [partyArc, setPartyArc] = useState<PartyArc>("auto");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  // sugerencias ya cargadas a un deck (key artista|tema) y la que está cargando
  const [usedKeys, setUsedKeys] = useState<string[]>([]);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);

  const stateRef = useRef<RoomState | null>(null);
  const versionRef = useRef(0);
  const lastEditAtRef = useRef(0);
  const pendingPatchRef = useRef<RoomPatch | null>(null);
  const flushTimerRef = useRef(0);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const autoMixTimerRef = useRef(0);
  const previewPlayersRef = useRef<Record<DeckId, YTPlayer | null>>({ a: null, b: null });
  const scrubRef = useRef<Record<DeckId, number | null>>({ a: null, b: null });
  const progressRef = useRef<RoomProgress | null>(null);
  const autoDjBusyRef = useRef(false);
  /** videoId del deck activo para el que ya preparamos sucesor. */
  const autoDjPreparedForRef = useRef<string | null>(null);
  const autoDjCooldownRef = useRef(0);
  // el loop lee estas listas sin re-crearse: refs que espejan el estado.
  const suggestionsRef = useRef<Suggestion[]>([]);
  const usedKeysRef = useRef<string[]>([]);
  /** videoId del tema activo para el que ya se pidieron alternativas. */
  const suggestForRef = useRef<string | null>(null);
  const livePcRef = useRef<RTCPeerConnection | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveIdRef = useRef<string | null>(null);
  const liveAnswerPollRef = useRef(0);

  const suggestionKey = (s: Suggestion) => `${s.artista}|${s.tema}`;

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);
  useEffect(() => {
    usedKeysRef.current = usedKeys;
  }, [usedKeys]);

  /** Envía al servidor lo acumulado por el throttle. */
  const flush = useCallback(async () => {
    flushTimerRef.current = 0;
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = null;
    if (!patch) return;
    try {
      const res = await fetch(`/api/mix/${room}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      if (res.ok) {
        const snap = (await res.json()) as RoomSnapshot;
        versionRef.current = snap.version;
      }
    } catch {
      // sin red: el próximo gesto o poll re-sincroniza
    }
  }, [room]);

  /** Aplica un cambio: optimista en local + BroadcastChannel + POST throttled. */
  const sendPatch = useCallback(
    (patch: RoomPatch) => {
      const current = stateRef.current;
      if (!current) return;
      const next = mergePatch(current, patch);
      stateRef.current = next;
      setState(next);
      lastEditAtRef.current = Date.now();
      bcRef.current?.postMessage({ kind: "state", state: next } satisfies MixBroadcast);

      pendingPatchRef.current = pendingPatchRef.current
        ? combinePatches(pendingPatchRef.current, patch)
        : patch;
      if (!flushTimerRef.current) {
        flushTimerRef.current = window.setTimeout(flush, 200);
      }
    },
    [flush],
  );

  /** Cierra la pre-escucha local de un deck y libera su player. */
  const closePreview = useCallback((deck: DeckId) => {
    try {
      previewPlayersRef.current[deck]?.destroy();
    } catch {
      // el player puede estar a medio crear
    }
    previewPlayersRef.current[deck] = null;
    setPreviewOpen((prev) => ({ ...prev, [deck]: false }));
  }, []);

  // Poll: estado inicial, progreso reportado por la TV y cambios remotos.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/mix/${room}?v=${versionRef.current}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Partial<RoomSnapshot> & { unchanged?: boolean };
        if (data.progress !== undefined) {
          progressRef.current = data.progress ?? null;
          setProgress(data.progress ?? null);
        }
        if (data.unchanged || typeof data.version !== "number") return;
        versionRef.current = data.version;
        // No pisar ediciones locales en vuelo.
        if (data.state && Date.now() - lastEditAtRef.current > 2500) {
          stateRef.current = data.state;
          setState(data.state);
        }
      } catch {
        // reintenta en el próximo tick
      }
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [room]);

  // BroadcastChannel: progreso instantáneo cuando la TV está en este equipo.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(broadcastChannelName(room));
    bcRef.current = bc;
    bc.onmessage = (event: MessageEvent<MixBroadcast>) => {
      if (event.data?.kind === "progress") {
        progressRef.current = event.data.progress;
        setProgress(event.data.progress);
      } else if (
        event.data?.kind === "rtc" &&
        event.data.role === "answer" &&
        event.data.id === liveIdRef.current &&
        event.data.sdp &&
        livePcRef.current?.signalingState === "have-local-offer"
      ) {
        // fase espejo: la respuesta de la TV llega al instante por BC
        void livePcRef.current
          .setRemoteDescription({ type: "answer", sdp: event.data.sdp })
          .catch(() => {});
      }
    };
    return () => {
      bcRef.current = null;
      bc.close();
    };
  }, [room]);

  const loadToDeck = useCallback(
    async (deck: DeckId, rawInput?: string, presetTitle?: string) => {
      const raw = (rawInput ?? urls[deck]).trim();
      const videoId = parseYouTubeId(raw);
      if (!videoId) {
        setDeckError((prev) => ({ ...prev, [deck]: "Pega una URL o ID de YouTube válido" }));
        return;
      }
      setDeckError((prev) => ({ ...prev, [deck]: null }));

      let title = presetTitle ?? videoId;
      if (!presetTitle) {
        setLoadingDeck(deck);
        try {
          const res = await fetch(`/api/mix/oembed?id=${videoId}`);
          if (res.ok) {
            const data = (await res.json()) as { title?: string | null };
            if (data.title) title = data.title;
          }
        } catch {
          // sin título no pasa nada
        }
        setLoadingDeck(null);
      }

      const decks: Partial<Record<DeckId, DeckPatch>> = {};
      // kind/src explícitos: el deck puede venir de un clip propio
      decks[deck] = { videoId, title, kind: "yt", src: null, playing: false };
      const library = [
        { videoId, title },
        ...(stateRef.current?.library ?? []),
      ];
      sendPatch({ decks, library });
      setUrls((prev) => ({ ...prev, [deck]: "" }));
      // la pre-escucha quedó apuntando al video anterior
      closePreview(deck);
    },
    [urls, sendPatch, closePreview],
  );

  /** Carga un clip propio (video subido) en un deck. */
  const loadClipToDeck = useCallback(
    (deck: DeckId, clip: ClipItem) => {
      const decks: Partial<Record<DeckId, DeckPatch>> = {};
      decks[deck] = {
        kind: "clip",
        src: clip.url,
        videoId: null,
        title: clip.name,
        playing: false,
      };
      sendPatch({ decks });
      closePreview(deck);
    },
    [sendPatch, closePreview],
  );

  /**
   * Sube un video del dispositivo a la sala. El archivo va directo del
   * navegador a Vercel Blob (client upload): las funciones no admiten cuerpos
   * de este tamaño.
   */
  const uploadClip = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(0);
      try {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-60);
        const blob = await upload(`mix/${room}/${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/mix/upload",
          clientPayload: room,
          onUploadProgress: ({ percentage }) => setUploading(Math.round(percentage)),
        });
        const clip: ClipItem = {
          id: Math.random().toString(36).slice(2, 10),
          url: blob.url,
          name: file.name.slice(0, 80),
        };
        sendPatch({ clips: [clip, ...(stateRef.current?.clips ?? [])] });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "";
        setUploadError(
          detail.includes("BLOB_READ_WRITE_TOKEN")
            ? "Falta configurar el almacenamiento (BLOB_READ_WRITE_TOKEN)"
            : `No se pudo subir el video${detail ? `: ${detail.slice(0, 80)}` : ""}`,
        );
      } finally {
        setUploading(null);
      }
    },
    [room, sendPatch],
  );

  const patchDeck = useCallback(
    (deck: DeckId, patch: DeckPatch) => {
      const decks: Partial<Record<DeckId, DeckPatch>> = {};
      decks[deck] = patch;
      sendPatch({ decks });
    },
    [sendPatch],
  );

  const seekBy = useCallback(
    (deck: DeckId, delta: number) => {
      const current = stateRef.current;
      if (!current) return;
      const p = progress?.decks[deck];
      const base = p?.t ?? 0;
      let target = Math.max(0, base + delta);
      if (p?.d && p.d > 0) target = Math.min(target, Math.max(0, p.d - 1));
      patchDeck(deck, {
        seekTo: target,
        seekNonce: current.decks[deck].seekNonce + 1,
      });
    },
    [progress, patchDeck],
  );

  const cue = useCallback(
    (deck: DeckId) => {
      const current = stateRef.current;
      if (!current) return;
      patchDeck(deck, {
        seekTo: 0,
        seekNonce: current.decks[deck].seekNonce + 1,
        playing: false,
      });
    },
    [patchDeck],
  );

  /**
   * Pre-escucha: player local con controles nativos de YouTube. Suena solo en
   * el dispositivo de la consola (auriculares) — la TV no se entera.
   */
  const openPreview = useCallback(async (deck: DeckId) => {
    const videoId = stateRef.current?.decks[deck].videoId;
    if (!videoId) return;
    setPreviewOpen((prev) => ({ ...prev, [deck]: true }));

    const YT = await loadYouTubeApi();
    // el contenedor aparece con el re-render de arriba
    const element = await new Promise<HTMLElement | null>((resolve) => {
      const find = (tries: number) => {
        const el = document.getElementById(`mix-preview-${deck}`);
        if (el || tries <= 0) resolve(el);
        else requestAnimationFrame(() => find(tries - 1));
      };
      find(20);
    });
    if (!element) return;

    try {
      previewPlayersRef.current[deck]?.destroy();
    } catch {
      // sin player previo
    }
    previewPlayersRef.current[deck] = new YT.Player(element, {
      videoId,
      playerVars: { controls: 1, playsinline: 1, rel: 0, iv_load_policy: 3 },
    });
  }, []);

  /** Copia el punto actual de la pre-escucha al deck (seek en la TV). */
  const applyPreviewPoint = useCallback(
    (deck: DeckId) => {
      const player = previewPlayersRef.current[deck];
      const current = stateRef.current;
      if (!player || !current) return;
      let t = 0;
      try {
        t = player.getCurrentTime() || 0;
        player.pauseVideo();
      } catch {
        return;
      }
      patchDeck(deck, {
        seekTo: Math.max(0, t),
        seekNonce: current.decks[deck].seekNonce + 1,
      });
    },
    [patchDeck],
  );

  useEffect(() => {
    const players = previewPlayersRef.current;
    return () => {
      for (const deck of ["a", "b"] as const) {
        try {
          players[deck]?.destroy();
        } catch {
          // desmontando igual
        }
      }
    };
  }, []);

  /** Confirma el arrastre de la barra de progreso: seek real en la TV. */
  const commitScrub = useCallback(
    (deck: DeckId) => {
      const value = scrubRef.current[deck];
      scrubRef.current[deck] = null;
      setScrub((prev) => ({ ...prev, [deck]: null }));
      const current = stateRef.current;
      if (value === null || !current) return;
      patchDeck(deck, {
        seekTo: value,
        seekNonce: current.decks[deck].seekNonce + 1,
      });
    },
    [patchDeck],
  );

  const stopAutoMix = useCallback(() => {
    if (autoMixTimerRef.current) {
      window.clearInterval(autoMixTimerRef.current);
      autoMixTimerRef.current = 0;
    }
    setAutoMixTarget(null);
  }, []);

  /**
   * Mix automático: arranca el deck de destino y lleva el crossfader al otro
   * lado con una curva suave; al llegar, pausa el deck de origen.
   */
  const startAutoMix = useCallback(() => {
    if (autoMixTimerRef.current) {
      stopAutoMix();
      return;
    }
    const current = stateRef.current;
    if (!current) return;
    const source: DeckId = current.crossfader <= 50 ? "a" : "b";
    const target: DeckId = source === "a" ? "b" : "a";
    if (!current.decks[target].videoId) return;

    const from = current.crossfader;
    const to = target === "b" ? 100 : 0;
    const durationMs = 8000;
    const startedAt = Date.now();

    const startDecks: Partial<Record<DeckId, DeckPatch>> = {};
    startDecks[target] = { playing: true };
    sendPatch({ decks: startDecks });
    setAutoMixTarget(target);

    autoMixTimerRef.current = window.setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      const eased = t * t * (3 - 2 * t); // smoothstep
      if (t >= 1) {
        const endDecks: Partial<Record<DeckId, DeckPatch>> = {};
        endDecks[source] = { playing: false };
        sendPatch({ crossfader: to, decks: endDecks });
        stopAutoMix();
      } else {
        sendPatch({ crossfader: Math.round(from + (to - from) * eased) });
      }
    }, 150);
  }, [sendPatch, stopAutoMix]);

  useEffect(() => {
    return () => {
      if (autoMixTimerRef.current) window.clearInterval(autoMixTimerRef.current);
    };
  }, []);

  /** Dispara un efecto de DJ en la TV (bocina, sirena, scratch, rewind). */
  const triggerFx = useCallback(
    (sound: FxSound) => {
      const current = stateRef.current;
      if (!current) return;
      sendPatch({ fx: { sound, nonce: (current.fx?.nonce ?? 0) + 1 } });
    },
    [sendPatch],
  );

  /** Corta el modo en vivo (mic/cámara) y avisa a la TV. */
  const stopLive = useCallback(
    (notifyTv = true) => {
      window.clearInterval(liveAnswerPollRef.current);
      liveAnswerPollRef.current = 0;
      try {
        livePcRef.current?.close();
      } catch {
        // ya cerrada
      }
      livePcRef.current = null;
      liveStreamRef.current?.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
      const id = liveIdRef.current;
      liveIdRef.current = null;
      if (notifyTv && id) {
        bcRef.current?.postMessage({ kind: "rtc", role: "end", id } satisfies MixBroadcast);
        fetch(`/api/mix/${room}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rtc: { role: "end", id } }),
        }).catch(() => {});
      }
      setLiveMode("off");
      setLiveStatus(null);
    },
    [room],
  );

  /**
   * Modo en vivo: captura mic (y cámara) de este dispositivo y lo transmite a
   * la TV por WebRTC. Señalización: offer/answer completos vía API (polling) y
   * BroadcastChannel como atajo en fase espejo.
   */
  const startLive = useCallback(
    async (mode: "mic" | "cam") => {
      stopLive(true);
      setLiveStatus("pidiendo permiso…");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video:
            mode === "cam"
              ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
              : false,
        });
      } catch {
        setLiveStatus("⚠ permiso de micrófono/cámara denegado");
        return;
      }

      try {
        liveStreamRef.current = stream;
        const pc = new RTCPeerConnection(RTC_CONFIG);
        livePcRef.current = pc;
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
        const id = newLiveSessionId();
        liveIdRef.current = id;

        pc.onconnectionstatechange = () => {
          if (livePcRef.current !== pc) return;
          if (pc.connectionState === "connected") {
            setLiveStatus(mode === "cam" ? "🔴 cámara y voz en la TV" : "🔴 tu voz suena en la TV");
          } else if (["failed", "disconnected"].includes(pc.connectionState)) {
            setLiveStatus("⚠ se perdió la conexión con la TV");
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitIceComplete(pc);
        const sdp = pc.localDescription?.sdp;
        if (!sdp) throw new Error("sin SDP");

        setLiveMode(mode);
        setLiveStatus("conectando con la TV…");
        bcRef.current?.postMessage({ kind: "rtc", role: "offer", id, sdp } satisfies MixBroadcast);
        await fetch(`/api/mix/${room}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rtc: { role: "offer", id, sdp } }),
        });

        // poll por la respuesta (para TV en otro dispositivo)
        let tries = 0;
        liveAnswerPollRef.current = window.setInterval(async () => {
          tries += 1;
          if (livePcRef.current !== pc || pc.signalingState !== "have-local-offer") {
            window.clearInterval(liveAnswerPollRef.current);
            return;
          }
          if (tries > 30) {
            window.clearInterval(liveAnswerPollRef.current);
            setLiveStatus("⚠ la TV no respondió — ¿está iniciada la pantalla?");
            return;
          }
          try {
            const res = await fetch(`/api/mix/${room}?v=-1`, { cache: "no-store" });
            if (!res.ok) return;
            const data = (await res.json()) as { rtc?: { answer?: { id: string; sdp: string } | null } | null };
            const answer = data.rtc?.answer;
            if (answer?.id === id && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
              window.clearInterval(liveAnswerPollRef.current);
            }
          } catch {
            // reintenta en el próximo tick
          }
        }, 1000);
      } catch {
        setLiveStatus("⚠ no se pudo iniciar el modo en vivo");
        stopLive(false);
      }
    },
    [room, stopLive],
  );

  useEffect(() => {
    return () => stopLive(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desmontar
  }, []);

  /** Pide alternativas al DJ IA (solo texto; no resuelve videos todavía). */
  const fetchSuggestions = useCallback(async (): Promise<
    Suggestion[] | { error: string }
  > => {
    const currentTitles = (["a", "b"] as const)
      .map((deck) => stateRef.current?.decks[deck].title)
      .filter((t): t is string => !!t);
    // historial de la sala = memoria anti-repetición del DJ
    const history = (stateRef.current?.library ?? []).map((item) => item.title);
    const res = await fetchWithTimeout(
      `/api/mix/suggest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: vibe.trim() || "mantén la energía y el género de lo que está sonando",
          current: currentTitles,
          history,
          hour: new Date().getHours(),
          ...(partyArc !== "auto" ? { arc: partyArc } : {}),
        }),
      },
      45_000,
    );
    const data = (await res.json()) as { sugerencias?: Suggestion[]; error?: string };
    if (!res.ok) return { error: data.error ?? "falló el DJ IA" };
    return (data.sugerencias ?? []).slice(0, 6);
  }, [vibe, partyArc]);

  /**
   * Resuelve una sugerencia (texto) al mejor video de YouTube utilizable:
   * entre los primeros candidatos embebibles y no repetidos, filtra a duración
   * de tema normal (1.5–9 min — fuera mega-mixes y shorts) y elige el más
   * popular (reproducciones, con likes de desempate).
   */
  const resolveSuggestion = useCallback(
    async (s: Suggestion): Promise<{ videoId: string; title: string } | null> => {
      const current = stateRef.current;
      const played = new Set(
        [
          ...(current?.library.map((item) => item.videoId) ?? []),
          current?.decks.a.videoId,
          current?.decks.b.videoId,
        ].filter((id): id is string => !!id),
      );
      const res = await fetchWithTimeout(
        `/api/mix/search?q=${encodeURIComponent(`${s.artista} ${s.tema}`)}`,
        {},
        15_000,
      );
      if (!res.ok) return null;
      const found = (await res.json()) as {
        items?: {
          videoId: string;
          title: string;
          embeddable?: boolean;
          duration?: number;
          views?: number;
          likes?: number;
        }[];
      };
      const usable = (found.items ?? [])
        .filter((v) => v.embeddable !== false && !played.has(v.videoId))
        .slice(0, 5);
      if (!usable.length) return null;
      const normalLength = usable.filter(
        (v) => (v.duration ?? 0) >= 90 && (v.duration ?? 0) <= 540,
      );
      const pool = normalLength.length ? normalLength : usable;
      const pick = pool.reduce((best, v) =>
        (v.views ?? 0) + (v.likes ?? 0) * 50 > (best.views ?? 0) + (best.likes ?? 0) * 50
          ? v
          : best,
      );
      return { videoId: pick.videoId, title: pick.title };
    },
    [],
  );

  /** Carga manual de una alternativa al deck elegido (botones → A / → B). */
  const loadSuggestion = useCallback(
    async (deck: DeckId, s: Suggestion) => {
      const key = suggestionKey(s);
      if (loadingSuggestion) return;
      setLoadingSuggestion(key);
      setSuggestError(null);
      try {
        const video = await resolveSuggestion(s);
        if (!video) {
          setSuggestError(`No encontré "${s.tema}" reproducible en YouTube`);
          return;
        }
        await loadToDeck(deck, video.videoId, video.title);
        setUsedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
        // marca este ciclo como preparado: el auto no volverá a pisar el deck.
        const srcId =
          stateRef.current?.decks[deck === "a" ? "b" : "a"].videoId ?? null;
        if (srcId) autoDjPreparedForRef.current = srcId;
      } catch {
        setSuggestError("No se pudo cargar la alternativa");
      } finally {
        setLoadingSuggestion(null);
      }
    },
    [loadingSuggestion, resolveSuggestion, loadToDeck],
  );

  /**
   * Modo DJ asistido (Mix eterno): apenas suena un tema pide 5 alternativas y
   * las muestra para que las cargues tú (→ A / → B). Si no intervienes, a
   * AUTODJ_MIX_AT segundos del final elige la primera libre, la carga en el
   * deck opuesto y dispara el mix automático. Corre con la consola abierta.
   */
  useEffect(() => {
    if (!autoDj) return;
    const tick = async () => {
      if (autoMixTimerRef.current || autoDjBusyRef.current) return;
      const current = stateRef.current;
      const prog = progressRef.current;
      if (!current || !prog) return;

      const source: DeckId = current.crossfader <= 50 ? "a" : "b";
      const target: DeckId = source === "a" ? "b" : "a";
      const srcDeck = current.decks[source];
      const p = prog.decks[source];
      if (!srcDeck.videoId || !srcDeck.playing || !p || p.d <= 0) return;
      const remaining = p.d - p.t;

      // Apenas cambia el tema activo: pedir alternativas (temprano, sin bloquear
      // el final). Reset de la selección previa.
      if (
        srcDeck.videoId !== suggestForRef.current &&
        Date.now() >= autoDjCooldownRef.current
      ) {
        suggestForRef.current = srcDeck.videoId;
        autoDjBusyRef.current = true;
        setAutoDjStatus("buscando alternativas…");
        try {
          const result = await fetchSuggestions();
          if ("error" in result) {
            setAutoDjStatus(`⚠ ${result.error} — reintento en 30 s`);
            autoDjCooldownRef.current = Date.now() + 30_000;
            suggestForRef.current = null;
          } else {
            setSuggestions(result);
            setUsedKeys([]);
            setAutoDjStatus(
              `${result.length} alternativas — carga una a A/B o dejo que mezcle solo`,
            );
          }
        } finally {
          autoDjBusyRef.current = false;
        }
        return;
      }

      // Cerca del final: asegurar que el deck opuesto tenga sucesor y mezclar.
      if (remaining > AUTODJ_MIX_AT) return;

      // Si el deck opuesto ya trae un tema distinto al que sale, solo mezclar.
      const targetReady =
        !!current.decks[target].videoId &&
        current.decks[target].videoId !== srcDeck.videoId;

      if (!targetReady) {
        // Auto-elegir: primera alternativa no usada que resuelva a un video.
        autoDjBusyRef.current = true;
        setAutoDjStatus("cargando el próximo…");
        try {
          const pending = suggestionsRef.current.filter(
            (s) => !usedKeysRef.current.includes(suggestionKey(s)),
          );
          for (const s of pending) {
            const video = await resolveSuggestion(s);
            if (video) {
              await loadToDeck(target, video.videoId, video.title);
              setUsedKeys((prev) => [...prev, suggestionKey(s)]);
              autoDjPreparedForRef.current = srcDeck.videoId;
              setAutoDjStatus(`próximo: ${video.title}`);
              break;
            }
          }
        } finally {
          autoDjBusyRef.current = false;
        }
        return;
      }

      setAutoDjStatus("mezclando…");
      startAutoMix();
    };
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [autoDj, fetchSuggestions, resolveSuggestion, startAutoMix, loadToDeck]);

  const copyTvLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/tv/${room}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bloqueado: el link queda visible igual
    }
  }, [room]);

  const askSuggestions = useCallback(async () => {
    if (!vibe.trim() || suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await fetchSuggestions();
      if ("error" in result) {
        setSuggestError(result.error);
        return;
      }
      setSuggestions(result);
      setUsedKeys([]);
    } catch (error) {
      setSuggestError(
        error instanceof DOMException && error.name === "AbortError"
          ? "El DJ IA tardó demasiado (>45 s). Reintenta."
          : "No se pudieron obtener sugerencias",
      );
    } finally {
      setSuggesting(false);
    }
  }, [vibe, suggesting, fetchSuggestions]);

  const renderDeck = (deck: DeckId) => {
    const meta = DECK_META[deck];
    const d = state?.decks[deck];
    const p = progress?.decks[deck] ?? null;
    const shownT = scrub[deck] ?? p?.t ?? 0;
    const playerError =
      d?.videoId && p?.err
        ? (PLAYER_ERROR_MESSAGES[p.err] ?? "No se pudo reproducir este video")
        : null;

    return (
      <section
        key={deck}
        className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"
      >
        <header className="flex items-center justify-between">
          <span className={`text-sm font-bold tracking-widest ${meta.accent}`}>
            {meta.label}
          </span>
          {d?.playing && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
              ● SONANDO
            </span>
          )}
        </header>

        <div className="flex items-center gap-3">
          {d?.videoId ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
            <img
              src={thumbnailUrl(d.videoId)}
              alt=""
              className="h-14 w-24 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
              vacío
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-100">
              {d?.title ?? "Carga un video de YouTube"}
            </p>
            <p className="text-sm font-medium tabular-nums text-zinc-300">
              {p?.d ? `${formatTime(shownT)} / ${formatTime(p.d)}` : "—:—"}
            </p>
          </div>
        </div>

        {/* Barra de progreso arrastrable: suelta para saltar a ese punto. */}
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(p?.d ?? 0))}
          value={Math.floor(shownT)}
          disabled={!p?.d}
          onChange={(e) => {
            const value = Number(e.target.value);
            scrubRef.current[deck] = value;
            setScrub((prev) => ({ ...prev, [deck]: value }));
          }}
          onPointerUp={() => commitScrub(deck)}
          onKeyUp={() => commitScrub(deck)}
          className={`${meta.faderClass} w-full disabled:opacity-40`}
          aria-label={`Posición de ${meta.label}`}
        />

        {playerError && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400">
            {playerError}
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={urls[deck]}
            onChange={(e) => setUrls((prev) => ({ ...prev, [deck]: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && loadToDeck(deck)}
            placeholder="Pega una URL de YouTube…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          <button
            onClick={() => loadToDeck(deck)}
            disabled={loadingDeck === deck}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
          >
            {loadingDeck === deck ? "…" : "Cargar"}
          </button>
        </div>
        {deckError[deck] && <p className="text-xs text-red-400">{deckError[deck]}</p>}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => cue(deck)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700" title="Volver al inicio">
            ⏮ Cue
          </button>
          <button onClick={() => seekBy(deck, -10)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700">
            −10s
          </button>
          <button
            onClick={() => d && patchDeck(deck, { playing: !d.playing })}
            disabled={!d?.videoId}
            className={`rounded-xl px-6 py-2 text-lg font-bold text-black transition disabled:opacity-40 ${
              deck === "a"
                ? "bg-emerald-500 hover:bg-emerald-400"
                : "bg-fuchsia-500 hover:bg-fuchsia-400"
            }`}
          >
            {d?.playing ? "❚❚" : "▶"}
          </button>
          <button onClick={() => seekBy(deck, 10)} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-200 transition hover:bg-zinc-700">
            +10s
          </button>
          <div className="flex overflow-hidden rounded-lg border border-zinc-700">
            {RATES.map((rate) => (
              <button
                key={rate}
                onClick={() => patchDeck(deck, { rate })}
                className={`px-2 py-2 text-xs transition ${
                  d?.rate === rate
                    ? "bg-zinc-100 font-bold text-zinc-950"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
                }`}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="w-8">Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            value={d?.volume ?? 80}
            onChange={(e) => patchDeck(deck, { volume: Number(e.target.value) })}
            className={meta.faderClass}
          />
          <span className="w-8 text-right">{d?.volume ?? 80}</span>
        </label>

        {/* Pre-escucha local: para encontrar el punto fuerte sin sonar en la TV. */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => (previewOpen[deck] ? closePreview(deck) : openPreview(deck))}
            disabled={!d?.videoId}
            className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {previewOpen[deck] ? "✕ Cerrar pre-escucha" : "🎧 Pre-escucha"}
          </button>
          {previewOpen[deck] && (
            <button
              onClick={() => applyPreviewPoint(deck)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-black transition ${
                deck === "a"
                  ? "bg-emerald-500 hover:bg-emerald-400"
                  : "bg-fuchsia-500 hover:bg-fuchsia-400"
              }`}
            >
              ⤓ Usar este punto en el deck
            </button>
          )}
        </div>
        {previewOpen[deck] && (
          <div>
            <div className="aspect-video overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <div id={`mix-preview-${deck}`} className="h-full w-full" />
            </div>
            <p className="mt-1 text-[10px] text-zinc-600">
              Suena solo en este dispositivo, no en la TV. Busca el punto fuerte con la
              barra de YouTube y tócalo con &quot;Usar este punto&quot;.
            </p>
          </div>
        )}
      </section>
    );
  };

  return (
    <div
      className="min-h-dvh bg-zinc-950 pb-16 text-zinc-100"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/mix" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← TV Mix
            </Link>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-sora), sans-serif" }}
            >
              Consola{" "}
              <span className="rounded-lg bg-zinc-800 px-2 py-0.5 text-lg tracking-widest text-emerald-400">
                {room}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm">
            <span className="text-zinc-400">
              TV: <span className="text-zinc-100">{host || "…"}/tv/{room}</span>
            </span>
            <button
              onClick={copyTvLink}
              className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
            <a
              href={`/tv/${room}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-black transition hover:bg-emerald-400"
            >
              Abrir ↗
            </a>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {renderDeck("a")}
          {renderDeck("b")}
        </div>

        {/* Mixer: crossfader + master. */}
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center gap-3">
            <span className="w-6 text-center text-sm font-bold text-emerald-400">A</span>
            <input
              type="range"
              min={0}
              max={100}
              value={state?.crossfader ?? 50}
              onChange={(e) => {
                stopAutoMix();
                sendPatch({ crossfader: Number(e.target.value) });
              }}
              className="mix-fader mix-fader--big"
              aria-label="Crossfader"
            />
            <span className="w-6 text-center text-sm font-bold text-fuchsia-400">B</span>
          </div>
          {(() => {
            const nextTarget: DeckId =
              (state?.crossfader ?? 50) <= 50 ? "b" : "a";
            const canMix = !!state?.decks[nextTarget].videoId;
            return (
              <button
                onClick={startAutoMix}
                disabled={!autoMixTarget && !canMix}
                title={
                  !autoMixTarget && !canMix
                    ? `Carga un video en el deck ${nextTarget.toUpperCase()} primero`
                    : undefined
                }
                className={`mx-auto rounded-xl px-6 py-2 text-sm font-bold transition disabled:opacity-40 ${
                  autoMixTarget
                    ? "bg-amber-500 text-black hover:bg-amber-400"
                    : "bg-zinc-100 text-zinc-950 hover:bg-white"
                }`}
              >
                {autoMixTarget
                  ? `Mezclando → ${autoMixTarget.toUpperCase()}… tocar para cancelar`
                  : `⇄ Mix automático → ${nextTarget.toUpperCase()}`}
              </button>
            );
          })()}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {FX_PAD.map(({ sound, label }) => (
              <button
                key={sound}
                onClick={() => triggerFx(sound)}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 active:bg-zinc-600"
                title="Suena en la TV"
              >
                {label}
              </button>
            ))}
          </div>
          {/* Modo en vivo: mic/cámara de este dispositivo hacia la TV. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-zinc-500">En vivo:</span>
            <button
              onClick={() => (liveMode === "mic" ? stopLive() : startLive("mic"))}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                liveMode === "mic"
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
              title="Habla por la TV (la música baja mientras hablas)"
            >
              🎤 {liveMode === "mic" ? "Cortar voz" : "Voz"}
            </button>
            <button
              onClick={() => (liveMode === "cam" ? stopLive() : startLive("cam"))}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                liveMode === "cam"
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
              title="Muestra tu cámara en la TV, con tu voz"
            >
              🎥 {liveMode === "cam" ? "Cortar cámara" : "Cámara"}
            </button>
            {liveStatus && <span className="text-xs text-emerald-300">{liveStatus}</span>}
          </div>
          <label className="flex items-center gap-3 text-xs text-zinc-400">
            <span className="w-12">Master</span>
            <input
              type="range"
              min={0}
              max={100}
              value={state?.master ?? 90}
              onChange={(e) => sendPatch({ master: Number(e.target.value) })}
              className="mix-fader"
            />
            <span className="w-8 text-right">{state?.master ?? 90}</span>
          </label>
        </section>

        {/* Buscador visual + playlists de YouTube / YouTube Music. */}
        <LibraryPanel
          room={room}
          onLoad={(deck, videoId, title) => loadToDeck(deck, videoId, title)}
        />

        {/* Biblioteca: últimos videos de la sala. */}
        {!!state?.library.length && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Recientes
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {state.library.map((item) => (
                <div
                  key={item.videoId}
                  className="w-36 shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
                  <img
                    src={thumbnailUrl(item.videoId)}
                    alt=""
                    className="mb-2 h-20 w-full rounded-lg object-cover"
                  />
                  <p className="mb-2 line-clamp-2 min-h-8 text-xs text-zinc-300">
                    {item.title}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadToDeck("a", item.videoId, item.title)}
                      className="flex-1 rounded-md bg-emerald-500/15 py-1 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30"
                    >
                      → A
                    </button>
                    <button
                      onClick={() => loadToDeck("b", item.videoId, item.title)}
                      className="flex-1 rounded-md bg-fuchsia-500/15 py-1 text-xs font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30"
                    >
                      → B
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Mis videos: clips propios subidos desde el celular. */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              📱 Mis videos
            </h2>
            <label
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                uploading !== null
                  ? "bg-zinc-800 text-zinc-400"
                  : "bg-zinc-100 text-zinc-950 hover:bg-white"
              }`}
            >
              {uploading !== null ? `Subiendo… ${uploading}%` : "+ Subir video"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                disabled={uploading !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ""; // permite resubir el mismo archivo
                  if (file) uploadClip(file);
                }}
              />
            </label>
          </div>
          {uploadError && <p className="mb-2 text-xs text-red-400">{uploadError}</p>}
          {state?.clips?.length ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {state.clips.map((clip) => (
                <div
                  key={clip.id}
                  className="w-36 shrink-0 rounded-xl border border-zinc-800 bg-zinc-950 p-2"
                >
                  <video
                    src={clip.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="mb-2 h-20 w-full rounded-lg bg-black object-cover"
                  />
                  <p className="mb-2 line-clamp-2 min-h-8 text-xs text-zinc-300">{clip.name}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => loadClipToDeck("a", clip)}
                      className="flex-1 rounded-md bg-emerald-500/15 py-1 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30"
                    >
                      → A
                    </button>
                    <button
                      onClick={() => loadClipToDeck("b", clip)}
                      className="flex-1 rounded-md bg-fuchsia-500/15 py-1 text-xs font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30"
                    >
                      → B
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">
              Sube videos desde tu celular y cárgalos a un deck: se mezclan con el
              crossfader igual que los de YouTube.
            </p>
          )}
        </section>

        {/* DJ asistente (IA). */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            DJ asistente · IA
          </h2>
          <div className="flex gap-2">
            <input
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askSuggestions()}
              placeholder="ej: funk latino para subir la energía"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            <button
              onClick={askSuggestions}
              disabled={suggesting || !vibe.trim()}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
            >
              {suggesting ? "Pensando…" : "Sugerir"}
            </button>
            <button
              onClick={() => {
                if (autoDj) {
                  setAutoDj(false);
                  setAutoDjStatus(null);
                } else {
                  autoDjPreparedForRef.current = null;
                  autoDjCooldownRef.current = 0;
                  suggestForRef.current = null;
                  setAutoDjStatus("activo — alternativas apenas parta el tema");
                  setAutoDj(true);
                }
              }}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                autoDj
                  ? "bg-emerald-500 text-black hover:bg-emerald-400"
                  : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              }`}
              title="Apenas parte cada tema te propone 5 alternativas; cárgalas a A/B o deja que mezcle solo al final"
            >
              {autoDj ? "♾ Mix eterno ON" : "♾ Mix eterno"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-zinc-500">Arco:</span>
            {PARTY_ARC_OPTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => setPartyArc(a.id)}
                title={a.hint}
                className={`rounded-full px-3 py-1 transition ${
                  partyArc === a.id
                    ? "bg-zinc-100 font-semibold text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          {autoDj && autoDjStatus && (
            <p className="mt-2 text-xs text-emerald-300">♾ {autoDjStatus}</p>
          )}
          {suggesting && (
            <p className="mt-2 text-xs text-zinc-500">
              El DJ IA está eligiendo… puede tardar unos segundos.
            </p>
          )}
          {suggestError && <p className="mt-2 text-xs text-red-400">{suggestError}</p>}
          {!!suggestions.length && (
            <ul className="mt-3 flex flex-col gap-2">
              {suggestions.map((s, i) => {
                const key = suggestionKey(s);
                const used = usedKeys.includes(key);
                const loading = loadingSuggestion === key;
                return (
                  <li
                    key={i}
                    className={`flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 ${
                      used ? "opacity-45" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-100">
                        <span className="font-semibold">{s.artista}</span> — {s.tema}
                        {used && " ✓"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">{s.motivo}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {loading ? (
                        <span className="px-2 text-xs text-zinc-400">cargando…</span>
                      ) : (
                        <>
                          <button
                            onClick={() => loadSuggestion("a", s)}
                            disabled={!!loadingSuggestion}
                            className="rounded-md bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-40"
                          >
                            → A
                          </button>
                          <button
                            onClick={() => loadSuggestion("b", s)}
                            disabled={!!loadingSuggestion}
                            className="rounded-md bg-fuchsia-500/15 px-3 py-1.5 text-xs font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30 disabled:opacity-40"
                          >
                            → B
                          </button>
                          <a
                            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                              `${s.artista} ${s.tema}`,
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md bg-zinc-800 px-2 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
                            title="Ver en YouTube"
                          >
                            ↗
                          </a>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-zinc-600">
            Escribe una vibra y pulsa Sugerir, o activa ♾ Mix eterno para recibir
            alternativas apenas parte cada tema. Cárgalas con → A / → B, o deja que
            mezcle solo.
          </p>
        </section>

        <p className="text-center text-xs text-zinc-600">
          Fase espejo: abre la TV en otra pestaña y castéala (Chrome → Enviar).
          Doble pantalla real: abre {host || "…"}/tv/{room} en el navegador del televisor.
        </p>
      </div>
    </div>
  );
}
