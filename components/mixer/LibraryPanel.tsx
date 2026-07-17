"use client";

/**
 * TV Mix — biblioteca visual: busca videos y navega tus playlists de
 * YouTube / YouTube Music (cuenta conectada por OAuth) sin pegar URLs.
 * Todo se carga a los decks con un toque.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { formatTime, thumbnailUrl, type DeckId } from "@/lib/mix-types";

type Video = {
  videoId: string;
  title: string;
  channel: string;
  duration: number;
  /** false = el dueño bloqueó la reproducción embebida (solo sirve en YouTube) */
  embeddable?: boolean;
  views?: number;
  likes?: number;
};
type Playlist = { id: string; title: string; itemCount: number; thumb: string | null };

/** 1234567 → "1,2 M" */
const compact = (n: number) =>
  new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(n);
type AuthStatus = { oauthConfigured: boolean; connected: boolean; searchAvailable: boolean };

const LIKES_ID = "__likes__";

type Props = {
  room: string;
  onLoad: (deck: DeckId, videoId: string, title: string) => void;
};

const emptySubscribe = () => () => {};

export default function LibraryPanel({ room, onLoad }: Props) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [tab, setTab] = useState<"search" | "library">("search");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Video[]>([]);
  const [resultLists, setResultLists] = useState<Playlist[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [active, setActive] = useState<{
    id: string;
    title: string;
    from: "search" | "library";
  } | null>(null);
  const [items, setItems] = useState<Video[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  // Resultado del redirect OAuth (?yt=ok|error), sin romper la hidratación.
  const ytParam = useSyncExternalStore(
    emptySubscribe,
    () => new URLSearchParams(window.location.search).get("yt"),
    () => null,
  );
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/mix/auth/status", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as AuthStatus);
    } catch {
      // sin red: el panel queda en modo básico
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mix/auth/status", { cache: "no-store" });
        if (res.ok && !cancelled) setStatus((await res.json()) as AuthStatus);
      } catch {
        // sin red: el panel queda en modo básico
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissNotice = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("yt");
    window.history.replaceState(null, "", url);
    setNoticeDismissed(true);
  };

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/mix/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as {
        items?: Video[];
        playlists?: Playlist[];
        error?: string;
      };
      if (!res.ok) {
        setSearchError(data.error ?? "falló la búsqueda");
        return;
      }
      setResults(data.items ?? []);
      setResultLists(data.playlists ?? []);
    } catch {
      setSearchError("falló la búsqueda");
    } finally {
      setSearching(false);
    }
  }, [query, searching]);

  const loadPlaylists = useCallback(async () => {
    setPlaylistsError(null);
    setLoadingPlaylists(true);
    try {
      const res = await fetch("/api/mix/library/playlists", { cache: "no-store" });
      const data = (await res.json()) as { playlists?: Playlist[]; error?: string };
      if (!res.ok) {
        setPlaylistsError(data.error ?? "no se pudieron cargar tus playlists");
        return;
      }
      setPlaylists(data.playlists ?? []);
    } catch {
      setPlaylistsError("no se pudieron cargar tus playlists");
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  /** Al entrar al tab "Mi música" (gesto del usuario) se cargan las playlists. */
  const openLibraryTab = useCallback(() => {
    setTab("library");
    if (status?.connected && playlists === null && !loadingPlaylists) {
      loadPlaylists();
    }
  }, [status?.connected, playlists, loadingPlaylists, loadPlaylists]);

  const openPlaylist = useCallback(async (
    id: string,
    title: string,
    page?: string,
    from: "search" | "library" = "library",
  ) => {
    setActive({ id, title, from });
    if (from === "search") setTab("library");
    setLoadingItems(true);
    setItemsError(null);
    if (!page) {
      setItems([]);
      setNextPage(null);
    }
    try {
      const params = new URLSearchParams({ id });
      if (page) params.set("page", page);
      const res = await fetch(`/api/mix/library/playlist?${params}`, { cache: "no-store" });
      const data = (await res.json()) as {
        items?: Video[];
        nextPage?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setItemsError(data.error ?? "no se pudo leer la playlist");
        return;
      }
      setItems((prev) => (page ? [...prev, ...(data.items ?? [])] : (data.items ?? [])));
      setNextPage(data.nextPage ?? null);
    } catch {
      setItemsError("no se pudo leer la playlist");
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await fetch("/api/mix/auth/logout", { method: "POST" });
    } catch {
      // igual refrescamos el estado
    }
    setPlaylists(null);
    setActive(null);
    setItems([]);
    refreshStatus();
  }, [refreshStatus]);

  const videoRow = (video: Video) => (
    <li
      key={video.videoId}
      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
      <img
        src={thumbnailUrl(video.videoId)}
        alt=""
        className="h-12 w-20 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-100">{video.title}</p>
        <p className="truncate text-xs text-zinc-500">
          {video.channel}
          {video.duration > 0 && ` · ${formatTime(video.duration)}`}
          {(video.views ?? 0) > 0 && ` · ${compact(video.views!)} vistas`}
          {(video.likes ?? 0) > 0 && ` · 👍 ${compact(video.likes!)}`}
        </p>
        {video.embeddable === false && (
          <p className="mt-0.5 text-[10px] font-semibold text-amber-400">
            🚫 Solo en YouTube — su dueño bloqueó reproducirlo fuera
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onLoad("a", video.videoId, video.title)}
          disabled={video.embeddable === false}
          className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-30"
        >
          → A
        </button>
        <button
          onClick={() => onLoad("b", video.videoId, video.title)}
          disabled={video.embeddable === false}
          className="rounded-md bg-fuchsia-500/15 px-3 py-2 text-xs font-bold text-fuchsia-300 transition hover:bg-fuchsia-500/30 disabled:opacity-30"
        >
          → B
        </button>
      </div>
    </li>
  );

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-zinc-800 p-1">
          <button
            onClick={() => setTab("search")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "search" ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            🔍 Buscar
          </button>
          <button
            onClick={openLibraryTab}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "library" ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            ♪ Mi música
          </button>
        </div>

        {status?.connected ? (
          <button
            onClick={disconnect}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Desconectar YouTube
          </button>
        ) : status?.oauthConfigured ? (
          <a
            href={`/api/mix/auth/login?room=${room}`}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500"
          >
            ▶ Conectar YouTube
          </a>
        ) : null}
      </div>

      {ytParam && !noticeDismissed && (
        <div
          className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
            ytParam === "ok"
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-red-500/10 text-red-300"
          }`}
        >
          <span>
            {ytParam === "ok"
              ? "✔ Cuenta de YouTube conectada"
              : "No se pudo conectar la cuenta de YouTube"}
          </span>
          <button onClick={dismissNotice} className="ml-3 opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {tab === "search" && (
        <>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Busca un tema, artista o video…"
              className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
            />
            <button
              onClick={search}
              disabled={searching || !query.trim()}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
            >
              {searching ? "…" : "Buscar"}
            </button>
          </div>
          {searchError && <p className="mt-2 text-xs text-red-400">{searchError}</p>}
          {status && !status.searchAvailable && (
            <p className="mt-2 text-xs text-zinc-500">
              Para buscar sin pegar URLs: conecta tu YouTube
              {status.oauthConfigured ? "" : " (falta configurar GOOGLE_CLIENT_ID)"} o
              configura YOUTUBE_API_KEY.
            </p>
          )}
          {!!resultLists.length && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {resultLists.map((playlist) => (
                <li key={playlist.id}>
                  <button
                    onClick={() => openPlaylist(playlist.id, playlist.title, undefined, "search")}
                    className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-left transition hover:border-zinc-600"
                  >
                    {playlist.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                      <img
                        src={playlist.thumb}
                        alt=""
                        className="h-12 w-20 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl">
                        ▤
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-100">
                        ▤ {playlist.title}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Playlist{playlist.itemCount > 0 && ` · ${playlist.itemCount} videos`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!!results.length && (
            <ul className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
              {results.map(videoRow)}
            </ul>
          )}
        </>
      )}

      {tab === "library" && (
        <>
          {active ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => {
                    setActive(null);
                    if (active.from === "search") setTab("search");
                  }}
                  className="rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
                >
                  {active.from === "search" ? "← Resultados" : "← Playlists"}
                </button>
                <p className="truncate text-sm font-semibold text-zinc-200">{active.title}</p>
              </div>
              {itemsError && <p className="mb-2 text-xs text-red-400">{itemsError}</p>}
              <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                {items.map(videoRow)}
              </ul>
              {loadingItems && <p className="mt-2 text-xs text-zinc-500">Cargando…</p>}
              {nextPage && !loadingItems && (
                <button
                  onClick={() => openPlaylist(active.id, active.title, nextPage, active.from)}
                  className="mt-2 w-full rounded-lg bg-zinc-800 py-2 text-xs text-zinc-300 transition hover:bg-zinc-700"
                >
                  Cargar más
                </button>
              )}
            </>
          ) : !status?.connected ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="max-w-sm text-sm text-zinc-400">
                Conecta tu cuenta de YouTube para ver tus playlists de YouTube Music y
                tus &quot;Me gusta&quot;, y cargarlos a los decks con un toque.
              </p>
              {status?.oauthConfigured ? (
                <a
                  href={`/api/mix/auth/login?room=${room}`}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  ▶ Conectar YouTube
                </a>
              ) : (
                <p className="text-xs text-zinc-600">
                  (Requiere configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET — ver
                  docs/tv-mix.md)
                </p>
              )}
            </div>
          ) : (
            <>
              {playlistsError && <p className="mb-2 text-xs text-red-400">{playlistsError}</p>}
              <ul className="grid gap-2 sm:grid-cols-2">
                <li>
                  <button
                    onClick={() => openPlaylist(LIKES_ID, "Tus Me gusta")}
                    className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-left transition hover:border-zinc-600"
                  >
                    <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-xl">
                      ❤
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-100">Tus Me gusta</span>
                      <span className="text-xs text-zinc-500">YouTube / YT Music</span>
                    </span>
                  </button>
                </li>
                {(playlists ?? []).map((playlist) => (
                  <li key={playlist.id}>
                    <button
                      onClick={() => openPlaylist(playlist.id, playlist.title)}
                      className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-left transition hover:border-zinc-600"
                    >
                      {playlist.thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                        <img
                          src={playlist.thumb}
                          alt=""
                          className="h-12 w-20 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xl">
                          ♪
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-zinc-100">
                          {playlist.title}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {playlist.itemCount} videos
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {loadingPlaylists && (
                <p className="mt-2 text-xs text-zinc-500">Cargando playlists…</p>
              )}
              {playlists === null && !loadingPlaylists && !playlistsError && (
                <button
                  onClick={loadPlaylists}
                  className="mt-2 w-full rounded-lg bg-zinc-800 py-2 text-xs text-zinc-300 transition hover:bg-zinc-700"
                >
                  Cargar mis playlists
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
