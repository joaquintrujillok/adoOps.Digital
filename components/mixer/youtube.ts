/**
 * Cargador y tipos mínimos de la YouTube IFrame Player API.
 * Solo se usa en el cliente (pantalla /tv).
 */

/** Acepta un id crudo o { videoId, startSeconds } para cuear en un punto. */
export type YTLoadArg = string | { videoId: string; startSeconds?: number };

export type YTPlayer = {
  loadVideoById: (arg: YTLoadArg) => void;
  cueVideoById: (arg: YTLoadArg) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
};

export type YTPlayerVars = {
  autoplay?: 0 | 1;
  controls?: 0 | 1;
  disablekb?: 0 | 1;
  fs?: 0 | 1;
  iv_load_policy?: 1 | 3;
  playsinline?: 0 | 1;
  rel?: 0 | 1;
};

export type YTNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId?: string;
      playerVars?: YTPlayerVars;
      events?: {
        onReady?: (event: { target: YTPlayer }) => void;
        onStateChange?: (event: { target: YTPlayer; data: number }) => void;
        /** data: 2 id inválido · 5 error HTML5 · 100 no existe · 101/150 embedding bloqueado */
        onError?: (event: { target: YTPlayer; data: number }) => void;
      };
    },
  ) => YTPlayer;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Adapta un <video> (clip propio) a la interfaz del player de YouTube, para
 * que la TV mezcle clips y videos de YouTube con el mismo código.
 */
export function clipPlayer(el: HTMLVideoElement): YTPlayer {
  let currentSrc = "";
  const load = (arg: YTLoadArg, autoplay: boolean) => {
    const src = typeof arg === "string" ? arg : arg.videoId;
    const startSeconds = typeof arg === "string" ? 0 : (arg.startSeconds ?? 0);
    if (currentSrc !== src) {
      currentSrc = src;
      el.src = src;
      el.load();
    }
    // el offset de inicio: aplícalo cuando el <video> ya sepa su duración
    if (startSeconds > 0) {
      const seek = () => {
        el.currentTime = startSeconds;
      };
      if (el.readyState >= 1) seek();
      else el.addEventListener("loadedmetadata", seek, { once: true });
    }
    if (autoplay) void el.play().catch(() => {});
  };
  return {
    // el "videoId" de un clip es su URL
    loadVideoById: (arg) => load(arg, true),
    cueVideoById: (arg) => load(arg, false),
    playVideo: () => void el.play().catch(() => {}),
    pauseVideo: () => el.pause(),
    seekTo: (seconds) => {
      if (Number.isFinite(seconds)) el.currentTime = Math.max(0, seconds);
    },
    setVolume: (volume) => {
      el.volume = Math.min(1, Math.max(0, volume / 100));
    },
    getCurrentTime: () => el.currentTime || 0,
    getDuration: () => (Number.isFinite(el.duration) ? el.duration : 0),
    setPlaybackRate: (rate) => {
      el.playbackRate = rate;
    },
    mute: () => {
      el.muted = true;
    },
    unMute: () => {
      el.muted = false;
    },
    destroy: () => {
      el.pause();
      el.removeAttribute("src");
      el.load();
    },
  };
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("solo disponible en el cliente"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise<YTNamespace>((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT as YTNamespace);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}
