/**
 * TV Mix — wrappers de la YouTube Data API v3.
 *
 * Todas las funciones aceptan credenciales flexibles: el access token OAuth
 * del usuario (biblioteca personal + búsqueda) o la API key del sitio
 * (YOUTUBE_API_KEY, búsqueda y playlists públicas sin conectar cuenta).
 */

const API = "https://www.googleapis.com/youtube/v3";

export type YtAuth = { accessToken?: string | null; apiKey?: string | null };

export type YtVideo = {
  videoId: string;
  title: string;
  channel: string;
  /** duración en segundos (0 si desconocida) */
  duration: number;
  /** false = el dueño bloqueó la reproducción embebida (solo sirve en YouTube) */
  embeddable: boolean;
  /** reproducciones (0 si el canal las oculta) */
  views: number;
  /** me gusta (0 si el canal los oculta) */
  likes: number;
  /** true = el video no se puede ver en el país del usuario */
  blockedInRegion: boolean;
};

export type YtPlaylist = {
  id: string;
  title: string;
  itemCount: number;
  thumb: string | null;
};

export type YtPage<T> = { items: T[]; nextPage: string | null };

/** ID de la pseudo-playlist "Tus Me gusta" (videos.list myRating=like). */
export const LIKES_PLAYLIST_ID = "__likes__";

export function searchConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

class YtApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function ytFetch<T>(
  auth: YtAuth,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const search = new URLSearchParams(params);
  const headers: Record<string, string> = {};
  if (auth.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`;
  else if (auth.apiKey) search.set("key", auth.apiKey);
  else throw new YtApiError(401, "sin credenciales para la YouTube API");

  const res = await fetch(`${API}/${path}?${search}`, { headers });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) detail = body.error.message;
    } catch {
      // cuerpo no-JSON
    }
    throw new YtApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export function isQuotaOrAuthError(error: unknown): number | null {
  return error instanceof YtApiError ? error.status : null;
}

/** Convierte una duración ISO 8601 (PT1H2M3S) a segundos. */
export function parseIsoDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

type VideoListResponse = {
  items?: {
    id: string;
    snippet?: { title?: string; channelTitle?: string };
    contentDetails?: {
      duration?: string;
      regionRestriction?: { allowed?: string[]; blocked?: string[] };
    };
    status?: { embeddable?: boolean };
    statistics?: { viewCount?: string; likeCount?: string };
  }[];
  nextPageToken?: string;
};

/** true si la restricción por país del video excluye a `region`. */
function isBlockedInRegion(
  rr: { allowed?: string[]; blocked?: string[] } | undefined,
  region: string | null,
): boolean {
  if (!rr || !region) return false;
  if (rr.allowed) return !rr.allowed.includes(region);
  if (rr.blocked) return rr.blocked.includes(region);
  return false;
}

function toYtVideo(
  item: NonNullable<VideoListResponse["items"]>[number],
  region: string | null,
): YtVideo {
  return {
    videoId: item.id,
    title: item.snippet?.title ?? item.id,
    channel: item.snippet?.channelTitle ?? "",
    duration: parseIsoDuration(item.contentDetails?.duration),
    embeddable: item.status?.embeddable !== false,
    views: Number(item.statistics?.viewCount ?? 0) || 0,
    likes: Number(item.statistics?.likeCount ?? 0) || 0,
    blockedInRegion: isBlockedInRegion(item.contentDetails?.regionRestriction, region),
  };
}

/** Duraciones, stats y metadatos de un lote de IDs vía videos.list. */
async function hydrateVideos(
  auth: YtAuth,
  ids: string[],
  region: string | null,
): Promise<Map<string, YtVideo>> {
  const map = new Map<string, YtVideo>();
  if (!ids.length) return map;
  const data = await ytFetch<VideoListResponse>(auth, "videos", {
    part: "snippet,contentDetails,status,statistics",
    id: ids.join(","),
    maxResults: String(ids.length),
  });
  for (const item of data.items ?? []) {
    map.set(item.id, toYtVideo(item, region));
  }
  return map;
}

type SearchResponse = {
  items?: {
    id?: { kind?: string; videoId?: string; playlistId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: { medium?: { url?: string } };
    };
  }[];
};

export type YtSearchResults = { videos: YtVideo[]; playlists: YtPlaylist[] };

/**
 * Búsqueda mixta de videos y playlists. El filtro `videoEmbeddable` de la API
 * no es compatible con `type=playlist`, así que los videos con embedding
 * bloqueado vienen igual — se marcan con `embeddable: false` vía videos.list.
 */
export async function searchAll(
  auth: YtAuth,
  query: string,
  region: string | null,
): Promise<YtSearchResults> {
  const data = await ytFetch<SearchResponse>(auth, "search", {
    part: "snippet",
    q: query,
    type: "video,playlist",
    maxResults: "16",
    safeSearch: "none",
    // prioriza resultados visibles en el país del usuario
    ...(region ? { regionCode: region } : {}),
  });
  const items = data.items ?? [];

  const videoIds = items
    .map((item) => (item.id?.kind === "youtube#video" ? item.id.videoId : null))
    .filter((id): id is string => !!id);
  const hydrated = await hydrateVideos(auth, videoIds, region);

  const playlistIds = items
    .map((item) => (item.id?.kind === "youtube#playlist" ? item.id.playlistId : null))
    .filter((id): id is string => !!id);
  const counts = await hydratePlaylistCounts(auth, playlistIds);

  const playlists = items
    .filter((item) => item.id?.kind === "youtube#playlist" && item.id.playlistId)
    .map((item) => ({
      id: item.id!.playlistId!,
      title: item.snippet?.title ?? "",
      itemCount: counts.get(item.id!.playlistId!) ?? 0,
      thumb: item.snippet?.thumbnails?.medium?.url ?? null,
    }));

  return {
    videos: videoIds.map((id) => hydrated.get(id)).filter((v): v is YtVideo => !!v),
    playlists,
  };
}

type PlaylistCountResponse = {
  items?: { id: string; contentDetails?: { itemCount?: number } }[];
};

/** Cantidad de videos por playlist (playlists.list cuesta 1 unidad). */
async function hydratePlaylistCounts(
  auth: YtAuth,
  ids: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ids.length) return map;
  try {
    const data = await ytFetch<PlaylistCountResponse>(auth, "playlists", {
      part: "contentDetails",
      id: ids.join(","),
      maxResults: String(ids.length),
    });
    for (const item of data.items ?? []) {
      map.set(item.id, item.contentDetails?.itemCount ?? 0);
    }
  } catch {
    // sin conteo no se pierde nada
  }
  return map;
}

type PlaylistListResponse = {
  items?: {
    id: string;
    snippet?: { title?: string; thumbnails?: { medium?: { url?: string } } };
    contentDetails?: { itemCount?: number };
  }[];
  nextPageToken?: string;
};

/** Playlists del usuario conectado (incluye las creadas en YouTube Music). */
export async function listMyPlaylists(accessToken: string): Promise<YtPlaylist[]> {
  const data = await ytFetch<PlaylistListResponse>(
    { accessToken },
    "playlists",
    { part: "snippet,contentDetails", mine: "true", maxResults: "50" },
  );
  return (data.items ?? []).map((item) => ({
    id: item.id,
    title: item.snippet?.title ?? item.id,
    itemCount: item.contentDetails?.itemCount ?? 0,
    thumb: item.snippet?.thumbnails?.medium?.url ?? null,
  }));
}

type PlaylistItemsResponse = {
  items?: { contentDetails?: { videoId?: string } }[];
  nextPageToken?: string;
};

export async function listPlaylistItems(
  auth: YtAuth,
  playlistId: string,
  region: string | null,
  pageToken?: string,
): Promise<YtPage<YtVideo>> {
  const params: Record<string, string> = {
    part: "contentDetails",
    playlistId,
    maxResults: "25",
  };
  if (pageToken) params.pageToken = pageToken;
  const data = await ytFetch<PlaylistItemsResponse>(auth, "playlistItems", params);
  const ids = (data.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => !!id);
  const hydrated = await hydrateVideos(auth, ids, region);
  return {
    // videos privados/eliminados no vienen en videos.list → quedan fuera solos
    items: ids.map((id) => hydrated.get(id)).filter((v): v is YtVideo => !!v),
    nextPage: data.nextPageToken ?? null,
  };
}

/** "Tus Me gusta" del usuario conectado (forma oficial: myRating=like). */
export async function listLikedVideos(
  accessToken: string,
  region: string | null,
  pageToken?: string,
): Promise<YtPage<YtVideo>> {
  const params: Record<string, string> = {
    part: "snippet,contentDetails,status,statistics",
    myRating: "like",
    maxResults: "25",
  };
  if (pageToken) params.pageToken = pageToken;
  const data = await ytFetch<VideoListResponse>({ accessToken }, "videos", params);
  return {
    items: (data.items ?? []).map((item) => toYtVideo(item, region)),
    nextPage: data.nextPageToken ?? null,
  };
}
