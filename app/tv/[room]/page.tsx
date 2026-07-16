import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TvScreen from "@/components/mixer/TvScreen";
import { normalizeRoomCode } from "@/lib/mix-types";

type Props = { params: Promise<{ room: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { room } = await params;
  const code = normalizeRoomCode(room);
  return {
    title: `TV ${code ?? ""} — TV Mix | adoOps`,
    robots: { index: false },
  };
}

export default async function TvRoomPage({ params }: Props) {
  const { room } = await params;
  const code = normalizeRoomCode(room);
  if (!code) redirect("/mix");
  return <TvScreen room={code} />;
}
