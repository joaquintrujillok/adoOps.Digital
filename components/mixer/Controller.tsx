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
  type QueueItem,
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

/** Offset de inicio por defecto (s) para saltarse la intro; ajustable en la consola. */
const START_OFFSET_DEFAULT = 15;
const START_OFFSET_OPTIONS = [0, 5, 10, 15, 20, 30];
const START_OFFSET_KEY = "tvmix-start-offset";

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

/** Tabs del modo app en celular (en desktop se muestra todo en una columna). */
type MobileTab = "mix" | "search" | "queue" | "dj";
const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: "mix", icon: "🎛", label: "Mezcla" },
  { id: "search", icon: "🔍", label: "Buscar" },
  { id: "queue", icon: "⏭", label: "Cola" },
  { id: "dj", icon: "♾", label: "DJ IA" },
];

/** Arco de la fiesta: elegido a mano pesa más que la hora local. */
type PartyArc = "auto" | "warmup" | "peak" | "cooldown";
const PARTY_ARC_OPTIONS: { id: PartyArc; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "la IA modula según la hora" },
  { id: "warmup", label: "🌅 Calentando", hint: "energía media, subiendo de a poco" },
  { id: "peak", label: "🔥 Peak", hint: "máxima energía bailable" },
  { id: "cooldown", label: "🌙 Bajando", hint: "aterrizar suave" },
];

type Suggestion = { artista: string; tema: string; motivo: string };

/** Alternativa del DJ IA ya resuelta a un video concreto (con sus datos). */
type ResolvedAlt = {
  videoId: string;
  title: string;
  duration: number;
  views: number;
  likes: number;
};

/** 1234567 → "1,2 M" (para vistas y likes). */
const compact = (n: number) =>
  new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Para comparar títulos sin tildes ni mayúsculas. */
const normalizeText = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Artista aproximado desde un título de YouTube ("Artista - Tema (…)"). */
const artistFromTitle = (title: string): string | null => {
  const seg = title.split(/\s+[-–—]\s+/)[0]?.trim();
  return seg && seg.length >= 3 && seg.length <= 40 ? seg : null;
};

/** Artistas de los últimos 3 temas cargados: vetados para el DJ IA. */
const recentArtists = (library: { title: string }[]): string[] =>
  Array.from(
    new Set(
      library
        .slice(0, 3)
        .map((i) => artistFromTitle(i.title))
        .filter((a): a is string => !!a),
    ),
  );

/** Versiones que un DJ no quiere por accidente al resolver una sugerencia. */
const BAD_VERSION_RE =
  /cover|karaoke|8d|sped ?up|slowed|reverb|reacci[oó]n|reaction|tutorial|instrumental|ensayo/;

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
  const [startOffset, setStartOffset] = useState(START_OFFSET_DEFAULT);
  const [mobileTab, setMobileTab] = useState<MobileTab>("mix");
  const [pasteUrl, setPasteUrl] = useState("");
  const host = useHost();

  const [vibe, setVibe] = useState("");
  const [partyArc, setPartyArc] = useState<PartyArc>("auto");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  // sugerencias ya cargadas a un deck (key artista|tema) y la que está cargando
  const [usedKeys, setUsedKeys] = useState<string[]>([]);
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  // alternativas resueltas a video real (key → datos; null = sin video utilizable)
  const [resolvedAlts, setResolvedAlts] = useState<Record<string, ResolvedAlt | null>>({});

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
  /**
   * Qué quedó "gastado" en cada deck tras un mix automático (videoId o src).
   * Sin esto, el tema anterior que queda en el deck saliente cuenta como
   * "sucesor listo" y el Mix eterno hace ping-pong A↔B repitiendo temas.
   */
  const spentRef = useRef<Record<DeckId, string | null>>({ a: null, b: null });
  // espejo reactivo del spentRef solo para la vista "Sonando → Siguiente"
  const [spentView, setSpentView] = useState<Record<DeckId, string | null>>({
    a: null,
    b: null,
  });
  const autoDjCooldownRef = useRef(0);
  // el loop lee estas listas sin re-crearse: refs que espejan el estado.
  const suggestionsRef = useRef<Suggestion[]>([]);
  const usedKeysRef = useRef<string[]>([]);
  const resolvedAltsRef = useRef<Record<string, ResolvedAlt | null>>({});
  /** videoId del tema activo para el que ya se pidieron alternativas. */
  const suggestForRef = useRef<string | null>(null);
  // el offset se lee al momento de cargar sin recrear loadToDeck/loadClipToDeck
  const startOffsetRef = useRef(START_OFFSET_DEFAULT);

  // restaura el offset elegido en este navegador tras montar (leerlo en el
  // render daría mismatch de hidratación: el server no ve localStorage).
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(START_OFFSET_KEY));
    if (START_OFFSET_OPTIONS.includes(saved) && saved !== START_OFFSET_DEFAULT) {
      startOffsetRef.current = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync con localStorage post-mount
      setStartOffset(saved);
    }
  }, []);

  const changeStartOffset = useCallback((value: number) => {
    startOffsetRef.current = value;
    setStartOffset(value);
    try {
      window.localStorage.setItem(START_OFFSET_KEY, String(value));
    } catch {
      // sin localStorage: el offset vale solo para esta sesión
    }
  }, []);
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
        // No pisar ediciones locales en vuelo. OJO: la versión se avanza solo
        // al aplicar — si no, un cambio externo (otra consola, un patch por
        // API) que llegue durante una edición local queda tragado para siempre
        // (mismo bug que tenía el poll de la TV).
        if (data.state && Date.now() - lastEditAtRef.current > 2500) {
          versionRef.current = data.version;
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
      // kind/src explícitos: el deck puede venir de un clip propio.
      // seek al offset de inicio para saltarse la intro.
      decks[deck] = {
        videoId,
        title,
        kind: "yt",
        src: null,
        playing: false,
        seekTo: startOffsetRef.current,
        seekNonce: (stateRef.current?.decks[deck].seekNonce ?? 0) + 1,
      };
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
        seekTo: startOffsetRef.current,
        seekNonce: (stateRef.current?.decks[deck].seekNonce ?? 0) + 1,
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

  /** Deck donde cae el próximo: prefiere el vacío; si no, el opuesto al activo. */
  const freeDeck = useCallback((): DeckId => {
    const s = stateRef.current;
    if (!s) return "a";
    const aEmpty = !s.decks.a.videoId && !s.decks.a.src;
    const bEmpty = !s.decks.b.videoId && !s.decks.b.src;
    if (aEmpty && !bEmpty) return "a";
    if (bEmpty && !aEmpty) return "b";
    return s.crossfader <= 50 ? "b" : "a";
  }, []);

  /** Carga un ítem de la cola (YouTube o clip) en el deck indicado. */
  const loadQueueItem = useCallback(
    (deck: DeckId, item: QueueItem) => {
      if (item.kind === "clip" && item.src) {
        loadClipToDeck(deck, { id: item.id, url: item.src, name: item.title });
      } else if (item.videoId) {
        loadToDeck(deck, item.videoId, item.title);
      }
    },
    [loadClipToDeck, loadToDeck],
  );

  /** Agrega un video/clip al final de la cola de próximos. */
  const enqueue = useCallback(
    (item: Omit<QueueItem, "id">) => {
      const entry: QueueItem = { ...item, id: Math.random().toString(36).slice(2, 10) };
      sendPatch({ queue: [...(stateRef.current?.queue ?? []), entry] });
    },
    [sendPatch],
  );

  const removeFromQueue = useCallback(
    (id: string) => {
      sendPatch({ queue: (stateRef.current?.queue ?? []).filter((x) => x.id !== id) });
    },
    [sendPatch],
  );

  /** Mueve un ítem de la cola una posición hacia arriba o abajo. */
  const moveInQueue = useCallback(
    (id: string, dir: -1 | 1) => {
      const q = [...(stateRef.current?.queue ?? [])];
      const i = q.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= q.length) return;
      [q[i], q[j]] = [q[j], q[i]];
      sendPatch({ queue: q });
    },
    [sendPatch],
  );

  /**
   * La cola alimenta los decks sola: apenas hay un deck vacío, el primero de
   * la cola se carga ahí (cueado en el offset de inicio). Así el próximo tema
   * siempre está listo en A o B sin apretar nada.
   */
  useEffect(() => {
    if (!state?.queue?.length) return;
    const empty = (["a", "b"] as const).find(
      (d) => !state.decks[d].videoId && !state.decks[d].src,
    );
    if (!empty) return;
    const [next, ...rest] = state.queue;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza la sala (servidor+TV), no solo estado local; termina al vaciar la cola o llenar los decks
    loadQueueItem(empty, next);
    sendPatch({ queue: rest });
  }, [state, loadQueueItem, sendPatch]);

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
    const tgt = current.decks[target];
    if (!(tgt.kind === "clip" ? tgt.src : tgt.videoId)) return;

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
        // lo que quedó en el deck saliente ya sonó: no cuenta como sucesor
        const src = current.decks[source];
        spentRef.current[source] =
          (src.kind === "clip" ? src.src : src.videoId) ?? null;
        setSpentView({ ...spentRef.current });
        // el deck que salió queda libre: la cola pone ahí el siguiente
        const q = stateRef.current?.queue ?? [];
        if (q.length) {
          const [nextItem, ...rest] = q;
          loadQueueItem(source, nextItem);
          sendPatch({ queue: rest });
        }
      } else {
        sendPatch({ crossfader: Math.round(from + (to - from) * eased) });
      }
    }, 150);
  }, [sendPatch, stopAutoMix, loadQueueItem]);

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
    const avoidArtists = recentArtists(stateRef.current?.library ?? []);
    const res = await fetchWithTimeout(
      `/api/mix/suggest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: vibe.trim() || "mantén la energía y el género de lo que está sonando",
          current: currentTitles,
          history,
          avoidArtists,
          hour: new Date().getHours(),
          ...(partyArc !== "auto" ? { arc: partyArc } : {}),
        }),
      },
      45_000,
    );
    const data = (await res.json()) as { sugerencias?: Suggestion[]; error?: string };
    if (!res.ok) return { error: data.error ?? "falló el DJ IA" };
    // 5 alternativas: cada una se resuelve con una búsqueda (cuota YouTube)
    return (data.sugerencias ?? []).slice(0, 5);
  }, [vibe, partyArc]);

  /**
   * Resuelve una sugerencia (texto) al mejor video de YouTube utilizable.
   * Puntaje = coincidencia de artista y tema en título/canal (evita que un
   * video popular pero equivocado gane) − castigo a covers/karaoke/reacciones
   * + popularidad (log de reproducciones). Duración acotada a tema normal
   * (1.5–9 min — fuera mega-mixes y shorts).
   */
  const resolveSuggestion = useCallback(
    async (s: Suggestion): Promise<ResolvedAlt | null> => {
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
          channel?: string;
          embeddable?: boolean;
          blockedInRegion?: boolean;
          duration?: number;
          views?: number;
          likes?: number;
        }[];
      };
      const usable = (found.items ?? [])
        .filter(
          (v) => v.embeddable !== false && !v.blockedInRegion && !played.has(v.videoId),
        )
        .slice(0, 8);
      if (!usable.length) return null;
      const normalLength = usable.filter(
        (v) => (v.duration ?? 0) >= 90 && (v.duration ?? 0) <= 540,
      );
      const pool = normalLength.length ? normalLength : usable;

      const artista = normalizeText(s.artista);
      const tema = normalizeText(s.tema);
      const score = (v: (typeof pool)[number]): number => {
        const texto = normalizeText(`${v.title} ${v.channel ?? ""}`);
        let match = 0;
        if (texto.includes(artista)) match += 3;
        if (texto.includes(tema)) match += 4;
        if (BAD_VERSION_RE.test(texto) && !BAD_VERSION_RE.test(tema)) match -= 5;
        return match * 2 + Math.log10((v.views ?? 0) + 1);
      };
      const pick = pool.reduce((best, v) => (score(v) > score(best) ? v : best));
      return {
        videoId: pick.videoId,
        title: pick.title,
        duration: pick.duration ?? 0,
        views: pick.views ?? 0,
        likes: pick.likes ?? 0,
      };
    },
    [],
  );

  // Modo ahorro de cuota: las alternativas NO se resuelven todas — el ciclo
  // resuelve la primera al preparar el sucesor, y el resto solo si tocas
  // "🔍 datos" o las cargas (videoForSuggestion cachea el resultado).

  /** Video de una alternativa: reutiliza lo resuelto o busca (y lo guarda). */
  const videoForSuggestion = useCallback(
    async (s: Suggestion): Promise<ResolvedAlt | null> => {
      const key = suggestionKey(s);
      const cached = resolvedAltsRef.current[key];
      if (cached !== undefined) return cached;
      const alt = await resolveSuggestion(s);
      resolvedAltsRef.current = { ...resolvedAltsRef.current, [key]: alt };
      setResolvedAlts(resolvedAltsRef.current);
      return alt;
    },
    [resolveSuggestion],
  );

  /** Resuelve una alternativa solo para VER sus datos (cuesta 1 búsqueda). */
  const peekSuggestion = useCallback(
    async (s: Suggestion) => {
      if (loadingSuggestion) return;
      setLoadingSuggestion(suggestionKey(s));
      try {
        await videoForSuggestion(s);
      } catch {
        // la fila quedará como "sin video"
      } finally {
        setLoadingSuggestion(null);
      }
    },
    [loadingSuggestion, videoForSuggestion],
  );

  /** Carga manual de una alternativa al deck elegido (botones → A / → B). */
  const loadSuggestion = useCallback(
    async (deck: DeckId, s: Suggestion) => {
      const key = suggestionKey(s);
      if (loadingSuggestion) return;
      setLoadingSuggestion(key);
      setSuggestError(null);
      try {
        const video = await videoForSuggestion(s);
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
    [loadingSuggestion, videoForSuggestion, loadToDeck],
  );

  /** Resuelve una alternativa del DJ IA y la agrega a la cola. */
  const enqueueSuggestion = useCallback(
    async (s: Suggestion) => {
      const key = suggestionKey(s);
      if (loadingSuggestion) return;
      setLoadingSuggestion(key);
      setSuggestError(null);
      try {
        const video = await videoForSuggestion(s);
        if (!video) {
          setSuggestError(`No encontré "${s.tema}" reproducible en YouTube`);
          return;
        }
        enqueue({ kind: "yt", videoId: video.videoId, title: video.title });
        setUsedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      } catch {
        setSuggestError("No se pudo agregar a la cola");
      } finally {
        setLoadingSuggestion(null);
      }
    },
    [loadingSuggestion, videoForSuggestion, enqueue],
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
            resolvedAltsRef.current = {};
            setResolvedAlts({});
            setAutoDjStatus(`${result.length} alternativas — eligiendo el siguiente…`);
          }
        } finally {
          autoDjBusyRef.current = false;
        }
        return;
      }

      // Solo mezclar si el deck opuesto trae un tema FRESCO: distinto al que
      // suena y distinto a lo que ese deck ya reprodujo (sin esto, el tema
      // anterior que queda cargado provoca ping-pong A↔B repitiendo temas).
      const tgt = current.decks[target];
      const tgtSource = (tgt.kind === "clip" ? tgt.src : tgt.videoId) ?? null;
      const srcSource =
        (srcDeck.kind === "clip" ? srcDeck.src : srcDeck.videoId) ?? null;
      const targetReady =
        !!tgtSource &&
        tgtSource !== srcSource &&
        tgtSource !== spentRef.current[target];

      // El sucesor se prepara DE INMEDIATO (no se espera al final del tema).
      if (!targetReady && autoDjPreparedForRef.current !== srcDeck.videoId) {
        autoDjBusyRef.current = true;
        try {
          // 1) La cola manda: si dejaste próximos, se usan antes que la IA.
          const q = stateRef.current?.queue ?? [];
          if (q.length) {
            const [nextItem, ...rest] = q;
            loadQueueItem(target, nextItem);
            sendPatch({ queue: rest });
            autoDjPreparedForRef.current = srcDeck.videoId;
            setAutoDjStatus(`⏭ siguiente (cola): ${nextItem.title}`);
            return;
          }
          // 2) Sin cola: primera alternativa resuelta y no usada, en el orden
          // de la IA. Si aún se está resolviendo, se reintenta al tick.
          // filtro duro anti-repetición: nada del mismo artista en 3 temas,
          // salvo que la vibra lo pida explícitamente por nombre.
          const vetados = recentArtists(stateRef.current?.library ?? []).map(normalizeText);
          const vibraNorm = normalizeText(vibe);
          for (const s of suggestionsRef.current) {
            const key = suggestionKey(s);
            if (usedKeysRef.current.includes(key)) continue;
            const artistaNorm = normalizeText(s.artista);
            if (
              artistaNorm.length >= 3 &&
              !vibraNorm.includes(artistaNorm) &&
              vetados.some((a) => a.includes(artistaNorm) || artistaNorm.includes(a))
            ) {
              continue; // artista repetido en los últimos 3 temas
            }
            // modo ahorro: resolver recién aquí, solo lo necesario
            let alt = resolvedAltsRef.current[key];
            if (alt === undefined) alt = await videoForSuggestion(s);
            if (!alt) continue; // sin video utilizable: probar la siguiente
            await loadToDeck(target, alt.videoId, alt.title);
            setUsedKeys((prev) => [...prev, key]);
            autoDjPreparedForRef.current = srcDeck.videoId;
            setAutoDjStatus(`⏭ siguiente: ${alt.title}`);
            return;
          }
        } finally {
          autoDjBusyRef.current = false;
        }
        return;
      }

      // Cerca del final y con sucesor fresco: mezclar.
      if (remaining > AUTODJ_MIX_AT || !targetReady) return;
      setAutoDjStatus("mezclando…");
      startAutoMix();
    };
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [
    autoDj,
    vibe,
    fetchSuggestions,
    videoForSuggestion,
    startAutoMix,
    loadToDeck,
    loadQueueItem,
    sendPatch,
  ]);

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
      resolvedAltsRef.current = {};
      setResolvedAlts({});
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

        {/* URL directa: en celular vive en el tab Buscar */}
        <div className="hidden gap-2 md:flex">
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
          <button onClick={() => cue(deck)} className="rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-700 md:px-3 md:py-2" title="Volver al inicio">
            ⏮ Cue
          </button>
          <button onClick={() => seekBy(deck, -10)} className="rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-700 md:px-3 md:py-2">
            −10s
          </button>
          <button
            onClick={() => d && patchDeck(deck, { playing: !d.playing })}
            disabled={!(d?.kind === "clip" ? d?.src : d?.videoId)}
            className={`rounded-xl px-7 py-3 text-lg font-bold text-black transition disabled:opacity-40 md:px-6 md:py-2 ${
              deck === "a"
                ? "bg-emerald-500 hover:bg-emerald-400"
                : "bg-fuchsia-500 hover:bg-fuchsia-400"
            }`}
          >
            {d?.playing ? "❚❚" : "▶"}
          </button>
          <button onClick={() => seekBy(deck, 10)} className="rounded-lg bg-zinc-800 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-700 md:px-3 md:py-2">
            +10s
          </button>
          <div className="hidden overflow-hidden rounded-lg border border-zinc-700 md:flex">
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
            className="min-h-11 rounded-lg bg-zinc-800 px-3 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40 md:min-h-0 md:py-1.5"
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
      className="min-h-dvh bg-zinc-950 pb-44 text-zinc-100 md:pb-16"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pt-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/mix" className="text-xs text-zinc-500 hover:text-zinc-300">
              ← TV Mix
            </Link>
            <h1
              className="text-xl font-bold md:text-2xl"
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
              TV:{" "}
              <span className="hidden text-zinc-100 sm:inline">
                {host || "…"}/tv/{room}
              </span>
              <span className="text-zinc-100 sm:hidden">{room}</span>
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

        {/* ——— Grupo Mezcla (tab "mix" en celular; siempre visible en desktop) ——— */}
        <div className={`${mobileTab === "mix" ? "flex" : "hidden"} flex-col gap-4 md:flex`}>
        {/* grid-cols-1 explícito: el track auto crecía al min-content y desbordaba en 375px */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                className={`mx-auto min-h-11 rounded-xl px-6 py-2 text-sm font-bold transition disabled:opacity-40 md:min-h-0 ${
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
                className="min-h-11 rounded-lg bg-zinc-800 px-4 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 active:bg-zinc-600 md:min-h-0 md:px-3 md:py-1.5"
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
              className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition md:min-h-0 md:py-1.5 ${
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
              className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition md:min-h-0 md:py-1.5 ${
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
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className="text-zinc-400"
              title="Los videos arrancan este offset adentro para saltarse la intro"
            >
              Inicio:
            </span>
            {START_OFFSET_OPTIONS.map((v) => (
              <button
                key={v}
                onClick={() => changeStartOffset(v)}
                className={`rounded-full px-3 py-2 transition md:py-1 ${
                  startOffset === v
                    ? "bg-zinc-100 font-semibold text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {v === 0 ? "0:00" : `${v}s`}
              </button>
            ))}
          </div>
        </section>
        </div>

        {/* ——— Grupo Cola (tab "queue") ——— */}
        <div className={`${mobileTab === "queue" ? "flex" : "hidden"} flex-col gap-4 md:flex`}>
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              ⏭ Cola{state?.queue?.length ? ` · ${state.queue.length}` : ""}
            </h2>
            <span className="text-[10px] text-zinc-600">
              el siguiente se carga solo al deck libre
            </span>
          </div>
          {state?.queue?.length ? (
            <ul className="flex flex-col gap-2">
              {state.queue.map((item, i) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-zinc-500">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                    {item.kind === "clip" ? "📱 " : ""}
                    {item.title}
                  </span>
                  <button
                    onClick={() => moveInQueue(item.id, -1)}
                    disabled={i === 0}
                    className="shrink-0 rounded-md bg-zinc-800 px-3 py-2.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-30 md:px-2.5 md:py-1"
                    title="Subir en la cola"
                    aria-label="Subir"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveInQueue(item.id, 1)}
                    disabled={i === (state.queue?.length ?? 0) - 1}
                    className="shrink-0 rounded-md bg-zinc-800 px-3 py-2.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-30 md:px-2.5 md:py-1"
                    title="Bajar en la cola"
                    aria-label="Bajar"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    className="shrink-0 rounded-md bg-zinc-800 px-3 py-2.5 text-xs text-zinc-400 transition hover:bg-zinc-700 md:px-2 md:py-1"
                    title="Quitar de la cola"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-600">
              Agrega videos con &quot;+ cola&quot; desde la búsqueda, tus videos,
              recientes o sugerencias. El primero de la cola se carga solo al deck
              libre; ordénalos con ↑ ↓ y con ♾ Mix eterno se encadenan solos.
            </p>
          )}
        </section>

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
                      className="flex-1 rounded-md bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 md:py-1"
                    >
                      → A
                    </button>
                    <button
                      onClick={() => loadToDeck("b", item.videoId, item.title)}
                      className="flex-1 rounded-md bg-fuchsia-500/15 py-2 text-xs font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30 md:py-1"
                    >
                      → B
                    </button>
                    <button
                      onClick={() =>
                        enqueue({ kind: "yt", videoId: item.videoId, title: item.title })
                      }
                      className="rounded-md bg-zinc-800 px-2 py-2 text-xs text-zinc-300 transition hover:bg-zinc-700 md:py-1"
                      title="Agregar a la cola"
                    >
                      + cola
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>

        {/* ——— Grupo Buscar (tab "search") ——— */}
        <div className={`${mobileTab === "search" ? "flex" : "hidden"} flex-col gap-4 md:flex`}>
        {/* Pegar URL directo (en desktop vive en cada deck). */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 md:hidden">
          <div className="flex gap-2">
            <input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              placeholder="Pega una URL de YouTube…"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            <button
              onClick={() => {
                if (pasteUrl.trim()) {
                  loadToDeck(freeDeck(), pasteUrl);
                  setPasteUrl("");
                }
              }}
              disabled={!pasteUrl.trim()}
              className="rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-40"
            >
              Cargar
            </button>
          </div>
        </section>

        {/* Buscador visual + playlists de YouTube / YouTube Music. */}
        <LibraryPanel
          room={room}
          onLoad={(deck, videoId, title) => loadToDeck(deck, videoId, title)}
          onEnqueue={(videoId, title) => enqueue({ kind: "yt", videoId, title })}
        />

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
                      className="flex-1 rounded-md bg-emerald-500/15 py-2 text-xs md:py-1 font-bold text-emerald-300 transition hover:bg-emerald-500/30"
                    >
                      → A
                    </button>
                    <button
                      onClick={() => loadClipToDeck("b", clip)}
                      className="flex-1 rounded-md bg-fuchsia-500/15 py-2 text-xs md:py-1 font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30"
                    >
                      → B
                    </button>
                    <button
                      onClick={() =>
                        enqueue({ kind: "clip", src: clip.url, title: clip.name })
                      }
                      className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
                      title="Agregar a la cola"
                    >
                      + cola
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
        </div>

        {/* ——— Grupo DJ IA (tab "dj") ——— */}
        <div className={`${mobileTab === "dj" ? "flex" : "hidden"} flex-col gap-4 md:flex`}>
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
                  spentRef.current = { a: null, b: null };
                  setSpentView({ a: null, b: null });
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
                className={`rounded-full px-3 py-2 transition md:py-1 ${
                  partyArc === a.id
                    ? "bg-zinc-100 font-semibold text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          {autoDj &&
            state &&
            (() => {
              const side: DeckId = state.crossfader <= 50 ? "a" : "b";
              const other: DeckId = side === "a" ? "b" : "a";
              const cur = state.decks[side];
              const nxt = state.decks[other];
              const nxtSource = (nxt.kind === "clip" ? nxt.src : nxt.videoId) ?? null;
              const nxtFresco = !!nxtSource && nxtSource !== spentView[other];
              return (
                <div className="mt-2 flex flex-col gap-0.5 rounded-lg bg-zinc-950 px-3 py-2 text-xs">
                  <p className="truncate">
                    <span className="text-zinc-500">▶ Sonando: </span>
                    <span className="text-zinc-200">{cur.title ?? "—"}</span>
                  </p>
                  <p className="truncate">
                    <span className="text-zinc-500">⏭ Siguiente: </span>
                    <span className={nxtFresco ? "text-emerald-300" : "text-zinc-500"}>
                      {nxtFresco ? nxt.title : "eligiendo…"}
                    </span>
                  </p>
                </div>
              );
            })()}
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
                const alt = resolvedAlts[key]; // undefined = resolviendo · null = sin video
                return (
                  <li
                    key={i}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 ${
                      used ? "opacity-45" : ""
                    }`}
                  >
                    {alt ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                      <img
                        src={thumbnailUrl(alt.videoId)}
                        alt=""
                        className="h-10 w-16 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[10px] text-zinc-600">
                        {alt === null ? "✕" : "…"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-100">
                        <span className="font-semibold">{s.artista}</span> — {s.tema}
                        {used && " ✓"}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {alt
                          ? `${alt.duration > 0 ? `${formatTime(alt.duration)} · ` : ""}${compact(alt.views)} vistas · 👍 ${compact(alt.likes)}`
                          : alt === null
                            ? "sin video reproducible en YouTube"
                            : "toca 🔍 para ver duración y vistas"}
                      </p>
                      <p className="truncate text-[11px] text-zinc-600">{s.motivo}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {loading ? (
                        <span className="px-2 text-xs text-zinc-400">cargando…</span>
                      ) : (
                        <>
                          {alt === undefined && (
                            <button
                              onClick={() => peekSuggestion(s)}
                              disabled={!!loadingSuggestion}
                              className="rounded-md bg-zinc-800 px-2.5 py-2.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40 md:py-1.5"
                              title="Ver duración, vistas y likes (1 búsqueda)"
                            >
                              🔍
                            </button>
                          )}
                          <button
                            onClick={() => loadSuggestion("a", s)}
                            disabled={!!loadingSuggestion || alt === null}
                            className="rounded-md bg-emerald-500/15 px-3 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-40 md:py-1.5"
                          >
                            → A
                          </button>
                          <button
                            onClick={() => loadSuggestion("b", s)}
                            disabled={!!loadingSuggestion || alt === null}
                            className="rounded-md bg-fuchsia-500/15 px-3 py-2.5 text-xs font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30 disabled:opacity-40 md:py-1.5"
                          >
                            → B
                          </button>
                          <button
                            onClick={() => enqueueSuggestion(s)}
                            disabled={!!loadingSuggestion || alt === null}
                            className="rounded-md bg-zinc-800 px-3 py-2.5 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40 md:px-2 md:py-1.5"
                            title="Agregar a la cola"
                          >
                            + cola
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
        </div>

        <p className="hidden text-center text-xs text-zinc-600 md:block">
          Fase espejo: abre la TV en otra pestaña y castéala (Chrome → Enviar).
          Doble pantalla real: abre {host || "…"}/tv/{room} en el navegador del televisor.
        </p>
      </div>

      {/* ——— Barra "sonando" (celular, tabs distintos de Mezcla) ——— */}
      {(() => {
        if (mobileTab === "mix" || !state) return null;
        const side: DeckId = state.crossfader <= 50 ? "a" : "b";
        const active: DeckId = state.decks[side].playing
          ? side
          : state.decks[side === "a" ? "b" : "a"].playing
            ? side === "a"
              ? "b"
              : "a"
            : side;
        const d = state.decks[active];
        const hasSource = d.kind === "clip" ? !!d.src : !!d.videoId;
        if (!hasSource) return null;
        const p = progress?.decks[active];
        return (
          <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 border-t border-zinc-800 bg-zinc-900/95 px-4 py-2 backdrop-blur md:hidden">
            <div className="mx-auto flex max-w-5xl items-center gap-3">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  active === "a" ? "bg-emerald-400" : "bg-fuchsia-400"
                } ${d.playing ? "" : "opacity-40"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-100">{d.title}</p>
                <p className="text-[10px] tabular-nums text-zinc-500">
                  {p?.d ? `${formatTime(p.t)} / ${formatTime(p.d)}` : "—:—"}
                  {d.playing ? "" : " · pausado"}
                </p>
              </div>
              <button
                onClick={() => patchDeck(active, { playing: !d.playing })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg text-zinc-100 transition hover:bg-zinc-700"
                aria-label={d.playing ? "Pausar" : "Reproducir"}
              >
                {d.playing ? "❚❚" : "▶"}
              </button>
              <button
                onClick={startAutoMix}
                className={`flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-bold transition ${
                  autoMixTarget
                    ? "bg-amber-500 text-black"
                    : "bg-zinc-100 text-zinc-950 hover:bg-white"
                }`}
                aria-label="Mix automático"
              >
                ⇄
              </button>
            </div>
          </div>
        );
      })()}

      {/* ——— Tab bar inferior (solo celular) ——— */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-14 max-w-5xl">
          {MOBILE_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setMobileTab(t.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
                mobileTab === t.id ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <span className="relative text-lg leading-none">
                {t.icon}
                {t.id === "queue" && !!state?.queue?.length && (
                  <span className="absolute -right-3 -top-1 rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-3 text-black">
                    {state.queue.length}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] ${mobileTab === t.id ? "font-semibold" : ""}`}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
