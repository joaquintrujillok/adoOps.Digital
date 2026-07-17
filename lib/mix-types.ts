/**
 * TV Mix — tipos y helpers puros del mixer de YouTube sincronizado con TV.
 *
 * Este archivo NO importa nada de servidor: es seguro para componentes
 * cliente (/mix, /tv) y también lo usa el route handler para mergear estado.
 */

export type DeckId = "a" | "b";

export type DeckState = {
  videoId: string | null;
  title: string | null;
  playing: boolean;
  /** Volumen propio del deck, 0–100. */
  volume: number;
  /** Velocidad de reproducción soportada por YouTube (0.5, 0.75, 1, 1.25, 1.5). */
  rate: number;
  /** Destino (en segundos) del último seek pedido desde la consola. */
  seekTo: number;
  /** Se incrementa en cada seek para que la TV lo aplique exactamente una vez. */
  seekNonce: number;
};

export type LibraryItem = { videoId: string; title: string };

/** Efectos de DJ sintetizados en la TV (Web Audio, no dependen de YouTube). */
export const FX_SOUNDS = ["horn", "siren", "scratch", "rewind"] as const;
export type FxSound = (typeof FX_SOUNDS)[number];
/** Evento one-shot: la TV lo dispara exactamente una vez por nonce. */
export type FxEvent = { sound: FxSound; nonce: number };

export type RoomState = {
  decks: Record<DeckId, DeckState>;
  /** 0 = solo deck A · 100 = solo deck B. */
  crossfader: number;
  /** Volumen maestro, 0–100. */
  master: number;
  /** Últimos videos cargados en la sala (para recargarlos rápido). */
  library: LibraryItem[];
  /** Último efecto pedido desde la consola (opcional: salas viejas no lo tienen). */
  fx?: FxEvent;
};

export type DeckProgress = {
  t: number;
  d: number;
  /** Código de error del player de YouTube (101/150 = embedding bloqueado). */
  err?: number | null;
};

export type RoomProgress = {
  decks: Record<DeckId, DeckProgress | null>;
  at: number;
};

/**
 * Señalización del modo en vivo (mic/cámara de la consola → TV por WebRTC).
 * SDPs completos sin trickle: un offer y un answer por sesión, apareados por id.
 */
export type RtcSignal = { id: string; sdp: string; at: number };
export type RtcChannel = { offer?: RtcSignal | null; answer?: RtcSignal | null } | null;

export type RoomSnapshot = {
  version: number;
  state: RoomState;
  progress: RoomProgress | null;
  rtc?: RtcChannel;
};

export type DeckPatch = Partial<
  Pick<
    DeckState,
    "videoId" | "title" | "playing" | "volume" | "rate" | "seekTo" | "seekNonce"
  >
>;

export type RoomPatch = {
  decks?: Partial<Record<DeckId, DeckPatch>>;
  crossfader?: number;
  master?: number;
  library?: LibraryItem[];
  fx?: FxEvent;
};

/** Mensajes del canal local (BroadcastChannel) entre consola y TV. */
export type MixBroadcast =
  | { kind: "state"; state: RoomState }
  | { kind: "progress"; progress: RoomProgress }
  | { kind: "rtc"; role: "offer" | "answer" | "end"; id: string; sdp?: string };

export const ROOM_CODE_RE = /^[A-Z0-9]{3,8}$/;
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const RATES = [0.5, 0.75, 1, 1.25, 1.5];
// historial de la sala: también es la memoria anti-repetición del DJ IA,
// así que debe alcanzar para una fiesta completa.
const LIBRARY_MAX = 30;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function defaultDeck(): DeckState {
  return {
    videoId: null,
    title: null,
    playing: false,
    volume: 80,
    rate: 1,
    seekTo: 0,
    seekNonce: 0,
  };
}

export function defaultRoomState(): RoomState {
  return {
    decks: { a: defaultDeck(), b: defaultDeck() },
    crossfader: 50,
    master: 90,
    library: [],
  };
}

export function normalizeRoomCode(raw: string): string | null {
  const code = decodeURIComponent(raw).trim().toUpperCase();
  return ROOM_CODE_RE.test(code) ? code : null;
}

/** Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L) para teclear en la TV. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makeRoomCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Extrae el ID de video de una URL de YouTube (watch, youtu.be, shorts,
 * live, embed) o acepta un ID crudo de 11 caracteres.
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (VIDEO_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1] ?? "";
    return VIDEO_ID_RE.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;
    const match = url.pathname.match(/^\/(shorts|live|embed)\/([A-Za-z0-9_-]{11})/);
    if (match) return match[2];
  }
  return null;
}

/** Ganancia (0–1) de cada deck según el crossfader, con curva equal-power. */
export function deckGain(deck: DeckId, crossfader: number): number {
  const x = clamp(crossfader, 0, 100) / 100;
  return deck === "a" ? Math.cos((x * Math.PI) / 2) : Math.sin((x * Math.PI) / 2);
}

/** Volumen final (0–100) que la TV debe aplicar a un deck. */
export function deckVolume(state: RoomState, deck: DeckId): number {
  const gain = deckGain(deck, state.crossfader);
  return Math.round(
    clamp(state.decks[deck].volume, 0, 100) * gain * (clamp(state.master, 0, 100) / 100),
  );
}

export function broadcastChannelName(room: string): string {
  return `adoops-tv-mix-${room}`;
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

function sanitizeDeckPatch(patch: DeckPatch): DeckPatch {
  const out: DeckPatch = {};
  if ("videoId" in patch) {
    out.videoId =
      patch.videoId === null
        ? null
        : typeof patch.videoId === "string" && VIDEO_ID_RE.test(patch.videoId)
          ? patch.videoId
          : undefined;
    if (out.videoId === undefined) delete out.videoId;
  }
  if ("title" in patch) {
    out.title =
      patch.title === null ? null : String(patch.title ?? "").slice(0, 140);
  }
  if (typeof patch.playing === "boolean") out.playing = patch.playing;
  if (typeof patch.volume === "number") out.volume = clamp(Math.round(patch.volume), 0, 100);
  if (typeof patch.rate === "number" && RATES.includes(patch.rate)) out.rate = patch.rate;
  if (typeof patch.seekTo === "number") out.seekTo = Math.max(0, patch.seekTo);
  if (typeof patch.seekNonce === "number") out.seekNonce = Math.max(0, Math.floor(patch.seekNonce));
  return out;
}

/**
 * Aplica un patch parcial sobre el estado de la sala, saneando valores.
 * Se usa igual en el servidor (autoridad) y en el cliente (optimista).
 */
export function mergePatch(state: RoomState, patch: RoomPatch): RoomState {
  const next: RoomState = {
    ...state,
    decks: { a: { ...state.decks.a }, b: { ...state.decks.b } },
    library: [...state.library],
  };

  if (patch.decks) {
    for (const deck of ["a", "b"] as const) {
      const deckPatch = patch.decks[deck];
      if (deckPatch) Object.assign(next.decks[deck], sanitizeDeckPatch(deckPatch));
    }
  }
  if (typeof patch.crossfader === "number") {
    next.crossfader = clamp(Math.round(patch.crossfader), 0, 100);
  }
  if (typeof patch.master === "number") {
    next.master = clamp(Math.round(patch.master), 0, 100);
  }
  if (
    patch.fx &&
    FX_SOUNDS.includes(patch.fx.sound) &&
    typeof patch.fx.nonce === "number" &&
    patch.fx.nonce >= 0
  ) {
    next.fx = { sound: patch.fx.sound, nonce: Math.floor(patch.fx.nonce) };
  }
  if (Array.isArray(patch.library)) {
    const seen = new Set<string>();
    next.library = patch.library
      .filter(
        (item): item is LibraryItem =>
          !!item &&
          typeof item.videoId === "string" &&
          VIDEO_ID_RE.test(item.videoId) &&
          !seen.has(item.videoId) &&
          !!seen.add(item.videoId),
      )
      .map((item) => ({ videoId: item.videoId, title: String(item.title ?? "").slice(0, 140) }))
      .slice(0, LIBRARY_MAX);
  }
  return next;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
