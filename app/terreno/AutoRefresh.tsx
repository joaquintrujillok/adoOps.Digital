"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Refresca el server component cada `seconds` para ver reportes nuevos en vivo. */
export default function AutoRefresh({ seconds = 8 }: { seconds?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);

  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [on, seconds, router]);

  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
    >
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-emerald-500 animate-pulse-dot" : "bg-slate-300"}`}
      />
      {on ? "En vivo" : "Pausado"}
    </button>
  );
}
