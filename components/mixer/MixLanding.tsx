"use client";

/** TV Mix — portada: crear una sala nueva o unirse a una existente. */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { makeRoomCode, normalizeRoomCode } from "@/lib/mix-types";

export default function MixLanding() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);

  const createRoom = () => {
    router.push(`/mix/${makeRoomCode()}`);
  };

  const joinRoom = () => {
    const code = normalizeRoomCode(joinCode);
    if (!code) {
      setJoinError("El código tiene 3 a 8 letras y números");
      return;
    }
    router.push(`/mix/${code}`);
  };

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-zinc-950 px-6 py-16 text-zinc-100"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <header className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">
          adoOps · experimento
        </p>
        <h1
          className="mt-2 text-5xl font-bold"
          style={{ fontFamily: "var(--font-sora), sans-serif" }}
        >
          TV Mix
        </h1>
        <p className="mx-auto mt-3 max-w-md text-zinc-400">
          Mezcla videos de YouTube desde tu celular o computador, con el video
          sincronizado en tu televisor.
        </p>
      </header>

      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Crear sala</h2>
          <p className="text-center text-sm text-zinc-500">
            Genera un código nuevo y abre la consola.
          </p>
          <button
            onClick={createRoom}
            className="rounded-full bg-emerald-500 px-8 py-3 font-semibold text-black transition hover:bg-emerald-400"
          >
            ▶ Crear sala
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
          <h2 className="text-lg font-semibold">Unirse a una sala</h2>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
            placeholder="CÓDIGO"
            maxLength={8}
            className="w-32 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-lg tracking-[0.3em] text-zinc-100 placeholder:tracking-normal placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
          />
          {joinError && <p className="text-xs text-red-400">{joinError}</p>}
          <button
            onClick={joinRoom}
            className="rounded-full bg-zinc-100 px-8 py-3 font-semibold text-zinc-950 transition hover:bg-white"
          >
            Entrar
          </button>
        </div>
      </div>

      <ol className="flex max-w-2xl flex-col gap-2 text-sm text-zinc-400">
        <li>
          <span className="font-semibold text-zinc-200">1.</span> Crea una sala —
          obtienes un código, por ejemplo <span className="text-emerald-400">XK42</span>.
        </li>
        <li>
          <span className="font-semibold text-zinc-200">2.</span> En el navegador del
          televisor abre <span className="text-zinc-200">adoops.digital/tv/CÓDIGO</span>{" "}
          (o castea esa pestaña desde Chrome con &quot;Enviar&quot;).
        </li>
        <li>
          <span className="font-semibold text-zinc-200">3.</span> Desde la consola carga
          videos de YouTube en los decks y mezcla con el crossfader: el video y el audio
          salen por la TV.
        </li>
      </ol>
    </div>
  );
}
