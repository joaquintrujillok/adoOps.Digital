import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Controller from "@/components/mixer/Controller";
import { normalizeRoomCode } from "@/lib/mix-types";

type Props = { params: Promise<{ room: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { room } = await params;
  const code = normalizeRoomCode(room);
  return {
    title: `Consola ${code ?? ""} — TV Mix | adoOps`,
    robots: { index: false },
  };
}

export default async function MixRoomPage({ params }: Props) {
  const { room } = await params;
  const code = normalizeRoomCode(room);
  if (!code) redirect("/mix");
  return <Controller room={code} />;
}
