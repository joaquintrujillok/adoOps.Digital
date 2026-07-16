"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Host actual (ej. "adoops.digital"), seguro para SSR: en el servidor y
 * durante la hidratación devuelve "" y luego el valor real del navegador.
 */
export function useHost(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.host,
    () => "",
  );
}
