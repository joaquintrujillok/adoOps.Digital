// Escucha en vivo — el copiloto de reunión.
//
// Tres paneles: la transcripción a la izquierda, el contexto que se construye
// solo arriba a la derecha, y debajo las preguntas que convendría hacer ahora.
//
// La prueba de humo que fue esta pantalla ya se pasó: la Realtime API responde,
// el micrófono capta la sala y el texto llega en menos de un segundo. Lo que
// falta por medir es lo que ninguna prueba corta puede decir — si las preguntas
// sirven de verdad en una reunión real, que es otra cosa que si el sistema
// funciona.

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
        bajada="Transcribe la reunión mientras ocurre, arma el contexto solo y sugiere qué preguntar. Cuesta ~US$1 la hora."
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

      <Card className="mt-4" titulo="Los límites de este carril">
        <ul className="ml-4 list-disc space-y-1.5 text-[13px] leading-relaxed text-[var(--d360-ink-2)]">
          <li>
            <strong>Quién dijo qué se pierde.</strong> Todo entra por un solo
            micrófono, así que el transcript es una sola voz corrida. Para armar
            contexto y sugerir preguntas alcanza; para un acta, no — para eso está
            el carril de los subtítulos, y los dos pueden convivir.
          </li>
          <li>
            <strong>El contexto va 20 segundos atrás, y es a propósito.</strong> Un
            modelo razonando sobre cada palabra devolvería un panel que cambia cada
            dos segundos, ilegible justo cuando hay que mirarlo de reojo mientras
            uno habla.
          </li>
          <li>
            <strong>Cuesta mientras está abierta.</strong> US$0,017 el minuto de
            transcripción más unos diez centavos por hora de razonamiento: cerca de
            US$1,10 la hora, cien veces el carril de los subtítulos. Por eso el
            contador está arriba y no al final.
          </li>
        </ul>
      </Card>
    </>
  );
}
