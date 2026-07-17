import { NextResponse } from "next/server";
import { getRoom, patchRoom, saveProgress } from "@/lib/mix-store";
import {
  normalizeRoomCode,
  type DeckProgress,
  type RoomPatch,
  type RoomProgress,
} from "@/lib/mix-types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ room: string }> };

/**
 * GET /api/mix/[room]?v=N
 * Devuelve el snapshot de la sala (la crea si no existe). Si `v` coincide con
 * la versión actual responde liviano — solo `progress`, que cambia sin
 * incrementar la versión.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { room } = await params;
  const code = normalizeRoomCode(room);
  if (!code) {
    return NextResponse.json({ error: "código de sala inválido" }, { status: 400 });
  }

  const snapshot = await getRoom(code);
  const since = new URL(req.url).searchParams.get("v");
  if (since !== null && Number(since) === snapshot.version) {
    return NextResponse.json({
      version: snapshot.version,
      unchanged: true,
      progress: snapshot.progress,
    });
  }
  return NextResponse.json(snapshot);
}

type PostBody = {
  patch?: RoomPatch;
  progress?: { decks?: { a?: DeckProgress | null; b?: DeckProgress | null } };
};

/**
 * POST /api/mix/[room]
 * `{ patch }`    → la consola actualiza el estado (versionado).
 * `{ progress }` → la TV reporta tiempos de reproducción (sin versionar).
 */
export async function POST(req: Request, { params }: Ctx) {
  const { room } = await params;
  const code = normalizeRoomCode(room);
  if (!code) {
    return NextResponse.json({ error: "código de sala inválido" }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  if (body.patch && typeof body.patch === "object") {
    const snapshot = await patchRoom(code, body.patch);
    return NextResponse.json(snapshot);
  }

  if (body.progress && typeof body.progress === "object") {
    const progress: RoomProgress = {
      decks: {
        a: sanitizeProgress(body.progress.decks?.a),
        b: sanitizeProgress(body.progress.decks?.b),
      },
      at: Date.now(),
    };
    await saveProgress(code, progress);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "se espera { patch } o { progress }" }, { status: 400 });
}

/** Códigos de onError del player de YouTube que la TV puede reportar. */
const PLAYER_ERROR_CODES = [2, 5, 100, 101, 150];

function sanitizeProgress(input: DeckProgress | null | undefined): DeckProgress | null {
  if (!input || typeof input.t !== "number" || typeof input.d !== "number") return null;
  return {
    t: Math.max(0, input.t),
    d: Math.max(0, input.d),
    ...(typeof input.err === "number" && PLAYER_ERROR_CODES.includes(input.err)
      ? { err: input.err }
      : {}),
  };
}
