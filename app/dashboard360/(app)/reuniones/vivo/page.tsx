// Escucha en vivo — prueba de humo.
//
// No es todavía el copiloto de reuniones: es el instrumento que decide si el
// copiloto se puede construir. Tres preguntas que no se contestan desde un
// escritorio, y esta pantalla las contesta en cinco minutos con una reunión de
// verdad:
//
//   1. ¿Esta cuenta de OpenAI tiene habilitada la Realtime API?
//   2. ¿Cuánta latencia hay entre hablar y ver el texto?
//   3. ¿El micrófono del Mac capta a la otra persona saliendo por el parlante,
//      con calidad suficiente para transcribir?
//
// La tercera es la que manda. Si la respuesta es no, todo el diseño de captura
// acústica —celular, ESP32, el micrófono del propio Mac— se cae junto, y hay que
// volver a capturar el audio de la pestaña.

import { Card, PageHeader } from "@/components/dashboard360/ui";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import EscuchaVivo from "./EscuchaVivo";

export const dynamic = "force-dynamic";

export default async function VivoPage() {
  await requireSession();

  return (
    <>
      <PageHeader
        titulo="Escucha en vivo"
        bajada="Prueba de humo: transcripción en tiempo real desde el micrófono. Todavía no construye contexto ni sugiere preguntas."
      />

      <Card className="mb-4" titulo="Cómo probarla bien">
        <ol className="ml-4 list-decimal space-y-1.5 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
          <li>
            <strong>Sin audífonos.</strong> Esto escucha la sala: tu voz directo y
            la de los demás saliendo por el parlante del Mac. Con audífonos, la
            otra persona no llega a ningún micrófono y se transcribe media
            conversación.
          </li>
          <li>Subí el volumen del parlante más de lo habitual.</li>
          <li>
            Apretá empezar <em>antes</em> de que hablen, y fijate cuánto tarda en
            aparecer el texto.
          </li>
          <li>
            Mirá el panel de eventos: si algo falla, la respuesta está ahí y no en
            un mensaje genérico.
          </li>
        </ol>
      </Card>

      <EscuchaVivo />

      <Card className="mt-4" titulo="Qué se pierde por escuchar la sala en vez de la pestaña">
        <ul className="ml-4 list-disc space-y-1.5 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
          <li>
            <strong>Quién dijo qué.</strong> Todo entra por un solo micrófono, así
            que el transcript en vivo es una sola voz corrida. Para construir
            contexto y sugerir preguntas alcanza; para un acta, no.
          </li>
          <li>
            <strong>Calidad.</strong> El parlante manda el sonido al aire y el aire
            se lo devuelve al micrófono con la reverberación de la pieza. Es peor
            que tomar el audio digital de la pestaña, y cuánto peor solo se sabe
            probándolo.
          </li>
          <li>
            <strong>Cuesta plata mientras está abierta.</strong> US$0,017 por
            minuto, unos US$1 la hora. Cien veces el carril de los subtítulos. El
            contador de arriba lo muestra en vivo por eso.
          </li>
        </ul>
      </Card>
    </>
  );
}
