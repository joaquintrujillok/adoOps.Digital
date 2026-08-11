// La lectura de negocio de cada pantalla, redactada por el asistente.
//
// Vive en su propio componente async para poder envolverlo en <Suspense>: así
// la página se pinta con todas sus cifras de inmediato (~430 ms) y el párrafo
// aparece cuando el modelo responde, en vez de dejar la pantalla en blanco
// mientras tanto. Con el caché caliente llega junto con el resto.

import { Lectura } from "./ui";
import { narrar } from "@/lib/crm/narrador";

export async function LecturaNarrada({
  resumen,
  contexto,
  respaldo,
  clave,
  titulo,
  extra,
  abierto,
}: {
  resumen: Record<string, unknown>;
  contexto: string;
  respaldo: string;
  /** Identifica la pantalla en el caché de narraciones. */
  clave: string;
  titulo?: string;
  /** Contenido fijo que se agrega bajo el párrafo (avisos calculados). */
  extra?: React.ReactNode;
  /**
   * Desplegada de entrada. Se usa donde la lectura ES la pantalla —el reporte
   * del trimestre— y no un acompañamiento de las cifras. También es lo que hace
   * que el párrafo entero salga al imprimir: un `<details>` cerrado imprime solo
   * su resumen.
   */
  abierto?: boolean;
}) {
  const narracion = await narrar(resumen, contexto, respaldo, clave);

  return (
    <Lectura
      titulo={titulo}
      resumen={primeraFrase(narracion.texto)}
      abierto={abierto}
      fuente={
        narracion.origen === "ia"
          ? "Redactado por el asistente sobre cifras calculadas por el CRM."
          : "Redactado con plantilla sobre cifras calculadas por el CRM."
      }
    >
      <p>{narracion.texto}</p>
      {extra}
    </Lectura>
  );
}

/**
 * La primera frase, para la línea que se ve sin desplegar.
 *
 * Corta en el punto y no a los N caracteres: el narrador escribe la conclusión
 * en la primera oración —así se le pide— y cortarla a la mitad convierte el
 * titular en un balbuceo. Si la primera frase igual es larguísima, el truncado
 * del CSS la corta con puntos suspensivos.
 */
function primeraFrase(texto: string): string {
  const corte = texto.search(/\.\s/);
  return corte > 0 ? texto.slice(0, corte + 1) : texto;
}

/**
 * Lo que se ve mientras el asistente escribe.
 *
 * Ocupa exactamente el alto de la lectura ya plegada —una línea— para que la
 * pantalla no dé un salto cuando el párrafo llega. Antes era un esqueleto de
 * tres renglones, y tenía sentido cuando la lectura venía abierta.
 */
export function LecturaEsqueleto({ titulo = "Qué dice esto" }: { titulo?: string }) {
  return (
    <div className="crm-no-print rounded-xl border border-[var(--crm-border)] bg-[var(--crm-brand-soft)] px-5 py-3">
      <div className="flex items-baseline gap-2" aria-live="polite" aria-busy="true">
        <span aria-hidden className="shrink-0 text-[10px] text-[var(--crm-brand-dark)]">
          ▶
        </span>
        <span className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-[var(--crm-brand-dark)]">
          {titulo}
        </span>
        <span className="h-3 min-w-0 flex-1 animate-pulse rounded bg-[#cfe8d9]" />
      </div>
    </div>
  );
}
