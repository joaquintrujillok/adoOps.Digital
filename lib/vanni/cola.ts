import { headers } from "next/headers";

/**
 * Pide al endpoint de la cola que siga enviando. Se llama por HTTP y no en el
 * mismo proceso para que cada tramo de envío tenga su propia función con su
 * propio límite de tiempo. El origen sale de la petición actual: en local
 * apunta al servidor local y en Vercel al despliegue, nunca a otro ambiente.
 */
export async function origenActual(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function dispararCola(origen: string): Promise<void> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return;
  try {
    await fetch(`${origen}/api/vanni/cron`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secreto}` },
      // No se espera a que termine: basta con que arranque.
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // El timeout de 2 s es esperable: la cola sigue corriendo del otro lado.
  }
}
