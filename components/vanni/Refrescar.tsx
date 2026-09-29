"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresca los datos del servidor cada `segundos` mientras esté montado. */
export default function Refrescar({ segundos = 10 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
