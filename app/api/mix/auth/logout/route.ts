import { NextResponse } from "next/server";
import { YT_COOKIE } from "@/lib/mix-auth";

export const runtime = "nodejs";

/** POST /api/mix/auth/logout — desconecta la cuenta de YouTube (borra la cookie). */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(YT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
